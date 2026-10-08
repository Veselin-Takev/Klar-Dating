import React, { useState } from 'react';
import { Sparkles, ArrowRight, Heart } from 'lucide-react';

export const DailyCheckinWidget: React.FC = () => {
  const [step, setStep] = useState(0);
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  const handleNext = () => {
    if (step === 0 && q1.trim()) setStep(1);
    else if (step === 1 && q2.trim()) setIsCompleted(true);
  };

  if (isCompleted) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 mb-6 text-center">
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
          <Heart size={24} />
        </div>
        <h3 className="font-medium text-emerald-900 dark:text-emerald-100 mb-1">Check-in abgeschlossen</h3>
        <p className="text-sm text-emerald-700 dark:text-emerald-300">Gut gemacht! Die Reflexion hilft dir, deine Dating-Reise bewusster zu gestalten.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-brand dark:text-brand-light" size={20} />
        <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Daily Check-in</h3>
      </div>

      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        Nimm dir einen kurzen Moment, um nach deinem letzten Date oder langen Chat zu reflektieren.
      </p>

      {step === 0 ? (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <label className="text-sm font-medium text-stone-900 dark:text-stone-100 block">
            1. Wie hast du dich während des letzten Gesprächs / Dates gefühlt?
          </label>
          <textarea
            value={q1}
            onChange={e => setQ1(e.target.value)}
            placeholder="z.B. Ich war anfangs nervös, aber dann sehr entspannt..."
            className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-stone-900 dark:text-stone-100 min-h-[80px]"
          />
          <button
            onClick={handleNext}
            disabled={!q1.trim()}
            className="flex items-center justify-center gap-2 w-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Weiter <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
          <label className="text-sm font-medium text-stone-900 dark:text-stone-100 block">
            2. Wurden deine Erwartungen / Bedürfnisse erfüllt?
          </label>
          <textarea
            value={q2}
            onChange={e => setQ2(e.target.value)}
            placeholder="z.B. Ja, wir haben ähnliche Werte..."
            className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-stone-900 dark:text-stone-100 min-h-[80px]"
          />
          <button
            onClick={handleNext}
            disabled={!q2.trim()}
            className="flex items-center justify-center gap-2 w-full bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Check-in abschließen <Heart size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
