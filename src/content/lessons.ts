// Full curriculum for tests and scripts only. App code must use ./catalog (index) and ./load
// (fetched per level) instead: importing this file would bundle the whole curriculum into the page
// and the Cloudflare Worker.
// Content is authored in content/ and built by `npm run content`; validation
// happens there and in tests, not at runtime.
import n5 from '../../public/content/n5.json';
import n4 from '../../public/content/n4.json';
import n3 from '../../public/content/n3.json';
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
