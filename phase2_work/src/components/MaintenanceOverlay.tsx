import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Wrench, Clock, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface MaintenanceDocData {
  active?: boolean;
  message?: string;
  progress?: number;
  estimatedEndTime?: string | number | { seconds: number };
  expectedEnd?: string | number | { seconds: number };
  endTime?: string | number | { seconds: number };
  until?: string | number | { seconds: number };
  startedAt?: string | number | { seconds: number };
  startTime?: string | number | { seconds: number };
  step?: string;
  steps?: string[];
}

export interface MaintenanceOverlayProps {
  onRetry?: () => void;
  message?: string;
  estimatedEndTime?: string;
  progress?: number;
  step?: string;
  className?: string;
}

/**
 * Normalisiert Zeitangaben aus Firestore (Strings, Timestamps oder Zahlen) zu einem Date-Objekt
 */
function parseTimestamp(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Falls Sekunden-Timestamp (z.B. Unix timestamp < 1e11)
    return new Date(val < 1e11 ? val * 1000 : val);
  }
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  if (typeof val === 'string') {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * Formatiert verbleibende Sekunden in einen lesbaren deutschen Text
 */
function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return 'Gleich abgeschlossen';
  if (seconds < 60) return `Noch ca. ${Math.ceil(seconds)} Sekunden`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = Math.floor(seconds % 60);
  if (minutes < 60) {
    if (remainingSecs === 0) return `Noch ca. ${minutes} Min.`;
    return `Noch ca. ${minutes} Min. ${remainingSecs} Sek.`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `Noch ca. ${hours} Std. ${remainingMins > 0 ? `${remainingMins} Min.` : ''}`.trim();
}

/**
 * MaintenanceOverlay:
 * Dynamisch animierte Wartungskomponente mit Framer-Motion.
 * Reagiert live auf das Firestore-Dokument 'config/maintenance' und animiert
 * Fortschrittsbalken und geschätzte Wartezeit in Echtzeit.
 */
export function MaintenanceOverlay({
  onRetry,
  message: propMessage,
  estimatedEndTime: propEstimatedEndTime,
  progress: propProgress,
  step: propStep,
  className = '',
}: MaintenanceOverlayProps) {
  const [docData, setDocData] = useState<MaintenanceDocData | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [isRetrying, setIsRetrying] = useState(false);

  // Firestore Live-Synchronisation mit config/maintenance
  useEffect(() => {
    let unsub = () => {};
    try {
      if (db) {
        unsub = onSnapshot(
          doc(db, 'config', 'maintenance'),
          (snapshot) => {
            if (snapshot.exists()) {
              setDocData(snapshot.data() as MaintenanceDocData);
            }
          },
          (err) => {
            console.warn('MaintenanceOverlay onSnapshot warning:', err);
          }
        );
      }
    } catch {
      // Offline- oder Test-Fallback
    }

    return () => unsub();
  }, []);

  // Taktgeber für die verbleibende Zeit (jede Sekunde)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Aktive Werte aus Props oder Firestore-Dokument ableiten
  const activeMessage =
    propMessage ||
    docData?.message ||
    'Wir führen derzeit notwendige Wartungsarbeiten durch, um Klar für dich zu verbessern. Wir sind in Kürze wieder da.';

  const rawEndTime =
    propEstimatedEndTime ||
    docData?.estimatedEndTime ||
    docData?.expectedEnd ||
    docData?.until ||
    docData?.endTime;

  const endDate = useMemo(() => parseTimestamp(rawEndTime), [rawEndTime]);

  const rawStartTime = docData?.startedAt || docData?.startTime;
  const startDate = useMemo(() => parseTimestamp(rawStartTime), [rawStartTime]);

  const activeStep = propStep || docData?.step;

  // Fortschrittsberechnung (0 - 100)
  const calculatedProgress = useMemo(() => {
    // 1. Expliziter Fortschritt übergeben (Prop oder Firestore)
    const explicitProgress = propProgress ?? docData?.progress;
    if (typeof explicitProgress === 'number' && !isNaN(explicitProgress)) {
      // Falls 0 - 1 übergeben wurde, auf 0 - 100 skalieren
      const normalized = explicitProgress <= 1 && explicitProgress > 0 ? explicitProgress * 100 : explicitProgress;
      return Math.min(100, Math.max(0, normalized));
    }

    // 2. Zeitbasierter Fortschritt, falls Start- und Endzeit bekannt sind
    if (startDate && endDate) {
      const total = endDate.getTime() - startDate.getTime();
      const elapsed = now - startDate.getTime();
      if (total > 0) {
        const ratio = (elapsed / total) * 100;
        return Math.min(96, Math.max(5, Math.round(ratio)));
      }
    }

    // 3. Wenn Endzeit bekannt, aber keine Startzeit: relative Annäherung
    if (endDate) {
      const diffSec = (endDate.getTime() - now) / 1000;
      if (diffSec <= 0) return 98;
      if (diffSec < 60) return 90;
      if (diffSec < 300) return 75;
      if (diffSec < 900) return 50;
      return 35;
    }

    // 4. Sanfter Grundfortschritt
    return 65;
  }, [propProgress, docData?.progress, startDate, endDate, now]);

  // Verbleibende Sekunden
  const remainingSeconds = useMemo(() => {
    if (!endDate) return null;
    const diff = (endDate.getTime() - now) / 1000;
    return Math.max(0, diff);
  }, [endDate, now]);

  // Formatiertes Enddatum (z.B. "14:30 Uhr")
  const formattedEndTime = useMemo(() => {
    if (!endDate) return null;
    const isToday = endDate.toDateString() === new Date().toDateString();
    const timeStr = endDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }) + ' Uhr';
    return isToday ? timeStr : `${timeStr} (${endDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })})`;
  }, [endDate]);

  const handleRetryClick = () => {
    setIsRetrying(true);
    if (onRetry) {
      onRetry();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
    setTimeout(() => setIsRetrying(false), 1200);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed inset-0 z-[9999] bg-light-bg/95 dark:bg-dark-bg/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 w-full min-h-[100dvh] overflow-y-auto ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg w-full bg-white/90 dark:bg-stone-900/90 border border-stone-200/80 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Subtiler Hintergrund-Glanz */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand/10 dark:bg-brand-light/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        {/* Animiertes Werkzeug- / Status-Icon */}
        <motion.div
          animate={{
            rotate: [-4, 4, -4],
            scale: [1, 1.04, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: 4,
            ease: 'easeInOut',
          }}
          className="w-20 h-20 sm:w-24 sm:h-24 bg-brand/10 dark:bg-brand-light/15 text-brand dark:text-brand-light rounded-3xl flex items-center justify-center mb-6 shadow-inner relative"
        >
          <Wrench className="w-10 h-10 sm:w-12 sm:h-12 text-brand dark:text-brand-light" aria-hidden="true" />
          <motion.div
            animate={{
              opacity: [0.4, 1, 0.4],
              scale: [0.9, 1.15, 0.9],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: 'easeInOut',
            }}
            className="absolute -top-1.5 -right-1.5 text-accent"
          >
            <Sparkles size={20} />
          </motion.div>
        </motion.div>

        {/* Überschrift */}
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 mb-3 tracking-tight">
          Wir sind gleich zurück
        </h1>

        {/* Beschreibungstext */}
        <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 mb-6 leading-relaxed max-w-md">
          {activeMessage}
        </p>

        {/* ── FORTSCHRITTSBALKEN (framer-motion) ── */}
        <div className="w-full bg-stone-100 dark:bg-stone-800/80 rounded-2xl p-4 sm:p-5 border border-stone-200/60 dark:border-stone-700/60 mb-6">
          <div className="flex justify-between items-center mb-2.5 text-xs sm:text-sm font-medium">
            <span className="text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-brand dark:text-brand-light" />
              Wartungsfortschritt
            </span>
            <span className="text-brand dark:text-brand-light font-bold" data-testid="progress-percentage">
              {Math.round(calculatedProgress)}%
            </span>
          </div>

          {/* Balken-Container */}
          <div
            className="w-full h-3.5 sm:h-4 bg-stone-200/80 dark:bg-stone-700/80 rounded-full overflow-hidden relative"
            role="progressbar"
            aria-valuenow={Math.round(calculatedProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Wartungsfortschritt"
          >
            {/* Animierter Fortschrittsstrang */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${calculatedProgress}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-full bg-gradient-to-r from-brand via-brand-light to-brand rounded-full relative overflow-hidden"
            >
              {/* Sanfter Shimmer-Effekt */}
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.2,
                  ease: 'linear',
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full h-full"
              />
            </motion.div>
          </div>

          {/* Aktueller Zwischenschritt (falls vorhanden) */}
          {activeStep && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <span className="inline-block w-2 h-2 rounded-full bg-brand dark:bg-brand-light animate-ping" />
              <span>{activeStep}</span>
            </div>
          )}
        </div>

        {/* ── GESCHÄTZTE WARTEZEIT (Countdown & Uhrzeit) ── */}
        <AnimatePresence mode="wait">
          {(remainingSeconds !== null || formattedEndTime) && (
            <motion.div
              key="wait-time-badge"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="w-full bg-brand/5 dark:bg-brand-light/5 border border-brand/15 dark:border-brand-light/15 rounded-2xl p-4 mb-6 text-center"
              data-testid="estimated-wait-container"
            >
              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-brand dark:text-brand-light mb-1">
                <Clock size={16} className="shrink-0" aria-hidden="true" />
                <span>Geschätzte Wartezeit</span>
              </div>

              {remainingSeconds !== null && (
                <div className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100" data-testid="countdown-text">
                  {formatRemainingTime(remainingSeconds)}
                </div>
              )}

              {formattedEndTime && (
                <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Voraussichtlich fertig um: <strong className="font-semibold text-stone-700 dark:text-stone-300">{formattedEndTime}</strong>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ERNEUT VERSUCHEN KNOPF ── */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRetryClick}
          disabled={isRetrying}
          aria-label="Seite neu laden, um zu prüfen, ob die Wartung beendet ist"
          className="w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 px-7 py-3.5 rounded-full font-medium shadow-md transition-colors cursor-pointer disabled:opacity-70"
        >
          <RefreshCw
            size={18}
            className={`transition-transform duration-700 ${isRetrying ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{isRetrying ? 'Prüfe Status...' : 'Erneut versuchen'}</span>
        </motion.button>

        {/* Sicherheitshinweis */}
        <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-4 flex items-center justify-center gap-1">
          <AlertCircle size={12} />
          <span>Deine Daten und Verbindungen sind sicher gespeichert.</span>
        </p>
      </motion.div>
    </div>
  );
}
