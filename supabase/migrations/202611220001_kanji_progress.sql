-- Kanji handwriting progress per account (the browser keeps guest progress locally).
-- Like learning results, rows are written only by a narrowly scoped function that checks auth.uid();
-- clients can read their own rows but never write the table directly.
begin;

create table public.kanji_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  kanji text not null check (kanji ~ '^[㐀-鿿豈-﫿々]$'),
  -- Highest practice stage finished with at most one mistake; null when only attempted.
  passed text check (passed in ('trace', 'guide', 'recall')),
  attempts integer not null default 0 check (attempts between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, kanji)
);
alter table public.kanji_progress enable row level security;
revoke all on table public.kanji_progress from anon, authenticated;
grant select on table public.kanji_progress to authenticated;
grant all on table public.kanji_progress to service_role;
create policy kanji_progress_read_own on public.kanji_progress for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.get_kanji_progress()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_rows jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select coalesce(jsonb_object_agg(kanji, jsonb_build_object('passed', passed, 'attempts', attempts,
    'at', to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))), '{}'::jsonb)
    into v_rows from public.kanji_progress where user_id = v_user;
  return v_rows;
end;
$$;

-- Same rule as the browser (src/lib/kanji-progress.ts): one mistake is forgiven, and the stored
-- stage only ever moves up (trace < guide < recall).
create function public.record_kanji_attempt(p_kanji text, p_mode text, p_mistakes integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_rank_new integer; v_rank_old integer; v_previous text; v_passed text;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_kanji is null or p_kanji !~ '^[㐀-鿿豈-﫿々]$' or coalesce(p_mode, '') not in ('trace', 'guide', 'recall')
    or p_mistakes is null or p_mistakes not between 0 and 1000 then
    raise exception 'Invalid attempt' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 1));
  -- Bounded per account: there are only a few hundred practice kanji.
  if (select count(*) from public.kanji_progress where user_id = v_user) >= 3000
    and not exists (select 1 from public.kanji_progress where user_id = v_user and kanji = p_kanji) then
    raise exception 'Too many kanji' using errcode = 'P0001';
  end if;
  select passed into v_previous from public.kanji_progress where user_id = v_user and kanji = p_kanji;
  v_rank_new := case when p_mistakes <= 1 then array_position(array['trace', 'guide', 'recall'], p_mode) else 0 end;
  v_rank_old := coalesce(array_position(array['trace', 'guide', 'recall'], v_previous), 0);
  v_passed := case when v_rank_new > v_rank_old then p_mode else v_previous end;
  insert into public.kanji_progress (user_id, kanji, passed, attempts, updated_at)
    values (v_user, p_kanji, v_passed, 1, now())
  on conflict (user_id, kanji) do update
    set passed = v_passed, attempts = least(public.kanji_progress.attempts + 1, 100000), updated_at = now();
  return public.get_kanji_progress();
end;
$$;

revoke all on function public.get_kanji_progress() from public, anon, authenticated;
revoke all on function public.record_kanji_attempt(text, text, integer) from public, anon, authenticated;
grant execute on function public.get_kanji_progress() to authenticated;
grant execute on function public.record_kanji_attempt(text, text, integer) to authenticated;

commit;
