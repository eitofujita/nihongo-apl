// Kanji search for the list and test pages. Pure functions: matches a kanji by the character itself,
// its English/Russian meaning, or a reading typed in hiragana, katakana or romaji (many learners have
// no Japanese keyboard).
import type {KanjiInfo} from '@/content/kanji';

const CJK = /[㐀-鿿豈-﫿々]/u;
const KANA = /^[ぁ-ゖァ-ヺー]+$/u;

export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/gu, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// Hepburn plus common alternatives (si, ti, tu, hu, zi, sya…). Longest keys are tried first.
const ROMAJI: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ', za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と', da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ', ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', wa: 'わ', wo: 'を',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ', sya: 'しゃ', syu: 'しゅ', syo: 'しょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ'
};
for (const [consonant, kana] of Object.entries({k: 'き', g: 'ぎ', n: 'に', h: 'ひ', b: 'び', p: 'ぴ', m: 'み', r: 'り'})) {
  ROMAJI[`${consonant}ya`] = `${kana}ゃ`; ROMAJI[`${consonant}yu`] = `${kana}ゅ`; ROMAJI[`${consonant}yo`] = `${kana}ょ`;
}

/** Converts romaji to hiragana, or returns null when the text is not entirely romaji. */
export function romajiToHiragana(input: string): string | null {
  const text = input.toLowerCase().replace(/[āâ]/g, 'aa').replace(/[īî]/g, 'ii').replace(/[ūû]/g, 'uu').replace(/[ēê]/g, 'ee').replace(/[ōô]/g, 'ou');
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "'" || c === '-') {i++; continue;}
    // A doubled consonant is a small っ (gakkou → がっこう).
    if (c === text[i + 1] && /[bcdfghjkmprstwyz]/.test(c)) {out += 'っ'; i++; continue;}
    if (c === 't' && text.startsWith('tch', i)) {out += 'っ'; i++; continue;}
    // ん: "nn", or "n" not followed by a vowel or y.
    if (c === 'n' && (text[i + 1] === 'n' || !/[aiueoy]/.test(text[i + 1] ?? ''))) {out += 'ん'; i += text[i + 1] === 'n' ? 2 : 1; continue;}
    const match = [3, 2, 1].map(size => text.slice(i, i + size)).find(key => ROMAJI[key]);
    if (!match) return null;
    out += ROMAJI[match];
    i += match.length;
  }
  return out || null;
}

/** All readings in hiragana, with okurigana (after ".") both kept and stripped: まな.ぶ → まなぶ, まな. */
function readingsOf(kanji: KanjiInfo): string[] {
  return [...kanji.on.map(toHiragana), ...kanji.kun.flatMap(reading => [reading.replace('.', ''), reading.split('.')[0]])];
}

/** 0 = best match, higher = weaker, null = no match. */
function score(kanji: KanjiInfo, query: string): number | null {
  const chars = [...query].filter(c => CJK.test(c));
  if (chars.length) return chars.includes(kanji.char) ? 0 : null;

  let best: number | null = null;
  const consider = (value: number) => {best = best === null ? value : Math.min(best, value);};
  const kana = KANA.test(query) ? toHiragana(query) : romajiToHiragana(query.replace(/\s+/g, ''));
  if (kana) {
    for (const reading of readingsOf(kanji)) {
      if (reading === kana) consider(1);
      else if (reading.startsWith(kana)) consider(3);
    }
  }
  if (!KANA.test(query)) {
    for (const meaning of [kanji.meanings.en, kanji.meanings.ru]) {
      const text = meaning.toLocaleLowerCase();
      const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      if (words.includes(query) || text === query) consider(1);
      else if (words.some(word => word.startsWith(query)) || (query.includes(' ') && text.includes(query))) consider(2);
    }
  }
  return best;
}

/** Kanji matching the query, best matches first; list order is kept among equal matches. */
export function searchKanji(list: KanjiInfo[], rawQuery: string): KanjiInfo[] {
  const query = rawQuery.normalize('NFKC').trim().toLocaleLowerCase();
  if (!query) return list;
  return list
    .map((kanji, index) => ({kanji, index, rank: score(kanji, query)}))
    .filter((item): item is {kanji: KanjiInfo; index: number; rank: number} => item.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(item => item.kanji);
}
