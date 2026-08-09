alter table public.lounge_threads
  drop constraint if exists lounge_threads_campus_slug_check;

alter table public.lounge_threads
  add constraint lounge_threads_campus_slug_check
  check (campus_slug in ('waseda', 'toyama', 'tokorozawa', 'nishiwaseda'))
  not valid;

alter table public.lounge_threads
  validate constraint lounge_threads_campus_slug_check;
