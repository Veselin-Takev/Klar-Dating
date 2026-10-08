import { klarStorage } from '../lib/userScopedStorage';
import React, { useState, useEffect } from 'react';
import { BellOff, Clock, Moon } from 'lucide-react';

export const FocusTimeSettingsWidget: React.FC = () => {
  const [uiError, setUiError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [startTime, setStartTime] = useState('22:00');
  const [endTime, setEndTime] = useState('08:00');

  useEffect(() => {
    const saved = klarStorage.getItem('klar_focus_time');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setEnabled(data.enabled);
        setStartTime(data.startTime);
        setEndTime(data.endTime);
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const handleSave = (newEnabled: boolean, newStart: string, newEnd: string) => {
    setEnabled(newEnabled);
    setStartTime(newStart);
    setEndTime(newEnd);
    klarStorage.setItem('klar_focus_time', JSON.stringify({ enabled: newEnabled, startTime: newStart, endTime: newEnd }));
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BellOff className="text-brand dark:text-brand-light" size={20} />
          <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Fokus-Zeiten (Ruhemodus)</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            onChange={(e) => handleSave(e.target.checked, startTime, endTime)}
          />
          <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-stone-600 peer-checked:bg-brand"></div>
        </label>
      </div>

      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        Lege Zeiten fest, in denen du keine Push-Benachrichtigungen erhalten möchtest, um Offline-Stress zu vermeiden.
      </p>

      {enabled && (
        <div className="flex items-center gap-4 bg-stone-50 dark:bg-stone-800/50 p-4 rounded-xl border border-stone-100 dark:border-stone-700">
          <div className="flex-1">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400 block mb-1 flex items-center gap-1"><Moon size={12}/> Von</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => handleSave(enabled, e.target.value, endTime)}
              className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-stone-900 dark:text-stone-100"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-stone-600 dark:text-stone-400 block mb-1 flex items-center gap-1"><Clock size={12}/> Bis</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => handleSave(enabled, startTime, e.target.value)}
              className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-stone-900 dark:text-stone-100"
            />
          </div>
        </div>
      )}
    </div>
  );
};
