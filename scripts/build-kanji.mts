// Builds handwriting-practice data from content/kanji/*.txt and KanjiVG stroke SVGs.
// Run: npm run kanji -- <path to the extracted KanjiVG "kanji" directory>
//   (download kanjivg-YYYYMMDD-main.zip from https://github.com/KanjiVG/kanjivg/releases)
// Outputs (committed, so the app never needs KanjiVG at build time):
//   src/content/generated/kanji.json   lightweight index shipped with the page
//   public/kanji/<codepoint>.json      stroke paths, fetched per kanji
// KanjiVG is © Ulrich Apel, CC BY-SA 3.0; the derived stroke files keep that licence.
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {pathToPoints} from '../src/lib/kanji-stroke.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error('Usage: npm run kanji -- <KanjiVG kanji directory>');
  process.exit(1);
}

const LEVELS = ['N5'] as const;
type Entry = {id: string; char: string; level: string; on: string[]; kun: string[]; meanings: {en: string; ru: string}; strokes: number};
const errors: string[] = [];
const index: Entry[] = [];
const outDir = `${root}public/kanji`;
rmSync(outDir, {recursive: true, force: true});
mkdirSync(outDir, {recursive: true});

const list = (value: string) => value === '-' ? [] : value.split(',').map(s => s.trim()).filter(Boolean);

for (const level of LEVELS) {
  const file = `content/kanji/${level.toLowerCase()}.txt`;
  readFileSync(`${root}${file}`, 'utf8').split('\n').forEach((raw, line) => {
    const text = raw.trim();
    if (!text || text.startsWith('#')) return;
    const where = `${file}:${line + 1}`;
    const [char, on, kun, en, ru, ...rest] = text.split('|').map(s => s.trim());
    if (rest.length || !char || !on || !kun || !en || !ru || [...char].length !== 1) {errors.push(`${where}: expected 5 fields`); return;}
    if (index.some(entry => entry.char === char)) {errors.push(`${where}: duplicate ${char}`); return;}
    const id = char.codePointAt(0)!.toString(16).padStart(5, '0');
    const svgPath = `${source}/${id}.svg`;
    if (!existsSync(svgPath)) {errors.push(`${where}: no KanjiVG file ${id}.svg`); return;}
    const svg = readFileSync(svgPath, 'utf8');
    // Stroke paths are numbered -s1, -s2, … in writing order.
    const strokes = [...svg.matchAll(/<path id="kvg:[0-9a-f]+-s(\d+)"[^>]*\sd="([^"]+)"/g)]
      .map(match => ({n: Number(match[1]), d: match[2]})).sort((a, b) => a.n - b.n);
    if (!strokes.length || strokes.some((stroke, i) => stroke.n !== i + 1)) {errors.push(`${where}: stroke numbering is not 1..n`); return;}
    for (const stroke of strokes) {
      try {if (pathToPoints(stroke.d).length < 2) throw new Error('empty path');} catch (error) {errors.push(`${where}: stroke ${stroke.n}: ${(error as Error).message}`);}
    }
    writeFileSync(`${outDir}/${id}.json`, JSON.stringify({char, strokes: strokes.map(stroke => stroke.d)}));
    index.push({id, char, level, on: list(on), kun: list(kun), meanings: {en, ru}, strokes: strokes.length});
  });
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
writeFileSync(`${outDir}/LICENSE.txt`, 'Stroke data derived from KanjiVG (https://kanjivg.tagaini.net), © Ulrich Apel.\nLicensed under Creative Commons Attribution-Share Alike 3.0: https://creativecommons.org/licenses/by-sa/3.0/\n');
writeFileSync(`${root}src/content/generated/kanji.json`, `${JSON.stringify(index, null, 1)}\n`);
console.log(`Kanji: ${index.length} entries, ${readdirSync(outDir).length - 1} stroke files.`);
