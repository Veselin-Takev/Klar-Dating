import { klarStorage } from '../lib/userScopedStorage';
import { authFetch } from '../lib/authFetch';
import { useAuth } from '../lib/AuthContext';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useLocation, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../lib/useOnline';
import { useFirestoreSyncTime } from '../lib/useFirestoreSyncTime';
import { hapticFeedback } from '../lib/haptics';
import { AnimatePresence } from 'motion/react';
import { SichtschutzKnopf } from './Sichtschutz';
import { QuickThemeToggle } from './QuickThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  Clock,
  Scale,
  Compass,
  MessageCircle,
  Sparkles,
  Flower2,
  BookOpen,
  User,
  type LucideIcon,
} from 'lucide-react';

interface InAppNotificationMessage {
  notificationId?: number;
  title: string;
  body?: string;
  message?: string;
  persistent?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface LegalUpdate {
  id: string;
  version: string;
  publishedAt: string;
  titleKey: string;
  descriptionKey: string;
  sourceKey: string;
  sourceUrl: string;
  actionRequired: boolean;
  categoryKey: string;
}

const DevPerformanceOverlay = lazy(() =>
  import('./DevPerformanceOverlay').then(m => ({ default: m.DevPerformanceOverlay }))
);
const KontingentAnzeige = lazy(() =>
  import('./KontingentAnzeige').then(m => ({ default: m.KontingentAnzeige }))
);
const GlobalApiOverlay = lazy(() =>
  import('./GlobalApiOverlay').then(m => ({ default: m.GlobalApiOverlay }))
);
const GlobalErrorOverlay = lazy(() =>
  import('./GlobalErrorOverlay').then(m => ({ default: m.GlobalErrorOverlay }))
);
const InAppNotification = lazy(() =>
  import('./InAppNotification').then(m => ({ default: m.InAppNotification }))
);
const LegalUpdatesModal = lazy(() =>
  import('./LegalUpdatesModal').then(m => ({ default: m.LegalUpdatesModal }))
);

export interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Layout: Reines UI-Shell-Rendering der Anwendung.
 * Vollständig entkoppelt von der Authentifizierungs- und Compliance-Gate-Logik.
 * Verantwortlich für:
 * - Systemleiste (Theme, Sprache, Sichtschutz, Kontingent)
 * - Offline-Statusleiste
 * - Hauptnavigationsleiste (Bottom Navigation)
 * - Barrierefreie Sprungmarke (#inhalt)
 * - Globale Benachrichtigungstoasts & Rechtliche Update-Hinweise
 */
export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const online = useOnline();
  const lastSync = useFirestoreSyncTime();

  const isChatView = location.pathname.startsWith('/chat/');

  const [hasPendingRituals, setHasPendingRituals] = useState(false);
  useEffect(() => {
    const checkRituals = () => {
      const lastRitual = klarStorage.getItem('klar_last_ritual_date');
      const today = new Date().toLocaleDateString('de-DE');
      setHasPendingRituals(lastRitual !== today);
    };
    checkRituals();
    window.addEventListener('storage', checkRituals);
    return () => window.removeEventListener('storage', checkRituals);
  }, []);

  const [inAppNotification, setInAppNotification] = useState<InAppNotificationMessage | null>(null);
  const nextNotificationId = useRef(0);
  const [legalUpdates, setLegalUpdates] = useState<LegalUpdate[]>([]);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [acknowledgedLegalIds, setAcknowledgedLegalIds] = useState<string[]>([]);
  const [unseenLegalCount, setUnseenLegalCount] = useState(0);

  useEffect(() => {
    const handleNotification = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail: unknown = customEvent.detail;
      if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return;
      const candidate = detail as Record<string, unknown>;
      if (typeof candidate.title !== 'string' || !candidate.title.trim()) return;
      setInAppNotification({
        title: candidate.title,
        ...(typeof candidate.body === 'string' ? { body: candidate.body } : {}),
        ...(typeof candidate.message === 'string' ? { message: candidate.message } : {}),
        persistent: candidate.persistent === true,
        notificationId: ++nextNotificationId.current,
      });
    };

    const handleOpenLegal = () => setIsLegalModalOpen(true);

    window.addEventListener('klar-in-app-notification', handleNotification);
    window.addEventListener('open-legal-modal', handleOpenLegal);
    return () => {
      window.removeEventListener('klar-in-app-notification', handleNotification);
      window.removeEventListener('open-legal-modal', handleOpenLegal);
    };
  }, []);

