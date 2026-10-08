import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { Bell, Clock } from 'lucide-react';

export function RitualReminderSetting() {
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState('19:00');

  useEffect(() => {
    const savedEnabled = klarStorage.getItem('klar_ritual_reminder_enabled') === 'true';
    const savedTime = klarStorage.getItem('klar_ritual_reminder_time') || '19:00';
    setEnabled(savedEnabled);
    setTime(savedTime);
  }, []);

  const handleToggle = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    klarStorage.setItem('klar_ritual_reminder_enabled', newValue.toString());

    if (newValue && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    klarStorage.setItem('klar_ritual_reminder_time', newTime);
  };

  return (
    <div className="flex flex-col mb-6 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-200 dark:border-stone-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-stone-500 dark:text-stone-400" />
          <div>
            <span className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              Tägliche Ritual-Erinnerung
            </span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">
              Eine selbstbestimmte, lokale Erinnerung an dein Dating-Ritual.
            </span>
          </div>
        </div>

        <button role="switch" aria-checked={enabled} aria-label="Ritual-Erinnerung umschalten"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-brand dark:bg-brand-light' : 'bg-stone-200 dark:bg-stone-700'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-4 flex items-center justify-between pl-8 pt-3 border-t border-stone-200 dark:border-stone-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-stone-400" />
            <span className="text-sm font-medium text-stone-600 dark:text-stone-400">Erinnerungszeit</span>
          </div>
          <input
            type="time"
            value={time}
            onChange={handleTimeChange}
            className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-800 dark:text-stone-200 font-medium focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
      )}
    </div>
  );
}
