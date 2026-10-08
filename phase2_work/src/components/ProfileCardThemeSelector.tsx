import { klarStorage } from '../lib/userScopedStorage';
import React, { useState, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';

const THEMES = [
  { id: 'default', name: 'Klar Classic', color: 'bg-white dark:bg-stone-800', border: 'border-stone-200 dark:border-stone-700' },
  { id: 'rose', name: 'Blush', color: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-900/50' },
  { id: 'indigo', name: 'Twilight', color: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-900/50' },
  { id: 'emerald', name: 'Mint', color: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900/50' },
  { id: 'amber', name: 'Sunrise', color: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900/50' },
];

export const ProfileCardThemeSelector: React.FC = () => {
  const [activeTheme, setActiveTheme] = useState('default');

  useEffect(() => {
    const saved = klarStorage.getItem('klar_profile_theme');
    if (saved) {
      setActiveTheme(saved);
    }
  }, []);

  const handleSelectTheme = (themeId: string) => {
    setActiveTheme(themeId);
    klarStorage.setItem('klar_profile_theme', themeId);
    // If auth/firestore was active, we would sync this to the user profile here
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="text-brand dark:text-brand-light" size={20} />
        <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Profil-Thema</h3>
      </div>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        Wähle eine Hintergrundfarbe für dein Profil, die deine Persönlichkeit widerspiegelt. Andere Personen sehen dieses Thema, wenn sie dein Profil betrachten.
      </p>

      <div className="grid grid-cols-5 gap-2">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => handleSelectTheme(theme.id)}
            className={`relative aspect-square rounded-xl border-2 transition-all ${theme.color} ${
              activeTheme === theme.id
                ? 'border-brand dark:border-brand-light scale-105 shadow-md z-10'
                : 'border-transparent '
            }`}
            title={theme.name}
          >
            {activeTheme === theme.id && (
              <div className="absolute inset-0 flex items-center justify-center text-brand dark:text-brand-light">
                <Check size={20} strokeWidth={3} />
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="mt-3 text-center text-xs font-medium text-stone-600 dark:text-stone-300">
        {THEMES.find(t => t.id === activeTheme)?.name}
      </div>
    </div>
  );
};
