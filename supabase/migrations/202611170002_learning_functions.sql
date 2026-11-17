begin;

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
commit;
