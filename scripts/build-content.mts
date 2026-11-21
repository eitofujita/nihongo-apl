// Builds the curriculum from content/ into src/content/generated and the Supabase seed.
// Run: npm run content   (validates everything; fails on any authoring error)
import {readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {align, createAnnotator} from './furigana.mts';
import {lessonSchema, questionSchema, type Lesson, type Question, type Word} from '../src/content/schemas.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const path = (p: string) => `${root}${p}`;
const LEVELS = ['N5', 'N4', 'N3'] as const;
type Level = typeof LEVELS[number];
const COLORS = ['green', 'peach', 'purple'] as const;
const errors: string[] = [];
const fail = (where: string, message: string) => errors.push(`${where}: ${message}`);

// ---------- Grammar DSL ----------
// @ id | title en | title ru | glyph
// S: study (en)      S: study (ru)       (exactly two S lines, en first)
// E: japanese | en | ru                  (one or more examples)
// Q: prompt | en | ru | *right / wrong / wrong / wrong | explanation en | explanation ru
// F: same as Q, but answered by typing (the starred choice is the accepted answer)
type Draft = Omit<Lesson, 'number' | 'color' | 'words'> & {level: Level; words?: Word[]; color?: Lesson['color']};
type GrammarLesson = Draft;
function parseGrammar(file: string, level: Level): GrammarLesson[] {
  const out: GrammarLesson[] = [];
  let current: (GrammarLesson & {studyParts: string[]}) | null = null;
  const lines = readFileSync(file, 'utf8').split('\n');
  const finish = () => {
    if (!current) return;
    const where = `${file.split('/').pop()}:${current.id}`;
    if (current.studyParts.length !== 2) fail(where, `expected 2 S: lines, got ${current.studyParts.length}`);
    current.study = {en: current.studyParts[0] ?? '', ru: current.studyParts[1] ?? ''};
    if (!current.examples.length) fail(where, 'no examples');
    if (current.questions.length < 2) fail(where, 'needs at least 2 questions');
    current.description = current.examples[0]?.translations ?? {en: '', ru: ''};
    // Short explanations get the topic name in front, so every answer explains itself in context.
    const title = current.title;
    current.questions = current.questions.map(q => ({...q, explanation: {
      en: q.explanation.en.length < 40 ? `${title.en} — ${q.explanation.en} Meaning: “${q.translation.en}”` : q.explanation.en,
      ru: q.explanation.ru.length < 40 ? `${title.ru} — ${q.explanation.ru} Смысл: «${q.translation.ru}»` : q.explanation.ru
    }}));
    const {studyParts, ...lesson} = current;
    void studyParts;
    out.push(lesson);
    current = null;
  };
  lines.forEach((raw, index) => {
    const line = raw.trim();
    const where = `${file.split('/').pop()}:${index + 1}`;
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('@')) {
      finish();
      const [id, en, ru, glyph] = line.slice(1).split('|').map(s => s.trim());
      if (!id || !en || !ru || !glyph) {fail(where, 'bad @ header'); return;}
      current = {id, level, category: 'grammar', title: {en, ru}, description: {en: '', ru: ''}, glyph, study: {en: '', ru: ''}, examples: [], questions: [], studyParts: []};
      return;
    }
    if (!current) {fail(where, 'content before first @'); return;}
    const tag = line.slice(0, 2);
    const body = line.slice(2).trim();
    if (tag === 'S:') {current.studyParts.push(body); return;}
    const parts = body.split('|').map(s => s.trim());
    if (tag === 'E:') {
      if (parts.length !== 3 || parts.some(p => !p)) {fail(where, 'E: needs japanese | en | ru'); return;}
      current.examples.push({japanese: parts[0], translations: {en: parts[1], ru: parts[2]}});
      return;
    }
    if (tag === 'Q:' || tag === 'F:') {
      if (parts.length !== 6) {fail(where, `${tag} needs 6 fields, got ${parts.length}`); return;}
      const [prompt, en, ru, choiceText, explEn, explRu] = parts;
      const marked = choiceText.split(' / ').map(s => s.trim());
      const answers = marked.filter(c => c.startsWith('*'));
      if (marked.length !== 4 || answers.length !== 1) {fail(where, 'need 4 choices with exactly one *'); return;}
      const choices = marked.map(c => c.replace(/^\*/, ''));
      if (choices.some(c => /[?？]/.test(c))) {fail(where, 'placeholder "?" left in a choice'); return;}
      if ([explEn, explRu].some(e => e.length < 3 || e.startsWith('—'))) {fail(where, 'explanation missing'); return;}
      const id = `${current.id}-${current.questions.length + 1}`;
      const parsed = questionSchema.safeParse({id, prompt, translation: {en, ru}, type: tag === 'F:' ? 'fill' : 'choice', choices, answer: answers[0].slice(1), explanation: {en: explEn, ru: explRu}});
      if (!parsed.success) {fail(where, parsed.error.issues.map(i => i.message).join('; ')); return;}
      current.questions.push(parsed.data);
      return;
    }
    fail(where, `unknown line: ${line.slice(0, 40)}`);
  });
  finish();
  return out;
}

