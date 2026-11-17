import {describe, expect, it} from 'vitest';
import {allQuestions, isCorrect, lessons, lessonSchema, placementQuestions, questionSchema, vocabulary} from '@/content/lessons';
import {addSession, answerInputSchema, dueQuestions, getRecommendation, getStats, getWeakTopics, initialProgress, parseProgress, progressSchema, type Session} from '@/lib/progress';
import {getPlusPrice} from '@/lib/config';

const now = new Date('2026-11-17T10:00:00Z');
const makeSession = (changes: Partial<Session> = {}): Session => ({
  id: 'test-session-1', lessonId: 'n5-wa-desu', at: now.toISOString(), durationSeconds: 120,
  answers: [{questionId: 'wa-1', correct: true}, {questionId: 'wa-2', correct: false}, {questionId: 'wa-3', correct: true}],
  ...changes
});

describe('N5 curriculum validation', () => {
  it('validates 20 grammar topics, 100 words and 100 questions', () => {
    expect(lessons).toHaveLength(30);
    expect(lessons.filter(l => l.category === 'grammar')).toHaveLength(20);
    expect(vocabulary).toHaveLength(100);
    expect(allQuestions).toHaveLength(100);
    expect(new Set(allQuestions.map(q => q.id)).size).toBe(100);
    expect(new Set(lessons.map(l => l.id)).size).toBe(30);
    expect(new Set(vocabulary.map(w => w.id)).size).toBe(100);
    expect(new Set(vocabulary.map(w => w.japanese)).size).toBe(100);
    lessons.forEach(lesson => expect(lessonSchema.safeParse(lesson).success).toBe(true));
  });
  it('provides study material, examples, readings and bilingual meanings before practice', () => {
    for (const lesson of lessons) {
      expect(lesson.study.en.length).toBeGreaterThan(50);
      expect(lesson.study.ru.length).toBeGreaterThan(50);
      expect(lesson.examples.length).toBeGreaterThan(0);
      if (lesson.category === 'vocabulary') expect(lesson.words).toHaveLength(10);
    }
    for (const word of vocabulary) {
      expect(word.reading).not.toBe('');
      expect(word.meanings.en).not.toBe('');
      expect(word.meanings.ru).not.toBe('');
    }
  });
  it('has distinct exercises and valid vocabulary question references', () => {
    const signatures = allQuestions.map(q => JSON.stringify([q.prompt, q.translation.en, [...q.choices].sort()]));
    expect(new Set(signatures).size).toBe(100);
    for (const question of allQuestions.filter(q => q.wordId)) {
      const word = vocabulary.find(w => w.id === question.wordId);
      expect(word?.japanese).toBe(question.answer);
    }
  });
  it('provides explanations in both languages for every question', () => {
    for (const question of allQuestions) {
      expect(question.explanation.en.length).toBeGreaterThan(20);
      expect(question.explanation.ru.length).toBeGreaterThan(20);
      expect(question.translation.ru).not.toBe('');
    }
  });
  it('rejects incorrect option counts, duplicate choices, or missing answers', () => {
    const question = allQuestions[0];
    expect(questionSchema.safeParse({...question, choices: ['は']}).success).toBe(false);
    expect(questionSchema.safeParse({...question, choices: ['は', 'は', 'に', 'で']}).success).toBe(false);
    expect(questionSchema.safeParse({...question, answer: 'が'}).success).toBe(false);
    expect(questionSchema.safeParse({...question, explanation: {en: 'only english'}}).success).toBe(false);
  });
  it('normalizes whitespace and full-width text without accepting a wrong answer', () => {
    expect(isCorrect(allQuestions[0], ' は ')).toBe(true);
    expect(isCorrect(allQuestions[0], 'を')).toBe(false);
    expect(isCorrect(allQuestions[0], '')).toBe(false);
  });
  it('bounds and validates learner input', () => {
    expect(answerInputSchema.safeParse({questionId: 'wa-1', answer: '  '}).success).toBe(false);
    expect(answerInputSchema.safeParse({questionId: 'wa-1', answer: 'a'.repeat(121)}).success).toBe(false);
    expect(answerInputSchema.safeParse({questionId: 'wa-1', answer: 'は'}).success).toBe(true);
  });
});

