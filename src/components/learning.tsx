'use client';

import {useEffect, useRef, useState} from 'react';
import {useLocale, useNow, useTranslations} from 'next-intl';
import {ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Keyboard, PenLine, RotateCcw, Search, Sparkles, X} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {getLessonMeta, isCorrect, LEVELS, lessons, levelStats, placementQuestions, PRACTICE_SIZE, type Level} from '@/content/catalog';
import {loadLesson, loadPracticeQuestions, loadQuestions, type FullLesson} from '@/content/load';
import type {Question} from '@/content/schemas';
import type {Locale} from '@/i18n/routing';
import type {SubmittedAnswer} from '@/lib/auth-schemas';
import {answerInputSchema, dueQuestionIds, getRecommendation, getStats, type PracticeAnswer} from '@/lib/progress';
import {LessonCard, PageHeading} from './dashboard';
import {useProgress} from './progress-provider';
import {FuriganaToggle, Ruby} from './ruby';
import {CatFace, Paw} from './cat';

export function LessonDetail({lessonId}: {lessonId: string}) {
  const t = useTranslations('App');
  const [lesson, setLesson] = useState<FullLesson | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadLesson(lessonId).then(found => {if (active) {if (found) setLesson(found); else setFailed(true);}}).catch(() => {if (active) setFailed(true);});
    return () => {active = false;};
  }, [lessonId]);
  if (failed) return <EmptyState title={t('errorTitle')} text={t('errorText')}/>;
  if (!lesson) return <p className="loading-note" role="status">{t('loading')}</p>;
  return <LessonBody lesson={lesson}/>;
}

function LessonBody({lesson}: {lesson: FullLesson}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const [practice, setPractice] = useState<Question[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  async function start() {
    setStarting(true); setStartError(false);
    try {setPractice(await loadPracticeQuestions(lesson)); window.scrollTo({top: 0});}
    catch {setStartError(true);}
    finally {setStarting(false);}
  }
  if (practice) return <Practice lessonId={lesson.id} questions={practice} onExit={() => {setPractice(null); window.scrollTo({top: 0});}}/>;
  return <article className="lesson-study">
    <Link className="back-link" href="/lessons"><ArrowLeft size={16}/>{t('backLessons')}</Link>
    <PageHeading title={lesson.title[locale]} subtitle={`JLPT ${lesson.level} · ${t('lessonNumber', {number: lesson.levelNumber})} · ${t(lesson.category)}`}/>
    <section className="study-section"><h2>{t('studyTitle')}</h2><p>{lesson.study[locale]}</p></section>
    {lesson.forms && <section className="study-section"><h2>{t('formsTitle')}</h2><ul className="grammar-forms">{lesson.forms[locale].map(form => <li key={form} lang="ja"><GrammarForm form={form}/></li>)}</ul></section>}
    {lesson.notes && <section className="study-section"><h2>{t('notesTitle')}</h2><ul className="grammar-notes">{lesson.notes.map(note => <li key={note.en}>{note[locale]}</li>)}</ul></section>}
    {lesson.mistakes && <section className="study-section"><div className="section-title-row"><h2>{t('mistakesTitle')}</h2><FuriganaToggle label={t('furigana')}/></div><ul className="grammar-mistakes">{lesson.mistakes.map(mistake => <li key={mistake.wrong}>
      <p className="mistake-wrong"><X size={16} aria-label={t('mistakeWrong')}/><span lang="ja"><Ruby text={mistake.wrong} ruby={mistake.rubyWrong}/></span></p>
      <p className="mistake-right"><Check size={16} aria-label={t('mistakeRight')}/><span lang="ja"><Ruby text={mistake.right} ruby={mistake.rubyRight}/></span></p>
      <p className="mistake-why">{mistake.why[locale]}</p></li>)}</ul></section>}
    {lesson.compare && <section className="study-section"><h2>{t('compareTitle')}</h2><dl className="grammar-compare">{lesson.compare.map(item => <div key={item.with}><dt lang="ja">{item.with}</dt><dd>{item.note[locale]}</dd></div>)}</dl></section>}
    {lesson.words.length > 0 ? <section className="study-section"><h2>{t('wordList')}</h2><div className="word-table"><table><thead><tr><th>{t('japaneseLabel')}</th><th>{t('readingLabel')}</th><th>{t('meaningLabel')}</th></tr></thead><tbody>{lesson.words.map(word => <tr key={word.id}><td lang="ja">{word.japanese}</td><td lang="ja">{word.reading}</td><td>{word.meanings[locale]}</td></tr>)}</tbody></table></div></section> : <section className="study-section"><div className="section-title-row"><h2>{t('examplesTitle')}</h2><FuriganaToggle label={t('furigana')}/></div>
      {lesson.examples.map(example => <div className="study-example" key={example.japanese}><p lang="ja"><Ruby text={example.japanese} ruby={example.ruby}/></p><p>{example.translations[locale]}</p></div>)}
      {questionExamples(lesson).map(example => <div className="study-example is-more" key={example.id}><p lang="ja"><Ruby text={example.before} ruby={example.rubyBefore}/><mark>{example.answer}</mark><Ruby text={example.after} ruby={example.rubyAfter}/></p><p>{example.translation[locale]}</p></div>)}
    </section>}
    <div className="study-action"><span>{t('questions', {count: Math.max(PRACTICE_SIZE, lesson.questions.length)})}{lesson.questions.length < PRACTICE_SIZE && ` · ${t('practiceMix', {own: lesson.questions.length, earlier: PRACTICE_SIZE - lesson.questions.length})}`}</span><button className="button primary" onClick={start} disabled={starting}>{t(starting ? 'loading' : 'startPractice')}<ArrowRight size={17}/></button></div>
    {startError && <p className="auth-error" role="alert">{t('errorText')}</p>}
  </article>;
}

/** A form line such as "[verb (dictionary form)] + つもりです": bracketed parts are slots, the rest is Japanese. */
function GrammarForm({form}: {form: string}) {
  return <>{form.split(/(\[[^\]]+\])/).filter(Boolean).map((part, i) => part.startsWith('[')
    ? <span key={i} className="form-slot" lang="und">{part.slice(1, -1)}</span>
    : <span key={i}>{part}</span>)}</>;
}

