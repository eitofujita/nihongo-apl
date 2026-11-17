import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {allQuestions, getLesson, lessons, placementQuestions} from '@/content/lessons';
import {progressSchema} from '@/lib/progress';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const SESSION_A = '10000000-0000-4000-8000-000000000001';
const SESSION_B = '10000000-0000-4000-8000-000000000002';
const FIRST = getLesson('n5-wa-desu')!;
const correctAnswers = FIRST.questions.map(q => ({questionId: q.id, answer: q.answer}));
let db: PGlite;

async function asUser(id: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('set role authenticated');
}
async function submit(id = SESSION_A, answers: unknown = correctAnswers, lesson = FIRST.id, duration = 90) {
  const result = await db.query<{progress: unknown}>('select public.submit_practice($1::uuid, $2, $3, $4::jsonb) as progress', [id, lesson, duration, JSON.stringify(answers)]);
  return progressSchema.parse(result.rows[0].progress);
}
async function progress() {
  const result = await db.query<{progress: unknown}>('select public.get_learning_progress() as progress');
  return progressSchema.parse(result.rows[0].progress);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const file of ['202611170001_initial_schema.sql', '202611170002_learning_functions.sql', '202611170003_question_bank.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
}, 30000);
beforeEach(async () => {
  await db.exec('reset role; truncate auth.users cascade;');
  await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [A, 'a@example.test', B, 'b@example.test']);
  await asUser(A);
});
afterAll(async () => {await db?.close();});

