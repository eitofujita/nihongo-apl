'use client';

import {useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowLeft, ArrowRight, Check, ClipboardCheck, Eye, PenLine, RotateCcw, Search, Shuffle, X} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {getKanji, kanjiList, loadKanjiDetail, type KanjiDetail, type KanjiInfo} from '@/content/kanji';
import type {Locale} from '@/i18n/routing';
import {gradeStrokeAt, pathLength, pathToPoints, type Point, type StrokeResult} from '@/lib/kanji-stroke';
import {KANJI_MODES, PASS_MISTAKES, saveKanjiAttempt, useKanjiProgress, type KanjiMode} from '@/lib/kanji-progress';
import {searchKanji} from '@/lib/kanji-search';
import {PageHeading} from './dashboard';
import {EmptyState} from './learning';
import {FuriganaToggle, Ruby, emphasize} from './ruby';

const BOX = 109;
const TOLERANCE: Record<KanjiMode, number> = {trace: 1.15, guide: 1, recall: 1};
const HINT_AFTER = 2;
const RANDOM_COUNT = 10;
const MASK = '□';
const KANJI_LEVELS = ['N5', 'N4'] as const;
type KanjiLevel = typeof KANJI_LEVELS[number];
const inLevel = (level: KanjiLevel) => kanjiList.filter(kanji => kanji.level === level);

/** N5 / N4 switcher; each tab shows how many kanji of that level are written from memory. */
function KanjiLevelTabs({level, onChange}: {level: KanjiLevel; onChange: (level: KanjiLevel) => void}) {
  const t = useTranslations('App');
  const store = useKanjiProgress();
  return <div className="level-tabs kanji-level-tabs" role="tablist" aria-label={t('levelLabel')}>{KANJI_LEVELS.map(item => {
    const list = inLevel(item);
    const done = list.filter(kanji => store[kanji.char]?.passed === 'recall').length;
    return <button key={item} type="button" role="tab" aria-selected={level === item} className={level === item ? 'selected' : ''} onClick={() => onChange(item)}>
      <strong>{item}</strong><small>{done}/{list.length}</small>
    </button>;
  })}</div>;
}

export function KanjiList() {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const store = useKanjiProgress();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<KanjiLevel>('N5');
  const levelList = useMemo(() => inLevel(level), [level]);
  // A search looks through every level, so learners need not know where a kanji belongs.
  const shown = useMemo(() => query.trim() ? searchKanji(kanjiList, query) : levelList, [query, levelList]);
  const recalled = levelList.filter(kanji => store[kanji.char]?.passed === 'recall').length;
  const percent = Math.round(recalled / levelList.length * 100);
  return <>
    <PageHeading title={t('kanjiTitle')} subtitle={t('kanjiSub')}>
      <Link className="button primary kanji-test-cta" href="/kanji/test"><ClipboardCheck size={17}/>{t('kanjiTestCta')}</Link>
    </PageHeading>
    <div className="curriculum-banner"><span className="stat-icon green"><PenLine size={24}/></span><div>
      <h2>{t('kanjiSummary', {count: kanjiList.length})}</h2>
      <p>{t('kanjiModesExplained')}</p>
      <div className="course-progress"><div className="course-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={levelList.length} aria-valuenow={recalled} aria-label={t('kanjiProgress', {done: recalled, total: levelList.length})}><span style={{width: `${percent}%`}}/></div><span>{level} · {t('kanjiProgress', {done: recalled, total: levelList.length})}</span></div>
    </div></div>
    <KanjiLevelTabs level={level} onChange={setLevel}/>
    <KanjiSearch query={query} onChange={setQuery} count={shown.length}/>
    <ul className="kanji-grid">{shown.map(kanji => {
      const passed = store[kanji.char]?.passed ?? null;
      return <li key={kanji.id}><Link href={`/kanji/${kanji.id}`} className={`kanji-tile ${passed ? `passed-${passed}` : ''}`}>
        <span className="kanji-tile-char" lang="ja">{kanji.char}</span>
        <span className="kanji-tile-meaning">{kanji.meanings[locale]}</span>
        <span className="kanji-tile-status">{t(passed ? `kanjiStatus_${passed}` : 'kanjiStatus_new')}</span>
      </Link></li>;
    })}</ul>
    <KanjiFootnote/>
  </>;
}

