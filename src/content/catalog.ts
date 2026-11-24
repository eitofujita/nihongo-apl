// Lightweight curriculum index that is safe to ship to every page.
// Full lesson bodies are static files in public/content (see load.ts / lessons.ts).
import data from './generated/catalog.json';
import type {Question} from './schemas';

export const LEVELS = ['N5', 'N4', 'N3'] as const;
export type Level = typeof LEVELS[number];
export type LocalizedText = {en: string; ru: string};
export type LessonMeta = {
  id: string; number: number; levelNumber: number; level: Level; category: 'grammar' | 'vocabulary';
  title: LocalizedText; description: LocalizedText; glyph: string;
  wordCount: number; questionIds: string[];
};

type StoredLesson = Omit<LessonMeta, 'number' | 'levelNumber' | 'wordCount' | 'questionIds'> & {words?: number; questions?: number; questionIds?: string[]};
const levelCounters = new Map<string, number>();
export const lessons: LessonMeta[] = (data.lessons as StoredLesson[]).map(({words, questions, questionIds, ...lesson}, index) => {
  const levelNumber = (levelCounters.get(lesson.level) ?? 0) + 1;
  levelCounters.set(lesson.level, levelNumber);
  return {...lesson, number: index + 1, levelNumber, wordCount: words ?? 0,
    questionIds: questionIds ?? Array.from({length: questions ?? 0}, (_, i) => `${lesson.id}-${i + 1}`)};
});
export const placementQuestions = data.placement as Question[];
const versions = data.versions as Record<Level, string>;
/** Content hash of a level's lesson file, used to bust caches when the curriculum changes. */
export function contentVersion(level: Level): string {return versions[level];}

const byId = new Map(lessons.map(lesson => [lesson.id, lesson]));
const lessonOfQuestion = new Map(lessons.flatMap(lesson => lesson.questionIds.map(id => [id, lesson] as const)));

export function getLessonMeta(id: string): LessonMeta | undefined {return byId.get(id);}
export function lessonForQuestion(questionId: string): LessonMeta | undefined {return lessonOfQuestion.get(questionId);}
export function isKnownQuestion(questionId: string): boolean {return lessonOfQuestion.has(questionId);}
export function isVocabularyQuestion(questionId: string): boolean {return lessonOfQuestion.get(questionId)?.category === 'vocabulary';}

/** A lesson's practice has this many questions: its own, topped up with questions from earlier lessons. */
export const PRACTICE_SIZE = 10;
export function practiceSize(lesson: LessonMeta): number {return Math.max(PRACTICE_SIZE, lesson.questionIds.length);}
/** Whether a question comes from a lesson before this one (so it may be mixed into this lesson's practice). */
export function isEarlierQuestion(lesson: LessonMeta, questionId: string): boolean {
  const owner = lessonOfQuestion.get(questionId);
  return Boolean(owner && owner.number < lesson.number);
}
/**
 * Question ids that top a lesson up to PRACTICE_SIZE: drawn from the most recent earlier lessons of the
 * same kind (grammar or vocabulary), then any earlier lesson if those are too few. `random` is injectable for tests.
 */
export function pickEarlierQuestionIds(lesson: LessonMeta, random: () => number = Math.random): string[] {
  const need = PRACTICE_SIZE - lesson.questionIds.length;
  if (need <= 0) return [];
  const earlier = lessons.filter(other => other.number < lesson.number).reverse();
  const pool: string[] = [];
  for (const group of [earlier.filter(other => other.category === lesson.category), earlier.filter(other => other.category !== lesson.category)]) {
    // Recent lessons first: a pool about four times the need keeps the mix close to what was just learned.
    for (const other of group) {if (pool.length >= need * 4) break; pool.push(...other.questionIds);}
    if (pool.length >= need) break;
  }
  for (let i = pool.length - 1; i > 0; i--) {const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]];}
  return pool.slice(0, need);
}

export function levelStats(level?: Level) {
  const scope = level ? lessons.filter(lesson => lesson.level === level) : lessons;
  return {
    lessons: scope.length,
    grammar: scope.filter(lesson => lesson.category === 'grammar').length,
    words: scope.reduce((sum, lesson) => sum + lesson.wordCount, 0),
    questions: scope.reduce((sum, lesson) => sum + lesson.questionIds.length, 0)
  };
}

export function normalizeAnswer(answer: string): string {return answer.normalize('NFKC').trim().toLocaleLowerCase();}
export function isCorrect(question: Pick<Question, 'answer'>, answer: string): boolean {return normalizeAnswer(answer) === normalizeAnswer(question.answer);}
