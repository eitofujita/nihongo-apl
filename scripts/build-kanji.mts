// Builds handwriting-practice data from content/kanji/*.txt, KanjiVG stroke SVGs and the curriculum.
// Run: npm run kanji -- <path to the extracted KanjiVG "kanji" directory>   (after `npm run content`)
//   (download kanjivg-YYYYMMDD-main.zip from https://github.com/KanjiVG/kanjivg/releases)
// Without a path, the stroke data already in public/kanji is reused, so example words and
// sentences can be refreshed after `npm run content` without downloading KanjiVG again.
// Outputs (committed, so the app never needs KanjiVG at build time):
//   src/content/generated/kanji.json   lightweight index shipped with the page
//   public/kanji/<codepoint>.json      stroke paths and usage examples, fetched per kanji
//                                      (static assets: they never count towards the Worker size)
// KanjiVG is © Ulrich Apel, CC BY-SA 3.0; the derived stroke files keep that licence.
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {pathToPoints} from '../src/lib/kanji-stroke.ts';
import type {Lesson} from '../src/content/schemas.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = process.argv[2];
if (source && !existsSync(source)) {
  console.error('Usage: npm run kanji -- [KanjiVG kanji directory]');
  process.exit(1);
}

const LEVELS = ['N5'] as const;
const CURRICULUM = ['n5', 'n4', 'n3'] as const;
const MAX_WORDS = 4;
const MAX_SENTENCES = 3;
type Entry = {id: string; char: string; level: string; on: string[]; kun: string[]; meanings: {en: string; ru: string}; strokes: number};
type ExampleWord = {japanese: string; reading: string; meanings: {en: string; ru: string}};
type ExampleSentence = {japanese: string; ruby?: string; translations: {en: string; ru: string}};
const errors: string[] = [];
const index: Entry[] = [];
const outDir = `${root}public/kanji`;

const list = (value: string) => value === '-' ? [] : value.split(',').map(s => s.trim()).filter(Boolean);

// ---------- Strokes ----------
function strokesFromKanjiVG(id: string, where: string): string[] | null {
  const svgPath = `${source}/${id}.svg`;
  if (!existsSync(svgPath)) {errors.push(`${where}: no KanjiVG file ${id}.svg`); return null;}
  const svg = readFileSync(svgPath, 'utf8');
  // Stroke paths are numbered -s1, -s2, … in writing order.
  const strokes = [...svg.matchAll(/<path id="kvg:[0-9a-f]+-s(\d+)"[^>]*\sd="([^"]+)"/g)]
    .map(match => ({n: Number(match[1]), d: match[2]})).sort((a, b) => a.n - b.n);
  if (!strokes.length || strokes.some((stroke, i) => stroke.n !== i + 1)) {errors.push(`${where}: stroke numbering is not 1..n`); return null;}
  return strokes.map(stroke => stroke.d);
}
function strokesFromExisting(id: string, where: string): string[] | null {
  const file = `${outDir}/${id}.json`;
  if (!existsSync(file)) {errors.push(`${where}: no ${id}.json yet; pass the KanjiVG directory`); return null;}
  const strokes = (JSON.parse(readFileSync(file, 'utf8')) as {strokes?: unknown}).strokes;
  if (!Array.isArray(strokes) || !strokes.every(d => typeof d === 'string')) {errors.push(`${where}: bad ${id}.json`); return null;}
  return strokes;
}

// ---------- Usage examples from the curriculum ----------
// Words come from the vocabulary lists; sentences from lesson examples and from grammar questions
// with their single blank filled in. Easier material (lower level, shorter, fewer unknown kanji) first.
const words: (ExampleWord & {rank: number})[] = [];
const sentences: (ExampleSentence & {rank: number})[] = [];
const BLANK = '（　）';
CURRICULUM.forEach((level, levelRank) => {
  const lessons = JSON.parse(readFileSync(`${root}public/content/${level}.json`, 'utf8')) as Lesson[];
  for (const lesson of lessons) {
    for (const word of lesson.words) {
      // Some list entries give variants ("高校; 高等学校"); the first, most common one is enough.
      const first = (value: string) => value.split(/[;；]/)[0].trim();
      words.push({japanese: first(word.japanese), reading: first(word.reading), meanings: word.meanings, rank: levelRank});
    }
    for (const example of lesson.examples) sentences.push({japanese: example.japanese, ruby: example.ruby, translations: example.translations, rank: levelRank});
    for (const question of lesson.questions) {
      if (question.prompt.split(BLANK).length !== 2) continue;
      const choice = question.choices.indexOf(question.answer);
      const rubyPrompt = question.ruby?.prompt;
      const rubyAnswer = question.ruby?.choices[choice];
      sentences.push({
        japanese: question.prompt.replace(BLANK, question.answer),
        ruby: rubyPrompt && rubyPrompt.split(BLANK).length === 2 ? rubyPrompt.replace(BLANK, rubyAnswer ?? question.answer) : undefined,
        translations: question.translation,
        rank: levelRank + 0.5 // A worked lesson example reads better than a quiz sentence.
      });
    }
  }
});