/** Search box shared by the list and test pages; the grid below shows only the matches. */
function KanjiSearch({query, onChange, count}: {query: string; onChange: (value: string) => void; count: number}) {
  const t = useTranslations('App');
  return <div className="kanji-search">
    <label className="search-input">
      <Search size={16} aria-hidden="true"/>
      <span className="sr-only">{t('kanjiSearchLabel')}</span>
      <input type="search" value={query} onChange={event => onChange(event.target.value)} placeholder={t('kanjiSearchPlaceholder')}
        autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="search"/>
      {query && <button type="button" className="icon-button" onClick={() => onChange('')} aria-label={t('kanjiSearchClear')}><X size={15}/></button>}
    </label>
    {query.trim() && <p className="kanji-search-count" role="status">{count ? t('kanjiSearchCount', {count}) : t('kanjiSearchNone', {query: query.trim()})}</p>}
  </div>;
}

function KanjiFootnote() {
  const t = useTranslations('App');
  return <p className="section-note kanji-footnote">{t('kanjiLocalNote')} {t.rich('kanjiAttribution', {link: chunks => <a href="https://kanjivg.tagaini.net" target="_blank" rel="noreferrer">{chunks}</a>})}</p>;
}

/** Strokes and usage examples for one kanji, fetched from the static /kanji/<id>.json file. */
function useKanjiDetail(id: string | undefined): {detail: KanjiDetail | null; failed: boolean} {
  const [state, setState] = useState<{id?: string; detail: KanjiDetail | null; failed: boolean}>({detail: null, failed: false});
  useEffect(() => {
    if (!id) return;
    let active = true;
    loadKanjiDetail(id).then(detail => {if (active) setState({id, detail, failed: false});}).catch(() => {if (active) setState({id, detail: null, failed: true});});
    return () => {active = false;};
  }, [id]);
  return state.id === id ? state : {detail: null, failed: false};
}

export function KanjiPractice({id}: {id: string}) {
  const t = useTranslations('App');
  const kanji = getKanji(id);
  const {detail, failed} = useKanjiDetail(id);
  if (!kanji || failed) return <EmptyState title={t('errorTitle')} text={t('errorText')}/>;
  if (!detail) return <p className="loading-note" role="status">{t('loading')}</p>;
  return <PracticeBoard kanji={kanji} detail={detail}/>;
}

function Kun({reading}: {reading: string}) {
  const [stem, okurigana] = reading.split('.');
  return <>{stem}{okurigana && <span className="kanji-okurigana">{okurigana}</span>}</>;
}

function KanjiReadings({kanji, strokes}: {kanji: KanjiInfo; strokes: number}) {
  const t = useTranslations('App');
  return <dl className="kanji-readings">
    {kanji.on.length > 0 && <><dt>{t('kanjiOn')}</dt><dd lang="ja">{kanji.on.join('、')}</dd></>}
    {kanji.kun.length > 0 && <><dt>{t('kanjiKun')}</dt><dd lang="ja">{kanji.kun.map((reading, i) => <span key={reading}>{i > 0 && '、'}<Kun reading={reading}/></span>)}</dd></>}
    <dt>{t('kanjiStrokeCount')}</dt><dd>{strokes}</dd>
  </dl>;
}