// Practice sentences double as worked examples: the blank is filled with the answer (highlighted) and
// hints in full-width parentheses such as （ふつう） are dropped. Plain-text questions only.
const BLANK = '（　）';
const stripHints = (text: string) => text.replace(/（[^　）]*）/g, '').trim();
function questionExamples(lesson: FullLesson) {
  const seen = new Set(lesson.examples.map(example => example.japanese));
  return lesson.questions.flatMap(question => {
    const [before, after, ...rest] = question.prompt.split(BLANK);
    if (after === undefined || rest.length) return [];
    const japanese = stripHints(before + question.answer + after);
    if (seen.has(japanese)) return [];
    seen.add(japanese);
    const ruby = question.ruby?.prompt.split(BLANK);
    const rubyOk = ruby?.length === 2;
    return [{id: question.id, before: stripHints(before), after: stripHints(after), answer: question.answer, translation: question.translation,
      rubyBefore: rubyOk ? stripHints(ruby[0]) : undefined, rubyAfter: rubyOk ? stripHints(ruby[1]) : undefined}];
  });
}

export function PlacementTest() {
  const t = useTranslations('App');
  const [started, setStarted] = useState(false);
  if (started) return <Practice lessonId="placement" questions={placementQuestions}/>;
  return <div className="lesson-study"><PageHeading title={t('placementTitle')} subtitle={t('placementIntro')}/><section className="study-section"><h2>{t('placementLabel')}</h2><p>{t('placementText')}</p><p className="section-note">{t('placementDisclaimer')}</p><button className="button primary" onClick={() => setStarted(true)}>{t('startPlacement')}<ArrowRight size={17}/></button></section></div>;
}

