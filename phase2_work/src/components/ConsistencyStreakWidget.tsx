import { klarStorage } from '../lib/userScopedStorage';
import React, { useEffect, useState } from 'react';
import { CalendarDays, Coffee } from 'lucide-react';

export const ConsistencyStreakWidget: React.FC = () => {
  const [uiError, setUiError] = useState<string | null>(null);

  const [streak, setStreak] = useState(0);
  const [isOnVacation, setIsOnVacation] = useState(false);
  const [vacationDaysLeft, setVacationDaysLeft] = useState(0);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = klarStorage.getItem('klar_rituals_streak');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          const lastDate = new Date(data.lastDate);

          lastDate.setHours(0, 0, 0, 0);
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);

          const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let currentlyOnVacation = false;
          if (data.vacationUntil) {
            const vacDate = new Date(data.vacationUntil);
            if (vacDate >= todayDate) {
               currentlyOnVacation = true;
               const vacDiff = Math.ceil((vacDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
               setVacationDaysLeft(vacDiff);
            }
          }

          setIsOnVacation(currentlyOnVacation);
          if (!currentlyOnVacation) setVacationDaysLeft(0);

          const graceUntil = data.resumeGraceUntil ? new Date(data.resumeGraceUntil) : null;
          if (diffDays <= 1 || currentlyOnVacation || (graceUntil && graceUntil >= todayDate)) {
            setStreak(data.count);
          } else {
            setStreak(0);
          }
        } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
      }
    };

    handleStorageChange();
    window.addEventListener('klar_ritual_completed', handleStorageChange);
    return () => window.removeEventListener('klar_ritual_completed', handleStorageChange);
  }, []);

  const resumeVacation = () => {
    try {
      const saved = klarStorage.getItem('klar_rituals_streak');
      if (!saved) throw new Error('Streak not found');
      const data = JSON.parse(saved);
      if (!data || typeof data !== 'object') throw new Error('Invalid streak');
      delete data.vacationUntil;
      // One-day grace preserves earned days without pretending that a ritual happened.
      const grace = new Date();
      grace.setHours(0, 0, 0, 0);
      grace.setDate(grace.getDate() + 1);
      data.resumeGraceUntil = grace.toISOString();
      // Preserve earned days while resuming; never fabricate a new completion.
      klarStorage.setItem('klar_rituals_streak', JSON.stringify(data));
      setIsOnVacation(false);
      setVacationDaysLeft(0);
      window.dispatchEvent(new Event('klar_ritual_completed'));
      setUiError(null);
    } catch {
      setUiError('Die Ritual-Pause konnte nicht beendet werden. Bitte versuche es erneut.');
    }
  };

  const activateVacation = () => {
    try {
       const saved = klarStorage.getItem('klar_rituals_streak');
       if (saved) {
         const data = JSON.parse(saved);
         const today = new Date();
         today.setHours(0,0,0,0);
         const vacUntil = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
         data.vacationUntil = vacUntil.toISOString();
         klarStorage.setItem('klar_rituals_streak', JSON.stringify(data));
         window.dispatchEvent(new Event('klar_ritual_completed'));
       }
    } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
  };

  if (streak === 0) return null;

  return (
    <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6">
      {uiError && <div role="alert" className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light flex items-center justify-center shrink-0">
          <CalendarDays size={18} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
            Ritual-Kontinuität
            <span className="bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs px-2 py-0.5 rounded-full font-semibold">
              {streak} {streak === 1 ? 'Tag' : 'Tage'}
            </span>
            {isOnVacation && (
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full font-semibold">
                <Coffee size={12} className="inline mr-1" /> Pausiert ({vacationDaysLeft}T)
              </span>
            )}
          </h4>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            {isOnVacation
               ? 'Dein Streak ist pausiert und sicher. Erhol dich gut!'
               : 'Gute Gewohnheiten schaffen Klarheit. Bleib dran!'}
          </p>
        </div>
        {isOnVacation ? (
          <button type="button" onClick={resumeVacation} aria-label="Ritual-Pause beenden"
            className="min-h-11 rounded-xl border border-stone-300 dark:border-stone-600 px-4 py-2 text-sm font-medium text-stone-800 dark:text-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Fortsetzen
          </button>
        ) : (
          <button
            onClick={activateVacation}
            type="button"
            aria-label="Ritual-Kontinuität 7 Tage pausieren"
            title="7 Tage pausieren"
            className="min-h-11 min-w-11 p-2 text-stone-600 dark:text-stone-300 hover:text-brand dark:hover:text-brand-light hover:bg-brand/5 dark:hover:bg-brand-light/5 rounded-full transition-colors shrink-0"
          >
            <Coffee size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