/** Words and sentences from the curriculum that use the kanji. While `masked`, the kanji is shown as □. */
function KanjiExamples({kanji, detail, masked}: {kanji: KanjiInfo; detail: KanjiDetail; masked: boolean}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  if (!detail.words.length && !detail.sentences.length) return null;
  const hide = (text: string) => masked ? text.replaceAll(kanji.char, MASK) : text;
  const mark = masked ? MASK : kanji.char;
  return <section className={`kanji-examples ${masked ? 'is-masked' : ''}`} aria-labelledby="kanji-usage-title">
    <div className="section-title-row"><h2 id="kanji-usage-title">{t('kanjiUsageTitle')}</h2>{detail.sentences.length > 0 && <FuriganaToggle label={t('furigana')}/>}</div>
    {masked && <p className="kanji-examples-note">{t('kanjiUsageMasked')}</p>}
    {detail.words.length > 0 && <>
      <h3>{t('kanjiUsageWords')}</h3>
      <ul className="kanji-words">{detail.words.map(word => <li key={word.japanese}>
        <span className="kanji-word" lang="ja">{emphasize(hide(word.japanese), mark)}</span>
        <span className="kanji-word-reading" lang="ja">{word.reading}</span>
        <span className="kanji-word-meaning">{word.meanings[locale]}</span>
      </li>)}</ul>
    </>}
    {detail.sentences.length > 0 && <>
      <h3>{t('kanjiUsageSentences')}</h3>
      <ul className="kanji-sentences">{detail.sentences.map(sentence => <li key={sentence.japanese}>
        <p lang="ja"><Ruby text={hide(sentence.japanese)} ruby={sentence.ruby && hide(sentence.ruby)} mark={mark}/></p>
        <p>{sentence.translations[locale]}</p>
      </li>)}</ul>
    </>}
  </section>;
}

type PadProps = {
  strokes: string[]; done: number; ghost: boolean; demo: number;
  hint: {stroke: number; key: string} | null; revealed?: boolean;
  onStart?: () => void; onStroke: (points: Point[]) => void;
};

/** The writing area: captures one pointer at a time and hands each finished stroke to the parent. */
function KanjiPad({strokes, done, ghost, demo, hint, revealed = false, onStart, onStroke}: PadProps) {
  const t = useTranslations('App');
  const svgRef = useRef<SVGSVGElement>(null);
  const liveRef = useRef<SVGPolylineElement>(null);
  const drawing = useRef<{pointer: number; points: Point[]} | null>(null);
  const finished = revealed || done === strokes.length;

  function toBox(event: {clientX: number; clientY: number}): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return [(event.clientX - rect.left) / rect.width * BOX, (event.clientY - rect.top) / rect.height * BOX];
  }
  function paint() {
    liveRef.current?.setAttribute('points', drawing.current ? drawing.current.points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') : '');
  }
  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (finished || drawing.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = {pointer: event.pointerId, points: [toBox(event)]};
    onStart?.();
    paint();
  }
  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drawing.current;
    if (!current || current.pointer !== event.pointerId) return;
    // Coalesced events give smooth lines on fast pen/finger movement where supported.
    const events = typeof event.nativeEvent.getCoalescedEvents === 'function' ? event.nativeEvent.getCoalescedEvents() : [];
    for (const item of events.length ? events : [event.nativeEvent]) {
      const point = toBox(item);
      const last = current.points[current.points.length - 1];
      if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= 0.6) current.points.push(point);
    }
    paint();
  }
  function onPointerEnd(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drawing.current;
    if (!current || current.pointer !== event.pointerId) return;
    drawing.current = null;
    paint();
    if (event.type === 'pointercancel' || pathLength(current.points) < 2) return; // Accidental tap.
    onStroke(current.points);
  }

  return <svg ref={svgRef} className={`kanji-pad ${finished ? 'is-finished' : ''}`} viewBox={`0 0 ${BOX} ${BOX}`} role="img" aria-label={t('kanjiPad')}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
    <g className="kanji-guides"><line x1={BOX / 2} y1="0" x2={BOX / 2} y2={BOX}/><line x1="0" y1={BOX / 2} x2={BOX} y2={BOX / 2}/></g>
    {ghost && <g className="kanji-ghost">{strokes.map((d, i) => <path key={i} d={d}/>)}</g>}
    {demo > 0 && <g className="kanji-demo" key={demo}>{strokes.map((d, i) => <path key={i} d={d} pathLength={1} style={{animationDelay: `${i * 0.55}s`}}/>)}</g>}
    <g className="kanji-ink">{strokes.slice(0, done).map((d, i) => <path key={i} d={d}/>)}</g>
    {revealed && <g className="kanji-answer">{strokes.slice(done).map((d, i) => <path key={i} d={d}/>)}</g>}
    {!finished && hint && <path className="kanji-hint" key={hint.key} d={strokes[hint.stroke]} pathLength={1}/>}
    <polyline ref={liveRef} className="kanji-live" points=""/>
  </svg>;
}

