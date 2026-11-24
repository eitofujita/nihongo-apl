import {describe, expect, it} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {getLessonMeta, lessons, pickEarlierQuestionIds, PRACTICE_SIZE, practiceSize} from '@/content/catalog';
import {submissionSchema} from '@/lib/auth-schemas';

const owner = new Map(lessons.flatMap(lesson => lesson.questionIds.map(id => [id, lesson] as const)));
const submit = (lessonId: string, ids: string[]) => submissionSchema.safeParse({
  id: '10000000-0000-4000-8000-000000000001', lessonId, durationSeconds: 30, answers: ids.map(questionId => ({questionId, answer: 'x'}))
}).success;

describe('Lesson practice of ten questions', () => {
  it('can fill every lesson to ten, using only questions from earlier lessons', () => {
    for (const lesson of lessons) {
      const extra = pickEarlierQuestionIds(lesson);
      expect(lesson.questionIds.length + extra.length, lesson.id).toBe(practiceSize(lesson));
      expect(new Set(extra).size).toBe(extra.length);
      for (const id of extra) expect(owner.get(id)!.number, `${lesson.id} ← ${id}`).toBeLessThan(lesson.number);
    }
  });
  it('prefers recent lessons of the same kind', () => {
    const lesson = getLessonMeta('n5-te-iru')!;
    const extra = pickEarlierQuestionIds(lesson, () => 0.5);
    expect(extra).toHaveLength(PRACTICE_SIZE - lesson.questionIds.length);
    for (const id of extra) {
      expect(owner.get(id)!.category).toBe('grammar');
      expect(lesson.number - owner.get(id)!.number).toBeLessThan(25);
    }
  });
  it('accepts a lesson with earlier questions, and rejects missing, later or extra questions', () => {
    const lesson = getLessonMeta('n5-no')!;
    const extra = pickEarlierQuestionIds(lesson);
    expect(submit(lesson.id, [...lesson.questionIds, ...extra])).toBe(true);
    expect(submit(lesson.id, lesson.questionIds)).toBe(true);
    expect(submit(lesson.id, [...lesson.questionIds.slice(1), ...extra])).toBe(false);
    const later = lessons.find(other => other.number > lesson.number)!.questionIds[0];
    expect(submit(lesson.id, [...lesson.questionIds, later])).toBe(false);
    const tooMany = lessons.filter(other => other.number < lesson.number).flatMap(other => other.questionIds).slice(0, 8);
    expect(submit(lesson.id, [...lesson.questionIds, ...tooMany])).toBe(false);
  });
  it('sets up a new project from setup.sql with the ten-question lessons', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
        create schema auth; create table auth.users (id uuid primary key, email text);
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
      `);
      await db.exec(await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8'));
      const count = await db.query<{n: number}>("select count(*)::int as n from private.lesson_questions where lesson_id = 'n5-wa-desu'");
      expect(count.rows[0].n).toBe(10);
      const source = await db.query<{src: string}>("select prosrc as src from pg_proc where proname = 'submit_practice'");
      expect(source.rows[0].src).toContain('v_included');
    } finally {await db.close();}
  }, 60000);
});
