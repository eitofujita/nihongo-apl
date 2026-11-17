-- Phase 2 preparation. Not applied automatically by the application.
-- All learning results and entitlements are server-authored; the browser can
-- only read its own records and update safe profile preferences.
begin;

create schema if not exists private;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_locale text not null default 'en' check (display_locale in ('en', 'ru')),
  daily_goal_minutes smallint not null default 15 check (daily_goal_minutes in (5, 10, 15, 20)),
  created_at timestamptz not null default now()
);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) between 1 and 100),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 3600),
  completed_at timestamptz not null default now(),
  unique (id, user_id)
);
create index practice_sessions_user_date on public.practice_sessions(user_id, completed_at desc);

create table public.practice_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 100),
  learner_answer text not null check (char_length(learner_answer) between 1 and 120),
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.practice_sessions(id, user_id) on delete cascade,
  unique (session_id, question_id)
);
create index practice_answers_user_question on public.practice_answers(user_id, question_id);

create table public.review_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 100),
  step smallint not null default 0 check (step between 0 and 3),
  due_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index review_cards_user_due on public.review_cards(user_id, due_at);

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  status text not null default 'inactive' check (status in ('inactive', 'active')),
  valid_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint plus_requires_expiry check (plan <> 'plus' or valid_until is not null)
);

alter table public.profiles enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_answers enable row level security;
alter table public.review_cards enable row level security;
alter table public.entitlements enable row level security;

-- Explicit grants protect even columns outside the RLS owner predicate.
revoke all on table public.profiles, public.practice_sessions,
  public.practice_answers, public.review_cards, public.entitlements from anon, authenticated;
grant select on table public.profiles, public.practice_sessions,
  public.practice_answers, public.review_cards, public.entitlements to authenticated;
grant update (display_locale, daily_goal_minutes) on public.profiles to authenticated;
grant all on table public.profiles, public.practice_sessions,
  public.practice_answers, public.review_cards, public.entitlements to service_role;

create policy profiles_read_own on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sessions_read_own on public.practice_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy answers_read_own on public.practice_answers for select to authenticated
  using ((select auth.uid()) = user_id);
create policy reviews_read_own on public.review_cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy entitlements_read_own on public.entitlements for select to authenticated
  using ((select auth.uid()) = user_id);

-- User metadata is never used to grant paid access.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  insert into public.entitlements (user_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger nihongo_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (user_id) select id from auth.users on conflict do nothing;
insert into public.entitlements (user_id) select id from auth.users on conflict do nothing;

commit;
