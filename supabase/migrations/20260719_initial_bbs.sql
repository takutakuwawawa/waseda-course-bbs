create extension if not exists pgcrypto;

create table if not exists public.moderation_terms (
  term text primary key,
  created_at timestamptz not null default now()
);

alter table public.moderation_terms enable row level security;

create table if not exists public.bbs_posts (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  anon_label text not null,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'approved' check (status in ('approved', 'pending', 'hidden')),
  like_count integer not null default 0 check (like_count >= 0),
  dislike_count integer not null default 0 check (dislike_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists bbs_posts_course_created_idx
  on public.bbs_posts (course_id, created_at desc);

alter table public.bbs_posts enable row level security;

create or replace function public.prepare_community_post()
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

  if (
    select count(*)
    from public.bbs_posts
    where author_id = current_user_id
      and created_at > now() - interval '1 minute'
  ) >= 3 then
    raise exception '投稿間隔が短すぎます。少し待ってから再度お試しください';
  end if;

  new.author_id := current_user_id;
  new.anon_label := '匿名-' || upper(
    substring(
      encode(extensions.digest(current_user_id::text || ':' || new.course_id, 'sha256'), 'hex')
      from 1 for 4
    )
  );
  new.status := case
    when exists (
      select 1
      from public.moderation_terms
      where position(lower(term) in lower(new.body)) > 0
    ) then 'pending'
    else 'approved'
  end;
  return new;
end;
$$;

drop trigger if exists prepare_bbs_post on public.bbs_posts;
create trigger prepare_bbs_post
before insert on public.bbs_posts
for each row execute function public.prepare_community_post();

drop policy if exists bbs_posts_read_public on public.bbs_posts;
create policy bbs_posts_read_public
on public.bbs_posts for select
to anon, authenticated
using (status = 'approved');

drop policy if exists bbs_posts_insert_authenticated on public.bbs_posts;
create policy bbs_posts_insert_authenticated
on public.bbs_posts for insert
to authenticated
with check (author_id = auth.uid());

revoke all on public.bbs_posts from anon, authenticated;
grant select (id, course_id, anon_label, body, like_count, dislike_count, created_at)
  on public.bbs_posts to anon, authenticated;
grant insert (course_id, body) on public.bbs_posts to authenticated;

create table if not exists public.bbs_votes (
  post_id uuid not null references public.bbs_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.bbs_votes enable row level security;

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
  new.user_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prepare_bbs_vote on public.bbs_votes;
create trigger prepare_bbs_vote
before insert or update on public.bbs_votes
for each row execute function public.prepare_vote();

create or replace function public.refresh_bbs_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_post_id uuid := coalesce(new.post_id, old.post_id);
begin
  update public.bbs_posts
  set
    like_count = (
      select count(*) from public.bbs_votes
      where post_id = target_post_id and choice = 'up'
    ),
    dislike_count = (
      select count(*) from public.bbs_votes
      where post_id = target_post_id and choice = 'down'
    )
  where id = target_post_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists refresh_bbs_vote_counts on public.bbs_votes;
create trigger refresh_bbs_vote_counts
after insert or update or delete on public.bbs_votes
for each row execute function public.refresh_bbs_vote_counts();

drop policy if exists bbs_votes_read_own on public.bbs_votes;
create policy bbs_votes_read_own
on public.bbs_votes for select
to authenticated
using (user_id = auth.uid());

drop policy if exists bbs_votes_insert_own on public.bbs_votes;
create policy bbs_votes_insert_own
on public.bbs_votes for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists bbs_votes_update_own on public.bbs_votes;
create policy bbs_votes_update_own
on public.bbs_votes for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists bbs_votes_delete_own on public.bbs_votes;
create policy bbs_votes_delete_own
on public.bbs_votes for delete
to authenticated
using (user_id = auth.uid());

revoke all on public.bbs_votes from anon, authenticated;
grant select (post_id, choice) on public.bbs_votes to authenticated;
grant insert (post_id, choice) on public.bbs_votes to authenticated;
grant update (choice) on public.bbs_votes to authenticated;
grant delete on public.bbs_votes to authenticated;

create table if not exists public.bbs_reports (
  post_id uuid not null references public.bbs_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'personal_info', 'spam', 'other')),
  details text check (details is null or char_length(details) <= 500),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.bbs_reports enable row level security;

create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists prepare_bbs_report on public.bbs_reports;
create trigger prepare_bbs_report
before insert on public.bbs_reports
for each row execute function public.prepare_report();

drop policy if exists bbs_reports_insert_own on public.bbs_reports;
create policy bbs_reports_insert_own
on public.bbs_reports for insert
to authenticated
with check (user_id = auth.uid());

revoke all on public.bbs_reports from anon, authenticated;
grant insert (post_id, reason, details) on public.bbs_reports to authenticated;

create table if not exists public.exam_reports (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  anon_label text not null,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 1000),
  taken_year integer not null check (taken_year between 2000 and 2100),
  taken_term text not null check (char_length(taken_term) between 1 and 30),
  exam_format text check (exam_format is null or exam_format in ('筆記', 'レポート', 'オンライン', 'プレゼン', 'なし', 'その他')),
  bring_in text check (bring_in is null or bring_in in ('不可', '一部可', '全可')),
  exam_minutes integer check (exam_minutes is null or exam_minutes between 0 and 600),
  difficulty integer check (difficulty is null or difficulty between 1 and 5),
  time_intensity integer check (time_intensity is null or time_intensity between 1 and 5),
  mark_writing_balance integer check (mark_writing_balance is null or mark_writing_balance between 0 and 100),
  status text not null default 'approved' check (status in ('approved', 'pending', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists exam_reports_course_created_idx
  on public.exam_reports (course_id, created_at desc);

alter table public.exam_reports enable row level security;

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

  if (
    select count(*)
    from public.exam_reports
    where author_id = current_user_id
      and created_at > now() - interval '5 minutes'
  ) >= 3 then
    raise exception '投稿間隔が短すぎます。少し待ってから再度お試しください';
  end if;

  new.author_id := current_user_id;
  new.anon_label := '匿名-' || upper(
    substring(
      encode(extensions.digest(current_user_id::text || ':' || new.course_id, 'sha256'), 'hex')
      from 1 for 4
    )
  );
  new.status := case
    when exists (
      select 1
      from public.moderation_terms
      where position(lower(term) in lower(new.body)) > 0
    ) then 'pending'
    else 'approved'
  end;
  return new;
end;
$$;

drop trigger if exists prepare_exam_report on public.exam_reports;
create trigger prepare_exam_report
before insert on public.exam_reports
for each row execute function public.prepare_exam_report();

drop policy if exists exam_reports_read_public on public.exam_reports;
create policy exam_reports_read_public
on public.exam_reports for select
to anon, authenticated
using (status = 'approved');

drop policy if exists exam_reports_insert_authenticated on public.exam_reports;
create policy exam_reports_insert_authenticated
on public.exam_reports for insert
to authenticated
with check (author_id = auth.uid());

revoke all on public.exam_reports from anon, authenticated;
grant select (
  id, course_id, anon_label, rating, body, taken_year, taken_term,
  exam_format, bring_in, exam_minutes, difficulty, time_intensity,
  mark_writing_balance, created_at
) on public.exam_reports to anon, authenticated;
grant insert (
  course_id, rating, body, taken_year, taken_term, exam_format, bring_in,
  exam_minutes, difficulty, time_intensity, mark_writing_balance
) on public.exam_reports to authenticated;

create table if not exists public.exam_report_flags (
  exam_report_id uuid not null references public.exam_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'personal_info', 'spam', 'other')),
  created_at timestamptz not null default now(),
  primary key (exam_report_id, user_id)
);

alter table public.exam_report_flags enable row level security;

drop trigger if exists prepare_exam_report_flag on public.exam_report_flags;
create trigger prepare_exam_report_flag
before insert on public.exam_report_flags
for each row execute function public.prepare_report();

drop policy if exists exam_report_flags_insert_own on public.exam_report_flags;
create policy exam_report_flags_insert_own
on public.exam_report_flags for insert
to authenticated
with check (user_id = auth.uid());

revoke all on public.exam_report_flags from anon, authenticated;
grant insert (exam_report_id, reason) on public.exam_report_flags to authenticated;
