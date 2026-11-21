// Builds sentence-building exercises from the curriculum (run after `npm run content`):
//   npm run sentences
// Each sentence is split into phrase chunks (a content word plus the particles and endings that
// follow it) with kuromoji, the same dictionary used for furigana. Runs only at build time.
// Outputs (committed):
//   public/sentences/<level>.json         exercises, fetched per level (static: not in the Worker)
//   src/content/generated/sentences.json  counts and content hashes for cache busting
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import kuromoji from 'kuromoji';
import type {Lesson} from '../src/content/schemas.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const LEVELS = ['N5', 'N4', 'N3'] as const;
const MIN_CHUNKS = 3;
const MAX_CHUNKS = 7;
const MAX_LENGTH = 40;
const BLANK = '（　）';
const END = /[。？！?!]$/;

type Chunk = {text: string; ruby?: string};
type Exercise = {id: string; japanese: string; ruby?: string; end: string; translations: {en: string; ru: string}; chunks: Chunk[]};

const dicPath = require.resolve('kuromoji/package.json').replace(/package\.json$/, 'dict');
const tokenizer = await new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>((resolve, reject) =>
  kuromoji.builder({dicPath}).build((error, built) => error ? reject(error) : resolve(built)));

/** Splits a sentence (without its final punctuation) into phrase chunks. */
export function chunk(text: string): string[] {
  const chunks: string[] = [];
  let previous: kuromoji.IpadicFeatures | null = null;
  for (const token of tokenizer.tokenize(text)) {
    const attaches = previous !== null && (
      ['助詞', '助動詞', '記号'].includes(token.pos) ||
      ['接尾', '非自立'].includes(token.pos_detail_1) ||
      previous.pos === '接頭詞' ||
      // Keep compound nouns and numbers together: 日本 + 語, 七 + 時 + 半.
      (token.pos === '名詞' && previous.pos === '名詞' && previous.pos_detail_1 !== '代名詞') ||
      // Verb stems with their endings: 食べ + たい, 行き + ます.
      (token.pos === '動詞' && previous.pos === '動詞')
    );
    if (attaches) chunks[chunks.length - 1] += token.surface_form;
    else chunks.push(token.surface_form);
    previous = token;
  }
  return chunks;
}

/** Splits 漢字{かんじ} notation at the given plain-text chunk boundaries. A chunk whose furigana would
 *  have to be cut in half gets none, which only means no furigana for that chunk. */
function splitRuby(ruby: string, chunks: string[]): (string | undefined)[] {
  const units = [...ruby.matchAll(/([^{}]+?)\{([^{}]+)\}|([^{}])/g)].flatMap(match => {
    if (match[3]) return [{plain: match[3], text: match[3]}];
    // The base is the trailing kanji run; the kana before it are separate plain characters.
    const chunkText = match[1];
    const base = chunkText.match(/[㐀-鿿豈-﫿々〆ヶ]+$/)?.[0] ?? chunkText;
    return [...chunkText.slice(0, chunkText.length - base.length)].map(c => ({plain: c, text: c})).concat({plain: base, text: `${base}{${match[2]}}`});
  });
  const out: (string | undefined)[] = [];
  let unit = 0;
  for (const text of chunks) {
    let plain = '';
    let annotated = '';
    while (plain.length < text.length && unit < units.length) {plain += units[unit].plain; annotated += units[unit].text; unit++;}
    if (plain !== text) return chunks.map(() => undefined); // Boundaries do not line up: no furigana at all.
    out.push(annotated.includes('{') ? annotated : undefined);
  }
  return out;
}

const errors: string[] = [];
const index: {levels: Record<string, {count: number; version: string}>} = {levels: {}};
rmSync(`${root}public/sentences`, {recursive: true, force: true});
mkdirSync(`${root}public/sentences`, {recursive: true});

for (const level of LEVELS) {
  const lessons = JSON.parse(readFileSync(`${root}public/content/${level.toLowerCase()}.json`, 'utf8')) as Lesson[];
  const candidates: Omit<Exercise, 'chunks' | 'end' | 'id'>[] = [];
  for (const lesson of lessons) {
    if (lesson.category !== 'grammar') continue;
    for (const example of lesson.examples) candidates.push({japanese: example.japanese, ruby: example.ruby, translations: example.translations});
    for (const question of lesson.questions) {
      if (question.prompt.split(BLANK).length !== 2) continue;
      const choice = question.choices.indexOf(question.answer);
      const rubyPrompt = question.ruby?.prompt;
      candidates.push({
        japanese: question.prompt.replace(BLANK, question.answer),
        ruby: rubyPrompt && rubyPrompt.split(BLANK).length === 2 ? rubyPrompt.replace(BLANK, question.ruby?.choices[choice] ?? question.answer) : undefined,
        translations: question.translation
      });
    }
  }
  const seen = new Set<string>();
  const exercises: Exercise[] = [];
  for (const candidate of candidates) {
    const {japanese} = candidate;
    if (seen.has(japanese) || !END.test(japanese) || [...japanese].length > MAX_LENGTH || /[「」（）()]/.test(japanese)) continue;
    seen.add(japanese);
    const end = japanese.slice(-1);
    const body = japanese.slice(0, -1);
    if (/[。？！?!]/.test(body)) continue; // Two sentences in one example: not one ordering task.
    const texts = chunk(body);
    if (texts.length < MIN_CHUNKS || texts.length > MAX_CHUNKS || texts.join('') !== body) continue;
    // A sentence whose chunks are all the same cannot be shuffled into a different order.
    if (new Set(texts).size < 2) continue;
    const rubies = candidate.ruby?.endsWith(end) ? splitRuby(candidate.ruby.slice(0, -1), texts) : texts.map(() => undefined);
    const id = `${level.toLowerCase()}-${createHash('sha256').update(japanese).digest('hex').slice(0, 10)}`;
    exercises.push({id, ...candidate, end, chunks: texts.map((text, i) => rubies[i] ? {text, ruby: rubies[i]} : {text})});
  }
  if (exercises.length < 20) errors.push(`${level}: only ${exercises.length} sentence exercises`);
  const body = `${JSON.stringify(exercises)}\n`;
  writeFileSync(`${root}public/sentences/${level.toLowerCase()}.json`, body);
  index.levels[level] = {count: exercises.length, version: createHash('sha256').update(body).digest('hex').slice(0, 12)};
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
writeFileSync(`${root}src/content/generated/sentences.json`, `${JSON.stringify(index, null, 1)}\n`);
console.log(`Sentences: ${LEVELS.map(level => `${level} ${index.levels[level].count}`).join(', ')}.`);
