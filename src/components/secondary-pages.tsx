'use client';

import {useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronRight, Globe2, LockKeyhole, ShieldCheck, Sparkles, Target, Trash2} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import {getLessonMeta} from '@/content/catalog';
import {getWeakTopics, localDay} from '@/lib/progress';
import {LanguageSelect} from './app-shell';
import {PageHeading, StatsCards} from './dashboard';
import {EmptyState, PlacementTest} from './learning';
import {useProgress} from './progress-provider';
import {CatFace, CatScene, Paw} from './cat';

export function History() {
  const t = useTranslations('App');
  const locale = useLocale() as 'en' | 'ru';
  const {progress, account} = useProgress();
  const weakTopics = getWeakTopics(progress);
  const now = new Date();
  const week = Array.from({length: 7}, (_, index) => {const date = new Date(now); date.setDate(date.getDate() - 6 + index); return {date, count: progress.sessions.filter(s => localDay(new Date(s.at)) === localDay(date)).reduce((sum, s) => sum + s.answers.length, 0)};});
  const max = Math.max(...week.map(d => d.count), 5);
  return <><PageHeading title={t('historyTitle')} subtitle={t('historySub')}><span className="local-label">{t(account.user ? 'savedToAccount' : 'localLabel')}</span></PageHeading><StatsCards/>{weakTopics.length > 0 && <section className="weak-topics panel"><h2>{t('weakTopicsTitle')}</h2>{weakTopics.slice(0, 5).map(topic => <Link className="weak-topic" key={topic.lesson.id} href={`/lessons/${topic.lesson.id}`}><strong>{topic.lesson.title[locale]}</strong><span>{t('mistakeCount', {count: topic.mistakes})}</span></Link>)}</section>}{progress.sessions.length ? <><section className="activity-panel panel"><h2>{t('weeklyActivity')}</h2><div className="activity-chart" role="img" aria-label={week.map(d => `${d.date.toLocaleDateString(locale)}: ${d.count}`).join(', ')}>{week.map(day => <div key={localDay(day.date)}><span>{day.count}</span><div className="bar-track"><span style={{height: `${Math.max(day.count / max * 100, 2)}%`}}/></div><small>{day.date.toLocaleDateString(locale, {weekday: 'short'})}</small></div>)}</div></section><section className="history-panel panel"><h2>{t('recentActivity')}</h2><div className="history-table"><table><thead><tr><th>{t('activity')}</th><th>{t('date')}</th><th>{t('score')}</th></tr></thead><tbody>{[...progress.sessions].reverse().map(session => <tr key={session.id}><td><span className="history-lesson-icon"><BookOpen size={16}/></span>{session.lessonId === 'review' ? t('review') : session.lessonId === 'placement' ? t('placementLabel') : (getLessonMeta(session.lessonId)?.title[locale] ?? t('lessons'))}</td><td>{new Date(session.at).toLocaleDateString(locale, {month: 'short', day: 'numeric'})}</td><td><span className="score-pill">{session.answers.filter(a => a.correct).length} / {session.answers.length}</span></td></tr>)}</tbody></table></div></section></> : <EmptyState title={t('historyEmpty')} text={t('historyEmptyText')}/>}</>;
}

export function Tutor() {
  const t = useTranslations('App');
  const [topic, setTopic] = useState<'Wa' | 'Ka' | 'No'>('Wa');
  return <><PageHeading title={t('tutorPageTitle')} subtitle={t('tutorPageSub')}/><div className="tutor-layout"><section className="tutor-info panel"><span className="tutor-big-icon"><Sparkles size={30}/></span><span className="mode-badge"><span/>{t('tutorMode')}</span><h2>{t('tutorTitle')}</h2><p>{t('tutorIntro')}</p><div className="tutor-topic-list"><h3>{t('tutorTopic')}</h3>{(['Wa', 'Ka', 'No'] as const).map(item => <button key={item} className={topic === item ? 'selected' : ''} aria-pressed={topic === item} onClick={() => setTopic(item)}>{t(`topic${item}`)}<ChevronRight size={16}/></button>)}</div></section><section className="tutor-answer panel" aria-live="polite"><div className="tutor-answer-label"><span className="avatar"><CatFace size={28}/></span>Nyantan<span className="sample-label">N5</span></div><h2>{t(`topic${topic}`)}</h2><p>{t(`tutor${topic}`)}</p><div className="tutor-example" lang="ja">{topic === 'Wa' ? '私は学生です。' : topic === 'Ka' ? '学生ですか。' : 'わたしの本'}</div><p className="tutor-disclaimer"><ShieldCheck size={16}/>{t('tutorDisclaimer')}</p></section></div></>;
}

