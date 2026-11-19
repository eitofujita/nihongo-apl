// Lightweight curriculum index that is safe to ship to every page.
// Full lesson bodies live in per-level chunks (see load.ts / lessons.ts).
import data from './generated/catalog.json';
import type {Question} from './schemas';

export const LEVELS = ['N5', 'N4', 'N3'] as const;
export type Level = typeof LEVELS[number];
export type LocalizedText = {en: string; ru: string};
export type LessonMeta = {
  id: string; number: number; levelNumber: number; level: Level; category: 'grammar' | 'vocabulary';
  title: LocalizedText; description: LocalizedText; glyph: string; color: 'green' | 'peach' | 'purple';
  wordCount: number; questionIds: string[];
};

export const lessons = data.lessons as LessonMeta[];
export const placementQuestions = data.placement as Question[];

const byId = new Map(lessons.map(lesson => [lesson.id, lesson]));
const lessonOfQuestion = new Map(lessons.flatMap(lesson => lesson.questionIds.map(id => [id, lesson] as const)));

export function getLessonMeta(id: string): LessonMeta | undefined {return byId.get(id);}
export function lessonForQuestion(questionId: string): LessonMeta | undefined {return lessonOfQuestion.get(questionId);}
export function isKnownQuestion(questionId: string): boolean {return lessonOfQuestion.has(questionId);}
export function isVocabularyQuestion(questionId: string): boolean {return lessonOfQuestion.get(questionId)?.category === 'vocabulary';}

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