describe('Local learning progress', () => {
  it('starts with no invented achievements', () => {
    const stats = getStats(initialProgress, now);
    expect(stats.completed.size).toBe(0); expect(stats.words).toBe(0);
    expect(stats.accuracy).toBeNull(); expect(stats.streak).toBe(0);
  });
  it('safely handles corrupt or outdated stored data', () => {
    expect(parseProgress(null)).toEqual(initialProgress);
    expect(parseProgress('not json')).toEqual(initialProgress);
    expect(parseProgress('{"version":99}')).toEqual(initialProgress);
  });
  it('validates stored settings and references to real curriculum items', () => {
    expect(progressSchema.safeParse({...initialProgress, dailyGoal: -1}).success).toBe(false);
    expect(progressSchema.safeParse({...initialProgress, sessions: [makeSession({lessonId: 'unknown'})]}).success).toBe(false);
    expect(progressSchema.safeParse({...initialProgress, sessions: [makeSession({answers: [{questionId: 'unknown', correct: true}]})]}).success).toBe(false);
  });
  it('records accuracy, completed lessons, duration, and missed questions', () => {
    const progress = addSession(initialProgress, makeSession());
    const stats = getStats(progress, now);
    expect(stats.completed.has('n5-wa-desu')).toBe(true);
    expect(stats.accuracy).toBe(67); expect(stats.total).toBe(3);
    expect(stats.todayMinutes).toBe(2); expect(stats.streak).toBe(1);
    expect(progress.reviews).toHaveLength(1);
    expect(progress.reviews[0].questionId).toBe('wa-2');
  });
  it('does not record a submitted session twice', () => {
    const progress = addSession(initialProgress, makeSession());
    expect(addSession(progress, makeSession()).sessions).toHaveLength(1);
  });
  it('keeps all progress independent of display language', () => {
    const progress = addSession(initialProgress, makeSession());
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
    expect(JSON.stringify(progress)).not.toMatch(/"locale"|"language"/);
  });
  it('preserves original three-question results when the curriculum is expanded', () => {
    const old = {...initialProgress, sessions: [makeSession(), makeSession({id: 'old-vocabulary', lessonId: 'n5-everyday', answers: [{questionId: 'word-1', correct: true}, {questionId: 'word-2', correct: true}, {questionId: 'word-3', correct: false}]})]};
    const restored = parseProgress(JSON.stringify(old));
    expect(restored.sessions).toHaveLength(2);
    expect(getStats(restored, now).completed.size).toBe(2);
    expect(getStats(restored, now).words).toBe(3);
  });
  it('rejects duplicate question records and a question submitted under the wrong lesson', () => {
    expect(() => addSession(initialProgress, makeSession({answers: [{questionId: 'wa-1', correct: true}, {questionId: 'wa-1', correct: false}]}))).toThrow();
    expect(() => addSession(initialProgress, makeSession({lessonId: 'n5-ka'}))).toThrow();
  });
  it('schedules missed questions after 10 minutes, then correct reviews after 1 and 3 days', () => {
    let progress = addSession(initialProgress, makeSession());
    expect(dueQuestions(progress, now)).toHaveLength(0);
    const reviewAt = new Date(now.getTime() + 600000);
    expect(dueQuestions(progress, reviewAt).map(q => q.id)).toEqual(['wa-2']);
    progress = addSession(progress, makeSession({id: 'review-1', lessonId: 'review', at: reviewAt.toISOString(), answers: [{questionId: 'wa-2', correct: true}]}));
    expect(progress.reviews[0].step).toBe(1);
    expect(Date.parse(progress.reviews[0].due) - reviewAt.getTime()).toBe(86400000);
    const nextAt = progress.reviews[0].due;
    progress = addSession(progress, makeSession({id: 'review-2', lessonId: 'review', at: nextAt, answers: [{questionId: 'wa-2', correct: true}]}));
    expect(Date.parse(progress.reviews[0].due) - Date.parse(nextAt)).toBe(3 * 86400000);
  });
  it('does not count review sessions as a new completed lesson', () => {
    const progress = addSession(initialProgress, makeSession({lessonId: 'review'}));
    expect(getStats(progress, now).completed.size).toBe(0);
  });
  it('counts practiced vocabulary words uniquely', () => {
    const session = makeSession({lessonId: 'n5-everyday', answers: [{questionId: 'word-1', correct: true}]});
    let progress = addSession(initialProgress, session);
    progress = addSession(progress, {...session, id: 'second-try'});
    expect(getStats(progress, now).words).toBe(1);
  });
  it('falls back to 980 yen for invalid price configuration', () => {
    expect(getPlusPrice('1200')).toBe(1200);
    expect(getPlusPrice('not-a-price')).toBe(980);
    expect(getPlusPrice('-1')).toBe(980);
    expect(getPlusPrice('')).toBe(980);
  });
});

describe('Recommendations and a diagnostic starting point', () => {
  it('starts with the first lesson and advances after a correct attempt', () => {
    expect(getRecommendation(initialProgress, now).lesson.id).toBe('n5-wa-desu');
    const progress = addSession(initialProgress, makeSession({answers: [{questionId: 'wa-1', correct: true}, {questionId: 'wa-2', correct: true}, {questionId: 'wa-3', correct: true}]}));
    expect(getRecommendation(progress, now).lesson.id).toBe('n5-everyday');
  });
  it('prioritizes mistakes, then due reviews, and lets a corrected topic recover', () => {
    let progress = addSession(initialProgress, makeSession());
    expect(getRecommendation(progress, now).reason).toBe('weak');
    expect(getWeakTopics(progress)[0].lesson.id).toBe('n5-wa-desu');
    expect(getRecommendation(progress, new Date(now.getTime() + 600000)).reason).toBe('review');
    progress = addSession(progress, makeSession({id: 'corrected', at: new Date(now.getTime() + 1000).toISOString(), answers: [{questionId: 'wa-2', correct: true}]}));
    expect(getWeakTopics(progress)).toHaveLength(0);
    expect(getRecommendation(progress, new Date(now.getTime() + 1000)).reason).toBe('next');
  });
  it('records a ten-question diagnostic without marking ten lessons complete', () => {
    expect(placementQuestions).toHaveLength(10);
    expect(new Set(placementQuestions.map(q => q.id)).size).toBe(10);
    const progress = addSession(initialProgress, makeSession({lessonId: 'placement', answers: placementQuestions.map(q => ({questionId: q.id, correct: q.id !== 'aru-1'}))}));
    expect(getStats(progress, now).completed.size).toBe(0);
    expect(getStats(progress, now).accuracy).toBe(90);
    expect(getRecommendation(progress, now).lesson.id).toBe('n5-arimasu');
  });
  it('offers a later practice topic after a completely correct diagnostic', () => {
    const progress = addSession(initialProgress, makeSession({lessonId: 'placement', answers: placementQuestions.map(q => ({questionId: q.id, correct: true}))}));
    expect(getRecommendation(progress, now).lesson.id).toBe('n5-invitations');
    expect(getStats(progress, now).completed.size).toBe(0);
  });
});
