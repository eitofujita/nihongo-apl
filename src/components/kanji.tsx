'use client';

import {useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowLeft, ArrowRight, Eye, PenLine, RotateCcw} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {getKanji, kanjiList, loadStrokes, type KanjiInfo} from '@/content/kanji';
import type {Locale} from '@/i18n/routing';
import {gradeStrokeAt, pathLength, pathToPoints, type Point, type StrokeResult} from '@/lib/kanji-stroke';
import {KANJI_MODES, saveKanjiAttempt, useKanjiProgress, type KanjiMode} from '@/lib/kanji-progress';
import {PageHeading} from './dashboard';
import {EmptyState} from './learning';

const BOX = 109;
const TOLERANCE: Record<KanjiMode, number> = {trace: 1.15, guide: 1, recall: 1};
const HINT_AFTER = 2;

export function KanjiList() {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const store = useKanjiProgress();
  const recalled = kanjiList.filter(kanji => store[kanji.char]?.passed === 'recall').length;
  const percent = Math.round(recalled / kanjiList.length * 100);
  return <>
    <PageHeading title={t('kanjiTitle')} subtitle={t('kanjiSub')}/>
    <div className="curriculum-banner"><span className="stat-icon green"><PenLine size={24}/></span><div>
      <h2>{t('kanjiSummary', {count: kanjiList.length})}</h2>
      <p>{t('kanjiModesExplained')}</p>
      <div className="course-progress"><div className="course-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={kanjiList.length} aria-valuenow={recalled} aria-label={t('kanjiProgress', {done: recalled, total: kanjiList.length})}><span style={{width: `${percent}%`}}/></div><span>{t('kanjiProgress', {done: recalled, total: kanjiList.length})}</span></div>
    </div></div>
    <ul className="kanji-grid">{kanjiList.map(kanji => {
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

function KanjiFootnote() {
  const t = useTranslations('App');
  return <p className="section-note kanji-footnote">{t('kanjiLocalNote')} {t.rich('kanjiAttribution', {link: chunks => <a href="https://kanjivg.tagaini.net" target="_blank" rel="noreferrer">{chunks}</a>})}</p>;
}

export function KanjiPractice({id}: {id: string}) {
  const t = useTranslations('App');
  const kanji = getKanji(id);
  const [strokes, setStrokes] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadStrokes(id).then(found => {if (active) setStrokes(found);}).catch(() => {if (active) setFailed(true);});
    return () => {active = false;};
  }, [id]);
  if (!kanji || failed) return <EmptyState title={t('errorTitle')} text={t('errorText')}/>;
  if (!strokes) return <p className="loading-note" role="status">{t('loading')}</p>;
  return <PracticeBoard kanji={kanji} strokes={strokes}/>;
}

function Kun({reading}: {reading: string}) {
  const [stem, okurigana] = reading.split('.');
  return <>{stem}{okurigana && <span className="kanji-okurigana">{okurigana}</span>}</>;
}

function PracticeBoard({kanji, strokes}: {kanji: KanjiInfo; strokes: string[]}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const store = useKanjiProgress();
  const initialMode: KanjiMode = store[kanji.char]?.passed === 'trace' ? 'guide' : store[kanji.char]?.passed ? 'recall' : 'trace';
  const [mode, setMode] = useState<KanjiMode>(initialMode);
  const [done, setDone] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [misses, setMisses] = useState(0); // On the current stroke, for showing a hint.
  const [feedback, setFeedback] = useState<StrokeResult | null>(null);
  const [demo, setDemo] = useState(0); // Bumped to replay the stroke-order animation.
  const [saved, setSaved] = useState(true);
  const expected = useMemo(() => strokes.map(pathToPoints), [strokes]);
  const svgRef = useRef<SVGSVGElement>(null);
  const liveRef = useRef<SVGPolylineElement>(null);
  const drawing = useRef<{pointer: number; points: Point[]} | null>(null);
  const finished = done === strokes.length;
  const index = kanjiList.findIndex(item => item.id === kanji.id);
  const nextKanji = kanjiList[(index + 1) % kanjiList.length];

  function reset(nextMode = mode) {
    setMode(nextMode); setDone(0); setMistakes(0); setMisses(0); setFeedback(null); setDemo(0);
  }

  function toBox(event: ReactPointerEvent): Point {
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
    setDemo(0);
    paint();
  }
  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const current = drawing.current;
    if (!current || current.pointer !== event.pointerId) return;
    // Coalesced events give smooth lines on fast pen/finger movement where supported.
    const events = typeof event.nativeEvent.getCoalescedEvents === 'function' ? event.nativeEvent.getCoalescedEvents() : [];
    for (const item of events.length ? events : [event.nativeEvent]) {
      const point = toBox(item as unknown as ReactPointerEvent);
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
    const result = gradeStrokeAt(current.points, expected, done, TOLERANCE[mode]);
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
    <Link className="back-link" href="/kanji"><ArrowLeft size={16}/>{t('kanjiBack')}</Link>
    <div className="kanji-layout">
      <section className="kanji-info" aria-label={t('kanjiAbout')}>
        <p className={`kanji-big ${hidden ? 'is-hidden' : ''}`} lang="ja" aria-hidden={hidden}>{hidden ? '?' : kanji.char}</p>
        <h1>{kanji.meanings[locale]}</h1>
        <dl className="kanji-readings">
          {kanji.on.length > 0 && <><dt>{t('kanjiOn')}</dt><dd lang="ja">{kanji.on.join('、')}</dd></>}
          {kanji.kun.length > 0 && <><dt>{t('kanjiKun')}</dt><dd lang="ja">{kanji.kun.map((reading, i) => <span key={reading}>{i > 0 && '、'}<Kun reading={reading}/></span>)}</dd></>}
          <dt>{t('kanjiStrokeCount')}</dt><dd>{strokes.length}</dd>
        </dl>
        <div className="tabs kanji-modes" role="group" aria-label={t('kanjiModeLabel')}>{KANJI_MODES.map(item => <button key={item} className={mode === item ? 'selected' : ''} aria-pressed={mode === item} onClick={() => reset(item)}>{t(`kanjiMode_${item}`)}</button>)}</div>
      </section>
      <section className="kanji-board">
        <svg ref={svgRef} className={`kanji-pad ${finished ? 'is-finished' : ''}`} viewBox={`0 0 ${BOX} ${BOX}`} role="img" aria-label={t('kanjiPad')}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
          <g className="kanji-guides"><line x1={BOX / 2} y1="0" x2={BOX / 2} y2={BOX}/><line x1="0" y1={BOX / 2} x2={BOX} y2={BOX / 2}/></g>
          {mode === 'trace' && <g className="kanji-ghost">{strokes.map((d, i) => <path key={i} d={d}/>)}</g>}
          {demo > 0 && <g className="kanji-demo" key={demo}>{strokes.map((d, i) => <path key={i} d={d} pathLength={1} style={{animationDelay: `${i * 0.55}s`}}/>)}</g>}
          <g className="kanji-ink">{strokes.slice(0, done).map((d, i) => <path key={i} d={d}/>)}</g>
          {!finished && misses >= HINT_AFTER && <path className="kanji-hint" key={`${done}-${misses}`} d={strokes[done]} pathLength={1}/>}
          <polyline ref={liveRef} className="kanji-live" points=""/>
        </svg>
        <p className={`kanji-status ${feedback && !feedback.ok && !finished ? 'is-miss' : ''} ${finished ? 'is-done' : ''}`} role="status">{status}</p>
        {!saved && finished && <p className="section-note">{t('storageError')}</p>}
        <div className="kanji-actions">
          {finished ? <>
            <button className="button outline" onClick={() => reset()}><RotateCcw size={16}/>{t('kanjiAgain')}</button>
            {nextMode ? <button className="button primary" onClick={() => reset(nextMode)}>{t('kanjiNextMode', {mode: t(`kanjiMode_${nextMode}`)})}<ArrowRight size={16}/></button>
              : <Link className="button primary" href={`/kanji/${nextKanji.id}`}>{t('kanjiNext')}<ArrowRight size={16}/></Link>}
          </> : <>
            <button className="button outline" onClick={() => setDemo(value => value + 1)}><Eye size={16}/>{t('kanjiShowOrder')}</button>
            <button className="button outline" onClick={() => reset()} disabled={done === 0 && mistakes === 0}><RotateCcw size={16}/>{t('kanjiRestart')}</button>
          </>}
        </div>
        <p className="kanji-mode-hint">{t(`kanjiModeHint_${mode}`)}</p>
      </section>
    </div>
    <KanjiFootnote/>
  </article>;
}