// ---------- Vocabulary ----------
// content/vocab/n5.csv (expression,reading,meaning,tags) from the open JLPT word list.
// content/vocab/ru-n5.txt lines: expression|reading|russian[|english override]
type VocabWord = {japanese: string; reading: string; en: string; ru: string};
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {if (c === '"' && text[i + 1] === '"') {field += '"'; i++;} else if (c === '"') quoted = false; else field += c;}
    else if (c === '"') quoted = true;
    else if (c === ',') {row.push(field); field = '';}
    else if (c === '\n') {row.push(field); rows.push(row); row = []; field = '';}
    else if (c !== '\r') field += c;
  }
  if (field || row.length) {row.push(field); rows.push(row);}
  return rows;
}
function shortEnglish(meaning: string): string {
  const cleaned = meaning.replace(/\([^)]*\)/g, '').replace(/--/g, '').replace(/\s+/g, ' ').trim();
  const senses = cleaned.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  let result = '';
  for (const sense of senses) {
    const next = result ? `${result}, ${sense}` : sense;
    if (next.length > 38 && result) break;
    result = next;
    if (result.split(',').length >= 3) break;
  }
  return result || cleaned || meaning.replace(/[()]/g, '').trim();
}
const sortKey = (reading: string) => reading.replace(/\([^)]*\)/g, '').replace(/[～〜\s]/g, '');
function loadVocabulary(level: Level, exclude: Set<string>): VocabWord[] {
  const tag = level.toLowerCase();
  const csv = parseCsv(readFileSync(path(`content/vocab/${tag}.csv`), 'utf8')).slice(1).filter(r => r.length >= 3 && r[0]);
  const ruFiles = readdirSync(path('content/vocab')).filter(f => f.startsWith(`ru-${tag}`) && f.endsWith('.txt')).sort();
  const ru = new Map<string, {ru: string; en?: string}>();
  for (const file of ruFiles) {
    readFileSync(path(`content/vocab/${file}`), 'utf8').split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const [japanese, reading, russian, english] = line.split('|').map(s => s.trim());
      if (!japanese || reading === undefined || !russian) {fail(`${file}:${i + 1}`, 'need expression|reading|russian'); return;}
      const key = `${japanese}|${reading}`;
      if (ru.has(key)) fail(`${file}:${i + 1}`, `duplicate ${key}`);
      ru.set(key, {ru: russian, en: english || undefined});
    });
  }
  const words: VocabWord[] = [];
  const used = new Set<string>();
  for (const [expression, reading, meaning] of csv) {
    const key = `${expression}|${reading}`;
    if (exclude.has(expression)) continue;
    const translation = ru.get(key);
    if (!translation) {fail(`vocab ${level}`, `missing Russian for ${key}`); continue;}
    used.add(key);
    // Repair a few malformed rows in the source list: swapped columns, empty readings, readings with する appended.
    const hasKanji = (t: string) => /[\u4e00-\u9fff]/.test(t);
    let [shownExpression, shownReading] = [expression, reading.replace(/\s*\(する\)/, '').trim()];
    if (!shownReading) shownReading = shownExpression;
    if (hasKanji(shownReading) && !hasKanji(shownExpression)) [shownExpression, shownReading] = [shownReading, shownExpression];
    if (shownReading.length > 2 && shownReading.endsWith('する') && !shownExpression.endsWith('る')) shownReading = shownReading.slice(0, -2);
    words.push({japanese: shownExpression, reading: shownReading, en: translation.en ?? shortEnglish(meaning), ru: translation.ru});
  }
  for (const key of ru.keys()) if (!used.has(key)) fail(`vocab ${level}`, `Russian entry not in word list: ${key}`);
  return words.sort((a, b) => sortKey(a.reading).localeCompare(sortKey(b.reading), 'ja'));
}