export function Courses() {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const [category, setCategory] = useState<'all' | 'grammar' | 'vocabulary'>('all');
  const [search, setSearch] = useState('');
  const {progress} = useProgress();
  const completed = getStats(progress).completed;
  const nextLesson = lessons.find(lesson => !completed.has(lesson.id));
  const [level, setLevel] = useState<Level>(nextLesson?.level ?? 'N5');
  const query = search.trim().toLocaleLowerCase();
  const inLevel = lessons.filter(l => l.level === level);
  const visible = inLevel.filter(l => (category === 'all' || l.category === category) && `${l.levelNumber} ${l.title[locale]} ${l.description[locale]} ${l.glyph}`.toLocaleLowerCase().includes(query));
  const levelDone = inLevel.filter(l => completed.has(l.id)).length;
  const percent = Math.round(levelDone / Math.max(1, inLevel.length) * 100);
  const stats = levelStats(level);
  return <><PageHeading title={t('courseTitle')} subtitle={t('courseSub')}><Link className="button outline" href="/kanji"><PenLine size={16}/>{t('kanjiTitle')}</Link></PageHeading><div className="level-tabs" role="tablist" aria-label={t('levelLabel')}>{LEVELS.map(item => {const done = lessons.filter(l => l.level === item && completed.has(l.id)).length; const total = lessons.filter(l => l.level === item).length; return <button key={item} role="tab" aria-selected={level === item} className={level === item ? 'selected' : ''} onClick={() => setLevel(item)}><strong>{item}</strong><small>{done}/{total}</small></button>;})}</div><div className="curriculum-banner"><span className="stat-icon green"><Paw size={22}/></span><div><h2>{t('curriculumSummary', {grammar: stats.grammar, words: stats.words, questions: stats.questions})}</h2><p>{t('curriculumDetail')}</p><div className="course-progress"><div className="course-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={inLevel.length} aria-valuenow={levelDone} aria-label={t('lessonsProgress', {done: levelDone, total: inLevel.length})}><span style={{width: `${percent}%`}}/></div><span>{t('lessonsProgress', {done: levelDone, total: inLevel.length})}</span></div></div></div><div className="course-toolbar"><div className="tabs" role="group" aria-label={t('lessons')}>{(['all', 'grammar', 'vocabulary'] as const).map(tab => <button key={tab} onClick={() => setCategory(tab)} className={category === tab ? 'selected' : ''} aria-pressed={category === tab}>{t(tab)}</button>)}</div><label className="search-input"><Search size={17}/><input aria-label={t('search')} placeholder={t('search')} maxLength={100} value={search} onChange={event => setSearch(event.target.value)}/></label></div><div className="course-grid">{visible.map(lesson => <LessonCard key={lesson.id} lesson={lesson} done={completed.has(lesson.id)} next={lesson.id === nextLesson?.id}/>)}</div>{visible.length === 0 && <div className="empty-state"><Search size={28}/><p>{t('noResults')}</p></div>}</>;
}

