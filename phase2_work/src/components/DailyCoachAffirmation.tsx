import { klarStorage } from '../lib/userScopedStorage';
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Quote, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const AFFIRMATIONS = [
  "Sei du selbst – genau das macht dich anziehend.",
  "Echte Verbindungen brauchen Zeit. Bleib entspannt.",
  "Jede Begegnung ist eine Chance, etwas Neues zu lernen.",
  "Deine Werte sind dein Kompass. Bleib dir treu.",
  "Ein 'Nein' ist Platz für das richtige 'Ja'.",
  "Fokus auf Qualität, nicht Quantität.",
  "Atme durch. Dating darf Spaß machen und leicht sein.",
  "Zeig dich authentisch – die richtigen Menschen werden es schätzen."
];

export const DailyCoachAffirmation: React.FC = () => {
  const { t } = useTranslation();
  const [affirmation, setAffirmation] = useState("");
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Select one affirmation based on the day of the year to make it "daily"
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    const index = dayOfYear % AFFIRMATIONS.length;
    setAffirmation(AFFIRMATIONS[index] || "Du bist großartig!");

    // Check if dismissed today
    const lastDismissed = klarStorage.getItem('klar_affirmation_dismissed');
    if (lastDismissed === new Date().toDateString()) {
      setIsVisible(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    klarStorage.setItem('klar_affirmation_dismissed', new Date().toDateString());
  };

  if (!isVisible || !affirmation) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-brand/5 dark:bg-brand-light/5 border border-brand/20 dark:border-brand-light/20 rounded-2xl p-4 relative mb-4 flex gap-3 shadow-sm"
        >
          <div className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand-light/10 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={16} className="text-brand dark:text-brand-light" />
          </div>
          <div className="flex-1 pr-6">
            <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold uppercase tracking-wider text-brand dark:text-brand-light/80">
              <Quote size={10} />
              {t("dashboard.coachImpulseTitle")}
            </div>
            <p className="text-sm text-stone-800 dark:text-stone-200 font-medium leading-snug">
              "{t("dashboard.coachImpulseText", affirmation)}"
            </p>
          </div>
          <button
            aria-label="Impuls schließen"
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 p-1"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
