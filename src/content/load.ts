// Client-side loading of full lesson bodies, one JLPT level per chunk.
import {getLessonMeta, lessonForQuestion, type Level} from './catalog';
import type {Lesson, Question} from './schemas';

export type FullLesson = Lesson & {level: Level; levelNumber: number};

const loaders: Record<Level, () => Promise<{default: unknown}>> = {
  N5: () => import('./generated/n5.json'),
  N4: () => import('./generated/n4.json'),
  N3: () => import('./generated/n3.json')
};
const cache = new Map<Level, Promise<FullLesson[]>>();

export function loadLevel(level: Level): Promise<FullLesson[]> {
  let pending = cache.get(level);
  if (!pending) {
    pending = loaders[level]().then(module => module.default as FullLesson[]);
    pending.catch(() => cache.delete(level));
    cache.set(level, pending);
  }
  return pending;
}

export async function loadLesson(id: string): Promise<FullLesson | undefined> {
  const meta = getLessonMeta(id);
  if (!meta) return undefined;
  return (await loadLevel(meta.level)).find(lesson => lesson.id === id);
}

/** Loads question bodies for the given ids, preserving the requested order. */
export async function loadQuestions(ids: string[]): Promise<Question[]> {
  const levels = [...new Set(ids.map(id => lessonForQuestion(id)?.level).filter((level): level is Level => Boolean(level)))];
  const chunks = await Promise.all(levels.map(loadLevel));
  const byId = new Map(chunks.flat().flatMap(lesson => lesson.questions.map(question => [question.id, question] as const)));
  return ids.map(id => byId.get(id)).filter((question): question is Question => Boolean(question));
}
