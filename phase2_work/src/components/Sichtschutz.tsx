import { klarStorage } from '../lib/userScopedStorage';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useModalAccessibility } from '../lib/useModalAccessibility';

export const SICHTSCHUTZ_EIN = 'klar:sichtschutz';
const INACTIVITY_MS = 2 * 60 * 1000;

export function aktiviereSichtschutz(): void { window.dispatchEvent(new Event(SICHTSCHUTZ_EIN)); }

export function SichtschutzKnopf() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const openedByLongPress = useRef(false);
  const menuWasOpen = useRef(false);
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); pressTimer.current = null; };
  const startPress = () => {
    openedByLongPress.current = false;
    cancelPress();
    pressTimer.current = setTimeout(() => { openedByLongPress.current = true; setMenuOpen(true); }, 500);
  };
  const handlePause = () => { klarStorage.setItem('sichtschutz_paused_until', String(Date.now() + 5 * 60 * 1000)); setMenuOpen(false); };
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    if (menuOpen) menuItemRefs.current[0]?.focus();
    else if (menuWasOpen.current) triggerRef.current?.focus();
    menuWasOpen.current = menuOpen;
  }, [menuOpen]);
  useEffect(() => () => { if (pressTimer.current) clearTimeout(pressTimer.current); }, []);
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
    const activeIndex = menuItemRefs.current.findIndex(item => item === document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowDown' ? (activeIndex + 1) % 2 : (activeIndex - 1 + 2) % 2;
      menuItemRefs.current[next]?.focus();
    }
  };
  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={event => { event.preventDefault(); setMenuOpen(true); }}
        onKeyDown={event => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); setMenuOpen(true); } }}
        onClick={() => { if (openedByLongPress.current || menuOpen) { openedByLongPress.current = false; return; } aktiviereSichtschutz(); }}
        className="p-2 rounded-full min-h-11 min-w-11"
        aria-label={t('privacy.coverScreen')}
        title={t('privacy.coverScreen')}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      ><EyeOff size={20} aria-hidden="true" /></button>
      <AnimatePresence>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" aria-hidden="true" onClick={closeMenu} />
            <motion.div
              role="menu"
              aria-label={t('privacy.menu')}
              onKeyDown={onMenuKeyDown}
              initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute right-0 top-full mt-2 w-60 bg-white dark:bg-stone-800 rounded-xl shadow-lg border z-50 overflow-hidden"
            >
              <button ref={element => { menuItemRefs.current[0] = element; }} type="button" role="menuitem" onClick={handlePause} className="w-full min-h-11 text-left px-4 py-3 text-sm">{t('privacy.pauseMenu')}</button>
              <button ref={element => { menuItemRefs.current[1] = element; }} type="button" role="menuitem" onClick={closeMenu} className="w-full min-h-11 text-left px-4 py-3 text-sm">{t('privacy.closeMenu')}</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sichtschutz() {
  const { t } = useTranslation();
  const [aktiv, setAktiv] = useState(false);
  const titleId = useId();
  const { dialogRef, onKeyDown } = useModalAccessibility<HTMLDivElement>(() => setAktiv(false), aktiv);
  const paused = () => {
    const raw = klarStorage.getItem('sichtschutz_paused_until');
    if (!raw) return false;
    const until = Number(raw);
    if (Number.isFinite(until) && Date.now() < until) return true;
    klarStorage.removeItem('sichtschutz_paused_until');
    return false;
  };
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const lock = () => { if (!paused()) setAktiv(true); };
    const schedule = () => { if (timer) clearTimeout(timer); if (!paused()) timer = setTimeout(lock, INACTIVITY_MS); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') lock(); else schedule(); };
    const onActivity = () => { if (!aktiv) schedule(); };
    window.addEventListener(SICHTSCHUTZ_EIN, lock);
    document.addEventListener('visibilitychange', onVisibility);
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(event => window.addEventListener(event, onActivity, { passive: true }));
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(SICHTSCHUTZ_EIN, lock);
      document.removeEventListener('visibilitychange', onVisibility);
      ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(event => window.removeEventListener(event, onActivity));
    };
  }, [aktiv]);
  if (!aktiv) return null;
  return (
    <div ref={dialogRef} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      className="fixed inset-0 z-[300] bg-stone-950 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-stone-800 flex items-center justify-center mb-5" aria-hidden="true"><EyeOff size={28} className="text-stone-300" /></div>
      <h2 id={titleId} className="text-xl font-serif text-white mb-2">{t('privacy.dialogTitle')}</h2>
      <p className="text-sm text-stone-300 max-w-xs mb-1">{t('privacy.nobodyCanSee')}</p>
      <p className="text-xs text-stone-400 max-w-xs mb-8">{t('privacy.autoActivation')}</p>
      <button type="button" onClick={() => setAktiv(false)} className="px-8 py-3 bg-brand text-white rounded-full font-medium shadow-lg flex items-center gap-2">
        <Eye size={18} aria-hidden="true" /> {t('privacy.showScreen')}
      </button>
    </div>
  );
}
