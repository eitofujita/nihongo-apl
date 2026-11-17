'use client';

import {useLocale, useNow, useTranslations} from 'next-intl';
import {ArrowRight, BookOpen, Check, ChevronRight, Leaf, RotateCcw, TrendingUp} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {lessons, vocabulary, type Lesson} from '@/content/lessons';
import type {Locale} from '@/i18n/routing';
import {getRecommendation, getStats} from '@/lib/progress';
import {useProgress} from './progress-provider';

export function PageHeading({title, subtitle, children}: {title: string; subtitle: string; children?: React.ReactNode}) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>;
}

export function LessonCard({lesson}: {lesson: Lesson}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const {progress} = useProgress();
  const done = getStats(progress).completed.has(lesson.id);
  return <Link className="lesson-card simple-lesson" href={`/lessons/${lesson.id}`}>
    <span className="simple-lesson-glyph" lang="ja">{lesson.glyph}</span>
    <div className="simple-lesson-text"><span>{t(lesson.category)} · {t('questions', {count: lesson.questions.length})}</span><h3>{lesson.title[locale]}</h3><p>{lesson.description[locale]}</p></div>
    {done ? <Check size={18} aria-label={t('completed')}/> : <ChevronRight size={18}/>}
  </Link>;
}

export function StatsCards() {
  const t = useTranslations('App');
  const {progress} = useProgress();
  const stats = getStats(progress);
  return <div className="stats-grid">
    <div className="stat-card"><span className="stat-icon green"><BookOpen size={21}/></span><div><span className="stat-label">{t('lessonsDone')}</span><strong>{stats.completed.size}<small>/ {lessons.length}</small></strong></div></div>
    <div className="stat-card"><span className="stat-icon green"><Leaf size={21}/></span><div><span className="stat-label">{t('wordsLearned')}</span><strong>{stats.words}</strong></div></div>
    <div className="stat-card"><span className="stat-icon green"><TrendingUp size={21}/></span><div><span className="stat-label">{t('accuracy')}</span><strong>{stats.accuracy === null ? '—' : `${stats.accuracy}%`}</strong></div></div>
  </div>;
}

export function Dashboard() {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  const {progress, ready, account} = useProgress();
  const stats = getStats(progress);
  const now = useNow({updateInterval: 30000});
  const recommendation = getRecommendation(progress, now);
  const lesson = recommendation.lesson;
  const due = recommendation.reason === 'review';
  const starting = ready && progress.sessions.length === 0;
  return <div className="focused-dashboard">
    <PageHeading title={t('hello')} subtitle={t('helloSub')}/>
    <section className="next-action panel">
      <span className="eyebrow">{t('nextStep')}</span>
      <h2>{starting ? t('placementTitle') : due ? t('reviewReady', {count: recommendation.dueCount}) : lesson.title[locale]}</h2>
      <p>{t(starting ? 'placementIntro' : recommendation.reason === 'weak' ? 'recommendWeak' : due ? 'recommendReview' : recommendation.reason === 'complete' ? 'recommendComplete' : 'recommendNext')}</p>
      <div className="next-action-actions">
        <Link className="button primary" href={starting ? '/placement' : due ? '/review' : `/lessons/${lesson.id}`} aria-disabled={!ready}>{t(starting ? 'startPlacement' : due ? 'startReview' : stats.completed.size ? 'continueLearning' : 'startLearning')}<ArrowRight size={17}/></Link>
        {starting && <Link className="first-lesson-link" href={`/lessons/${lessons[0].id}`}>{t('startWithFirstLesson')}</Link>}
      </div>
    </section>
    <StatsCards/>
    <div className="dashboard-shortcuts">
      <Link href="/lessons"><BookOpen size={20}/><span><strong>{t('allLessons')}</strong><small>{t('curriculumSummary', {grammar: 20, words: vocabulary.length, questions: 100})}</small></span><ArrowRight size={17}/></Link>
      <Link href="/review"><RotateCcw size={20}/><span><strong>{t('review')}</strong><small>{t('reviewCount', {count: progress.reviews.length})}</small></span><ArrowRight size={17}/></Link>
    </div>
    {!starting && !progress.sessions.some(s => s.lessonId === 'placement') && <Link className="placement-link" href="/placement"><span>{t('placementLink')}</span><ChevronRight size={17}/></Link>}
    <p className="dashboard-storage">{t(account.user ? 'savedToAccount' : 'guestDetail')}</p>
  </div>;
}