export function Pricing({price}: {price: number}) {
  const t = useTranslations('App');
  const locale = useLocale() as 'en' | 'ru';
  return <><PageHeading title={t('pricingTitle')} subtitle={t('pricingSub')}/><div className="pricing-grid"><section className="price-card panel"><span className="stat-icon green"><CatFace size={34}/></span><h2>{t('free')}</h2><p>{t('freeDescription')}</p><div className="price">{t('freePrice')}<small>{t('forever')}</small></div><Link href="/lessons" className="button outline">{t('currentPlan')}<ArrowRight size={16}/></Link><ul>{(['freeFeature1', 'freeFeature2', 'freeFeature3'] as const).map(key => <li key={key}><Check size={17}/>{t(key)}</li>)}</ul></section><section className="price-card plus-card panel"><span className="planned-label">{t('planned')}</span><span className="stat-icon green"><Sparkles size={25}/></span><h2>{t('plus')}</h2><p>{t('plusDescription')}</p><div className="price">{new Intl.NumberFormat(locale, {style: 'currency', currency: 'JPY', maximumFractionDigits: 0}).format(price)}<small>{t('perMonth')}</small></div><button className="button primary" disabled><LockKeyhole size={15}/>{t('billingUnavailable')}</button><ul>{(['plusFeature1', 'plusFeature2', 'plusFeature3', 'plusFeature4'] as const).map(key => <li key={key}><Check size={17}/>{t(key)}</li>)}</ul></section></div><p className="pricing-note"><ShieldCheck size={17}/>{t('pricingNote')}</p></>;
}

export function Settings() {
  const t = useTranslations('App');
  const {progress, setGoal, reset, account, ready, syncing} = useProgress();
  const [saved, setSaved] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <><PageHeading title={t('settingsTitle')} subtitle={t('settingsSub')}/><div className="settings-stack"><section className="settings-card panel"><div className="settings-heading"><span className="stat-icon green"><Globe2 size={22}/></span><div><h2>{t('displayLanguage')}</h2><p>{t('languageHelp')}</p></div></div><LanguageSelect/></section><section className="settings-card panel"><div className="settings-heading"><span className="stat-icon peach"><Target size={22}/></span><div><h2>{t('goalTitle')}</h2><p>{t('goalHelp')}</p></div></div><div className="goal-options" role="group" aria-label={t('goalTitle')}>{[5, 10, 15, 20].map(goal => <button className={progress.dailyGoal === goal ? 'selected' : ''} key={goal} aria-pressed={progress.dailyGoal === goal} disabled={!ready || syncing} onClick={async () => {setSaved(false); try {await setGoal(goal); setSaved(true);} catch { /* The provider displays the save error. */ }}}>{t('goalOption', {count: goal})}{progress.dailyGoal === goal && <Check size={15}/>}</button>)}</div>{saved && <p className="saved-note" role="status"><CheckCircle2 size={14}/>{t(account.user ? 'savedToAccount' : 'saved')}</p>}</section><section className="settings-card panel"><div className="settings-heading"><span className="stat-icon purple"><ShieldCheck size={22}/></span><div><h2>{t('storageTitle')}</h2><p>{t(account.user ? 'cloudStorageHelp' : 'storageHelp')}</p></div></div><button className="button danger-outline" disabled={!ready || syncing} onClick={() => dialogRef.current?.showModal()}><Trash2 size={15}/>{t(account.user ? 'resetCloud' : 'reset')}</button></section></div><dialog ref={dialogRef} className="reset-dialog" aria-labelledby="reset-title"><h2 id="reset-title">{t('resetTitle')}</h2><p>{t(account.user ? 'resetCloudText' : 'resetText')}</p><div><button className="button outline" onClick={() => dialogRef.current?.close()}>{t('cancel')}</button><button className="button danger" disabled={syncing} onClick={async () => {try {await reset(); setSaved(false); dialogRef.current?.close();} catch { /* Keep the dialog open when saving failed. */ }}}>{t('confirmReset')}</button></div></dialog></>;
}

export function Account() {
  const t = useTranslations('App');
  return <><PageHeading title={t('accountTitle')} subtitle={t('tagline')}/><EmptyState title={t('accountTitle')} text={t('accountText')}><Link className="button primary" href="/lessons">{t('tryGuest')}<ArrowRight size={17}/></Link></EmptyState></>;
}

export function Placement() {
  return <PlacementTest/>;
}

export function Welcome() {
  const t = useTranslations('App');
  return <><section className="welcome-hero"><span className="eyebrow">{t('level')}</span><h1>{t('welcomeTitle')}</h1><p>{t('welcomeText')}</p><div className="welcome-actions"><Link href="/lessons" className="button primary">{t('startLearning')}<ArrowRight size={18}/></Link><Link href="/pricing" className="text-link">{t('pricing')}<ArrowUpRight size={16}/></Link></div><CatScene className="welcome-scene"/></section><div className="welcome-features">{([{key: 'welcomeFeature1', icon: Paw}, {key: 'welcomeFeature2', icon: Globe2}, {key: 'welcomeFeature3', icon: Target}] as const).map(({key, icon: Icon}) => <div className="panel" key={key}><Icon size={26}/><h2>{t(key)}</h2></div>)}</div><div className="preview-note"><Sparkles size={18}/><div><strong>{t('previewNotice')}</strong><span>{t('previewDetail')}</span></div></div></>;
}