/** onBack is set when practising from inside a test: the board then returns to the test instead of leaving the page. */
function PracticeBoard({kanji, detail, onBack}: {kanji: KanjiInfo; detail: KanjiDetail; onBack?: () => void}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const store = useKanjiProgress();
  const {strokes} = detail;
  const initialMode: KanjiMode = store[kanji.char]?.passed === 'trace' ? 'guide' : store[kanji.char]?.passed ? 'recall' : 'trace';
  const [mode, setMode] = useState<KanjiMode>(initialMode);
  const [done, setDone] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [misses, setMisses] = useState(0); // On the current stroke, for showing a hint.
  const [feedback, setFeedback] = useState<StrokeResult | null>(null);
  const [demo, setDemo] = useState(0); // Bumped to replay the stroke-order animation.
  const [saved, setSaved] = useState(true);
  const expected = useMemo(() => strokes.map(pathToPoints), [strokes]);
  const finished = done === strokes.length;
  const index = kanjiList.findIndex(item => item.id === kanji.id);
  const nextKanji = kanjiList[(index + 1) % kanjiList.length];

  function reset(nextMode = mode) {
    setMode(nextMode); setDone(0); setMistakes(0); setMisses(0); setFeedback(null); setDemo(0);
  }
  function onStroke(points: Point[]) {
    const result = gradeStrokeAt(points, expected, done, TOLERANCE[mode]);
    setFeedback(result);
    if (result.ok) {
      const nextDone = done + 1;
      setDone(nextDone); setMisses(0);
      if (nextDone === strokes.length) setSaved(saveKanjiAttempt(kanji.char, mode, mistakes));
    } else {
      setMistakes(count => count + 1); setMisses(count => count + 1);
    }
  }

  const status = finished ? t('kanjiDoneText', {count: mistakes})
    : feedback && !feedback.ok ? t(`kanjiMiss_${feedback.reason}`)
    : t('kanjiStrokeOf', {current: done + 1, total: strokes.length});
  const hidden = mode === 'recall' && !finished;
  const nextMode = KANJI_MODES[KANJI_MODES.indexOf(mode) + 1];

  return <article className="kanji-practice">
    {onBack ? <button type="button" className="back-link" onClick={onBack}><ArrowLeft size={16}/>{t('kanjiTestBackToTest')}</button>
      : <Link className="back-link" href="/kanji"><ArrowLeft size={16}/>{t('kanjiBack')}</Link>}
    <div className="kanji-layout">
      <section className="kanji-info" aria-label={t('kanjiAbout')}>
        <p className={`kanji-big ${hidden ? 'is-hidden' : ''}`} lang="ja" aria-hidden={hidden}>{hidden ? '?' : kanji.char}</p>
        <h1>{kanji.meanings[locale]}</h1>
        <KanjiReadings kanji={kanji} strokes={strokes.length}/>
        <div className="tabs kanji-modes" role="group" aria-label={t('kanjiModeLabel')}>{KANJI_MODES.map(item => <button key={item} className={mode === item ? 'selected' : ''} aria-pressed={mode === item} onClick={() => reset(item)}>{t(`kanjiMode_${item}`)}</button>)}</div>
      </section>
      <section className="kanji-board">
        <KanjiPad strokes={strokes} done={done} ghost={mode === 'trace'} demo={demo}
          hint={misses >= HINT_AFTER ? {stroke: done, key: `${done}-${misses}`} : null}
          onStart={() => setDemo(0)} onStroke={onStroke}/>
        <p className={`kanji-status ${feedback && !feedback.ok && !finished ? 'is-miss' : ''} ${finished ? 'is-done' : ''}`} role="status">{status}</p>
        {!saved && finished && <p className="section-note">{t('storageError')}</p>}
        <div className="kanji-actions">
          {finished ? <>
            <button className="button outline" onClick={() => reset()}><RotateCcw size={16}/>{t('kanjiAgain')}</button>
            {nextMode ? <button className="button primary" onClick={() => reset(nextMode)}>{t('kanjiNextMode', {mode: t(`kanjiMode_${nextMode}`)})}<ArrowRight size={16}/></button>
              : onBack ? <button className="button primary" onClick={onBack}>{t('kanjiTestBackToTest')}<ArrowRight size={16}/></button>
              : <Link className="button primary" href={`/kanji/${nextKanji.id}`}>{t('kanjiNext')}<ArrowRight size={16}/></Link>}
          </> : <>
            <button className="button outline" onClick={() => setDemo(value => value + 1)}><Eye size={16}/>{t('kanjiShowOrder')}</button>
            <button className="button outline" onClick={() => reset()} disabled={done === 0 && mistakes === 0}><RotateCcw size={16}/>{t('kanjiRestart')}</button>
          </>}
        </div>
        <p className="kanji-mode-hint">{t(`kanjiModeHint_${mode}`)}</p>
      </section>
    </div>
    <KanjiExamples kanji={kanji} detail={detail} masked={hidden}/>
    <KanjiFootnote/>
  </article>;
}

