'use client';

import {useLocale, useNow, useTranslations} from 'next-intl';
import {ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Flame, Leaf, RotateCcw, Target, TrendingUp} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {lessons, levelStats, type LessonMeta} from '@/content/catalog';
import type {Locale} from '@/i18n/routing';
import {getRecommendation, getStats} from '@/lib/progress';
import {useProgress} from './progress-provider';

export function PageHeading({title, subtitle, children}: {title: string; subtitle: string; children?: React.ReactNode}) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{children}</div>;
}

export function LessonCard({lesson, done, next}: {lesson: LessonMeta; done: boolean; next?: boolean}) {
  const t = useTranslations('App');
  const locale = useLocale() as Locale;
  return <Link className={`lesson-card simple-lesson ${done ? 'is-done' : ''} ${next ? 'is-next' : ''}`} href={`/lessons/${lesson.id}`}>
    <span className="simple-lesson-glyph" lang="ja">{lesson.glyph}</span>
    <div className="simple-lesson-text">
      <span className="simple-lesson-meta">
        <span>{t('lessonNumber', {number: lesson.levelNumber})} · {t(lesson.category)} · {t('questions', {count: lesson.questionIds.length})}</span>
        {done && <span className="lesson-badge done"><CheckCircle2 size={13}/>{t('completed')}</span>}
        {next && !done && <span className="lesson-badge next">{t('nextUp')}</span>}
      </span>
      <h3>{lesson.title[locale]}</h3><p>{lesson.description[locale]}</p>
    </div>
    <ChevronRight size={18} aria-hidden="true"/>
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

function TodayGoal({seconds, goal, streak}: {seconds: number; goal: number; streak: number}) {
  const t = useTranslations('App');
  // Any practice today counts as at least one minute, so a short lesson still moves the bar.
  const minutes = seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0;
  const percent = Math.min(100, Math.max(seconds > 0 ? 4 : 0, Math.round(seconds / (goal * 60) * 100)));
  const reached = seconds >= goal * 60;
  return <section className={`today-goal ${reached ? 'reached' : ''}`} aria-label={t('dailyGoal')}>
    <div className="today-goal-text">
      <span className="today-goal-label"><Target size={16}/>{t('dailyGoal')}</span>
      <strong>{t('dailyMinutes', {count: minutes, goal})}</strong>
    </div>
    <div className="today-goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(minutes, goal)} aria-label={t('dailyGoal')}><span style={{width: `${percent}%`}}/></div>
    <div className="today-goal-meta">
      {reached ? <span className="goal-done"><Check size={15}/>{t('goalReached')}</span> : <Link href="/settings">{t('goalOption', {count: goal})}</Link>}
      {streak > 0 && <span className="streak-badge"><Flame size={15}/>{t('streakLabel', {count: streak})}</span>}
    </div>
  </section>;
}

const curriculum = (({grammar, words, questions}) => ({grammar, words, questions}))(levelStats());

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
    {!starting && <TodayGoal seconds={stats.todaySeconds} goal={progress.dailyGoal} streak={stats.streak}/>}
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
      <Link href="/lessons"><BookOpen size={20}/><span><strong>{t('allLessons')}</strong><small>{t('curriculumSummary', curriculum)}</small></span><ArrowRight size={17}/></Link>
      <Link href="/review"><RotateCcw size={20}/><span><strong>{t('review')}</strong><small>{t('reviewCount', {count: progress.reviews.length})}</small></span><ArrowRight size={17}/></Link>
    </div>
    {!starting && !progress.sessions.some(s => s.lessonId === 'placement') && <Link className="placement-link" href="/placement"><span>{t('placementLink')}</span><ChevronRight size={17}/></Link>}
    <p className="dashboard-storage">{t(account.user ? 'savedToAccount' : 'guestDetail')}</p>
  </div>;
}