const STOP = new Set(['to', 'a', 'an', 'the', 'of', 'be', 'one', 'something', 'someone', 'etc', 'in', 'on', 'at', 'for', 'and', 'or', 'with', 'up', 'out', 'by', 'is', 'it', 'as', 'very', 'thing', 'person']);
const tokens = (text: string) => new Set(text.toLowerCase().replace(/[^a-zа-яё\s-]/gi, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t)));
const isVerb = (w: VocabWord) => /^to /.test(w.en);
const shown = (w: VocabWord) => w.japanese.split(';')[0].trim();
function overlaps(a: VocabWord, b: VocabWord): boolean {
  if (shown(a) === shown(b) || a.reading === b.reading) return true;
  const ta = tokens(`${a.en} ${a.ru}`);
  for (const t of tokens(`${b.en} ${b.ru}`)) if (ta.has(t)) return true;
  return false;
}
function vocabLessons(level: Level, words: VocabWord[]): Draft[] {
  const size = 10;
  const tag = level.toLowerCase();
  const lessons: Draft[] = [];
  for (let start = 0, n = 1; start < words.length; start += size, n++) {
    const group = words.slice(start, start + size);
    const id = `${tag}-v${String(n).padStart(3, '0')}`;
    const wordObjects: Word[] = group.map((w, i) => ({id: `${id}-w${i + 1}`, japanese: w.japanese, reading: w.reading, meanings: {en: w.en, ru: w.ru}}));
    const questions: Question[] = group.map((w, i) => {
      // Distractors: same level, same kind (verb / non-verb), no shared meaning or reading.
      const pool = words.filter(o => o !== w && isVerb(o) === isVerb(w) && !overlaps(o, w));
      const picks: VocabWord[] = [];
      let seed = (start + i) * 7919 + 17;
      while (picks.length < 3 && pool.length) {
        seed = (seed * 48271) % 2147483647;
        const candidate = pool[seed % pool.length];
        if (!picks.includes(candidate) && picks.every(p => !overlaps(p, candidate))) picks.push(candidate);
        if (seed % 97 === 0 && picks.length === 0) break;
      }
      if (picks.length < 3) fail(id, `not enough distractors for ${w.japanese}`);
      const slot = (start + i * 3) % 4;
      const choices = picks.map(shown);
      choices.splice(slot, 0, shown(w));
      return {id: `${id}-${i + 1}`, prompt: 'ことばを えらびましょう。', type: 'choice' as const, choices, answer: shown(w),
        translation: {en: `Which word means “${w.en}”?`, ru: `Какое слово означает «${w.ru}»?`},
        explanation: {en: `${w.japanese} is read ${w.reading} and means “${w.en}”.`, ru: `${w.japanese} читается ${w.reading} и означает «${w.ru}».`},
        wordId: `${id}-w${i + 1}`};
    });
    const initial = (w: VocabWord) => sortKey(w.reading).charAt(0);
    const first = initial(group[0]), last = initial(group[group.length - 1]);
    const range = first === last ? first : `${first}–${last}`;
    lessons.push({id, level, category: 'vocabulary',
      title: {en: `${level} words ${n} (${range})`, ru: `Слова ${level}, часть ${n} (${range})`},
      description: {en: group.slice(0, 3).map(w => w.en.split(',')[0]).join(' · '), ru: group.slice(0, 3).map(w => w.ru.split(',')[0]).join(' · ')},
      glyph: [...group[0].japanese.replace(/^[～〜]/, '')][0] ?? '語',
      study: {en: `Read each word with its kana reading and meaning, then say it aloud. These ${group.length} words are part of the ${level} vocabulary range.`,
        ru: `Прочитайте каждое слово, его чтение и значение, затем произнесите вслух. Эти ${group.length} слов входят в лексику уровня ${level}.`},
      examples: [{japanese: group[0].japanese, translations: {en: group[0].en, ru: group[0].ru}}],
      words: wordObjects, questions});
  }
  return lessons;
}