// ---------- Self-chosen test ----------

type TestResult = {id: string; ok: boolean; mistakes: number; gaveUp: boolean};

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pick any kanji, then write each from its meaning and readings with no model or hints. */
export function KanjiTest() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [queue, setQueue] = useState<string[] | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);

  function start(ids: string[]) {setResults([]); setQueue(shuffled(ids));}
  function quit() {setQueue(null); setResults([]);}

  if (!queue) return <TestSetup selected={selected} onChange={setSelected} onStart={() => start(kanjiList.filter(k => selected.has(k.id)).map(k => k.id))}/>;
  if (results.length === queue.length) {
    const missed = results.filter(result => !result.ok).map(result => result.id);
    return <TestResults results={results} onRetry={missed.length ? () => start(missed) : undefined} onChoose={quit}/>;
  }
  const current = results.length;
  const id = queue[current];
  return <TestQuestion key={`${current}-${id}`} kanji={getKanji(id)!} number={current + 1} total={queue.length} nextId={queue[current + 1]}
    onDone={result => setResults(list => [...list, result])} onQuit={quit}/>;
}

function TestSetup({selected, onChange, onStart}: {selected: Set<string>; onChange: (next: Set<string>) => void; onStart: () => void}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const store = useKanjiProgress();
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  const [level, setLevel] = useState<KanjiLevel>('N5');
  const levelList = useMemo(() => inLevel(level), [level]);
  // Quick-select buttons act on the open level; picks from other levels stay selected.
  const notMastered = levelList.filter(kanji => store[kanji.char]?.passed !== 'recall');
  const addAll = (items: KanjiInfo[]) => onChange(new Set([...selected, ...items.map(k => k.id)]));
  const [query, setQuery] = useState('');
  const shown = useMemo(() => query.trim() ? searchKanji(kanjiList, query) : levelList, [query, levelList]);
  return <article className="kanji-test">
    <Link className="back-link" href="/kanji"><ArrowLeft size={16}/>{t('kanjiBack')}</Link>
    <PageHeading title={t('kanjiTestTitle')} subtitle={t('kanjiTestSub')}/>
    <KanjiLevelTabs level={level} onChange={setLevel}/>
    <div className="kanji-test-toolbar" role="group" aria-label={t('kanjiTestQuickSelect')}>
      <button className="button outline" onClick={() => addAll(levelList)}>{t('kanjiTestSelectAll')}</button>
      <button className="button outline" onClick={() => addAll(notMastered)} disabled={!notMastered.length}>{t('kanjiTestNotMastered', {count: notMastered.length})}</button>
      <button className="button outline" onClick={() => addAll(shuffled(levelList.filter(k => !selected.has(k.id))).slice(0, RANDOM_COUNT))}><Shuffle size={15}/>{t('kanjiTestRandom', {count: RANDOM_COUNT})}</button>
      <button className="button outline" onClick={() => onChange(new Set())} disabled={!selected.size}><X size={15}/>{t('kanjiTestClear')}</button>
    </div>
    <KanjiSearch query={query} onChange={setQuery} count={shown.length}/>
    <ul className="kanji-grid" aria-label={t('kanjiTestPick')}>{shown.map(kanji => {
      const on = selected.has(kanji.id);
      const passed = store[kanji.char]?.passed ?? null;
      return <li key={kanji.id}><button type="button" className={`kanji-tile kanji-pick ${on ? 'is-selected' : ''}`} aria-pressed={on} onClick={() => toggle(kanji.id)}>
        {on && <span className="kanji-pick-check" aria-hidden="true"><Check size={13}/></span>}
        <span className="kanji-tile-char" lang="ja">{kanji.char}</span>
        <span className="kanji-tile-meaning">{kanji.meanings[locale]}</span>
        <span className="kanji-tile-status">{t(passed ? `kanjiStatus_${passed}` : 'kanjiStatus_new')}</span>
      </button></li>;
    })}</ul>
    <div className="kanji-test-start">
      <span>{t('kanjiTestSelected', {count: selected.size})}</span>
      <button className="button primary" onClick={onStart} disabled={!selected.size}>{t('kanjiTestStart', {count: selected.size})}<ArrowRight size={16}/></button>
    </div>
  </article>;
}

