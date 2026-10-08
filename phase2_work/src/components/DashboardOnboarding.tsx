import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect, useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fetchWithTimeout } from '../lib/api';
import { useModalAccessibility } from '../lib/useModalAccessibility';

const steps = [
  { title: 'Willkommen bei Klar', content: 'Klar steht für weniger Auswahlstress: 8–12 Vorschläge am Tag, klare Absichten, echte Gespräche und Verifizierung.' },
  { title: 'Das Klar-Prinzip', content: 'Gespräch zuerst statt Auswahl-Druck. Kostenloser Kernzugang, transparente Absichten und ein ruhiges Interface gehören zum Produktversprechen.' },
  { title: 'Dein lokaler Start', content: 'Wähle deine Stadt, damit Klar dir passende Kontakte in deiner Nähe vorschlagen kann.' },
  { title: 'Vom Kontakt zum Date', content: 'Gemeinsamkeiten, Beziehungsziele, Gesprächsimpulse und Date-Planung begleiten den Weg – ohne Katalog-Mentalität.' },
];

export function DashboardOnboarding() {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let hasSeen = false;
    try { hasSeen = klarStorage.getItem('klar_onboarding_seen') === 'true'; } catch { /* optional storage */ }
    if (!hasSeen) {
      setIsVisible(true);
      void fetchWithTimeout('/api/activation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'onboarding_started' }), timeout: 10000, retries: 0 }).catch(() => {});
    }
  }, []);

  const close = (completed = false) => {
    setIsVisible(false);
    try { klarStorage.setItem('klar_onboarding_seen', 'true'); } catch { /* tutorial remains dismissible */ }
    if (completed) {
      void fetchWithTimeout('/api/activation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'onboarding_completed' }), timeout: 10000, retries: 0 }).catch(() => {});
      void fetchWithTimeout('/api/launch/founding-claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 10000, retries: 0 }).catch(() => {});
    }
  };
  const { dialogRef, onKeyDown } = useModalAccessibility<HTMLDivElement>(() => close(), isVisible);
  if (!isVisible) return null;
  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60">
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.15 }}
        className="bg-white dark:bg-stone-800 rounded-[24px] p-6 max-w-sm w-full max-h-[90dvh] overflow-y-auto"
      >
        <h2 id={titleId} className="text-xl font-serif text-stone-900 dark:text-white mb-2">{currentStep?.title}</h2>
        <p id={descriptionId} className="text-base text-stone-600 dark:text-stone-300 mb-4">{currentStep?.content}</p>
        <p role="status" className="text-sm text-stone-600 dark:text-stone-300 mb-6">
          Schritt {step + 1} von {steps.length}<span className="sr-only">: {currentStep?.title}</span>
        </p>
        <div className="flex flex-wrap justify-between items-center gap-3">
          <button type="button" onClick={() => close()} className="px-3 py-2.5 text-stone-700 dark:text-stone-200 rounded-full">Einführung überspringen</button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} className="px-6 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-full font-medium">Weiter</button>
          ) : (
            <button type="button" onClick={() => close(true)} className="px-6 py-2.5 bg-brand text-white rounded-full font-medium">Loslegen</button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
