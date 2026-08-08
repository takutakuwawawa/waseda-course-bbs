create table if not exists public.lounge_threads (
  id uuid primary key default gen_random_uuid(),
  campus_slug text not null check (campus_slug in ('waseda', 'toyama', 'tokorozawa')),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  status text not null default 'approved' check (status in ('approved', 'pending', 'hidden')),
  reply_count integer not null default 0 check (reply_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lounge_threads_campus_updated_idx
  on public.lounge_threads (campus_slug, updated_at desc);

alter table public.lounge_threads enable row level security;

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

  if (
    select count(*)
    from public.lounge_threads
    where author_id = auth.uid()
      and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'スレッド作成の間隔が短すぎます。少し待ってから再度お試しください';
  end if;

  new.author_id := auth.uid();
  new.status := case
    when exists (
      select 1
      from public.moderation_terms
      where position(lower(term) in lower(new.title)) > 0
    ) then 'pending'
    else 'approved'
  end;
  return new;
end;
$$;

drop trigger if exists prepare_lounge_thread on public.lounge_threads;
create trigger prepare_lounge_thread
before insert on public.lounge_threads
for each row execute function public.prepare_lounge_thread();

drop policy if exists lounge_threads_read_public on public.lounge_threads;
create policy lounge_threads_read_public
on public.lounge_threads for select
to anon, authenticated
using (status = 'approved');

drop policy if exists lounge_threads_insert_authenticated on public.lounge_threads;
create policy lounge_threads_insert_authenticated
on public.lounge_threads for insert
to authenticated
with check (author_id = auth.uid());

revoke all on public.lounge_threads from anon, authenticated;
grant select (id, campus_slug, title, reply_count, created_at, updated_at)
  on public.lounge_threads to anon, authenticated;
grant insert (campus_slug, title) on public.lounge_threads to authenticated;

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
begin
  if char_length(p_body) not between 1 and 1000 then
    raise exception '最初の書き込みは1文字以上1000文字以下で入力してください';
  end if;

  insert into public.lounge_threads (campus_slug, title)
  values (p_campus_slug, p_title)
  returning id into new_thread_id;

  insert into public.bbs_posts (course_id, body)
  values ('lounge:' || new_thread_id::text, p_body);

  return new_thread_id;
end;
$$;

revoke all on function public.create_lounge_thread(text, text, text) from public;
grant execute on function public.create_lounge_thread(text, text, text) to authenticated;

create or replace function public.refresh_lounge_thread_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_board_id text := coalesce(new.course_id, old.course_id);
  target_thread_id uuid;
begin
  if target_board_id not like 'lounge:%' then
    return coalesce(new, old);
  end if;

  begin
    target_thread_id := substring(target_board_id from 8)::uuid;
  exception when invalid_text_representation then
    return coalesce(new, old);
  end;

  update public.lounge_threads
  set
    reply_count = (
      select count(*)
      from public.bbs_posts
      where course_id = target_board_id
        and status = 'approved'
    ),
    updated_at = now()
  where id = target_thread_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_lounge_thread_counts on public.bbs_posts;
create trigger refresh_lounge_thread_counts
after insert or update of status or delete on public.bbs_posts
for each row execute function public.refresh_lounge_thread_counts();