function interleave<T>(grammar: T[], vocab: T[]): T[] {
  const out: T[] = []; let g = 0, v = 0;
  while (g < grammar.length || v < vocab.length) {
    const gDue = grammar.length ? (g + 1) / grammar.length : Infinity;
    const vDue = vocab.length ? (v + 1) / vocab.length : Infinity;
    if (g < grammar.length && (v >= vocab.length || gDue <= vDue)) out.push(grammar[g++]); else out.push(vocab[v++]);
  }
  return out;
}

// ---------- Assemble ----------
const legacy = JSON.parse(readFileSync(path('content/legacy.json'), 'utf8')) as {lessons: Lesson[]; placementQuestionIds: string[]};
const legacyWords = new Set(legacy.lessons.flatMap(l => l.words.map(w => w.japanese)));
// ---------- Grammar forms (content/grammar/patterns.txt) ----------
const TOKENS: Record<string, [string, string]> = {
  'N': ['noun', 'сущ.'], 'V': ['verb', 'глагол'],
  'V-dict': ['verb (dictionary form)', 'глагол (словарная форма)'],
  'V-masu': ['verb stem (ます form without ます)', 'основа глагола (форма на ます без ます)'],
  'V-te': ['verb (て form)', 'глагол (форма на て)'], 'V-ta': ['verb (た form)', 'глагол (форма на た)'],
  'V-nai': ['verb (ない form)', 'глагол (форма на ない)'],
  'V-nai-stem': ['ない stem (書か, 食べ)', 'основа на ない (書か, 食べ)'],
  'V-ba': ['verb (ば form)', 'глагол (форма на ば)'], 'V-vol': ['verb (volitional form)', 'глагол (волевая форма)'],
  'V-pot': ['verb (potential form)', 'глагол (потенциальная форма)'], 'V-plain': ['verb (plain form)', 'глагол (простая форма)'],
  'V-caus': ['verb (causative form)', 'глагол (каузатив)'], 'V-caus-te': ['causative て form', 'каузатив в форме на て'],
  'V-pass': ['verb (passive form)', 'глагол (пассив)'],
  'A-i': ['い-adjective', 'い-прилагательное'], 'A-i-stem': ['い-adjective without い', 'い-прилагательное без い'],
  'A-na': ['な-adjective', 'な-прилагательное'], 'plain': ['plain form', 'простая форма'],
  'Q': ['question word', 'вопросительное слово'], 'S': ['sentence', 'предложение'],
  'num': ['number + counter', 'число + счётный суффикс'], 'person': ['person', 'человек'],
  'place': ['place', 'место'], 'time': ['time', 'время'], 'neg': ['negative form', 'отрицание']
};
function localizeForm(form: string, lang: 0 | 1, where: string): string {
  return form
    .replace(/\{([A-Za-z-]+)\}/g, (_, token: string) => {
      const label = TOKENS[token];
      if (!label) {fail(where, `unknown token {${token}}`); return token;}
      return `[${label[lang]}]`;
    })
    .replace(/\[([^\]~]+)~([^\]]+)\]/g, (_, en: string, ru: string) => (lang === 0 ? en : ru).trim());
}
const forms = new Map<string, {en: string[]; ru: string[]}>();
readFileSync(path('content/grammar/patterns.txt'), 'utf8').split('\n').forEach((raw, i) => {
  const line = raw.trim();
  if (!line || line.startsWith('#')) return;
  const where = `patterns.txt:${i + 1}`;
  const split = line.indexOf('|');
  const id = line.slice(0, split).trim();
  const list = line.slice(split + 1).split(' ; ').map(f => f.trim()).filter(Boolean);
  if (split < 0 || !id || !list.length) {fail(where, 'expected id | form ; form'); return;}
  if (forms.has(id)) fail(where, `duplicate ${id}`);
  forms.set(id, {en: list.map(f => localizeForm(f, 0, where)), ru: list.map(f => localizeForm(f, 1, where))});
});

