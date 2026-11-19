import {z} from 'zod';

export const localizedText = z.object({en: z.string().min(1), ru: z.string().min(1)});
export type LocalizedText = z.infer<typeof localizedText>;
export const wordSchema = z.object({
  id: z.string().min(1), japanese: z.string().min(1), reading: z.string().min(1), meanings: localizedText
});
export type Word = z.infer<typeof wordSchema>;
export const questionSchema = z.object({
  id: z.string().min(1), prompt: z.string().min(1), translation: localizedText,
  type: z.enum(['choice', 'fill']), choices: z.array(z.string().min(1)).length(4),
  answer: z.string().min(1), explanation: localizedText, wordId: z.string().optional(),
  // Furigana notation 漢字{かんじ}, generated at build time; plain fields stay the source of truth.
  ruby: z.object({prompt: z.string(), choices: z.array(z.string())}).optional()
}).superRefine((question, context) => {
  if (!question.choices.includes(question.answer)) context.addIssue({code: 'custom', message: 'Answer must be among choices'});
  if (new Set(question.choices).size !== 4) context.addIssue({code: 'custom', message: 'Choices must be distinct'});
});
export type Question = z.infer<typeof questionSchema>;
export const lessonSchema = z.object({
  id: z.string().min(1), number: z.number().int().positive(),
  category: z.enum(['grammar', 'vocabulary']), title: localizedText, description: localizedText,
  glyph: z.string(), color: z.enum(['green', 'peach', 'purple']),
  study: localizedText,
  examples: z.array(z.object({japanese: z.string().min(1), translations: localizedText, ruby: z.string().optional()})).min(1),
  words: z.array(wordSchema).default([]), questions: z.array(questionSchema).min(1)
});
export type Lesson = z.infer<typeof lessonSchema>;

export function text(en: string, ru: string): LocalizedText {return {en, ru};}
export function q(id: string, prompt: string, en: string, ru: string, choices: string[], answer: string, explanationEn: string, explanationRu: string, type: 'choice' | 'fill' = 'choice'): Question {
  return questionSchema.parse({id, prompt, translation: {en, ru}, choices, answer, explanation: {en: explanationEn, ru: explanationRu}, type});
}