  // Rechtliche Updates are server-authoritative. No browser storage is used for acknowledgements.
  useEffect(() => {
    let cancelled = false;
    setLegalUpdates([]);
    setAcknowledgedLegalIds([]);
    setUnseenLegalCount(0);
    setInAppNotification(null);
    if (authLoading || !user) return () => { cancelled = true; };
    const fetchLegalUpdates = async () => {
      try {
        const res = await authFetch('/api/legal-updates');
        if (!res.ok) return;
        const data = await res.json() as { updates?: LegalUpdate[]; acknowledgedIds?: string[] };
        if (cancelled || !Array.isArray(data.updates) || !Array.isArray(data.acknowledgedIds)) return;
        setLegalUpdates(data.updates);
        setAcknowledgedLegalIds(data.acknowledgedIds);
        const unseen = data.updates.filter(update => !data.acknowledgedIds!.includes(update.id));
        setUnseenLegalCount(unseen.length);
        if (unseen.some(update => update.actionRequired)) {
          setInAppNotification({
            title: t('legalUpdates.notificationTitle'),
            body: t('legalUpdates.notificationBody'),
            persistent: true,
            notificationId: ++nextNotificationId.current,
          });
        }
      } catch {
        // Legal notices are non-blocking; the next scheduled refresh retries.
      }
    };
    void fetchLegalUpdates();
    const interval = setInterval(() => void fetchLegalUpdates(), 60 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [t, user?.uid, authLoading]);

  const handleAcknowledgeLegal = async (id: string): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/legal-updates/${encodeURIComponent(id)}/acknowledge`, { method: 'POST' });
      if (!response.ok) return false;
      setAcknowledgedLegalIds(previous => previous.includes(id) ? previous : [...previous, id]);
      setUnseenLegalCount(previous => Math.max(0, previous - 1));
      setIsLegalModalOpen(false);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="klar-page mx-auto w-full max-w-7xl h-[calc(100dvh-var(--contract-links-height,0px))] flex flex-col relative overflow-hidden shadow-md">
      <AnimatePresence>
        {inAppNotification && (
          <Suspense fallback={null}>
            <InAppNotification
              key={inAppNotification.notificationId}
              notification={inAppNotification}
              onDismiss={() => setInAppNotification(current => current?.notificationId === inAppNotification.notificationId ? null : current)}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <GlobalApiOverlay />
        <GlobalErrorOverlay />
        <DevPerformanceOverlay />
      </Suspense>

      {/* Offline-Leiste: Vorhanden, wenn keine Verbindung besteht */}
      {!online && (
        <div role="status" className="bg-accent-quiet text-ink text-sm px-4 py-2 flex flex-col items-center justify-center gap-1 text-center">
          <span>Keine Verbindung. Angezeigte Inhalte können veraltet sein.</span>
          {lastSync && (
            <div className="flex items-center gap-1 text-xs opacity-80">
              <Clock size={12} />
              <span>Zuletzt synchronisiert: {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      )}

      {/* Systemleiste: Kontingent (außerhalb Chat), Sichtschutz, Theme, Sprache */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-700 px-2 py-1">
        <div className="flex-1 flex justify-center">
          {!isChatView && (
            <Suspense fallback={null}>
              <KontingentAnzeige kompakt />
            </Suspense>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <SichtschutzKnopf />
          <QuickThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>

      {/* WCAG 2.4.1 Skip-Link */}
      <a
        href="#inhalt"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          const target = document.getElementById('inhalt');
          if (target) {
            target.focus();
          }
        }}
      >
        {t('accessibility.skipToContent', 'Zum Inhalt springen')}
      </a>

      {/* Desktop navigation: identical six canonical routes; Manifest is content, not navigation. */}
      {!isChatView && (
        <nav className="hidden md:flex border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4" aria-label={t('accessibility.mainNav', 'Hauptnavigation')}>
          <div className="mx-auto flex w-full max-w-5xl items-center justify-center gap-2 py-2">
            {([
              { to: '/', label: 'Entdecken', Icon: Compass },
              { to: '/chats', label: 'Gespräche', Icon: MessageCircle },
              { to: '/ai-coach', label: 'Coach', Icon: Sparkles },
              { to: '/rituals', label: 'Rituale', Icon: Flower2 },
              { to: '/tips', label: 'Tipps', Icon: BookOpen },
              { to: '/profile', label: 'Profil', Icon: User },
            ] satisfies ReadonlyArray<{ to: string; label: string; Icon: LucideIcon }>).map(({ to, label, Icon }) => {
              const path = to;
              const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
              const C = Icon;
              return <Link key={path} to={path} onClick={() => hapticFeedback('light')} aria-current={active ? 'page' : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${active ? 'bg-brand/10 text-brand dark:bg-brand-light/10 dark:text-brand-light' : 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700'}`}><C size={18}/><span>{label}</span></Link>;
            })}
          </div>
        </nav>
      )}

      {/* Hauptinhaltsbereich */}
      <main id="inhalt" tabIndex={-1} className="flex-1 overflow-y-auto hide-scrollbar relative outline-none">
        {children}
      </main>

      {/* Hauptnavigation unten */}
      {!isChatView && (
        <nav className="md:hidden border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 pb-safe relative" aria-label={t('accessibility.mainNav', 'Hauptnavigation')}>
          {unseenLegalCount > 0 && (
            <button
              onClick={() => setIsLegalModalOpen(true)}
              aria-label={`${unseenLegalCount} neue rechtliche Updates. Klicken zum Öffnen.`}
              className="absolute -top-12 left-1/2 -translate-x-1/2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2 rounded-full shadow-lg text-xs font-medium flex items-center gap-2 transition-transform"
            >
              <Scale size={14} />
              {unseenLegalCount} {unseenLegalCount === 1 ? 'neues Update' : 'neue Updates'}
            </button>
          )}
          <div className="flex items-center justify-around p-3">
            <Link
              to="/"
              onClick={() => hapticFeedback('light')}
              className={`p-2 flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-brand dark:text-brand-light' : 'text-stone-700 dark:text-stone-400'}`}
              aria-label={t('navigationLabels.discover', 'Entdecken: Neue Vorschläge ansehen')}
              aria-current={location.pathname === '/' ? 'page' : undefined}
            >
              <Compass size={24} />
              <span className="text-xs font-medium">{t('bottomNav.discover', 'Entdecken')}</span>
            </Link>
            <Link
              to="/chats"
              onClick={() => hapticFeedback('light')}
              className={`p-2 flex flex-col items-center gap-1 ${location.pathname.startsWith('/chats') ? 'text-brand dark:text-brand-light' : 'text-stone-700 dark:text-stone-400'}`}
              aria-label={t('navigationLabels.chats', 'Gespräche: Deine Kontakte und Nachrichten')}
              aria-current={location.pathname.startsWith('/chats') ? 'page' : undefined}
            >
              <MessageCircle size={24} />
              <span className="text-xs font-medium">{t('bottomNav.chats', 'Gespräche')}</span>
            </Link>
            <Link
              to="/ai-coach"
              onClick={() => hapticFeedback('light')}
              className={`p-2 flex flex-col items-center gap-1 ${location.pathname === '/ai-coach' ? 'text-brand dark:text-brand-light' : 'text-stone-700 dark:text-stone-400'}`}
              aria-label={t('navigationLabels.coach', 'Coach: KI-Unterstützung und Dating-Tipps')}
              aria-current={location.pathname === '/ai-coach' ? 'page' : undefined}
            >
              <Sparkles size={24} />
              <span className="text-xs font-medium">{t('bottomNav.coach', 'Coach')}</span>
            </Link>
            <Link
              to="/rituals"
              onClick={() => hapticFeedback('light')}
              className={`p-2 flex flex-col items-center gap-1 relative ${location.pathname === '/rituals' ? 'text-brand dark:text-brand-light' : 'text-stone-700 dark:text-stone-400'}`}
              aria-label={t('bottomNav.rituals', 'Rituale')}
              aria-current={location.pathname === '/rituals' ? 'page' : undefined}
            >
              <div className="relative">
                <Flower2 size={24} />
                {hasPendingRituals && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white dark:border-dark-bg" />
                )}
              </div>
              <span className="text-xs font-medium">{t('bottomNav.rituals', 'Rituale')}</span>
            </Link>
            <Link
              to="/tips"
              onClick={() => hapticFeedback('light')}
              className={`p-2 flex flex-col items-center gap-1 ${location.pathname === '/tips' ? 'text-brand dark:text-brand-light' : 'text-stone-700 dark:text-stone-400'}`}
              aria-label={t('navigationLabels.tips', 'Tipps: Hilfe und Anleitungen')}
              aria-current={location.pathname === '/tips' ? 'page' : undefined}
            >
              <BookOpen size={24} />
              <span className="text-xs font-medium">{t('bottomNav.tips', 'Tipps')}</span>
            </Link>
            <Link
              to="/profile"
              onClick={() => hapticFeedback('light')}
              className={`p-2 flex flex-col items-center gap-1 ${location.pathname === '/profile' ? 'text-brand dark:text-brand-light' : 'text-stone-700 dark:text-stone-400'}`}
              aria-label={t('navigationLabels.profile', 'Profil: Deine Einstellungen und Verifizierung')}
              aria-current={location.pathname === '/profile' ? 'page' : undefined}
            >
              <User size={24} />
              <span className="text-xs font-medium">{t('bottomNav.profile', 'Profil')}</span>
            </Link>
          </div>
        </nav>
      )}

      <AnimatePresence>
        {isLegalModalOpen && (
          <Suspense fallback={null}>
            <LegalUpdatesModal
              updates={legalUpdates}
              onClose={() => setIsLegalModalOpen(false)}
              onAcknowledge={handleAcknowledgeLegal}
              acknowledgedIds={acknowledgedLegalIds}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
