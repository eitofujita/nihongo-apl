import {z} from 'zod';
import {getLessonMeta, isKnownQuestion, isVocabularyQuestion, lessons} from '@/content/catalog';

export const STORAGE_KEY = 'nihongo-ai:progress:v1';
export const answerInputSchema = z.object({questionId: z.string().max(100), answer: z.string().trim().min(1).max(120)});
const knownQuestion = z.string().refine(isKnownQuestion);
const recordSchema = z.object({questionId: knownQuestion, correct: z.boolean()});
const sessionSchema = z.object({
  id: z.string().min(1).max(100), lessonId: z.string().refine(id => id === 'review' || id === 'placement' || Boolean(getLessonMeta(id))),
  at: z.iso.datetime(), durationSeconds: z.number().int().min(0).max(3600),
  answers: z.array(recordSchema).min(1).max(100)
}).superRefine((session, context) => {
  if (new Set(session.answers.map(a => a.questionId)).size !== session.answers.length) {
    context.addIssue({code: 'custom', message: 'A session cannot contain the same question twice'});
  }
  const lesson = getLessonMeta(session.lessonId);
  if (lesson && session.answers.some(a => !lesson.questionIds.includes(a.questionId))) {
    context.addIssue({code: 'custom', message: 'Question does not belong to this lesson'});
  }
});
const reviewSchema = z.object({questionId: knownQuestion, due: z.iso.datetime(), step: z.number().int().min(0).max(3)});
export const progressSchema = z.object({
  version: z.literal(1), dailyGoal: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]),
  sessions: z.array(sessionSchema).max(1000), reviews: z.array(reviewSchema).max(1000)
});
export type Progress = z.infer<typeof progressSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type PracticeAnswer = z.infer<typeof recordSchema>;
export const initialProgress: Progress = {version: 1, dailyGoal: 15, sessions: [], reviews: []};

export function parseProgress(raw: string | null): Progress {
  if (!raw) return initialProgress;
  try {const parsed = progressSchema.safeParse(JSON.parse(raw)); return parsed.success ? parsed.data : initialProgress;} catch {return initialProgress;}
}

export function addSession(progress: Progress, session: Session): Progress {
  if (progress.sessions.some(existing => existing.id === session.id)) return progress;
  const validated = sessionSchema.parse(session);
  const reviews = new Map(progress.reviews.map(item => [item.questionId, item]));
  for (const answer of validated.answers) {
    const existing = reviews.get(answer.questionId);
    if (!answer.correct) {
      reviews.set(answer.questionId, {questionId: answer.questionId, step: 0, due: new Date(Date.parse(session.at) + 600000).toISOString()});
    } else if (existing) {
      const days = [1, 3, 7, 7][existing.step];
      reviews.set(answer.questionId, {questionId: answer.questionId, step: Math.min(existing.step + 1, 3), due: new Date(Date.parse(session.at) + days * 86400000).toISOString()});
    }
  }
  return progressSchema.parse({...progress, sessions: [...progress.sessions, validated].slice(-1000), reviews: [...reviews.values()]});
}

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getStats(progress: Progress, now = new Date()) {
  const answers = progress.sessions.flatMap(session => session.answers);
  const correct = answers.filter(answer => answer.correct).length;
  const completed = new Set(progress.sessions.filter(s => Boolean(getLessonMeta(s.lessonId))).map(s => s.lessonId));
  const words = new Set(answers.filter(a => isVocabularyQuestion(a.questionId)).map(a => a.questionId)).size;
  const activeDays = new Set(progress.sessions.map(s => localDay(new Date(s.at))));
  let streak = 0;
  const day = new Date(now);
  if (!activeDays.has(localDay(day))) day.setDate(day.getDate() - 1);
  while (activeDays.has(localDay(day))) {streak++; day.setDate(day.getDate() - 1);}
  const todaySeconds = progress.sessions.filter(s => localDay(new Date(s.at)) === localDay(now)).reduce((sum, s) => sum + s.durationSeconds, 0);
  return {completed, words, correct, total: answers.length, accuracy: answers.length ? Math.round(correct / answers.length * 100) : null, streak, todayMinutes: Math.floor(todaySeconds / 60), todaySeconds, activeDays};
}

/** Ids of review questions that are due; load their content with loadQuestions(). */
export function dueQuestionIds(progress: Progress, now = new Date()): string[] {
  return progress.reviews.filter(review => Date.parse(review.due) <= now.getTime() && isKnownQuestion(review.questionId)).map(review => review.questionId);
}

/** Most recent answer per question wins, so a corrected mistake can recover. */
export function getWeakTopics(progress: Progress) {
  const latest = new Map<string, boolean>();
  [...progress.sessions].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).forEach(session => {
    session.answers.forEach(answer => latest.set(answer.questionId, answer.correct));
  });
  return lessons.flatMap(lesson => {
    const answered = lesson.questionIds.filter(id => latest.has(id));
    const mistakes = answered.filter(id => latest.get(id) === false).length;
    return mistakes ? [{lesson, mistakes, attempted: answered.length, accuracy: Math.round((answered.length - mistakes) / answered.length * 100)}] : [];
  }).sort((a, b) => a.accuracy - b.accuracy || b.mistakes - a.mistakes || a.lesson.number - b.lesson.number);
}

export function getRecommendation(progress: Progress, now = new Date()) {
  const due = dueQuestionIds(progress, now);
  const weak = getWeakTopics(progress)[0];
  const completed = getStats(progress, now).completed;
  if (due.length) return {lesson: weak?.lesson ?? lessons[0], reason: 'review' as const, dueCount: due.length};
  if (weak) return {lesson: weak.lesson, reason: 'weak' as const, dueCount: 0};
  const diagnostic = [...progress.sessions].reverse().find(session => session.lessonId === 'placement');
  if (completed.size === 0 && diagnostic && diagnostic.answers.length === 10 && diagnostic.answers.every(answer => answer.correct)) {
    return {lesson: getLessonMeta('n5-invitations') ?? lessons[0], reason: 'next' as const, dueCount: 0};
  }
  const next = lessons.find(lesson => !completed.has(lesson.id));
  return {lesson: next ?? lessons[0], reason: next ? 'next' as const : 'complete' as const, dueCount: 0};
}
