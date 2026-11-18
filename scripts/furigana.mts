// Build-time furigana: annotates kanji with readings using kuromoji (IPADIC).
// Output notation: 漢字{かんじ} — parsed by src/components/ruby.tsx. Runs only at build time.
import {createRequire} from 'node:module';
import {readFileSync, existsSync} from 'node:fs';
import kuromoji from 'kuromoji';

const require = createRequire(import.meta.url);
const KANJI = /[㐀-鿿豈-﫿々〆ヶ]/;
const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

export type Annotator = (text: string) => string;

/** Splits a token into kanji runs (with readings) and kana, e.g. 食べる/たべる → 食{た}べる. */
export function align(surface: string, reading: string): string {
  const parts = surface.match(/[㐀-鿿豈-﫿々〆ヶ]+|[^㐀-鿿豈-﫿々〆ヶ]+/g) ?? [surface];
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('^' + parts.map(p => KANJI.test(p) ? '(.+?)' : escape(toHiragana(p))).join('') + '$');
  const match = toHiragana(reading).match(pattern);
  if (!match) return `${surface}{${toHiragana(reading)}}`;
  let group = 1;
  return parts.map(p => KANJI.test(p) ? `${p}{${match[group++]}}` : p).join('');
}

export async function createAnnotator(overridesPath: string): Promise<Annotator> {
  const dicPath = require.resolve('kuromoji/package.json').replace(/package\.json$/, 'dict');
  const tokenizer = await new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>((resolve, reject) =>
    kuromoji.builder({dicPath}).build((error, built) => error ? reject(error) : resolve(built)));
  // Corrections for readings the dictionary gets wrong: {"surface": "reading"}.
  const overrides: Record<string, string> = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {};
  const overrideKeys = Object.keys(overrides).sort((a, b) => b.length - a.length);

  function annotatePlain(text: string): string {
    return tokenizer.tokenize(text).map(token => {
      const surface = token.surface_form;
      if (!KANJI.test(surface) || !token.reading || token.reading === '*') return surface;
      return align(surface, token.reading);
    }).join('');
  }

  return text => {
    if (!KANJI.test(text) || /[{}]/.test(text)) return text;
    // Apply overrides first, then annotate the remaining segments.
    let out = '';
    let rest = text;
    while (rest) {
      let best = -1; let key = '';
      for (const k of overrideKeys) {const i = rest.indexOf(k); if (i >= 0 && (best < 0 || i < best)) {best = i; key = k;}}
      if (best < 0) {out += annotatePlain(rest); break;}
      out += annotatePlain(rest.slice(0, best)) + align(key, overrides[key]);
      rest = rest.slice(best + key.length);
    }
    return out;
  };
}