type Full = Lesson & {level: Level; levelNumber: number};
const all: Full[] = [];
let number = 0;
for (const level of LEVELS) {
  const grammarFiles = existsSync(path('content/grammar')) ? readdirSync(path('content/grammar')).filter(f => f.startsWith(level.toLowerCase()) && f.endsWith('.txt')).sort() : [];
  const grammar = grammarFiles.flatMap(f => parseGrammar(path(`content/grammar/${f}`), level));
  const vocab = existsSync(path(`content/vocab/${level.toLowerCase()}.csv`)) ? vocabLessons(level, loadVocabulary(level, level === 'N5' ? legacyWords : new Set())) : [];
  const ordered: Draft[] = [...(level === 'N5' ? legacy.lessons.map(l => ({...l, level})) : []), ...interleave<Draft>(grammar, vocab)];
  ordered.forEach((lesson, i) => {
    number++;
    const form = lesson.category === 'grammar' ? forms.get(lesson.id) : undefined;
    if (lesson.category === 'grammar' && !form) fail(lesson.id, 'no form in content/grammar/patterns.txt');
    const full: Full = {...lesson, number, levelNumber: i + 1, color: lesson.color ?? COLORS[number % 3], words: lesson.words ?? [], ...(form ? {forms: form} : {})};
    const parsed = lessonSchema.safeParse(full);
    if (!parsed.success) fail(full.id, parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
    all.push(full);
  });
}

const lessonIds = new Set<string>(); const questionIds = new Set<string>();
for (const id of forms.keys()) if (!all.some(lesson => lesson.id === id && lesson.category === 'grammar')) fail('patterns.txt', `no grammar lesson ${id}`);
for (const lesson of all) {
  if (lessonIds.has(lesson.id)) fail(lesson.id, 'duplicate lesson id');
  lessonIds.add(lesson.id);
  for (const q of lesson.questions) {if (questionIds.has(q.id)) fail(q.id, 'duplicate question id'); questionIds.add(q.id);}
}
const byId = new Map(all.flatMap(l => l.questions.map(q => [q.id, q] as const)));
const placement = legacy.placementQuestionIds.map(id => byId.get(id)!);

if (errors.length) {
  console.error(`Content has ${errors.length} problem(s):\n` + errors.slice(0, 80).join('\n'));
  process.exit(1);
}

// ---------- Furigana (build time only) ----------
const annotateText = await createAnnotator(path('content/furigana-overrides.json'));
// A choice that is exactly a vocabulary word uses the word list's reading (more reliable than the tokenizer).
const wordReadings = new Map(all.flatMap(l => l.words.map(w => [w.japanese, w.reading] as const)));
const annotate = (text: string) => {
  const reading = wordReadings.get(text);
  return reading && /[\u3400-\u9fff々]/.test(text) && /^[\u3040-\u309fー]+$/.test(reading) ? align(text, reading) : annotateText(text);
};
// Mutates in place so the placement list (built from the same objects) is annotated too.
for (const lesson of all) {
  for (const example of lesson.examples) {const ruby = annotate(example.japanese); if (ruby !== example.japanese) example.ruby = ruby;}
  for (const question of lesson.questions) {
    const prompt = annotate(question.prompt); const choices = question.choices.map(annotate);
    if (prompt !== question.prompt || choices.some((c, i) => c !== question.choices[i])) question.ruby = {prompt, choices};
  }
}

// ---------- Write outputs ----------
mkdirSync(path('src/content/generated'), {recursive: true});
const json = (value: unknown) => JSON.stringify(value) + '\n';
const catalog = {
  lessons: all.map(l => ({id: l.id, number: l.number, levelNumber: l.levelNumber, level: l.level, category: l.category, title: l.title, description: l.description, glyph: l.glyph, color: l.color, wordCount: l.words.length, questionIds: l.questions.map(q => q.id)})),
  placement
};
// Lesson bodies are static files under public/content: the browser fetches one level when needed,
// and they never become part of the server bundle (which keeps the Cloudflare Worker small).
// The catalog records a content hash per level so a changed file is never served from a stale cache.
mkdirSync(path('public/content'), {recursive: true});
const versions: Record<string, string> = {};
for (const level of LEVELS) {
  const body = json(all.filter(l => l.level === level));
  versions[level] = createHash('sha256').update(body).digest('hex').slice(0, 12);
  writeFileSync(path(`public/content/${level.toLowerCase()}.json`), body);
}
writeFileSync(path('src/content/generated/catalog.json'), json({...catalog, versions}));
for (const level of LEVELS) rmSync(path(`src/content/generated/${level.toLowerCase()}.json`), {force: true});

// Supabase seed for everything beyond the original 100-question migration.
const legacyIds = new Set(legacy.lessons.flatMap(l => l.questions.map(q => q.id)));
const sql = (s: string) => `'${s.replace(/'/g, "''")}'`;
const fresh = all.filter(l => !legacyIds.has(l.questions[0].id));
const bank = fresh.flatMap(l => l.questions.map(q => `(${sql(q.id)}, ${sql(q.answer)})`));
const links = fresh.flatMap(l => l.questions.map((q, i) => `(${sql(l.id)}, ${sql(q.id)}, ${i})`));
const seed = bank.length ? [
  '-- GENERATED by scripts/build-content.mts from content/. Do not edit by hand.',
  `-- Adds ${fresh.length} lessons and ${bank.length} questions (N5–N3) beyond the original seed.`,
  'begin;',
  `insert into private.question_bank (id, correct_answer) values\n${bank.join(',\n')};`,
  `insert into private.lesson_questions (lesson_id, question_id, position) values\n${links.join(',\n')};`,
  'commit;', ''
].join('\n') : '-- GENERATED: no additional curriculum.\n';
writeFileSync(path('supabase/migrations/202611180001_curriculum_n5_n3.sql'), seed);

// Keep the one-shot setup file in sync for new projects.
const setupPath = path('supabase/setup.sql');
const setup = readFileSync(setupPath, 'utf8');
const begin = '-- BEGIN GENERATED CURRICULUM (scripts/build-content.mts)';
const end = '-- END GENERATED CURRICULUM';
const inner = seed.replace(/^begin;\n/m, '').replace(/^commit;\n/m, '');
const block = `${begin}\n${inner}${end}\n`;
const next = setup.includes(begin)
  ? setup.replace(new RegExp(`${begin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end}\\n`), block)
  : setup.replace(/\ncommit;\s*$/, `\n\n${block}\ncommit;\n`);
writeFileSync(setupPath, next);

const count = (level: Level, category: string) => all.filter(l => l.level === level && l.category === category).length;
for (const level of LEVELS) {
  const words = all.filter(l => l.level === level).reduce((s, l) => s + l.words.length, 0);
  console.log(`${level}: ${count(level, 'grammar')} grammar lessons, ${count(level, 'vocabulary')} vocabulary lessons, ${words} words`);
}
console.log(`Total: ${all.length} lessons, ${questionIds.size} questions.`);
void z;