export function Practice({lessonId, questions, onExit}: {lessonId: string; questions: Question[]; onExit?: () => void}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const {saveSession, progress, ready, account} = useProgress();
  const lesson = getLessonMeta(lessonId);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [rawAnswers, setRawAnswers] = useState<SubmittedAnswer[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [finished, setFinished] = useState(false);
  const sessionId = useRef<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const promptRef = useRef<HTMLHeadingElement>(null);
  const submitted = useRef(false);
  const answerLocked = useRef(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const question = questions[index];

  // After checking, move focus to the action button so Enter continues and the feedback stays in view.
  useEffect(() => {if (checked) submitRef.current?.focus();}, [checked]);

  // Always call the latest choose() so the handler sees the current `ready` state.
  const chooseRef = useRef<(choice: string) => void>(() => {});
  useEffect(() => {chooseRef.current = choose;});

  // Keyboard: 1–4 (or A–D) pick an answer; Enter checks / continues even when nothing is focused.
  useEffect(() => {
    if (!question || finished) return;
    const choices = question.type === 'choice' && !checked ? question.choices : [];
    function onKey(event: KeyboardEvent) {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (event.key === 'Enter') {
        if (!target || target === document.body || target.tagName === 'H2') {event.preventDefault(); formRef.current?.requestSubmit();}
        return;
      }
      if (target && (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'radio' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      const position = /^[1-9]$/.test(key) ? Number(key) - 1 : 'abcdefgh'.indexOf(key);
      if (position < 0 || position >= choices.length) return;
      event.preventDefault();
      chooseRef.current(choices[position]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, checked, finished]);

  function restart() {
    answerLocked.current = false; submitted.current = false; sessionId.current = null; startedAt.current = null;
    setIndex(0); setSelected(''); setChecked(false); setAnswers([]); setRawAnswers([]); setSaveError(false); setFinished(false);
  }

  // Multiple choice: one click (or key) selects and checks at once.
  function choose(choice: string) {
    if (answerLocked.current || !ready) return;
    startedAt.current ??= Date.now();
    setSelected(choice);
    check(choice);
  }

  function check(answer = selected) {
    if (answerLocked.current || !ready || !question) return;
    const input = answerInputSchema.safeParse({questionId: question.id, answer});
    if (!input.success) return;
    answerLocked.current = true;
    startedAt.current ??= Date.now();
    setRawAnswers(current => [...current, input.data]);
    const right = isCorrect(question, input.data.answer);
    setChecked(true); setAnswers(current => [...current, {questionId: question.id, correct: right}]);
  }
  async function next() {
    if (!checked) return;
    if (index < questions.length - 1) {answerLocked.current = false; setIndex(index + 1); setSelected(''); setChecked(false); promptRef.current?.focus(); return;}
    if (submitted.current) return;
    submitted.current = true;
    sessionId.current ??= crypto.randomUUID();
    setSaving(true); setSaveError(false);
    try {
      await saveSession({id: sessionId.current, lessonId, at: new Date().toISOString(), durationSeconds: Math.min(3600, Math.max(0, Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000))), answers}, rawAnswers);
      setFinished(true);
    } catch {submitted.current = false; setSaveError(true);}
    finally {setSaving(false);}
  }

  if (!question) return <EmptyState icon="book" title={t('notFound')} text={t('courseSub')}/>;
  const correct = checked && isCorrect(question, selected);
  const recommendation = getRecommendation(progress);
  const reviewNext = recommendation.reason === 'review';
  if (finished) return <div className="result-card panel"><span className="result-sprout"><CatFace size={64} mood={answers.filter(a => a.correct).length / answers.length >= 0.7 ? 'happy' : 'wink'}/></span><span className="eyebrow">{lesson ? `JLPT ${lesson.level}` : t(lessonId === 'placement' ? 'placementLabel' : 'review')}</span><h1>{t(lessonId === 'review' ? 'reviewComplete' : lessonId === 'placement' ? 'placementComplete' : 'lessonComplete')}</h1><p>{t('resultText', {correct: answers.filter(a => a.correct).length, total: answers.length})}</p><div className="result-score">{Math.round(answers.filter(a => a.correct).length / answers.length * 100)}<span>%</span></div><p className="muted">{t('resultSub')}</p><div className="result-next"><span>{t('nextStep')}</span><strong>{reviewNext ? t('reviewReady', {count: recommendation.dueCount}) : recommendation.lesson.title[locale]}</strong><Link className="button primary" href={reviewNext ? '/review' : `/lessons/${recommendation.lesson.id}`}>{t(reviewNext ? 'startReview' : 'begin')}<ArrowRight size={17}/></Link></div><div className="result-secondary">{lesson && <button type="button" className="button outline" onClick={restart}><RotateCcw size={16}/>{t('practiceAgain')}</button>}<Link className="back-link" href="/">{t('backOverview')}</Link></div><small className="saved-note"><CheckCircle2 size={14}/>{t(account.user ? 'savedToAccount' : 'savedLocally')}</small></div>;
  const backLink = onExit
    ? <button type="button" className="back-link" onClick={onExit}><ArrowLeft size={16}/>{t('backToLesson')}</button>
    : lessonId === 'review' ? <Link className="back-link" href="/review"><ArrowLeft size={16}/>{t('backReview')}</Link>
    : lessonId === 'placement' ? <Link className="back-link" href="/"><ArrowLeft size={16}/>{t('backOverview')}</Link>
    : <Link className="back-link" href="/lessons"><ArrowLeft size={16}/>{t('backLessons')}</Link>;
  const progressPercent = (index + (checked ? 1 : 0)) / questions.length * 100;
  return <div className="practice-container">{backLink}<div className="practice-title"><div><span className="eyebrow">{lesson ? `${t(lesson.category)} · JLPT ${lesson.level}` : `${t(lessonId === 'placement' ? 'placementLabel' : 'review')} · JLPT`}</span><h1>{lesson ? lesson.title[locale] : t(lessonId === 'placement' ? 'placementLabel' : 'review')}</h1></div><div className="practice-meta"><FuriganaToggle label={t('furigana')}/><span className="question-progress">{t('questionProgress', {current: index + 1, total: questions.length})}</span></div></div><div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={index + (checked ? 1 : 0)} aria-label={t('questionProgress', {current: index + 1, total: questions.length})}><span style={{width: `${progressPercent}%`}}/></div><section className="question-card panel" data-question={question.id}><div className="question-type"><span>{String(index + 1).padStart(2, '0')}</span>{t(question.type === 'fill' ? 'typeAnswer' : 'chooseAnswer')}{lesson && !lesson.questionIds.includes(question.id) && <small className="question-earlier"><RotateCcw size={12}/>{t('fromEarlierLesson')}</small>}</div><h2 className="japanese-question" lang="ja" tabIndex={-1} ref={promptRef}><Ruby text={question.prompt} ruby={question.ruby?.prompt}/></h2><p className="question-translation">{question.translation[locale]}</p><form ref={formRef} onKeyDown={event => {if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();}} onSubmit={event => {event.preventDefault(); if (checked) next(); else check();}}>
    {question.type === 'choice' ? <fieldset className="answer-options" disabled={checked || !ready}><legend className="sr-only">{t('chooseAnswer')}</legend>{question.choices.map((choice, i) => <label key={choice} className={`answer-option ${selected === choice ? 'selected' : ''} ${checked && choice === question.answer ? 'right-answer' : ''} ${checked && selected === choice && !correct ? 'wrong-answer' : ''}`}><input type="radio" name={question.id} value={choice} checked={selected === choice} onChange={() => choose(choice)}/><span className="answer-letter">{String.fromCharCode(65 + i)}</span><span lang="ja"><Ruby text={choice} ruby={question.ruby?.choices[i]}/></span>{checked && choice === question.answer && <Check size={18}/>}</label>)}</fieldset> : <input className="fill-answer" aria-label={t('answerPlaceholder')} placeholder={t('answerPlaceholder')} value={selected} maxLength={120} disabled={checked || !ready} onChange={event => {startedAt.current ??= Date.now(); setSelected(event.target.value);}} autoComplete="off" lang="ja"/>}
    {checked && <div role="status" className={`answer-feedback ${correct ? 'correct' : 'incorrect'}`}><div className="feedback-heading">{correct ? <CheckCircle2 size={21}/> : <X size={21}/>}<h3>{t(correct ? 'correct' : 'incorrect')}</h3></div>{!correct && <strong>{t('correctAnswer', {answer: question.answer})}</strong>}<p>{question.explanation[locale]}</p><Link href="/tutor">{t('askTutor')}<Sparkles size={14}/></Link></div>}
    <div className="practice-actions">{saveError && <p className="auth-error" role="alert">{t('saveProgressError')}</p>}<span className="muted practice-hint"><Keyboard size={14}/>{t(question.type === 'choice' ? 'keyboardHintChoice' : 'keyboardHintFill')}</span><button ref={submitRef} type="submit" className="button primary" disabled={!selected.trim() || !ready || saving}>{t(saving ? 'savingProgress' : checked ? (index === questions.length - 1 ? 'finishLesson' : 'nextQuestion') : 'checkAnswer')}<ArrowRight size={17}/></button></div></form></section><p className="practice-local"><Paw size={13}/>{t(account.user ? 'accountPracticeNotice' : 'savedLocally')}</p></div>;
}

export function EmptyState({title, text, icon = 'sprout', children}: {title: string; text: string; icon?: 'sprout' | 'book' | 'review'; children?: React.ReactNode}) {
  const t = useTranslations('App');
  const Icon = icon === 'book' ? BookOpen : icon === 'review' ? RotateCcw : null;
  return <div className="empty-state panel"><span className="empty-icon">{Icon ? <Icon size={32} strokeWidth={1.4}/> : <CatFace size={48} mood="wink"/>}</span><h2>{title}</h2><p>{text}</p>{children ?? <Link href="/lessons" className="button primary">{t('startLearning')}<ArrowRight size={17}/></Link>}</div>;
}

const REVIEW_SESSION_SIZE = 20;

export function Review() {
  const t = useTranslations('App');
  const {progress} = useProgress();
  const [practice, setPractice] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const now = useNow({updateInterval: 30000});
  const due = dueQuestionIds(progress, now);
  async function start() {
    setLoading(true); setLoadError(false);
    try {
      const loaded = await loadQuestions(due.slice(0, REVIEW_SESSION_SIZE));
      if (loaded.length) setPractice(loaded); else setLoadError(true);
    } catch {setLoadError(true);} finally {setLoading(false);}
  }
  if (practice) return <Practice lessonId="review" questions={practice}/>;
  return <><PageHeading title={t('reviewTitle')} subtitle={t('reviewSub')}/><EmptyState icon="review" title={t(due.length ? 'reviewReady' : progress.reviews.length ? 'reviewSoon' : 'reviewEmpty', {count: due.length})} text={t(due.length ? 'reviewSchedule' : progress.reviews.length ? 'reviewSoonText' : 'reviewEmptyText')}>{due.length > 0 ? <><button className="button primary" onClick={start} disabled={loading}>{t(loading ? 'loading' : 'startReview')}<ArrowRight size={17}/></button>{due.length > REVIEW_SESSION_SIZE && <p className="section-note">{t('reviewBatch', {count: REVIEW_SESSION_SIZE})}</p>}{loadError && <p className="auth-error" role="alert">{t('errorText')}</p>}</> : undefined}</EmptyState><p className="section-note">{t('reviewSchedule')}</p></>;
}
