import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useEffect, useRef, useState } from 'react';
import { OnboardingMusic } from '../components/OnboardingMusic';
import type { UserMusicPreferences } from '../types/user';

const AVAILABLE_INTERESTS = [
  { id: 'Vegan', icon: '🌱' },
  { id: 'Oktoberfest', icon: '🥨' },
  { id: 'Kochen', icon: '🍳' },
  { id: 'Sport', icon: '⚽' },
  { id: 'Kultur', icon: '🎭' },
  { id: 'Reisen', icon: '✈️' },
  { id: 'Musik', icon: '🎵' },
] as const;

export interface OnboardingData {
  interests: string[];
  musicPreferences?: UserMusicPreferences;
}

interface OnboardingProps {
  onComplete: (data: OnboardingData) => void | Promise<void>;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [musicPreferences, setMusicPreferences] = useState<UserMusicPreferences>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.querySelector<HTMLElement>('[data-step-heading]')?.focus();
  }, [step]);

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const finish = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await onComplete({
        interests: selectedInterests,
        musicPreferences: selectedInterests.includes('Musik') ? musicPreferences : undefined,
      });
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4" aria-labelledby="onboarding-heading">
      <div ref={contentRef} className="max-w-lg w-full">
        <LanguageSwitcher />
        <div
          role="progressbar"
          aria-label={t('onboarding.progress')}
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={step}
          aria-valuetext={t('onboarding.step', { step, total: 5 })}
          className="flex gap-2 mb-4"
        >
          {[1, 2, 3, 4, 5].map(i => (
            <span
              key={i}
              aria-hidden="true"
              className={`h-1.5 flex-1 rounded-full transition-colors ${step >= i ? 'bg-blue-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        {step === 3 ? (
          <OnboardingMusic
            headingId="onboarding-heading"
            initialPreferences={musicPreferences}
            onBack={() => setStep(2)}
            onComplete={(preferences) => {
              setMusicPreferences(preferences);
              setStep(4);
            }}
          />
        ) : (
          <div className="w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            {step === 1 && (
              <div className="space-y-6 text-center">
                <h1 id="onboarding-heading" data-step-heading tabIndex={-1} className="text-2xl font-bold text-slate-900">
                  {t('onboarding.title')}
                </h1>
                <p className="text-slate-600 text-sm">{t('onboarding.intro')}</p>
                <button type="button" onClick={() => setStep(2)} className="w-full min-h-11 bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700">
                  {t('onboarding.start')}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h1 id="onboarding-heading" data-step-heading tabIndex={-1} className="text-xl font-bold text-slate-900">{t('onboarding.interestsTitle')}</h1>
                  <p id="interests-help" className="text-slate-600 text-sm mt-1">{t('onboarding.interestsHint')}</p>
                </div>
                <fieldset aria-describedby="interests-help">
                  <legend className="sr-only">{t('onboarding.interestsLabel')}</legend>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_INTERESTS.map(item => {
                      const isSelected = selectedInterests.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleInterest(item.id)}
                          aria-pressed={isSelected}
                          className={`min-h-11 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isSelected ? 'bg-blue-600 text-white shadow-sm scale-105' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                          <span aria-hidden="true">{item.icon} </span>{t(`onboarding.interests.${item.id}`)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <button
                  type="button"
                  disabled={selectedInterests.length === 0}
                  aria-describedby={selectedInterests.length === 0 ? 'interests-help' : undefined}
                  onClick={() => setStep(selectedInterests.includes('Musik') ? 3 : 4)}
                  className="w-full min-h-11 bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('onboarding.next')}
                </button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 text-center">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{t('onboarding.preview')}</span>
                  <p className="text-slate-800 text-sm mt-1 font-medium">{t('onboarding.previewHint')}</p>
                </div>
                <h1 id="onboarding-heading" data-step-heading tabIndex={-1} className="text-xl font-bold text-slate-900">{t('onboarding.ready')}</h1>
                <button type="button" onClick={() => setStep(5)} className="w-full min-h-11 bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700">
                  {t('onboarding.discover')}
                </button>
              </div>
            )}

            {step === 5 && (
              <form
                className="space-y-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  void finish();
                }}
              >
                <div>
                  <h1 id="onboarding-heading" data-step-heading tabIndex={-1} className="text-xl font-bold text-slate-900">{t('onboarding.finishTitle')}</h1>
                  <p className="text-slate-600 text-sm mt-1">{t('onboarding.finishHint')}</p>
                </div>
                {saveError && <p id="onboarding-save-error" role="alert" className="text-sm text-red-700">{t('onboarding.saveFailed')}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  aria-describedby={saving ? 'onboarding-saving-status' : undefined}
                  className="w-full min-h-11 bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? t('onboarding.saving') : t('onboarding.finish')}
                </button>
                <p id="onboarding-saving-status" role="status" aria-live="polite" className="sr-only">
                  {saving ? t('onboarding.savingStatus') : ''}
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

