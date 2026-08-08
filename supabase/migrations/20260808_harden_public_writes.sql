-- Public clients use the Supabase anonymous key directly. Keep all validation and
-- throttling in the database so it cannot be bypassed by editing browser code.

insert into public.moderation_terms (term)
values
  ('殺す'),
  ('殺しに行く'),
  ('爆破する'),
  ('爆弾を仕掛け'),
  ('放火する'),
  ('刺しに行く'),
  ('住所晒'),
  ('学籍番号'),
  ('死ね')
on conflict (term) do nothing;

create or replace function public.requires_moderation(content text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.moderation_terms
      where position(lower(term) in lower(content)) > 0
    )
    or content ~* '[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+'
    or content ~ '(0[5789]0|0[1-9][0-9]?)[-‐‑‒–—―ー−]?[0-9]{3,4}[-‐‑‒–—―ー−]?[0-9]{4}';
$$;

revoke all on function public.requires_moderation(text) from public, anon, authenticated;

alter table public.bbs_posts
  drop constraint if exists bbs_posts_course_id_format_check;
alter table public.bbs_posts
  add constraint bbs_posts_course_id_format_check check (
    course_id ~ '^[0-9a-f]{20}$'
    or course_id ~ '^lounge:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  );

alter table public.exam_reports
  drop constraint if exists exam_reports_course_id_format_check;
alter table public.exam_reports
  add constraint exam_reports_course_id_format_check check (
    course_id ~ '^[0-9a-f]{20}$'
  );

alter table public.bbs_reports
  drop constraint if exists bbs_reports_reason_check;
alter table public.bbs_reports
  add constraint bbs_reports_reason_check check (
    reason in ('harassment', 'personal_info', 'threat', 'illegal', 'spam', 'other')
  );

alter table public.exam_report_flags
  drop constraint if exists exam_report_flags_reason_check;
alter table public.exam_report_flags
  add constraint exam_report_flags_reason_check check (
    reason in ('harassment', 'personal_info', 'threat', 'illegal', 'spam', 'other')
  );

create or replace function public.prepare_community_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  lounge_thread_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  new.course_id := lower(btrim(new.course_id));
  new.body := btrim(new.body);

  if new.course_id ~ '^lounge:' then
    begin
      lounge_thread_id := substring(new.course_id from 8)::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid lounge thread';
    end;

    if not exists (
      select 1 from public.lounge_threads
      where id = lounge_thread_id
    ) then
      raise exception 'lounge thread not found';
    end if;
  elsif new.course_id !~ '^[0-9a-f]{20}$' then
    raise exception 'invalid course id';
  end if;

  if (
    select count(*) from public.bbs_posts
    where author_id = current_user_id
      and created_at > now() - interval '1 minute'
  ) >= 3 then
    raise exception '投稿間隔が短すぎます。少し待ってから再度お試しください';
  end if;

  if (
    select count(*) from public.bbs_posts
    where author_id = current_user_id
      and created_at > now() - interval '1 hour'
  ) >= 12 then
    raise exception '1時間あたりの投稿上限に達しました';
  end if;

  if (
    select count(*) from public.bbs_posts
    where author_id = current_user_id
      and created_at > now() - interval '1 day'
  ) >= 40 then
    raise exception '1日あたりの投稿上限に達しました';
  end if;

  new.author_id := current_user_id;
  new.anon_label := '匿名-' || upper(
    substring(
      encode(extensions.digest(current_user_id::text || ':' || new.course_id, 'sha256'), 'hex')
      from 1 for 4
    )
  );
  new.status := case
    when public.requires_moderation(new.body) then 'pending'
    else 'approved'
  end;
  return new;
end;
$$;

create or replace function public.prepare_exam_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  new.course_id := lower(btrim(new.course_id));
  new.body := btrim(new.body);

  if new.course_id !~ '^[0-9a-f]{20}$' then
    raise exception 'invalid course id';
  end if;

  if (
    select count(*) from public.exam_reports
    where author_id = current_user_id
      and created_at > now() - interval '5 minutes'
  ) >= 3 then
    raise exception '投稿間隔が短すぎます。少し待ってから再度お試しください';
  end if;

  if (
    select count(*) from public.exam_reports
    where author_id = current_user_id
      and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception '1日あたりのテスト情報投稿上限に達しました';
  end if;

  new.author_id := current_user_id;
  new.anon_label := '匿名-' || upper(
    substring(
      encode(extensions.digest(current_user_id::text || ':' || new.course_id, 'sha256'), 'hex')
      from 1 for 4
    )
  );
  new.status := case
    when public.requires_moderation(new.body) then 'pending'
    else 'approved'
  end;
  return new;
end;
$$;

create or replace function public.prepare_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if tg_op = 'INSERT' and (
    select count(*) from public.bbs_votes
    where user_id = auth.uid()
      and created_at > now() - interval '1 hour'
  ) >= 120 then
    raise exception '投票回数が多すぎます。しばらく待ってから再度お試しください';
  end if;

  new.user_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if tg_table_name = 'bbs_reports' then
    select count(*) into recent_count from public.bbs_reports
    where user_id = auth.uid() and created_at > now() - interval '1 hour';
  elsif tg_table_name = 'exam_report_flags' then
    select count(*) into recent_count from public.exam_report_flags
    where user_id = auth.uid() and created_at > now() - interval '1 hour';
  else
    raise exception 'unsupported report table';
  end if;

  if recent_count >= 20 then
    raise exception '通報回数が多すぎます。しばらく待ってから再度お試しください';
  end if;

  new.user_id := auth.uid();
  return new;
end;
$$;

create or replace function public.prepare_lounge_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  new.title := btrim(new.title);

  if (
    select count(*) from public.lounge_threads
    where author_id = auth.uid()
      and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'スレッド作成の間隔が短すぎます。少し待ってから再度お試しください';
  end if;

  if (
    select count(*) from public.lounge_threads
    where author_id = auth.uid()
      and created_at > now() - interval '1 day'
  ) >= 8 then
    raise exception '1日あたりのスレッド作成上限に達しました';
  end if;

  new.author_id := auth.uid();
  new.status := case
    when public.requires_moderation(new.title) then 'pending'
    else 'approved'
  end;
  return new;
end;
$$;

create or replace function public.create_lounge_thread(
  p_campus_slug text,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_thread_id uuid;
  clean_title text := btrim(p_title);
  clean_body text := btrim(p_body);
begin
  if char_length(clean_title) not between 1 and 80 then
    raise exception 'タイトルは1文字以上80文字以下で入力してください';
  end if;
  if char_length(clean_body) not between 1 and 1000 then
    raise exception '最初の書き込みは1文字以上1000文字以下で入力してください';
  end if;

  insert into public.lounge_threads (campus_slug, title)
  values (p_campus_slug, clean_title)
  returning id into new_thread_id;

  insert into public.bbs_posts (course_id, body)
  values ('lounge:' || new_thread_id::text, clean_body);

  return new_thread_id;
end;
$$;

revoke all on function public.create_lounge_thread(text, text, text) from public;
grant execute on function public.create_lounge_thread(text, text, text) to authenticated;

-- A dashboard-only moderation view. It is deliberately unavailable to public roles.
create or replace view public.moderation_queue
with (security_invoker = true)
as
select
  p.id as content_id,
  'bbs'::text as content_type,
  p.course_id,
  p.body,
  p.status,
  p.created_at,
  count(r.post_id)::integer as report_count
from public.bbs_posts p
left join public.bbs_reports r on r.post_id = p.id
group by p.id
union all
select
  e.id as content_id,
  'exam'::text as content_type,
  e.course_id,
  e.body,
  e.status,
  e.created_at,
  count(f.exam_report_id)::integer as report_count
from public.exam_reports e
left join public.exam_report_flags f on f.exam_report_id = e.id
group by e.id;

revoke all on public.moderation_queue from anon, authenticated;
