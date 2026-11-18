// Full curriculum for server code and tests. Client components must import
// from ./catalog (index) and ./load (on-demand chunks) instead, so the whole
// curriculum is never bundled into every page.
// Content is authored in content/ and built by `npm run content`; validation
// happens there and in tests, not at runtime.
import n5 from './generated/n5.json';
import n4 from './generated/n4.json';
import n3 from './generated/n3.json';
import type {FullLesson} from './load';
import type {Question, Word} from './schemas';

export {lessonSchema, questionSchema, wordSchema} from './schemas';
export type {Lesson, Question, Word} from './schemas';
export type {FullLesson} from './load';
export {isCorrect, normalizeAnswer, placementQuestions, LEVELS} from './catalog';

export const lessons = [...n5, ...n4, ...n3] as FullLesson[];
export const allQuestions: Question[] = lessons.flatMap(lesson => lesson.questions);
export const vocabulary: Word[] = lessons.flatMap(lesson => lesson.words);

const byId = new Map(lessons.map(lesson => [lesson.id, lesson]));
export function getLesson(id: string): FullLesson | undefined {return byId.get(id);}
