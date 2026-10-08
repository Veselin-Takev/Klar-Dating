import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import { fetchWithTimeout } from '../lib/api';
import { useModalAccessibility } from '../lib/useModalAccessibility';

const ONBOARDING_VERSION = 2;
const ONBOARDING_KEY = 'klar_onboarding_state';
const LEGACY_ONBOARDING_KEY = 'klar_onboarding_seen';
const ACTIVATION_STARTED_ID = 'onboarding_v2_started';
const ACTIVATION_COMPLETED_ID = 'onboarding_v2_completed';
type OnboardingState = { version: number; state: 'in_progress' | 'completed' | 'skipped'; completedAt?: string; skipped?: boolean };
function readState(): OnboardingState | null {
  try {
    const raw = klarStorage.getItem(ONBOARDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OnboardingState>;
      if (parsed.version === ONBOARDING_VERSION && ['in_progress','completed','skipped'].includes(String(parsed.state))) return parsed as OnboardingState;
    }
    if (klarStorage.getItem(LEGACY_ONBOARDING_KEY) === 'true') {
      const migrated={version:ONBOARDING_VERSION,state:'completed' as const,completedAt:new Date().toISOString()};
      klarStorage.setItem(ONBOARDING_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}
  return null;
}
function writeState(state: OnboardingState) { try { klarStorage.setItem(ONBOARDING_KEY, JSON.stringify(state)); if (state.state !== 'in_progress') klarStorage.setItem(LEGACY_ONBOARDING_KEY,'true'); } catch {} }


export function DashboardOnboarding() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const state = readState();
    if (!state || state.state === 'in_progress') {
      setIsVisible(true);
      void fetchWithTimeout('/api/activation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'onboarding_started', eventId: ACTIVATION_STARTED_ID, metadata: { variant: 'v2' } }), timeout: 10000, retries: 0 }).catch(() => {});
      writeState({ version: ONBOARDING_VERSION, state: 'in_progress' });
    }
  }, []);

  const close = (completed = false) => {
    setIsVisible(false);
    writeState(completed ? { version: ONBOARDING_VERSION, state: 'completed', completedAt: new Date().toISOString(), skipped: false } : { version: ONBOARDING_VERSION, state: 'skipped', skipped: true });
    if (completed) {
      void fetchWithTimeout('/api/activation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'onboarding_completed', eventId: ACTIVATION_COMPLETED_ID, metadata: { variant: 'v2' } }), timeout: 10000, retries: 0 }).catch(() => {});
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
        <h2 id={titleId} className="text-xl font-serif text-stone-900 dark:text-white mb-2">{t(`dashboardOnboarding.steps.${step}.title`)}</h2>
        <p id={descriptionId} className="text-base text-stone-600 dark:text-stone-300 mb-4">{t(`dashboardOnboarding.steps.${step}.content`)}</p>
        <p role="status" className="text-sm text-stone-600 dark:text-stone-300 mb-6">
          {t('dashboardOnboarding.progress', { step: step + 1, total: steps.length })}<span className="sr-only">: {currentStep?.title}</span>
        </p>
        <div className="flex flex-wrap justify-between items-center gap-3">
          <button type="button" onClick={() => close()} className="px-3 py-2.5 text-stone-700 dark:text-stone-200 rounded-full">{t('dashboardOnboarding.skip')}</button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} className="px-6 py-2.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-full font-medium">{t('dashboardOnboarding.next')}</button>
          ) : (
            <button type="button" onClick={() => close(true)} className="px-6 py-2.5 bg-brand text-white rounded-full font-medium">{t('dashboardOnboarding.start')}</button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
