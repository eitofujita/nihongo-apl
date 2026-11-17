'use client';

import {useRef, useState} from 'react';
import {useLocale, useNow, useTranslations} from 'next-intl';
import {ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Clock3, RotateCcw, Search, Sparkles, Sprout, X} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {getLesson, isCorrect, lessons, placementQuestions, vocabulary, type Question} from '@/content/lessons';
import type {Locale} from '@/i18n/routing';
import type {SubmittedAnswer} from '@/lib/auth-schemas';
import {answerInputSchema, dueQuestions, getRecommendation, type PracticeAnswer} from '@/lib/progress';
import {LessonCard, PageHeading} from './dashboard';
import {useProgress} from './progress-provider';

export function LessonDetail({lessonId}: {lessonId: string}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const [practicing, setPracticing] = useState(false);
  const lesson = getLesson(lessonId);
  if (!lesson) return <EmptyState title={t('notFound')} text={t('courseSub')}/>;
  if (practicing) return <Practice lessonId={lessonId}/>;
  return <article className="lesson-study">
    <Link className="back-link" href="/lessons"><ArrowLeft size={16}/>{t('backLessons')}</Link>
    <PageHeading title={lesson.title[locale]} subtitle={t(lesson.category) + ' · JLPT N5'}/>
    <section className="study-section"><h2>{t('studyTitle')}</h2><p>{lesson.study[locale]}</p></section>
    {lesson.words.length > 0 ? <section className="study-section"><h2>{t('wordList')}</h2><div className="word-table"><table><thead><tr><th>{t('japaneseLabel')}</th><th>{t('readingLabel')}</th><th>{t('meaningLabel')}</th></tr></thead><tbody>{lesson.words.map(word => <tr key={word.id}><td lang="ja">{word.japanese}</td><td lang="ja">{word.reading}</td><td>{word.meanings[locale]}</td></tr>)}</tbody></table></div></section> : <section className="study-section"><h2>{t('examplesTitle')}</h2>{lesson.examples.map(example => <div className="study-example" key={example.japanese}><p lang="ja">{example.japanese}</p><p>{example.translations[locale]}</p></div>)}</section>}
    <div className="study-action"><span>{t('questions', {count: lesson.questions.length})}</span><button className="button primary" onClick={() => setPracticing(true)}>{t('startPractice')}<ArrowRight size={17}/></button></div>
  </article>;
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
  const visible = lessons.filter(l => (category === 'all' || l.category === category) && `${l.title[locale]} ${l.description[locale]} ${l.glyph}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <><PageHeading title={t('courseTitle')} subtitle={t('courseSub')}><span className="level-pill"><span/>{t('levelBadge')}</span></PageHeading><div className="curriculum-banner"><span className="stat-icon green"><Sprout size={24}/></span><div><h2>{t('curriculumSummary', {grammar: 20, words: vocabulary.length, questions: 100})}</h2><p>{t('curriculumDetail')}</p></div></div><div className="course-toolbar"><div className="tabs" role="group" aria-label={t('lessons')}>{(['all', 'grammar', 'vocabulary'] as const).map(tab => <button key={tab} onClick={() => setCategory(tab)} className={category === tab ? 'selected' : ''} aria-pressed={category === tab}>{t(tab)}</button>)}</div><label className="search-input"><Search size={17}/><input aria-label={t('search')} placeholder={t('search')} maxLength={100} value={search} onChange={event => setSearch(event.target.value)}/></label></div><div className="course-grid">{visible.map(lesson => <LessonCard key={lesson.id} lesson={lesson}/>)}</div>{visible.length === 0 && <div className="empty-state"><Search size={28}/><p>{t('noResults')}</p></div>}</>;
}

export function Practice({lessonId, questions: reviewQuestions}: {lessonId: string; questions?: Question[]}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const {saveSession, progress, ready, account} = useProgress();
  const lesson = getLesson(lessonId);
  const questions = reviewQuestions ?? lesson?.questions ?? [];
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
  const question = questions[index];

  function check() {
    if (answerLocked.current || !ready || !question) return;
    const input = answerInputSchema.safeParse({questionId: question.id, answer: selected});
    if (!input.success) return;
    answerLocked.current = true;
    startedAt.current ??= Date.now();
    setRawAnswers(current => [...current, input.data]);
    setChecked(true); setAnswers(current => [...current, {questionId: question.id, correct: isCorrect(question, input.data.answer)}]);
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
  if (finished) return <div className="result-card panel"><span className="result-sprout"><Sprout size={38}/></span><span className="eyebrow">{t('levelBadge')}</span><h1>{t(lessonId === 'review' ? 'reviewComplete' : lessonId === 'placement' ? 'placementComplete' : 'lessonComplete')}</h1><p>{t('resultText', {correct: answers.filter(a => a.correct).length, total: answers.length})}</p><div className="result-score">{Math.round(answers.filter(a => a.correct).length / answers.length * 100)}<span>%</span></div><p className="muted">{t('resultSub')}</p><div className="result-next"><span>{t('nextStep')}</span><strong>{reviewNext ? t('reviewReady', {count: recommendation.dueCount}) : recommendation.lesson.title[locale]}</strong><Link className="button primary" href={reviewNext ? '/review' : `/lessons/${recommendation.lesson.id}`}>{t(reviewNext ? 'startReview' : 'begin')}<ArrowRight size={17}/></Link></div><Link className="back-link" href="/">{t('backOverview')}</Link><small className="saved-note"><CheckCircle2 size={14}/>{t(account.user ? 'savedToAccount' : 'savedLocally')}</small></div>;
  return <div className="practice-container"><Link className="back-link" href={lessonId === 'review' ? '/review' : '/lessons'}><ArrowLeft size={16}/>{t('backLessons')}</Link><div className="practice-title"><div><span className="eyebrow">{t(lesson?.category ?? (lessonId === 'placement' ? 'placementLabel' : 'review'))} · JLPT N5</span><h1>{lesson ? lesson.title[locale] : t(lessonId === 'placement' ? 'placementLabel' : 'review')}</h1></div><span className="question-progress">{t('questionProgress', {current: index + 1, total: questions.length})}</span></div><div className="progress-track"><span style={{width: `${index / questions.length * 100}%`}}/></div><section className="question-card panel"><div className="question-type"><span>{String(index + 1).padStart(2, '0')}</span>{t(question.type === 'fill' ? 'typeAnswer' : 'chooseAnswer')}</div><h2 className="japanese-question" lang="ja" tabIndex={-1} ref={promptRef}>{question.prompt}</h2><p className="question-translation">{question.translation[locale]}</p><form onKeyDown={event => {if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();}} onSubmit={event => {event.preventDefault(); if (checked) next(); else check();}}>
    {question.type === 'choice' ? <fieldset className="answer-options" disabled={checked || !ready}><legend className="sr-only">{t('chooseAnswer')}</legend>{question.choices.map((choice, i) => <label key={choice} className={`answer-option ${selected === choice ? 'selected' : ''} ${checked && choice === question.answer ? 'right-answer' : ''} ${checked && selected === choice && !correct ? 'wrong-answer' : ''}`}><input type="radio" name={question.id} value={choice} checked={selected === choice} onChange={() => {startedAt.current ??= Date.now(); setSelected(choice);}}/><span className="answer-letter">{String.fromCharCode(65 + i)}</span><span lang="ja">{choice}</span>{checked && choice === question.answer && <Check size={18}/>}</label>)}</fieldset> : <input className="fill-answer" aria-label={t('answerPlaceholder')} placeholder={t('answerPlaceholder')} value={selected} maxLength={120} disabled={checked || !ready} onChange={event => {startedAt.current ??= Date.now(); setSelected(event.target.value);}} autoComplete="off" lang="ja"/>}
    {checked && <div role="status" className={`answer-feedback ${correct ? 'correct' : 'incorrect'}`}><div className="feedback-heading">{correct ? <CheckCircle2 size={21}/> : <X size={21}/>}<h3>{t(correct ? 'correct' : 'incorrect')}</h3></div>{!correct && <strong>{t('correctAnswer', {answer: question.answer})}</strong>}<p>{question.explanation[locale]}</p><Link href="/tutor">{t('askTutor')}<Sparkles size={14}/></Link></div>}
    <div className="practice-actions">{saveError && <p className="auth-error" role="alert">{t('saveProgressError')}</p>}<span className="muted"><Clock3 size={14}/>{t('yourPace')}</span><button type="submit" className="button primary" disabled={!selected.trim() || !ready || saving}>{t(saving ? 'savingProgress' : checked ? (index === questions.length - 1 ? 'finishLesson' : 'nextQuestion') : 'checkAnswer')}<ArrowRight size={17}/></button></div></form></section><p className="practice-local"><Sprout size={14}/>{t(account.user ? 'accountPracticeNotice' : 'savedLocally')}</p></div>;
}

export function EmptyState({title, text, icon = 'sprout', children}: {title: string; text: string; icon?: 'sprout' | 'book' | 'review'; children?: React.ReactNode}) {
  const t = useTranslations('App');
  const Icon = icon === 'book' ? BookOpen : icon === 'review' ? RotateCcw : Sprout;
  return <div className="empty-state panel"><span className="empty-icon"><Icon size={32} strokeWidth={1.4}/></span><h2>{title}</h2><p>{text}</p>{children ?? <Link href="/lessons" className="button primary">{t('startLearning')}<ArrowRight size={17}/></Link>}</div>;
}

export function Review() {
  const t = useTranslations('App');
  const {progress} = useProgress();
  const [practice, setPractice] = useState<Question[] | null>(null);
  const now = useNow({updateInterval: 30000});
  const questions = dueQuestions(progress, now);
  if (practice) return <Practice lessonId="review" questions={practice}/>;
  return <><PageHeading title={t('reviewTitle')} subtitle={t('reviewSub')}/><EmptyState icon="review" title={t(questions.length ? 'reviewReady' : progress.reviews.length ? 'reviewSoon' : 'reviewEmpty', {count: questions.length})} text={t(questions.length ? 'reviewSchedule' : progress.reviews.length ? 'reviewSoonText' : 'reviewEmptyText')}>{questions.length > 0 ? <button className="button primary" onClick={() => setPractice(questions)}>{t('startReview')}<ArrowRight size={17}/></button> : undefined}</EmptyState><p className="section-note">{t('reviewSchedule')}</p></>;
}
