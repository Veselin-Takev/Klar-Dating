import { klarStorage } from '../lib/userScopedStorage';
import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SICHTSCHUTZ_EIN = 'klar:sichtschutz';
const INACTIVITY_MS = 2 * 60 * 1000;

export function aktiviereSichtschutz(): void { window.dispatchEvent(new Event(SICHTSCHUTZ_EIN)); }

export function SichtschutzKnopf() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = () => { pressTimer.current = setTimeout(() => setMenuOpen(true), 500); };
  const cancelPress = () => { if (pressTimer.current) clearTimeout(pressTimer.current); pressTimer.current = null; };
  const handlePause = () => { klarStorage.setItem('sichtschutz_paused_until', String(Date.now() + 5 * 60 * 1000)); setMenuOpen(false); };
  return <div className="relative">
    <button type="button" onPointerDown={startPress} onPointerUp={cancelPress} onPointerLeave={cancelPress} onClick={() => { if (!menuOpen) aktiviereSichtschutz(); }} className="p-2 rounded-full" aria-label="Bildschirm verdecken" title="Bildschirm verdecken"><EyeOff size={20} /></button>
    <AnimatePresence>{menuOpen && <><div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} /><motion.div initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-stone-800 rounded-xl shadow-lg border z-50 overflow-hidden"><button type="button" onClick={handlePause} className="w-full text-left px-4 py-3 text-sm">Automatischen Sichtschutz 5 Minuten pausieren</button></motion.div></>}</AnimatePresence>
  </div>;
}

export function Sichtschutz() {
  const [aktiv, setAktiv] = useState(false);
  const unlockRef = useRef<HTMLButtonElement | null>(null);
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
    return () => { if (timer) clearTimeout(timer); window.removeEventListener(SICHTSCHUTZ_EIN, lock); document.removeEventListener('visibilitychange', onVisibility); ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(event => window.removeEventListener(event, onActivity)); };
  }, [aktiv]);

  useEffect(() => { if (aktiv) unlockRef.current?.focus(); }, [aktiv]);
  if (!aktiv) return null;
  return <div role="dialog" aria-modal="true" aria-label="Bildschirm verdeckt" className="fixed inset-0 z-[300] bg-stone-950 flex flex-col items-center justify-center p-8 text-center">
    <div className="w-16 h-16 rounded-full bg-stone-800 flex items-center justify-center mb-5"><EyeOff size={28} className="text-stone-300" /></div>
    <h2 className="text-xl font-serif text-white mb-2">Bildschirm verdeckt</h2>
    <p className="text-sm text-stone-300 max-w-xs mb-1">Niemand sieht, was du gerade liest.</p>
    <p className="text-xs text-stone-400 max-w-xs mb-8">Der Sichtschutz aktiviert sich auch nach Inaktivität oder beim Verlassen des Tabs.</p>
    <button type="button" ref={unlockRef} onClick={() => setAktiv(false)} className="px-8 py-3 bg-brand text-white rounded-full font-medium shadow-lg flex items-center gap-2"><Eye size={18} /> Wieder anzeigen</button>
  </div>;
}
