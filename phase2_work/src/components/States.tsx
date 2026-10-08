import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

// ═══════════════════════════════════════════════════════════════════════════
// P2 — die vier Zustände als Bausteine (Design-Richtlinie §6)
//
// Laden · Leer · Fehler · Offline. Wer `StateView` benutzt, kann keinen
// Zustand vergessen — das ist der ganze Zweck. Vorher hatten 3 von 210
// Dateien einen Ladezustand und 5 einen Offline-Zustand.
//
// Ladezustand als Platzhalterfläche, NICHT als Spinner: Ein Spinner sagt
// „es passiert etwas", eine Platzhalterfläche sagt „hier kommt gleich das".
// ═══════════════════════════════════════════════════════════════════════════

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-stone-200 dark:bg-stone-800 animate-pulse rounded-md ${className}`} aria-hidden="true" />;
}

export function LadeZustand({ zeilen = 3, label = "Wird geladen" }: { zeilen?: number; label?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3" role="status" aria-busy="true" aria-label={label}
    >
      {Array.from({ length: zeilen }, (_, i) => (
        <Skeleton key={i} className={i === 0 ? "h-6 w-2/3" : "h-20 w-full"} />
      ))}
    </motion.div>
  );
}

export function LeerZustand({ titel, text, aktion }: { titel: string; text: string; aktion?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line-ui p-6 text-center">
      <h3 className="text-lg font-serif text-ink mb-2">{titel}</h3>
      {/* Ein leerer Zustand ohne nächsten Schritt ist eine Sackgasse. */}
      <p className="text-base text-muted mb-4">{text}</p>
      {aktion}
    </div>
  );
}

export function FehlerZustand({ text, erneut }: { text: string; erneut?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-line-ui p-6">
      {/* Benennt, was zu tun ist — nie nur eine Farbe (WCAG 1.4.1). */}
      <p className="text-base text-ink mb-4">{text}</p>
      {erneut ? (
        <button onClick={erneut} className="min-h-11 px-5 py-2 rounded-full border border-line-ui text-base text-ink">
          Erneut versuchen
        </button>
      ) : null}
    </div>
  );
}

export function OfflineZustand() {
  return (
    <div role="status" className="rounded-2xl border border-line-ui p-6">
      <p className="text-base text-ink">
        Keine Verbindung. Was du geschrieben hast, bleibt erhalten und geht
        raus, sobald du wieder online bist.
      </p>
    </div>
  );
}

interface StateViewProps<T> {
  laden: boolean;
  fehler: string | null;
  offline?: boolean;
  daten: T | null;
  leer?: { titel: string; text: string; aktion?: ReactNode };
  erneut?: () => void;
  children: (daten: T) => ReactNode;
}

/** Die Hülle, die die Fallunterscheidung übernimmt. Reihenfolge ist
 *  bewusst: offline vor Fehler (sonst zeigt man einen Serverfehler an,
 *  wo gar keine Verbindung bestand), Fehler vor Laden. */
export function StateView<T>({ laden, fehler, offline, daten, leer, erneut, children }: StateViewProps<T>) {
  return (
    <AnimatePresence mode="wait">
      {offline ? (
        <motion.div key="offline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <OfflineZustand />
        </motion.div>
      ) : fehler ? (
        <motion.div key="fehler" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <FehlerZustand text={fehler} erneut={erneut} />
        </motion.div>
      ) : laden ? (
        <LadeZustand key="laden" />
      ) : (daten === null || (Array.isArray(daten) && daten.length === 0)) ? (
        leer ? (
          <motion.div key="leer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <LeerZustand {...leer} />
          </motion.div>
        ) : null
      ) : (
        <motion.div key="daten" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          {children(daten)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
