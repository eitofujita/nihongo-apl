-- Nihongo AI: verification AFTER setup, including on a populated project.
-- Run this COMPLETE file as postgres in the Supabase SQL Editor.
-- Creates two random test identities inside a transaction; sends no email.
-- Existing users are never used as test identities. ALWAYS ends in ROLLBACK.
-- If execution fails, run ROLLBACK; before continuing. Never replace it with COMMIT.
-- This tests DB roles/RLS, not signed JWTs or browser authentication.

begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

do $$
declare
  v_table text;
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
begin
  if current_user <> 'postgres' then raise exception 'Run verification as postgres in SQL Editor'; end if;
  foreach v_table in array array['profiles', 'practice_sessions', 'practice_answers', 'review_cards', 'entitlements', 'kanji_progress'] loop
    if not coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.' || v_table)), false) then
      raise exception 'RLS is not enabled on %', v_table;
    end if;
    if has_table_privilege('anon', 'public.' || v_table, 'SELECT') then
      raise exception 'Unexpected anonymous read privilege on %', v_table;
    end if;
    if has_table_privilege('authenticated', 'public.' || v_table, 'INSERT,DELETE') then
      raise exception 'Unexpected direct client write privilege on %', v_table;
    end if;
    if v_table <> 'profiles' and has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE') then
      raise exception 'Unexpected direct client update privilege on %', v_table;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.get_learning_progress()', 'EXECUTE')
    or has_function_privilege('anon', 'public.submit_practice(uuid,text,integer,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.reset_learning_progress()', 'EXECUTE') then
    raise exception 'Anonymous learning RPC execution must be disabled';
  end if;
  perform set_config('nihongo_qa.user_a', v_a::text, true);
  perform set_config('nihongo_qa.user_b', v_b::text, true);
  perform set_config('nihongo_qa.session_a', gen_random_uuid()::text, true);
  perform set_config('nihongo_qa.session_b', gen_random_uuid()::text, true);
  insert into auth.users(id, email) values
    (v_a, 'nihongo-qa-' || v_a || '@example.invalid'),
    (v_b, 'nihongo-qa-' || v_b || '@example.invalid');
  perform set_config('request.jwt.claim.sub', v_a::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
end;
$$;

set local role authenticated;
do $$
declare v_progress jsonb; v_session uuid := current_setting('nihongo_qa.session_a')::uuid;
begin
  if current_user <> 'authenticated'
    or (select rolbypassrls from pg_roles where rolname = current_user)
    or auth.uid() is distinct from current_setting('nihongo_qa.user_a')::uuid then
    raise exception 'User A role/identity simulation failed';
  end if;
  if (select count(*) from public.profiles) <> 1
    or (select count(*) from public.entitlements where plan = 'free' and status = 'inactive') <> 1 then
    raise exception 'User A profile/entitlement isolation failed';
  end if;
  v_progress := public.submit_practice(v_session, 'n5-wa-desu', 60,
    '[{"questionId":"wa-1","answer":"を","correct":true},{"questionId":"wa-2","answer":"です"},{"questionId":"wa-3","answer":"は"}]'::jsonb);
  if jsonb_array_length(v_progress->'sessions') <> 1
    or (v_progress #>> '{sessions,0,answers,0,correct}')::boolean is distinct from false
    or (v_progress #>> '{sessions,0,answers,1,correct}')::boolean is distinct from true
    or (v_progress #>> '{sessions,0,answers,2,correct}')::boolean is distinct from true
    or jsonb_array_length(v_progress->'reviews') <> 1 then
    raise exception 'Server grading or review creation failed';
  end if;
  v_progress := public.submit_practice(v_session, 'n5-wa-desu', 60,
    '[{"questionId":"wa-1","answer":"を"},{"questionId":"wa-2","answer":"です"},{"questionId":"wa-3","answer":"は"}]'::jsonb);
  if jsonb_array_length(v_progress->'sessions') <> 1 then raise exception 'Retry created a duplicate'; end if;
  update public.profiles set daily_goal_minutes = 10 where user_id = auth.uid();
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('nihongo_qa.user_b'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('nihongo_qa.user_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare v_progress jsonb; v_count bigint; v_table text; v_foreign boolean;
begin
  if current_user <> 'authenticated'
    or auth.uid() is distinct from current_setting('nihongo_qa.user_b')::uuid then
    raise exception 'User B role/identity simulation failed';
  end if;
  foreach v_table in array array['profiles', 'practice_sessions', 'practice_answers', 'review_cards', 'entitlements', 'kanji_progress'] loop
    execute format('select exists(select 1 from public.%I where user_id <> auth.uid())', v_table) into v_foreign;
    if v_foreign then raise exception 'User B can read another account in %', v_table; end if;
  end loop;
  v_progress := public.get_learning_progress();
  if jsonb_array_length(v_progress->'sessions') <> 0 or (v_progress->>'dailyGoal')::int <> 15 then
    raise exception 'User B inherited user A history/settings';
  end if;
  update public.profiles set daily_goal_minutes = 5 where user_id = current_setting('nihongo_qa.user_a')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'User B updated user A profile'; end if;
  v_progress := public.submit_practice(current_setting('nihongo_qa.session_b')::uuid, 'n5-wa-desu', 60,
    '[{"questionId":"wa-1","answer":"は"},{"questionId":"wa-2","answer":"か"},{"questionId":"wa-3","answer":"は"}]'::jsonb);
  if jsonb_array_length(v_progress->'sessions') <> 1 or jsonb_array_length(v_progress->'reviews') <> 1 then
    raise exception 'User B own submission failed';
  end if;
  if (public.record_kanji_attempt('水', 'trace', 0)->'水'->>'passed') is distinct from 'trace' then
    raise exception 'User B own kanji progress failed';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('nihongo_qa.user_a'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('nihongo_qa.user_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare v_table text; v_foreign boolean; v_progress jsonb;
begin
  foreach v_table in array array['profiles', 'practice_sessions', 'practice_answers', 'review_cards', 'entitlements', 'kanji_progress'] loop
    execute format('select exists(select 1 from public.%I where user_id <> auth.uid())', v_table) into v_foreign;
    if v_foreign then raise exception 'User A can read another account in %', v_table; end if;
  end loop;
  v_progress := public.get_learning_progress();
  if jsonb_array_length(v_progress->'sessions') <> 1 or (v_progress->>'dailyGoal')::int <> 10 then
    raise exception 'User A history/settings changed while user B was active';
  end if;
  v_progress := public.reset_learning_progress();
  if jsonb_array_length(v_progress->'sessions') <> 0 or jsonb_array_length(v_progress->'reviews') <> 0 then
    raise exception 'User A reset failed';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', current_setting('nihongo_qa.user_b'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('nihongo_qa.user_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare v_progress jsonb := public.get_learning_progress();
begin
  if jsonb_array_length(v_progress->'sessions') <> 1 or jsonb_array_length(v_progress->'reviews') <> 1 then
    raise exception 'User A reset changed user B history';
  end if;
  if (select count(*) from public.entitlements where plan = 'free' and status = 'inactive') <> 1 then
    raise exception 'Payment rights changed during verification';
  end if;
end;
$$;

reset role;
rollback;
select 'PASS: account isolation, grading, retries and scoped reset. Test data rolled back.' as verification;
