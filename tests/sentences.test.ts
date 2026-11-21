import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import index from '../src/content/generated/sentences.json';
import {isSentenceCorrect, shuffledChunks, type SentenceExercise} from '../src/content/sentences';

const levelData = (level: string) => JSON.parse(readFileSync(`public/sentences/${level.toLowerCase()}.json`, 'utf8')) as SentenceExercise[];

describe('sentence-building exercises', () => {
  it('has well-formed exercises for every level', () => {
    for (const level of ['N5', 'N4', 'N3']) {
      const exercises = levelData(level);
      expect(exercises.length).toBe((index.levels as Record<string, {count: number}>)[level].count);
      expect(exercises.length).toBeGreaterThanOrEqual(100);
      expect(new Set(exercises.map(e => e.id)).size).toBe(exercises.length);
      for (const exercise of exercises) {
        // The chunks spell the sentence exactly, without its final punctuation.
        expect(exercise.chunks.map(c => c.text).join('') + exercise.end, exercise.japanese).toBe(exercise.japanese);
        expect(exercise.chunks.length).toBeGreaterThanOrEqual(3);
        expect(exercise.chunks.length).toBeLessThanOrEqual(7);
        expect(exercise.translations.en && exercise.translations.ru).toBeTruthy();
        for (const chunk of exercise.chunks) {
          if (chunk.ruby) expect(chunk.ruby.replace(/\{[^}]*\}/g, '')).toBe(chunk.text);
        }
      }
    }
  });

  it('grades by the sentence spelled, and never starts from the answer', () => {
    const exercise = levelData('N5')[0];
    const model = exercise.chunks.map((_, i) => i);
    expect(isSentenceCorrect(exercise, model)).toBe(true);
    expect(isSentenceCorrect(exercise, [...model].reverse())).toBe(false);
    expect(isSentenceCorrect(exercise, model.slice(1))).toBe(false);
    for (let seed = 0; seed < 50; seed++) {
      let state = seed + 1;
      const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
      const order = shuffledChunks(exercise, random);
      expect([...order].sort()).toEqual(model);
      expect(isSentenceCorrect(exercise, order)).toBe(false);
    }
    // Identical chunks may swap places.
    const twin: SentenceExercise = {...exercise, japanese: 'はいはいいいえ。', end: '。', chunks: [{text: 'はい'}, {text: 'はい'}, {text: 'いいえ'}]};
    expect(isSentenceCorrect(twin, [1, 0, 2])).toBe(true);
  });
});
