-- Nihongo AI: initial setup for a NEW / EMPTY development project.
-- Paste this complete file into Supabase SQL Editor and run once.
-- All schema, policy, function and seed changes run in ONE transaction.
-- Existing objects with the same names cause a rollback; no data is deleted.
-- For projects with previously applied migrations, use only pending migrations.

begin;

-- Source: 202611170001_initial_schema.sql
-- Phase 2 preparation. Not applied automatically by the application.
-- All learning results and entitlements are server-authored; the browser can
-- only read its own records and update safe profile preferences.

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

-- Source: 202611170002_learning_functions.sql
-- The question bank is deliberately unavailable to API clients. Only the
-- narrowly scoped grading function can use it to author learning results.
create table private.question_bank (
  id text primary key,
  correct_answer text not null
);
create table private.lesson_questions (
  lesson_id text not null,
  question_id text not null references private.question_bank(id),
  position smallint not null,
  primary key (lesson_id, question_id)
);
revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
alter table public.practice_answers add column position smallint not null default 0;

create function public.get_learning_progress()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_goal smallint; v_sessions jsonb; v_reviews jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select daily_goal_minutes into strict v_goal from public.profiles where user_id = v_user;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'lessonId', s.lesson_id,
    'at', to_char(s.completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'durationSeconds', s.duration_seconds,
    'answers', (select coalesce(jsonb_agg(jsonb_build_object('questionId', a.question_id, 'correct', a.is_correct) order by a.position), '[]'::jsonb)
      from public.practice_answers a where a.session_id = s.id and a.user_id = v_user)
  ) order by s.completed_at, s.id), '[]'::jsonb) into v_sessions
  from (select * from public.practice_sessions where user_id = v_user order by completed_at desc, id desc limit 1000) s;
  select coalesce(jsonb_agg(jsonb_build_object('questionId', question_id, 'step', step,
    'due', to_char(due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by due_at, question_id), '[]'::jsonb)
    into v_reviews from public.review_cards where user_id = v_user;
  return jsonb_build_object('version', 1, 'dailyGoal', v_goal, 'sessions', v_sessions, 'reviews', v_reviews);
end;
$$;

create function public.submit_practice(p_session_id uuid, p_lesson_id text, p_duration_seconds integer, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_count integer; v_expected integer;
  v_item jsonb; v_question text; v_answer text; v_correct boolean;
  v_step smallint; v_position smallint := 0;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  if exists (select 1 from public.practice_sessions where id = p_session_id and user_id = v_user) then
    return public.get_learning_progress(); -- idempotent retry after a lost response
  end if;
  if p_session_id is null or p_lesson_id is null or p_duration_seconds is null or p_duration_seconds not between 0 and 3600
    or p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Invalid submission' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_answers);
  if v_count not between 1 and 100 or
    (select count(distinct item->>'questionId') from jsonb_array_elements(p_answers) item) <> v_count then
    raise exception 'Invalid submission' using errcode = '22023';
  end if;
  if p_lesson_id <> 'review' then
    select count(*) into v_expected from private.lesson_questions where lesson_id = p_lesson_id;
    if v_expected = 0 or v_expected <> v_count then raise exception 'Invalid lesson' using errcode = '22023'; end if;
  end if;
  if (select count(*) from public.practice_sessions where user_id = v_user and completed_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 200 then
    raise exception 'Daily session limit' using errcode = 'P0001';
  end if;
  insert into public.practice_sessions (id, user_id, lesson_id, duration_seconds)
    values (p_session_id, v_user, p_lesson_id, p_duration_seconds);
  for v_item in select value from jsonb_array_elements(p_answers) loop
    v_question := v_item->>'questionId'; v_answer := v_item->>'answer';
    if jsonb_typeof(v_item->'answer') <> 'string' or v_answer is null or char_length(btrim(v_answer)) not between 1 and 120 then
      raise exception 'Invalid answer' using errcode = '22023';
    end if;
    if p_lesson_id = 'review' then
      if not exists (select 1 from public.review_cards where user_id = v_user and question_id = v_question and due_at <= now()) then
        raise exception 'Review is not due' using errcode = '22023';
      end if;
    elsif not exists (select 1 from private.lesson_questions where lesson_id = p_lesson_id and question_id = v_question) then
      raise exception 'Invalid question' using errcode = '22023';
    end if;
    select lower(btrim(normalize(v_answer, NFKC))) = lower(btrim(normalize(correct_answer, NFKC)))
      into v_correct from private.question_bank where id = v_question;
    if v_correct is null then raise exception 'Unknown question' using errcode = '22023'; end if;
    insert into public.practice_answers (session_id, user_id, question_id, learner_answer, is_correct, position)
      values (p_session_id, v_user, v_question, v_answer, v_correct, v_position);
    v_position := v_position + 1;
    if not v_correct then
      insert into public.review_cards (user_id, question_id, step, due_at) values (v_user, v_question, 0, now() + interval '10 minutes')
        on conflict (user_id, question_id) do update set step = 0, due_at = excluded.due_at, updated_at = now();
    else
      select step into v_step from public.review_cards where user_id = v_user and question_id = v_question;
      if found then
        update public.review_cards set step = least(v_step + 1, 3),
          due_at = now() + case when v_step = 0 then interval '1 day' when v_step = 1 then interval '3 days' else interval '7 days' end,
          updated_at = now() where user_id = v_user and question_id = v_question;
      end if;
    end if;
  end loop;
  delete from public.practice_sessions where user_id = v_user and id in
    (select id from public.practice_sessions where user_id = v_user order by completed_at desc, id desc offset 1000);
  return public.get_learning_progress();
end;
$$;

create function public.reset_learning_progress()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  delete from public.practice_sessions where user_id = v_user;
  delete from public.review_cards where user_id = v_user;
  update public.profiles set daily_goal_minutes = 15 where user_id = v_user;
  return public.get_learning_progress();
end;
$$;

revoke all on function public.get_learning_progress() from public, anon, authenticated;
revoke all on function public.submit_practice(uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.reset_learning_progress() from public, anon, authenticated;
grant execute on function public.get_learning_progress() to authenticated;
grant execute on function public.submit_practice(uuid, text, integer, jsonb) to authenticated;
grant execute on function public.reset_learning_progress() to authenticated;

-- Source: 202611170003_question_bank.sql
-- Fixed curriculum seed. Keep in sync with src/content; covered by DB tests.

insert into private.question_bank (id, correct_answer) values
('wa-1', 'は'),
('wa-2', 'です'),
('wa-3', 'は'),
('word-1', '本'),
('word-2', '水'),
('word-3', '学校'),
('word-4', '猫'),
('ka-1', 'か'),
('ka-2', 'か'),
('ka-3', 'か'),
('kore-1', 'これ'),
('kore-2', 'それ'),
('kore-3', 'あれ'),
('no-1', 'の'),
('no-2', 'の'),
('no-3', 'の'),
('food-1', 'お茶'),
('food-2', '魚'),
('food-3', 'パン'),
('food-4', 'ご飯'),
('negative-1', 'ではありません'),
('negative-2', 'じゃありません'),
('negative-3', 'ではありません'),
('mo-1', 'も'),
('mo-2', 'も'),
('mo-3', 'も'),
('wo-1', 'を'),
('wo-2', 'を'),
('wo-3', 'を'),
('de-1', 'で'),
('de-2', 'で'),
('de-3', 'で'),
('time-ni-1', 'に'),
('time-ni-2', 'に'),
('time-ni-3', 'に'),
('direction-1', 'へ'),
('direction-2', 'へ'),
('direction-3', 'へ'),
('aru-1', 'あります'),
('aru-2', 'に'),
('aru-3', 'ありません'),
('iru-1', 'います'),
('iru-2', 'が'),
('iru-3', 'いません'),
('verb-1', 'ます'),
('verb-2', 'ません'),
('verb-3', 'ます'),
('past-1', 'ました'),
('past-2', 'ませんでした'),
('past-3', 'ました'),
('iadj-1', '新しい'),
('iadj-2', '高くない'),
('iadj-3', '大きい'),
('naadj-1', '静かな'),
('naadj-2', 'な'),
('naadj-3', 'な'),
('kono-1', 'この'),
('kono-2', 'その'),
('kono-3', 'あの'),
('suki-1', 'が'),
('suki-2', '好きです'),
('suki-3', 'ではありません'),
('te-1', 'ください'),
('te-2', '読んで'),
('te-3', 'ください'),
('invite-1', 'ましょう'),
('invite-2', 'ませんか'),
('invite-3', 'ましょう'),
('n5-people-q1', '人'),
('n5-people-q2', '友達'),
('n5-people-q3', '先生'),
('n5-people-q4', '学生'),
('n5-time-words-q1', '今日'),
('n5-time-words-q2', '明日'),
('n5-time-words-q3', '昨日'),
('n5-time-words-q4', '朝'),
('n5-places-q1', '駅'),
('n5-places-q2', '病院'),
('n5-places-q3', '銀行'),
('n5-places-q4', '郵便局'),
('n5-actions-q1', '行く'),
('n5-actions-q2', '来る'),
('n5-actions-q3', '帰る'),
('n5-actions-q4', '食べる'),
('n5-describing-q1', '大きい'),
('n5-describing-q2', '小さい'),
('n5-describing-q3', '新しい'),
('n5-describing-q4', '古い'),
('n5-travel-q1', '車'),
('n5-travel-q2', '電車'),
('n5-travel-q3', '自転車'),
('n5-travel-q4', 'バス'),
('n5-nature-q1', '山'),
('n5-nature-q2', '川'),
('n5-nature-q3', '海'),
('n5-nature-q4', '空'),
('n5-numbers-q1', '一'),
('n5-numbers-q2', '二'),
('n5-numbers-q3', '三'),
('n5-numbers-q4', '四');
insert into private.lesson_questions (lesson_id, question_id, position) values
('n5-wa-desu', 'wa-1', 0),
('n5-wa-desu', 'wa-2', 1),
('n5-wa-desu', 'wa-3', 2),
('n5-everyday', 'word-1', 0),
('n5-everyday', 'word-2', 1),
('n5-everyday', 'word-3', 2),
('n5-everyday', 'word-4', 3),
('n5-ka', 'ka-1', 0),
('n5-ka', 'ka-2', 1),
('n5-ka', 'ka-3', 2),
('n5-kore', 'kore-1', 0),
('n5-kore', 'kore-2', 1),
('n5-kore', 'kore-3', 2),
('n5-no', 'no-1', 0),
('n5-no', 'no-2', 1),
('n5-no', 'no-3', 2),
('n5-food', 'food-1', 0),
('n5-food', 'food-2', 1),
('n5-food', 'food-3', 2),
('n5-food', 'food-4', 3),
('n5-negative', 'negative-1', 0),
('n5-negative', 'negative-2', 1),
('n5-negative', 'negative-3', 2),
('n5-mo', 'mo-1', 0),
('n5-mo', 'mo-2', 1),
('n5-mo', 'mo-3', 2),
('n5-wo', 'wo-1', 0),
('n5-wo', 'wo-2', 1),
('n5-wo', 'wo-3', 2),
('n5-de', 'de-1', 0),
('n5-de', 'de-2', 1),
('n5-de', 'de-3', 2),
('n5-time-ni', 'time-ni-1', 0),
('n5-time-ni', 'time-ni-2', 1),
('n5-time-ni', 'time-ni-3', 2),
('n5-direction', 'direction-1', 0),
('n5-direction', 'direction-2', 1),
('n5-direction', 'direction-3', 2),
('n5-arimasu', 'aru-1', 0),
('n5-arimasu', 'aru-2', 1),
('n5-arimasu', 'aru-3', 2),
('n5-imasu', 'iru-1', 0),
('n5-imasu', 'iru-2', 1),
('n5-imasu', 'iru-3', 2),
('n5-verbs', 'verb-1', 0),
('n5-verbs', 'verb-2', 1),
('n5-verbs', 'verb-3', 2),
('n5-past', 'past-1', 0),
('n5-past', 'past-2', 1),
('n5-past', 'past-3', 2),
('n5-i-adjectives', 'iadj-1', 0),
('n5-i-adjectives', 'iadj-2', 1),
('n5-i-adjectives', 'iadj-3', 2),
('n5-na-adjectives', 'naadj-1', 0),
('n5-na-adjectives', 'naadj-2', 1),
('n5-na-adjectives', 'naadj-3', 2),
('n5-kono', 'kono-1', 0),
('n5-kono', 'kono-2', 1),
('n5-kono', 'kono-3', 2),
('n5-suki', 'suki-1', 0),
('n5-suki', 'suki-2', 1),
('n5-suki', 'suki-3', 2),
('n5-te-kudasai', 'te-1', 0),
('n5-te-kudasai', 'te-2', 1),
('n5-te-kudasai', 'te-3', 2),
('n5-invitations', 'invite-1', 0),
('n5-invitations', 'invite-2', 1),
('n5-invitations', 'invite-3', 2),
('n5-people', 'n5-people-q1', 0),
('n5-people', 'n5-people-q2', 1),
('n5-people', 'n5-people-q3', 2),
('n5-people', 'n5-people-q4', 3),
('n5-time-words', 'n5-time-words-q1', 0),
('n5-time-words', 'n5-time-words-q2', 1),
('n5-time-words', 'n5-time-words-q3', 2),
('n5-time-words', 'n5-time-words-q4', 3),
('n5-places', 'n5-places-q1', 0),
('n5-places', 'n5-places-q2', 1),
('n5-places', 'n5-places-q3', 2),
('n5-places', 'n5-places-q4', 3),
('n5-actions', 'n5-actions-q1', 0),
('n5-actions', 'n5-actions-q2', 1),
('n5-actions', 'n5-actions-q3', 2),
('n5-actions', 'n5-actions-q4', 3),
('n5-describing', 'n5-describing-q1', 0),
('n5-describing', 'n5-describing-q2', 1),
('n5-describing', 'n5-describing-q3', 2),
('n5-describing', 'n5-describing-q4', 3),
('n5-travel', 'n5-travel-q1', 0),
('n5-travel', 'n5-travel-q2', 1),
('n5-travel', 'n5-travel-q3', 2),
('n5-travel', 'n5-travel-q4', 3),
('n5-nature', 'n5-nature-q1', 0),
('n5-nature', 'n5-nature-q2', 1),
('n5-nature', 'n5-nature-q3', 2),
('n5-nature', 'n5-nature-q4', 3),
('n5-numbers', 'n5-numbers-q1', 0),
('n5-numbers', 'n5-numbers-q2', 1),
('n5-numbers', 'n5-numbers-q3', 2),
('n5-numbers', 'n5-numbers-q4', 3),
('placement', 'wa-1', 0),
('placement', 'ka-1', 1),
('placement', 'no-1', 2),
('placement', 'wo-1', 3),
('placement', 'de-1', 4),
('placement', 'aru-1', 5),
('placement', 'verb-2', 6),
('placement', 'past-1', 7),
('placement', 'iadj-2', 8),
('placement', 'te-2', 9);

commit;