// Hand-written sentences for kanji the curriculum has few sentences for (content/kanji/sentences.txt).
const extraFile = 'content/kanji/sentences.txt';
readFileSync(`${root}${extraFile}`, 'utf8').split('\n').forEach((raw, line) => {
  const text = raw.trim();
  if (!text || text.startsWith('#')) return;
  const where = `${extraFile}:${line + 1}`;
  const [char, ruby, en, ru, ...rest] = text.split('|').map(s => s.trim());
  if (rest.length || !char || !ruby || !en || !ru) {errors.push(`${where}: expected 4 fields`); return;}
  if (!/^[^{}]*(\{[^{}]+\}[^{}]*)*$/.test(ruby)) {errors.push(`${where}: unbalanced furigana braces`); return;}
  const japanese = ruby.replace(/\{[^}]*\}/g, '');
  if (!japanese.includes(char)) {errors.push(`${where}: sentence does not contain ${char}`); return;}
  if (!/[。？！]$/.test(japanese)) {errors.push(`${where}: not a full sentence`); return;}
  sentences.push({japanese, ruby, translations: {en, ru}, rank: 0});
});

const KANJI = /[㐀-鿿豈-﫿々]/g;
function examplesFor(char: string, known: Set<string>) {
  const unknownKanji = (text: string) => (text.match(KANJI) ?? []).filter(c => c !== char && !known.has(c)).length;
  const pick = <T extends {japanese: string; rank: number}>(items: T[], max: number, maxLength: number) => {
    const seen = new Set<string>();
    return items
      .filter(item => item.japanese.includes(char) && [...item.japanese].length <= maxLength)
      .map(item => ({item, score: item.rank * 10 + unknownKanji(item.japanese) * 4 + [...item.japanese].length / 4}))
      .sort((a, b) => a.score - b.score)
      .filter(({item}) => !seen.has(item.japanese) && seen.add(item.japanese))
      .slice(0, max)
      .map(({item: {rank, ...rest}}) => {void rank; return rest;});
  };
  // Vocabulary lessons also list bare words as examples; only full sentences count here.
  return {words: pick(words, MAX_WORDS, 8), sentences: pick(sentences.filter(sentence => /[。？！?!]$/.test(sentence.japanese)), MAX_SENTENCES, 32)};
}

// ---------- Build ----------
const drafts: {entry: Entry; strokes: string[]}[] = [];
for (const level of LEVELS) {
  const file = `content/kanji/${level.toLowerCase()}.txt`;
  readFileSync(`${root}${file}`, 'utf8').split('\n').forEach((raw, line) => {
    const text = raw.trim();
    if (!text || text.startsWith('#')) return;
    const where = `${file}:${line + 1}`;
    const [char, on, kun, en, ru, ...rest] = text.split('|').map(s => s.trim());
    if (rest.length || !char || !on || !kun || !en || !ru || [...char].length !== 1) {errors.push(`${where}: expected 5 fields`); return;}
    if (drafts.some(draft => draft.entry.char === char)) {errors.push(`${where}: duplicate ${char}`); return;}
    const id = char.codePointAt(0)!.toString(16).padStart(5, '0');
    const strokes = source ? strokesFromKanjiVG(id, where) : strokesFromExisting(id, where);
    if (!strokes) return;
    strokes.forEach((d, i) => {
      try {if (pathToPoints(d).length < 2) throw new Error('empty path');} catch (error) {errors.push(`${where}: stroke ${i + 1}: ${(error as Error).message}`);}
    });
    drafts.push({entry: {id, char, level, on: list(on), kun: list(kun), meanings: {en, ru}, strokes: strokes.length}, strokes});
  });
}

const known = new Set(drafts.map(draft => draft.entry.char));
const details = drafts.map(({entry, strokes}) => {
  const examples = examplesFor(entry.char, known);
  if (!examples.words.length) errors.push(`${entry.char}: no example word in the curriculum`);
  return {entry, body: {char: entry.char, strokes, ...examples}};
});

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
rmSync(outDir, {recursive: true, force: true});
mkdirSync(outDir, {recursive: true});
for (const {entry, body} of details) {
  writeFileSync(`${outDir}/${entry.id}.json`, JSON.stringify(body));
  index.push(entry);
}
writeFileSync(`${outDir}/LICENSE.txt`, 'Stroke data derived from KanjiVG (https://kanjivg.tagaini.net), © Ulrich Apel.\nLicensed under Creative Commons Attribution-Share Alike 3.0: https://creativecommons.org/licenses/by-sa/3.0/\nExample words and sentences come from this app\'s curriculum (see docs/curriculum.md).\n');
writeFileSync(`${root}src/content/generated/kanji.json`, `${JSON.stringify(index, null, 1)}\n`);
const sentenceless = details.filter(detail => !detail.body.sentences.length).map(detail => detail.entry.char);
console.log(`Kanji: ${index.length} entries, ${readdirSync(outDir).length - 1} files. Without an example sentence: ${sentenceless.join('') || 'none'}.`);
