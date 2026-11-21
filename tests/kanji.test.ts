import {readFileSync, existsSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import index from '../src/content/generated/kanji.json';
import en from '../messages/en.json';
import {gradeStroke, gradeStrokeAt, pathLength, pathToPoints, resample, type Point} from '../src/lib/kanji-stroke';
import {parseKanjiStore, recordAttempt} from '../src/lib/kanji-progress';

const strokesOf = (id: string): Point[][] =>
  (JSON.parse(readFileSync(`public/kanji/${id}.json`, 'utf8')) as {strokes: string[]}).strokes.map(pathToPoints);
const idOf = (char: string) => char.codePointAt(0)!.toString(16).padStart(5, '0');

// A hand-drawn-looking copy: shifted, scaled, with a slow wobble.
function wobble(points: Point[], dx = 4, dy = -3, amplitude = 3): Point[] {
  const [cx, cy] = points[0];
  return resample(points, 30).map(([x, y], i) => [cx + (x - cx) * 1.1 + dx + amplitude * Math.sin(i / 4), cy + (y - cy) * 1.1 + dy + amplitude * Math.cos(i / 5)]);
}

describe('kanji data', () => {
  it('has stroke files for every listed kanji', () => {
    expect(index.length).toBeGreaterThanOrEqual(100);
    expect(new Set(index.map(k => k.char)).size).toBe(index.length);
    for (const kanji of index) {
      expect(kanji.id).toBe(idOf(kanji.char));
      expect(existsSync(`public/kanji/${kanji.id}.json`), kanji.char).toBe(true);
      expect(strokesOf(kanji.id)).toHaveLength(kanji.strokes);
      expect(kanji.meanings.en && kanji.meanings.ru, kanji.char).toBeTruthy();
    }
    expect(existsSync('public/kanji/LICENSE.txt')).toBe(true);
  });
  it('covers N5 and N4 without listing a kanji twice', () => {
    expect(index.filter(k => k.level === 'N5').length).toBeGreaterThanOrEqual(100);
    expect(index.filter(k => k.level === 'N4').length).toBeGreaterThanOrEqual(140);
    expect(index.every(k => k.level === 'N5' || k.level === 'N4')).toBe(true);
  });

  it('shows how every kanji is used, with words and sentences that contain it', () => {
    for (const kanji of index) {
      const detail = JSON.parse(readFileSync(`public/kanji/${kanji.id}.json`, 'utf8')) as {
        words: {japanese: string; reading: string; meanings: {en: string; ru: string}}[];
        sentences: {japanese: string; ruby?: string; translations: {en: string; ru: string}}[];
      };
      expect(detail.words.length, kanji.char).toBeGreaterThanOrEqual(1);
      expect(detail.words.length).toBeLessThanOrEqual(4);
      for (const word of detail.words) {
        expect(word.japanese, kanji.char).toContain(kanji.char);
        expect(word.reading).toMatch(/^[ぁ-ゖァ-ヺー・〜～／]+$/);
        expect(word.meanings.en && word.meanings.ru).toBeTruthy();
      }
      expect(new Set(detail.words.map(word => word.japanese)).size).toBe(detail.words.length);
      for (const sentence of detail.sentences) {
        expect(sentence.japanese, kanji.char).toContain(kanji.char);
        expect(sentence.japanese).toMatch(/[。？！?!]$/);
        expect(sentence.translations.en && sentence.translations.ru).toBeTruthy();
        // Furigana notation must spell out the same sentence once the readings are removed.
        if (sentence.ruby) expect(sentence.ruby.replace(/\{[^}]*\}/g, '')).toBe(sentence.japanese);
      }
      expect(detail.sentences.length, `${kanji.char} has no example sentence`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('stroke geometry', () => {
  it('parses KanjiVG paths with relative and smooth curves', () => {
    const [first] = strokesOf(idOf('水'));
    expect(first[0]).toEqual([52.77, 15.08]);
    expect(pathLength(first)).toBeGreaterThan(70);
    expect(() => pathToPoints('M0,0 Q1,1 2,2')).toThrow(/Unsupported/);
  });

  it('resamples to evenly spaced points', () => {
    const points = resample([[0, 0], [10, 0]], 6);
    expect(points).toHaveLength(6);
    expect(points[2][0]).toBeCloseTo(4);
  });

  it('accepts every model stroke and a hand-drawn copy of it', () => {
    for (const kanji of index) {
      const strokes = strokesOf(kanji.id);
      strokes.forEach((stroke, i) => {
        expect(gradeStrokeAt(stroke, strokes, i).ok, `${kanji.char} stroke ${i + 1}`).toBe(true);
        expect(gradeStrokeAt(wobble(stroke), strokes, i).ok, `${kanji.char} wobbly stroke ${i + 1}`).toBe(true);
      });
    }
  });

  it('rejects the next stroke when it is written too early', () => {
    for (const kanji of index) {
      const strokes = strokesOf(kanji.id);
      for (let i = 0; i + 1 < strokes.length; i++) {
        expect(gradeStrokeAt(strokes[i + 1], strokes, i).ok, `${kanji.char} stroke ${i + 2} for ${i + 1}`).toBe(false);
      }
    }
  });

  it('explains common mistakes', () => {
    const [stroke] = strokesOf(idOf('一'));
    expect(gradeStroke([...stroke].reverse(), stroke)).toEqual({ok: false, reason: 'direction'});
    expect(gradeStroke(stroke.map(([x, y]) => [x, y + 40] as Point), stroke)).toEqual({ok: false, reason: 'position'});
    expect(gradeStroke([[50, 50], [51, 50]], stroke)).toEqual({ok: false, reason: 'tooShort'});
    const strokes = strokesOf(idOf('三'));
    expect(gradeStrokeAt(strokes[2], strokes, 0)).toEqual({ok: false, reason: 'order'});
  });

  it('has a message for every mistake reason', () => {
    for (const reason of ['tooShort', 'direction', 'shape', 'position', 'order']) expect(en.App).toHaveProperty(`kanjiMiss_${reason}`);
  });
});

describe('kanji progress', () => {
  const at = new Date('2026-11-20T10:00:00Z');
  it('keeps the highest step passed with at most one mistake', () => {
    let store = recordAttempt({}, '水', 'trace', 0, at);
    expect(store['水']).toEqual({passed: 'trace', attempts: 1, at: at.toISOString()});
    store = recordAttempt(store, '水', 'recall', 3, at);
    expect(store['水'].passed).toBe('trace');
    store = recordAttempt(store, '水', 'recall', 1, at);
    expect(store['水'].passed).toBe('recall');
    store = recordAttempt(store, '水', 'trace', 0, at);
    expect(store['水']).toMatchObject({passed: 'recall', attempts: 4});
  });

  it('falls back to empty progress on damaged storage', () => {
    expect(parseKanjiStore(null)).toEqual({});
    expect(parseKanjiStore('{broken')).toEqual({});
    expect(parseKanjiStore(JSON.stringify({水: {passed: 'expert', attempts: 1, at: at.toISOString()}}))).toEqual({});
  });
});
