// Client-side loading of full lesson bodies, one JLPT level per request. The bodies are static files
// (public/content/<level>.json, written by `npm run content`), so they stay out of every JS bundle and
// out of the Cloudflare Worker; the hash in the catalog makes each content change a new URL.
import {contentVersion, getLessonMeta, lessonForQuestion, type Level} from './catalog';
import type {Lesson, Question} from './schemas';

export type FullLesson = Lesson & {level: Level; levelNumber: number};

async function fetchLevel(level: Level): Promise<FullLesson[]> {
  const response = await fetch(`/content/${level.toLowerCase()}.json?v=${contentVersion(level)}`);
  if (!response.ok) throw new Error(`Lessons ${level}: ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error(`Lessons ${level}: bad format`);
  return body as FullLesson[];
}
const cache = new Map<Level, Promise<FullLesson[]>>();

export function loadLevel(level: Level): Promise<FullLesson[]> {
  let pending = cache.get(level);
  if (!pending) {
    pending = fetchLevel(level);
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
