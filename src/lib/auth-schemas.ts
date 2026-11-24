import {z} from 'zod';
import {getLessonMeta, isEarlierQuestion, isKnownQuestion, placementQuestions, practiceSize} from '@/content/catalog';

const localeSchema = z.enum(['en', 'ru']);
export const pkceFlowIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/);
const email = z.email().max(254).transform(value => value.trim().toLowerCase());
const password = z.string().min(1).refine(value => new TextEncoder().encode(value).length <= 72, 'Password must be at most 72 bytes');
export const loginSchema = z.object({email, password, locale: localeSchema});
export const registerSchema = loginSchema.extend({password: password.refine(value => value.length >= 12, 'Use at least 12 characters')});
export const recoverySchema = z.object({email, locale: localeSchema});
export const newPasswordSchema = z.object({password: registerSchema.shape.password});
export const preferencesSchema = z.object({
  locale: localeSchema.optional(), dailyGoal: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).optional()
}).strict().refine(value => value.locale !== undefined || value.dailyGoal !== undefined);

export const submissionSchema = z.object({
  id: z.uuid(), lessonId: z.string().min(1).max(100),
  durationSeconds: z.number().int().min(0).max(3600),
  answers: z.array(z.object({questionId: z.string().min(1).max(100), answer: z.string().trim().min(1).max(120)}).strict()).min(1).max(100)
}).strict().superRefine((value, context) => {
  const ids = value.answers.map(a => a.questionId);
  const lesson = getLessonMeta(value.lessonId);
  const expected = lesson?.questionIds ?? (value.lessonId === 'placement' ? placementQuestions.map(q => q.id) : null);
  // A lesson's practice holds all of its own questions, topped up to PRACTICE_SIZE from earlier lessons.
  const allowed = (id: string) => value.lessonId === 'review' ? isKnownQuestion(id) : Boolean(expected?.includes(id) || (lesson && isEarlierQuestion(lesson, id)));
  const complete = value.lessonId === 'review' || Boolean(expected?.every(id => ids.includes(id)) && ids.length <= (lesson ? practiceSize(lesson) : expected!.length));
  if ((!expected && value.lessonId !== 'review') || new Set(ids).size !== ids.length || ids.some(id => !allowed(id)) || !complete) {
    context.addIssue({code: 'custom', message: 'Invalid lesson questions'});
  }
});
export type SubmittedAnswer = z.infer<typeof submissionSchema>['answers'][number];
export function callbackLocale(value: string | null): 'en' | 'ru' {return value === 'ru' ? 'ru' : 'en';}
