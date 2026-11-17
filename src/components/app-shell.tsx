'use client';

import {useState, type ReactNode} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {BookOpen, ChartNoAxesCombined, ChevronDown, ChevronRight, House, Menu, RotateCcw, Settings, Sparkles, Sprout, X} from 'lucide-react';
import {Link, usePathname, useRouter} from '@/i18n/navigation';
import {useProgress} from './progress-provider';
import type {Locale} from '@/i18n/routing';

export function LanguageSelect({compact = false}: {compact?: boolean}) {
  const locale = useLocale();
  const t = useTranslations('App');
  const router = useRouter();
  const pathname = usePathname();
  const {setLocale, syncing} = useProgress();
  return <label className={`language-select ${compact ? 'compact' : ''}`}>
    <span aria-hidden="true" className="language-symbol">◎</span>
    <span className="sr-only">{t('language')}</span>
    <select aria-label={t('language')} value={locale} disabled={syncing} onChange={async event => {
      const next = event.target.value as Locale;
      try {await setLocale(next);} catch { /* Display language can change even when saving a preference fails. */ }
      router.replace(pathname, {locale: next});
    }}>
      <option value="en">English</option><option value="ru">Русский</option>
    </select><ChevronDown size={13} aria-hidden="true"/>
  </label>;
}

export function Brand() {
  return <Link href="/" className="brand" aria-label="Nihongo AI"><span className="brand-mark" lang="ja">日<span/></span><span>Nihongo<span className="brand-ai"> AI</span></span></Link>;
}

export function AppShell({children}: {children: ReactNode}) {
  const t = useTranslations('App');
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const {progress, storageError, syncError, account, ready} = useProgress();
  const nav = [
    {href: '/', label: 'dashboard', icon: House},
    {href: '/lessons', label: 'lessons', icon: BookOpen},
    {href: '/review', label: 'review', icon: RotateCcw},
    {href: '/history', label: 'history', icon: ChartNoAxesCombined},
    {href: '/tutor', label: 'tutor', icon: Sparkles}
  ] as const;
  return <div className="app-shell">
    {menuOpen && <button className="sidebar-backdrop" aria-label={t('close')} onClick={() => setMenuOpen(false)}/>}
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-label={t('menu')}>
      <div className="sidebar-brand"><Brand/><button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label={t('close')}><X size={20}/></button></div>
      <p className="sidebar-caption">{t('navLearn')}</p>
      <nav className="main-nav">{nav.map(({href, label, icon: Icon}) => <Link key={href} href={href} className={`nav-link ${(href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'active' : ''}`} onClick={() => setMenuOpen(false)} aria-current={(href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'page' : undefined}><Icon size={19} strokeWidth={1.8}/><span>{t(label)}</span>{label === 'tutor' && <span className="nav-spark">✧</span>}{label === 'review' && progress.reviews.length > 0 && <span className="nav-count">{progress.reviews.length}</span>}</Link>)}</nav>
      <p className="sidebar-caption account-caption">{t('navAccount')}</p>
      <nav className="main-nav"><Link href="/settings" onClick={() => setMenuOpen(false)} className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}><Settings size={19} strokeWidth={1.8}/><span>{t('settings')}</span></Link></nav>
      <div className="sidebar-bottom"><Link href="/pricing" className="nav-link" onClick={() => setMenuOpen(false)}>{t('pricing')}<ChevronRight size={15}/></Link>
        <Link href="/login" className="profile" onClick={() => setMenuOpen(false)}><span className="avatar"><Sprout size={21}/></span><span><strong>{t(account.user ? 'accountLabel' : 'login')}</strong></span><ChevronRight size={15}/></Link>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="topbar-left"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-label={t('menu')}><Menu size={22}/></button><span className="breadcrumb">{t('breadcrumb')}<ChevronRight size={13}/><strong>{t(nav.find(item => item.href === pathname)?.label ?? (pathname === '/settings' ? 'settings' : pathname === '/pricing' ? 'pricing' : 'lessons'))}</strong></span><span className="mobile-wordmark">Nihongo <span>AI</span></span></div><div className="topbar-actions"><LanguageSelect/><Link className="topbar-avatar" href="/settings" aria-label={t('settings')}><Sprout size={19}/></Link></div></header>
      {storageError && <div className="storage-error" role="alert">{t('storageError')}</div>}
      {syncError && <div className="storage-error" role="alert">{t('cloudError')}<button className="button outline" onClick={() => window.location.reload()}>{t('tryAgain')}</button></div>}
      <main id="main-content" className="main-content">{account.user && !ready && !account.loadError ? <p role="status">{t('loading')}</p> : children}</main>
      <footer className="footer"><span>© {new Date().getFullYear()} Nihongo AI <span className="footer-dot">·</span> {t('footer')}</span><span><span className="status-dot"/>{t('previewNotice')}</span></footer>
    </div>
  </div>;
}
