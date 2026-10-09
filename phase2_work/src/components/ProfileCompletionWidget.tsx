import React, { useEffect, useState } from 'react';
import { getUserStorageItem, klarStorage } from '../lib/userScopedStorage';
import { Target, CheckCircle2, Edit3, Heart, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';

export const ProfileCompletionWidget: React.FC = () => {
  const [uiError, setUiError] = useState<string | null>(null);

  const [completionScore, setCompletionScore] = useState(0);
  const [missingFields, setMissingFields] = useState<{ id: string; label: string; icon: React.ComponentType<{ size?: number }>; actionText: string }[]>([]);

  useEffect(() => {
    const calculateScore = () => {
      let score = 0;
      const missing: { id: string; label: string; icon: React.ComponentType<{ size?: number }>; actionText: string }[] = [];

      // 1. Bio (30%)
      const bio = getUserStorageItem('klar_user_bio') || '';
      if (bio.length > 20) {
        score += 30;
      } else {
        missing.push({ id: 'bio', label: 'Biografie ausfüllen', icon: Edit3, actionText: 'Bio hinzufügen' });
      }

      // 2. Interests (25%)
      const interestsStr = getUserStorageItem('userInterests');
      let interestsCount = 0;
      try {
        const interests = interestsStr ? JSON.parse(interestsStr) : [];
        interestsCount = Array.isArray(interests) ? interests.length : 0;
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }

      if (interestsCount >= 3) {
        score += 25;
      } else {
        missing.push({ id: 'interests', label: 'Interessen (mind. 3)', icon: Heart, actionText: 'Interessen wählen' });
      }

      // 3. NoGos (15%)
      const noGosStr = klarStorage.getItem('userNoGos');
      let noGosCount = 0;
      try {
        const noGos = noGosStr ? JSON.parse(noGosStr) : [];
        noGosCount = Array.isArray(noGos) ? noGos.length : 0;
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }

      if (noGosCount > 0) {
        score += 15;
      } else {
        missing.push({ id: 'nogos', label: 'No-Gos definieren', icon: Target, actionText: 'Grenzen setzen' });
      }

      // 4. Icebreakers (15%)
      const iceStr = getUserStorageItem('profile_icebreakers');
      let iceCount = 0;
      try {
        const ice = iceStr ? JSON.parse(iceStr) : [];
        iceCount = Array.isArray(ice) ? ice.length : 0;
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }

      if (iceCount > 0) {
        score += 15;
      } else {
        missing.push({ id: 'icebreakers', label: 'Eisbrecher hinzufügen', icon: MessageSquare, actionText: 'Eisbrecher setzen' });
      }

      // 5. Goal/Focus (15%)
      const goal = getUserStorageItem('userGoal');
      if (goal && goal !== 'undecided') {
        score += 15;
      } else {
        missing.push({ id: 'goal', label: 'Dating-Ziel setzen', icon: Target, actionText: 'Ziel wählen' });
      }

      setCompletionScore(Math.min(100, score));
      setMissingFields(missing.slice(0, 2)); // Show up to 2 suggestions
    };

    calculateScore();

    // Check whenever klarStorage changes (rudimentary but works if they navigate back/forth)
    window.addEventListener('storage', calculateScore);
    return () => window.removeEventListener('storage', calculateScore);
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Target className="text-brand dark:text-brand-light" size={20} />
          Profilstärke
        </h3>
        <span className="font-bold text-lg text-brand dark:text-brand-light">{completionScore}%</span>
      </div>

      <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-3 overflow-hidden mb-5">
        <motion.div
          className="bg-brand dark:bg-brand-light h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${completionScore}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>

      {completionScore === 100 ? (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-900/30">
          <CheckCircle2 size={18} />
          <p className="text-sm font-medium">Dein Profil ist vollständig! Du hebst dich optimal ab.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-stone-500 mb-3 font-medium uppercase tracking-wider">Fehlende Elemente:</p>
          <div className="flex flex-col gap-2">
            {missingFields.map((field) => {
              const Icon = field.icon;
              return (
                <div key={field.id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-stone-500 dark:text-stone-400">
                      <Icon size={16} />
                    </div>
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{field.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
