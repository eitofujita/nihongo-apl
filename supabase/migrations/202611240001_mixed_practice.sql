-- Lesson practice is topped up to 10 questions with questions from earlier lessons.
-- A lesson submission must still contain every question of that lesson; any other question must be
-- a known question (it is graded from the question bank like the rest). Review stays limited to due
-- cards. Same signature, so existing grants are kept.
begin;
create or replace function public.submit_practice(p_session_id uuid, p_lesson_id text, p_duration_seconds integer, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_count integer; v_expected integer; v_included integer;
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
    select count(*) into v_included from private.lesson_questions q
      where q.lesson_id = p_lesson_id and q.question_id in (select item->>'questionId' from jsonb_array_elements(p_answers) item);
    -- Every own question is answered, and only a lesson (not the placement test) may add others.
    if v_expected = 0 or v_included <> v_expected or (v_count > v_expected and (p_lesson_id = 'placement' or v_count > greatest(v_expected, 10))) then
      raise exception 'Invalid lesson' using errcode = '22023';
    end if;
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
commit;
