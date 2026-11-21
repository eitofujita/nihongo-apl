import {describe, expect, it} from 'vitest';
import {kanjiList} from '../src/content/kanji';
import {romajiToHiragana, searchKanji, toHiragana} from '../src/lib/kanji-search';

const chars = (query: string) => searchKanji(kanjiList, query).map(kanji => kanji.char);

describe('kana conversion', () => {
  it('converts katakana and romaji to hiragana', () => {
    expect(toHiragana('ガク')).toBe('がく');
    expect(romajiToHiragana('mizu')).toBe('みず');
    expect(romajiToHiragana('gakkou')).toBe('がっこう');
    expect(romajiToHiragana('shinbun')).toBe('しんぶん');
    expect(romajiToHiragana("kin'you")).toBe('きんよう');
    expect(romajiToHiragana('kyou')).toBe('きょう');
    expect(romajiToHiragana('tōkyō')).toBe('とうきょう');
    expect(romajiToHiragana('water')).toBeNull();
  });
});

describe('kanji search', () => {
  it('returns everything for an empty query', () => {
    expect(searchKanji(kanjiList, '  ')).toHaveLength(kanjiList.length);
  });

  it('finds kanji by the character, including inside a pasted word', () => {
    expect(chars('学校')).toEqual(['学', '校']);
    expect(chars('水')).toEqual(['水']);
  });

  it('finds kanji by English or Russian meaning, whole words first', () => {
    expect(chars('water')[0]).toBe('水');
    expect(chars('Water')[0]).toBe('水');
    expect(chars('вода')[0]).toBe('水');
    expect(chars('wat')).toContain('水');
    expect(chars('one')).toContain('一');
    expect(chars('one')).not.toContain('金'); // "money" contains "one" but does not start with it.
  });

  it('finds kanji by reading in hiragana, katakana or romaji', () => {
    for (const query of ['みず', 'ミズ', 'mizu']) expect(chars(query)[0], query).toBe('水');
    expect(chars('がく')).toContain('学');
    expect(chars('まなぶ')).toContain('学'); // okurigana is part of the reading
    expect(chars('gaku')).toContain('学');
  });

  it('shows nothing for a query that matches nothing', () => {
    expect(chars('zzzz')).toEqual([]);
  });
});
