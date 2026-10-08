import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Wind, Shirt, Play, X, Heart } from 'lucide-react';
import { hapticFeedback, HAPTIC_PATTERNS } from '../lib/haptics';

export function DatePrepModeWidget() {
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let interval: unknown;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      hapticFeedback(HAPTIC_PATTERNS.SUCCESS);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleMode = () => {
    hapticFeedback(HAPTIC_PATTERNS.LIGHT_TAP);
    if (!isActive) {
      setIsActive(true);
      setTimeLeft(15 * 60);
      setStep(0);
    } else {
      setIsActive(false);
    }
  };

  const steps = [
    { label: "Outfit-Check", icon: Shirt, timeText: "15:00 - 10:00", description: "Fühlst du dich wohl? Letzter Blick in den Spiegel." },
    { label: "Atemübung", icon: Wind, timeText: "10:00 - 05:00", description: "3x tief ein- und ausatmen. Puls beruhigen." },
    { label: "Sicherheits-Check", icon: ShieldCheck, timeText: "05:00 - 00:00", description: "Standort teilen, Akku checken, los geht's!" },
  ];

  useEffect(() => {
    if (timeLeft > 10 * 60) setStep(0);
    else if (timeLeft > 5 * 60) setStep(1);
    else setStep(2);
  }, [timeLeft]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-stone-700 relative overflow-hidden mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-brand/10 dark:bg-brand-light/10 p-2 rounded-xl text-brand dark:text-brand-light">
            <Heart size={20} />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Date-Vorbereitungs-Modus</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">Stress abbauen vor dem Treffen</p>
          </div>
        </div>
        {!isActive && (
          <button
            aria-label="Date-Vorbereitung starten"
            onClick={toggleMode}
            className="p-2 bg-brand dark:bg-brand-light text-white rounded-full hover:opacity-90 transition-opacity"
          >
            <Play size={16} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col items-center py-4">
              <div className="text-4xl font-mono font-bold text-brand dark:text-brand-light mb-4">
                {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
              </div>

              <div className="w-full space-y-3">
                {steps.map((s, idx) => {
                  const Icon = s.icon;
                  const isCurrent = step === idx;
                  const isPast = step > idx;
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isCurrent ? 'bg-brand/5 border-brand/20 dark:bg-brand-light/10 dark:border-brand-light/30' : isPast ? 'bg-stone-50 border-stone-200 dark:bg-stone-800 dark:border-stone-700 opacity-50' : 'bg-white border-stone-100 dark:bg-stone-800 dark:border-stone-700 opacity-50'}`}
                    >
                      <div className={`mt-0.5 ${isCurrent ? 'text-brand dark:text-brand-light' : 'text-stone-400'}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <h4 className={`text-sm font-semibold ${isCurrent ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500'}`}>{s.label}</h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{s.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={toggleMode}
                className="mt-6 px-6 py-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full text-sm font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center gap-2"
              >
                <X size={16} /> Beenden
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
