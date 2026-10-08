import { klarStorage } from '../lib/userScopedStorage';
import React, { useState, useEffect } from 'react';
// ENTFERNT 11.08.2026: Sun, Moon, Monitor, Palette — sie gehoerten zum
// doppelten Theme-Block, siehe unten.
import { Vibrate, Volume2, RotateCcw, Play } from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';

export const HapticSettings: React.FC = () => {
  const [intensity, setIntensity] = useState<number>(100);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [patternType, setPatternType] = useState<string>('medium');
  const [isTesting, setIsTesting] = useState(false);
  // ── ENTFERNT 11.08.2026 — vierte Steuerung fuer dieselbe Einstellung ────
  //
  // Hier standen ein eigener `theme`-Zustand und `updateTheme`. Beide
  // schrieben nach `klarStorage['theme']`. Der ThemeProvider liest aber
  // `klarStorage['klar_theme']` (ThemeProvider.tsx:17). Die Einstellung war
  // damit nach dem naechsten Neuladen weg — derselbe Befund wie bei
  // QuickThemeToggle, nur an einer zweiten Stelle.
  //
  // Auf der Profilseite gab es die Wahl Hell/Dunkel/System DREIMAL:
  //   1. ThemeSettingsWidget      (Profile.tsx:1528)  -> Schluessel 'theme'
  //   2. hier, "Theme Settings"   (Profile.tsx:1529)  -> Schluessel 'theme'
  //   3. Einstellungen -> Erscheinungsbild            -> useTheme, korrekt
  // dazu seit heute die Systemleiste oben. Vier Bedienelemente fuer eine
  // Einstellung, zwei davon ohne dauerhafte Wirkung, alle vier konnten
  // widerspruechliche Zustaende anzeigen.
  //
  // Geblieben sind zwei, mit klarer Aufgabenteilung: die Systemleiste als
  // schneller Wechsel Hell/Dunkel, und "Einstellungen -> Erscheinungsbild"
  // fuer die vollstaendige Wahl einschliesslich "System". Beide gehen ueber
  // `useTheme`, also ueber die eine Stelle, die den Zustand haelt.

  useEffect(() => {
    const storedIntensity = klarStorage.getItem('klar_haptic_intensity');
    if (storedIntensity !== null) {
      setIntensity(parseInt(storedIntensity, 10));
    }
    const storedEnabled = klarStorage.getItem('klar_haptic_enabled');
    if (storedEnabled !== null) {
      setIsEnabled(storedEnabled === 'true');
    }
    const storedPattern = klarStorage.getItem('klar_haptic_pattern');
    if (storedPattern) {
      setPatternType(storedPattern);
    }
  }, []);

  const handleIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setIntensity(val);
    klarStorage.setItem('klar_haptic_intensity', val.toString());
  };

  const toggleEnabled = () => {
    const newVal = !isEnabled;
    setIsEnabled(newVal);
    klarStorage.setItem('klar_haptic_enabled', newVal.toString());
  };

  const handlePatternChange = (type: string) => {
    setPatternType(type);
    klarStorage.setItem('klar_haptic_pattern', type);
    setTimeout(() => {
      triggerHaptic('LIGHT_TAP');
    }, 100);
  };

  const resetToDefault = () => {
    setIntensity(50);
    setIsEnabled(true);
    setPatternType('medium');
    klarStorage.setItem('klar_haptic_intensity', '50');
    klarStorage.setItem('klar_haptic_enabled', 'true');
    klarStorage.setItem('klar_haptic_pattern', 'medium');
  };

  const testVibration = () => {
    triggerHaptic('LIGHT_TAP');
    setIsTesting(true);
    setTimeout(() => setIsTesting(false), 200);
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light rounded-full flex items-center justify-center">
            <Vibrate size={20} />
          </div>
          <div>
            <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Haptisches Feedback</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">Vibration für Aktionen</p>
          </div>
        </div>
        {/* BEFUND 12.08.2026: Dieser Schalter bestand nur aus zwei
            farbigen Flaechen — kein Text, kein Symbol, keine Beschriftung.
            Vorgelesen wurde „Schaltflaeche", und ob das Feedback an oder
            aus ist, war nicht zu erfahren. `aria-pressed` sagt den Zustand,
            `aria-label` sagt, worum es geht. */}
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label="Haptisches Feedback"
          onClick={toggleEnabled}
          className={`w-12 h-6 rounded-full transition-colors relative ${isEnabled ? 'bg-brand dark:bg-brand-light' : 'bg-stone-200 dark:bg-stone-700'}`}
        >
          <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
      </div>

      {isEnabled && (
        <>
          <div className="mb-6">
            <p className="text-sm text-stone-700 dark:text-stone-300 mb-3 font-medium">Muster</p>
            <div className="flex gap-2">
              <select
                value={patternType}
                onChange={(e) => handlePatternChange(e.target.value)}
                className="w-full bg-stone-100 dark:bg-stone-800 border-none text-stone-700 dark:text-stone-300 rounded-xl py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-brand focus:outline-none appearance-none"
              >
                <option value="soft">Soft</option>
                <option value="medium">Medium</option>
                <option value="strong">Strong</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-stone-700 dark:text-stone-300 mb-3 font-medium">Intensität</p>
            <div className="flex items-center gap-4">
              <Volume2 size={16} className="text-stone-400 shrink-0 opacity-50" />
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={intensity}
                onChange={handleIntensityChange}
                className="w-full h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-brand dark:accent-brand-light"
              />
              <Vibrate size={20} className="text-stone-500 shrink-0" />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-stone-400 font-medium">
              <span>Aus</span>
              <span>Mittel</span>
              <span>Max</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={testVibration}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand dark:bg-brand-light text-white rounded-xl font-medium hover:opacity-90 transition-opacity text-sm"
            >
              <Play size={16} className={`transition-transform duration-200 ${isTesting ? 'scale-150' : 'scale-100'}`} />
              Test Vibration
            </button>
            <button
              onClick={resetToDefault}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-sm"
            >
              <RotateCcw size={16} />
              Reset to Default
            </button>
          </div>
        </>
      )}

      {/* ENTFERNT 11.08.2026 — der Abschnitt "Theme Settings".
          Er war die zweite von drei Hell/Dunkel/System-Wahlen auf dieser
          Seite und schrieb in den falschen Speicherschluessel. Begruendung
          ausfuehrlich oben im Kopf dieser Datei. */}

    </div>
  );
};
