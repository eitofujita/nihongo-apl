'use client';

import {useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowRight, Check, CheckCircle2, Puzzle, RotateCcw, X} from 'lucide-react';
import {LEVELS, type Level} from '@/content/catalog';
import {isSentenceCorrect, loadSentences, sentenceCount, shuffledChunks, type SentenceExercise} from '@/content/sentences';
import type {Locale} from '@/i18n/routing';
import {PageHeading} from './dashboard';
import {EmptyState} from './learning';
import {FuriganaToggle, Ruby} from './ruby';

const SESSION_SIZE = 10;

type Answer = {exercise: SentenceExercise; order: number[]; ok: boolean};

function pick<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

/** Build Japanese sentences by putting phrase chunks in order, from an English or Russian translation. */
export function SentenceBuilder() {
  const t = useTranslations('App');
  const [level, setLevel] = useState<Level>('N5');
  const [session, setSession] = useState<SentenceExercise[] | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start(nextLevel = level) {
    setLoading(true); setFailed(false);
    try {
      const all = await loadSentences(nextLevel);
      setAnswers([]); setSession(pick(all, SESSION_SIZE));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (failed) return <EmptyState title={t('errorTitle')} text={t('errorText')}><button className="button primary" onClick={() => start()}>{t('sentenceRetryLoad')}</button></EmptyState>;
  if (!session) return <article className="sentence-page">
    <PageHeading title={t('sentenceTitle')} subtitle={t('sentenceSub')}/>
    <section className="panel sentence-setup">
      <span className="stat-icon green"><Puzzle size={22}/></span>
      <h2>{t('sentenceChooseLevel')}</h2>
      <div className="tabs" role="group" aria-label={t('sentenceChooseLevel')}>{LEVELS.map(item =>
        <button key={item} className={level === item ? 'selected' : ''} aria-pressed={level === item} onClick={() => setLevel(item)}>
          {item} <span className="sentence-level-count">{t('sentenceLevelCount', {count: sentenceCount(item)})}</span>
        </button>)}
      </div>
      <p>{t('sentenceHow')}</p>
      <button className="button primary" onClick={() => start()} disabled={loading}>{t('sentenceStart', {count: SESSION_SIZE})}<ArrowRight size={16}/></button>
    </section>
  </article>;
  if (answers.length === session.length) return <SentenceResults answers={answers} onAgain={() => start()} onLevel={() => setSession(null)}/>;
  const current = answers.length;
  return <SentenceQuestion key={session[current].id} exercise={session[current]} number={current + 1} total={session.length}
    onDone={answer => setAnswers(list => [...list, answer])} onQuit={() => setSession(null)}/>;
}

function SentenceQuestion({exercise, number, total, onDone, onQuit}: {
  exercise: SentenceExercise; number: number; total: number; onDone: (answer: Answer) => void; onQuit: () => void;
}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  // Questions only appear after a click in the browser (never server-rendered), so shuffling here is safe.
  const [pool] = useState(() => shuffledChunks(exercise));
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLButtonElement>(null);
  const keepFocus = useRef(false);
  // Each question replaces the last one; start keyboard and screen-reader users at the new prompt.
  useEffect(() => {headingRef.current?.focus();}, []);
  // A tapped phrase disappears from the pool; hand focus to the next phrase (or Check) so it is not lost.
  useEffect(() => {
    if (!keepFocus.current) return;
    keepFocus.current = false;
    (poolRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? checkRef.current)?.focus();
  }, [order]);

  const complete = order.length === exercise.chunks.length;
  const update = (next: (list: number[]) => number[]) => {keepFocus.current = true; setOrder(next);};
  const add = (index: number) => {if (checked === null && !order.includes(index)) update(list => [...list, index]);};
  const remove = (position: number) => {if (checked === null) update(list => list.filter((_, i) => i !== position));};
  const chunkLabel = (index: number) => exercise.chunks[index].text;

  return <article className="sentence-page practice-container">
    <div className="kanji-test-header">
      <button className="back-link" onClick={onQuit}><X size={16}/>{t('sentenceQuit')}</button>
      <span className="question-progress">{t('kanjiTestQuestion', {current: number, total})}</span>
    </div>
    <div className="progress-track" aria-hidden="true"><span style={{width: `${(number - 1 + (checked === null ? 0 : 1)) / total * 100}%`}}/></div>
    <section className="panel sentence-card">
      <div className="section-title-row"><span className="question-type">{t('sentenceInstruction')}</span><FuriganaToggle label={t('furigana')}/></div>
      <h1 className="sentence-translation" ref={headingRef} tabIndex={-1}>{exercise.translations[locale]}</h1>

      <div className={`sentence-answer ${checked === true ? 'is-right' : checked === false ? 'is-wrong' : ''}`} aria-label={t('sentenceAnswerLabel')} role="group">
        {order.length === 0 && <span className="sentence-placeholder">{t('sentencePlaceholder')}</span>}
        {order.map((index, position) => <button key={`${index}-${position}`} type="button" className="sentence-chunk is-placed" lang="ja"
          onClick={() => remove(position)} disabled={checked !== null} aria-label={t('sentenceRemoveChunk', {chunk: chunkLabel(index)})}>
          <Ruby text={exercise.chunks[index].text} ruby={exercise.chunks[index].ruby}/>
        </button>)}
      </div>

      {checked === null && <div className="sentence-pool" ref={poolRef} aria-label={t('sentencePoolLabel')} role="group">
        {pool.map(index => {
          const used = order.includes(index);
          return <button key={index} type="button" className={`sentence-chunk ${used ? 'is-used' : ''}`} lang="ja"
            onClick={() => add(index)} disabled={used || checked !== null} aria-hidden={used} tabIndex={used ? -1 : 0}>
            <Ruby text={exercise.chunks[index].text} ruby={exercise.chunks[index].ruby}/>
          </button>;
        })}
      </div>}

      {checked === null ? <div className="practice-actions">
        <button className="button outline" onClick={() => update(() => [])} disabled={!order.length}><RotateCcw size={16}/>{t('sentenceClear')}</button>
        <button ref={checkRef} className="button primary" onClick={() => setChecked(isSentenceCorrect(exercise, order))} disabled={!complete}>{t('sentenceCheck')}<Check size={16}/></button>
      </div> : <div className={`answer-feedback ${checked ? '' : 'incorrect'}`} role="status">
        <div className="feedback-heading">{checked ? <CheckCircle2 size={20}/> : <X size={20}/>}<h3>{checked ? t('sentenceCorrect') : t('sentenceIncorrect')}</h3></div>
        {!checked && <p className="sentence-model-label">{t('sentenceModel')}</p>}
        <p className="sentence-model" lang="ja"><Ruby text={exercise.japanese} ruby={exercise.ruby}/></p>
        {!checked && <p>{t('sentenceOtherOrders')}</p>}
        <div className="practice-actions">
          <span/>
          <button className="button primary" onClick={() => onDone({exercise, order, ok: checked})} autoFocus>{number === total ? t('kanjiTestFinish') : t('kanjiTestNextQuestion')}<ArrowRight size={16}/></button>
        </div>
      </div>}
    </section>
  </article>;
}

function SentenceResults({answers, onAgain, onLevel}: {answers: Answer[]; onAgain: () => void; onLevel: () => void}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const correct = answers.filter(answer => answer.ok).length;
  const missed = answers.filter(answer => !answer.ok);
  return <article className="sentence-page">
    <section className="result-card panel">
      <h1>{t('kanjiTestResultsTitle')}</h1>
      <p className="kanji-test-score">{t('kanjiTestScore', {correct, total: answers.length})}</p>
      <div className="kanji-actions">
        <button className="button primary" onClick={onAgain}><RotateCcw size={16}/>{t('sentenceAgain', {count: SESSION_SIZE})}</button>
        <button className="button outline" onClick={onLevel}>{t('sentenceChangeLevel')}</button>
      </div>
    </section>
    {missed.length > 0 && <section className="panel sentence-review">
      <div className="section-title-row"><h2>{t('sentenceReviewTitle')}</h2><FuriganaToggle label={t('furigana')}/></div>
      <ul>{missed.map(({exercise, order}) => <li key={exercise.id}>
        <p className="sentence-model" lang="ja"><Ruby text={exercise.japanese} ruby={exercise.ruby}/></p>
        <p className="sentence-yours" lang="ja"><span>{t('sentenceYours')}</span> {order.map(i => exercise.chunks[i].text).join('')}{exercise.end}</p>
        <p>{exercise.translations[locale]}</p>
      </li>)}</ul>
    </section>}
  </article>;
}