function TestQuestion({kanji, number, total, nextId, onDone, onQuit}: {
  kanji: KanjiInfo; number: number; total: number; nextId?: string;
  onDone: (result: TestResult) => void; onQuit: () => void;
}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const {detail, failed} = useKanjiDetail(kanji.id);
  const [done, setDone] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState<StrokeResult | null>(null);
  const [answer, setAnswer] = useState<TestResult | null>(null);
  const [saved, setSaved] = useState(true);
  // Practising a missed kanji happens in place, so this question (and the whole test) stays intact.
  const [practicing, setPracticing] = useState(false);
  const expected = useMemo(() => detail?.strokes.map(pathToPoints) ?? [], [detail]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Each question replaces the last one; move focus so keyboard and screen-reader users start at the new prompt.
  // Coming back from practice also lands here.
  useEffect(() => {if (!practicing) headingRef.current?.focus();}, [practicing]);
  const togglePractice = (on: boolean) => {setPracticing(on); window.scrollTo({top: 0});};

  // Fetch the next kanji while this one is being written, so the next question opens at once.
  useEffect(() => {if (nextId) loadKanjiDetail(nextId).catch(() => {});}, [nextId]);

  function finish(result: TestResult) {
    setAnswer(result);
    // A give-up counts as an attempt but never as a pass.
    setSaved(saveKanjiAttempt(kanji.char, 'recall', result.gaveUp ? PASS_MISTAKES + 1 : result.mistakes));
  }
  function onStroke(points: Point[]) {
    if (!detail || answer) return;
    const result = gradeStrokeAt(points, expected, done, TOLERANCE.recall);
    setFeedback(result);
    if (result.ok) {
      const nextDone = done + 1;
      setDone(nextDone);
      if (nextDone === detail.strokes.length) finish({id: kanji.id, ok: mistakes <= PASS_MISTAKES, mistakes, gaveUp: false});
    } else {
      setMistakes(count => count + 1);
    }
  }

  if (failed) return <EmptyState title={t('errorTitle')} text={t('errorText')}/>;
  if (practicing && detail) return <PracticeBoard kanji={kanji} detail={detail} onBack={() => togglePractice(false)}/>;
  const status = !detail ? t('loading')
    : answer?.gaveUp ? t('kanjiTestAnswer', {kanji: kanji.char})
    : answer ? (answer.ok ? t('kanjiTestCorrect', {count: answer.mistakes}) : t('kanjiTestTooMany', {count: answer.mistakes}))
    : feedback && !feedback.ok ? t(`kanjiMiss_${feedback.reason}`)
    : t('kanjiStrokeOf', {current: done + 1, total: detail.strokes.length});
  const last = number === total;

  return <article className="kanji-practice kanji-test">
    <div className="kanji-test-header">
      <button className="back-link" onClick={onQuit}><ArrowLeft size={16}/>{t('kanjiTestQuit')}</button>
      <span className="question-progress">{t('kanjiTestQuestion', {current: number, total})}</span>
    </div>
    <div className="progress-track" aria-hidden="true"><span style={{width: `${(number - 1 + (answer ? 1 : 0)) / total * 100}%`}}/></div>
    <div className="kanji-layout">
      <section className="kanji-info" aria-label={t('kanjiAbout')}>
        <p className={`kanji-big ${answer ? '' : 'is-hidden'}`} lang="ja" aria-hidden={!answer}>{answer ? kanji.char : '?'}</p>
        <h1 ref={headingRef} tabIndex={-1}>{kanji.meanings[locale]}</h1>
        <KanjiReadings kanji={kanji} strokes={kanji.strokes}/>
      </section>
      <section className="kanji-board">
        {detail ? <KanjiPad strokes={detail.strokes} done={done} ghost={false} demo={0} hint={null} revealed={answer?.gaveUp} onStroke={onStroke}/>
          : <div className="kanji-pad kanji-pad-loading" aria-hidden="true"/>}
        <p className={`kanji-status ${(feedback && !feedback.ok && !answer) || (answer && !answer.ok) ? 'is-miss' : ''} ${answer?.ok ? 'is-done' : ''}`} role="status">{status}</p>
        {!saved && answer && <p className="section-note">{t('storageError')}</p>}
        <div className="kanji-actions">
          {answer ? <>
            {!answer.ok && <button type="button" className="button outline" onClick={() => togglePractice(true)}><PenLine size={16}/>{t('kanjiTestPractice')}</button>}
            <button className="button primary" onClick={() => onDone(answer)} autoFocus>{last ? t('kanjiTestFinish') : t('kanjiTestNextQuestion')}<ArrowRight size={16}/></button>
          </> : <button className="button outline" onClick={() => finish({id: kanji.id, ok: false, mistakes, gaveUp: true})} disabled={!detail}>{t('kanjiTestGiveUp')}</button>}
        </div>
        <p className="kanji-mode-hint">{t('kanjiTestHint')}</p>
      </section>
    </div>
    {detail && <KanjiExamples kanji={kanji} detail={detail} masked={!answer}/>}
  </article>;
}

function TestResults({results, onRetry, onChoose}: {results: TestResult[]; onRetry?: () => void; onChoose: () => void}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const correct = results.filter(result => result.ok).length;
  return <article className="kanji-test">
    <section className="result-card panel kanji-test-result">
      <h1>{t('kanjiTestResultsTitle')}</h1>
      <p className="kanji-test-score">{t('kanjiTestScore', {correct, total: results.length})}</p>
      <div className="kanji-actions">
        {onRetry && <button className="button primary" onClick={onRetry}><RotateCcw size={16}/>{t('kanjiTestRetryMissed', {count: results.length - correct})}</button>}
        <button className={`button ${onRetry ? 'outline' : 'primary'}`} onClick={onChoose}>{t('kanjiTestChooseAgain')}</button>
        <Link className="button outline" href="/kanji">{t('kanjiBack')}</Link>
      </div>
    </section>
    <ul className="kanji-grid kanji-test-list">{results.map(result => {
      const kanji = getKanji(result.id)!;
      return <li key={result.id}><Link href={`/kanji/${kanji.id}`} className={`kanji-tile ${result.ok ? 'is-correct' : 'is-missed'}`}>
        <span className="kanji-tile-char" lang="ja">{kanji.char}</span>
        <span className="kanji-tile-meaning">{kanji.meanings[locale]}</span>
        <span className="kanji-tile-status">{result.ok ? <Check size={12}/> : <X size={12}/>}{t(result.ok ? 'kanjiTestResult_ok' : 'kanjiTestResult_miss')}</span>
      </Link></li>;
    })}</ul>
  </article>;
}