describe.sequential('PostgreSQL migrations, RLS and server-authored grading', () => {
  it('runs the SQL Editor verification repeatedly without changing existing history or users', async () => {
    const existing = await submit();
    await db.exec('reset role');
    const before = await db.query<{users: number; profiles: number; sessions: number}>(
      'select (select count(*)::int from auth.users) as users, (select count(*)::int from public.profiles) as profiles, (select count(*)::int from public.practice_sessions) as sessions'
    );
    const sql = await readFile(new URL('../supabase/verify.sql', import.meta.url), 'utf8');
    for (let attempt = 0; attempt < 2; attempt++) {
      const results = await db.exec(sql);
      expect(results.at(-1)?.rows).toEqual([{verification: 'PASS: account isolation, grading, retries and scoped reset. Test data rolled back.'}]);
      expect((await db.query('select (select count(*)::int from auth.users) as users, (select count(*)::int from public.profiles) as profiles, (select count(*)::int from public.practice_sessions) as sessions')).rows).toEqual(before.rows);
    }
    await asUser(A);
    expect(await progress()).toEqual(existing);
  });
  it('rejects a disabled RLS policy before creating verification users', async () => {
    await db.exec('reset role; alter table public.profiles disable row level security;');
    const sql = await readFile(new URL('../supabase/verify.sql', import.meta.url), 'utf8');
    try {await expect(db.exec(sql)).rejects.toThrow(/RLS is not enabled/);}
    finally {await db.exec('rollback; alter table public.profiles enable row level security;');}
    expect((await db.query<{count: number}>('select count(*)::int as count from auth.users')).rows[0].count).toBe(2);
  });
  it('detects a permissive policy and rolls back all temporary verification identities', async () => {
    await db.exec('reset role; create policy qa_broken_profile_policy on public.profiles for select to authenticated using (true);');
    const sql = await readFile(new URL('../supabase/verify.sql', import.meta.url), 'utf8');
    try {await expect(db.exec(sql)).rejects.toThrow(/profile\/entitlement isolation failed/);}
    finally {await db.exec('rollback; drop policy qa_broken_profile_policy on public.profiles;');}
    expect((await db.query<{count: number}>('select count(*)::int as count from auth.users')).rows[0].count).toBe(2);
    await asUser(A);
    expect((await db.query('select user_id from public.profiles')).rows).toEqual([{user_id: A}]);
  });
  it('seeds exactly the application curriculum, including the diagnostic mapping', async () => {
    await db.exec('reset role');
    const rows = (await db.query<{id: string; correct_answer: string}>('select id, correct_answer from private.question_bank')).rows;
    expect(new Map(rows.map(row => [row.id, row.correct_answer]))).toEqual(new Map(allQuestions.map(q => [q.id, q.answer])));
    const links = (await db.query<{lesson_id: string; question_id: string; position: number}>('select * from private.lesson_questions')).rows;
    expect(links).toHaveLength(allQuestions.length + placementQuestions.length);
    for (const lesson of lessons) expect(links.filter(row => row.lesson_id === lesson.id).sort((a, b) => a.position - b.position).map(row => row.question_id)).toEqual(lesson.questions.map(q => q.id));
  });
  it('creates private profiles and free inactive entitlements at signup', async () => {
    expect((await db.query<{user_id: string}>('select user_id from public.profiles')).rows).toEqual([{user_id: A}]);
    expect((await db.query<{plan: string; status: string}>('select plan, status from public.entitlements')).rows).toEqual([{plan: 'free', status: 'inactive'}]);
  });
  it('denies anonymous reads and writes and execution of private learning functions', async () => {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;");
    await expect(db.query('select * from public.profiles')).rejects.toThrow(/permission denied/i);
    await expect(db.query('select public.get_learning_progress()')).rejects.toThrow(/permission denied/i);
    await expect(submit()).rejects.toThrow(/permission denied/i);
  });
  it('only lets users change safe columns on their own profile', async () => {
    await db.query("update public.profiles set display_locale = 'ru', daily_goal_minutes = 10 where user_id = $1", [A]);
    expect((await progress()).dailyGoal).toBe(10);
    expect((await db.query('update public.profiles set daily_goal_minutes = 5 where user_id = $1 returning user_id', [B])).rows).toHaveLength(0);
    await expect(db.query('update public.profiles set user_id = $1 where user_id = $2', [B, A])).rejects.toThrow(/permission denied/i);
  });
  it('grades raw answers and ignores forged correct flags or owner fields', async () => {
    const answers = correctAnswers.map((answer, index) => ({...answer, answer: index === 0 ? 'を' : answer.answer, correct: true, userId: B}));
    const stored = await submit(SESSION_A, answers);
    expect(stored.sessions[0].answers.map(a => a.correct)).toEqual([false, true, true]);
    expect(stored.reviews[0].questionId).toBe('wa-1');
    await asUser(B);
    expect((await progress()).sessions).toHaveLength(0);
    expect((await db.query('select * from public.practice_answers')).rows).toHaveLength(0);
  });
  it('does not let clients author scores, paid access or read the question bank directly', async () => {
    await expect(db.query("insert into public.practice_sessions(user_id, lesson_id) values ($1, 'n5-wa-desu')", [A])).rejects.toThrow(/permission denied/i);
    await expect(db.query("update public.entitlements set plan = 'plus', status = 'active', valid_until = now() + interval '1 year'")).rejects.toThrow(/permission denied/i);
    await expect(db.query('select * from private.question_bank')).rejects.toThrow(/permission denied/i);
    await expect(db.query('delete from public.review_cards')).rejects.toThrow(/permission denied/i);
  });
  it('deduplicates retries and preserves another user’s sessions', async () => {
    await submit(); await submit();
    expect((await progress()).sessions).toHaveLength(1);
    await asUser(B); await submit(SESSION_B);
    expect((await progress()).sessions.map(s => s.id)).toEqual([SESSION_B]);
    await asUser(A);
    expect((await progress()).sessions.map(s => s.id)).toEqual([SESSION_A]);
  });
  it('rolls back incomplete, duplicate and mismatched lesson submissions', async () => {
    await expect(submit(SESSION_A, correctAnswers.slice(0, 1))).rejects.toThrow(/Invalid lesson/i);
    await expect(submit(SESSION_A, [correctAnswers[0], correctAnswers[0], correctAnswers[2]])).rejects.toThrow(/Invalid submission/i);
    await expect(submit(SESSION_A, correctAnswers, 'n5-ka')).rejects.toThrow(/Invalid question/i);
    await expect(submit(SESSION_A, correctAnswers, FIRST.id, 4000)).rejects.toThrow(/Invalid submission/i);
    expect((await progress()).sessions).toHaveLength(0);
  });
  it('only permits due reviews and advances the server-side repetition interval', async () => {
    await submit(SESSION_A, correctAnswers.map((answer, i) => ({...answer, answer: i === 0 ? 'を' : answer.answer})));
    await expect(submit(SESSION_B, [correctAnswers[0]], 'review')).rejects.toThrow(/Review is not due/i);
    await db.exec('reset role');
    await db.query("update public.review_cards set due_at = now() - interval '1 second' where user_id = $1", [A]);
    await asUser(A);
    const saved = await submit(SESSION_B, [correctAnswers[0]], 'review');
    expect(saved.reviews[0].step).toBe(1);
    expect(Date.parse(saved.reviews[0].due) - Date.now()).toBeGreaterThan(86300000);
  });
  it('resets only the authenticated account and leaves payment rights unchanged', async () => {
    await submit();
    await asUser(B); await submit(SESSION_B);
    await asUser(A);
    await db.query('select public.reset_learning_progress()');
    expect((await progress()).sessions).toHaveLength(0);
    expect((await db.query<{plan: string}>('select plan from public.entitlements')).rows[0].plan).toBe('free');
    await asUser(B);
    expect((await progress()).sessions).toHaveLength(1);
  });
  it('uses a composite foreign key to prevent answers referencing another owner’s session', async () => {
    await submit(); await db.exec('reset role');
    await expect(db.query("insert into public.practice_answers(session_id, user_id, question_id, learner_answer, is_correct) values ($1, $2, 'ka-1', 'か', true)", [SESSION_A, B])).rejects.toThrow(/foreign key/i);
  });
  it('applies the daily write limit per authenticated user', async () => {
    await db.exec('reset role');
    await db.query("insert into public.practice_sessions(user_id, lesson_id) select $1::uuid, 'n5-wa-desu' from generate_series(1, 200)", [A]);
    await asUser(A); await expect(submit()).rejects.toThrow(/Daily session limit/i);
    await asUser(B); expect((await submit(SESSION_B)).sessions).toHaveLength(1);
  });
});
