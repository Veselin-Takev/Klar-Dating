import { klarStorage } from '../lib/userScopedStorage';
import React, { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { melde } from "../lib/fehler";

export const InactiveNotificationManager: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if we should show the prompt for notifications
    const checkNotificationStatus = async () => {
      if (!('Notification' in window)) return;

      const lastPrompt = klarStorage.getItem('klar_notification_prompt');
      const hasPermission = Notification.permission === 'granted';
      const isDenied = Notification.permission === 'denied';

      if (!hasPermission && !isDenied && !lastPrompt) {
        // Show prompt after a short delay
        setTimeout(() => setShowPrompt(true), 15000);
      }
    };

    checkNotificationStatus();

    // Track activity
    const updateActivity = () => {
      klarStorage.setItem('klar_last_active', Date.now().toString());
    };

    updateActivity();

    // Add event listeners for activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    // Check for inactivity when returning to the app
    const checkInactivity = () => {
      const lastActiveStr = klarStorage.getItem('klar_last_active');
      if (lastActiveStr) {
        const lastActive = parseInt(lastActiveStr, 10);
        const hoursInactive = (Date.now() - lastActive) / (1000 * 60 * 60);

        // If inactive for more than 48 hours and we have permission
        if (hoursInactive > 48 && Notification.permission === 'granted') {
          try {
            new Notification('Willkommen zurück bei Klar!', {
              body: 'Du hast neue potenzielle Verbindungen, die darauf warten, von dir entdeckt zu werden.',
              icon: '/icon.png',
              badge: '/icon.png'
            });
          } catch (e) {
            console.error('Notification failed', e);
          }
        }
      }
      updateActivity();
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    });

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
    };
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification('Benachrichtigungen aktiviert', {
          body: 'Wir erinnern dich, wenn du länger nicht aktiv warst.',
        });
      }
    } catch (e) {
      melde("InactiveNotificationManager", e);
    } finally {
      klarStorage.setItem('klar_notification_prompt', 'true');
      setShowPrompt(false);
    }
  };

  const dismissPrompt = () => {
    klarStorage.setItem('klar_notification_prompt', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-80 bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 p-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <button
        aria-label="Hinweis schließen"
        onClick={dismissPrompt}
        className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-brand/10 dark:bg-brand-light/10 rounded-full flex items-center justify-center shrink-0 text-brand dark:text-brand-light">
          <BellRing size={20} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">Bleib in Verbindung</h4>
          <p className="text-xs text-stone-600 dark:text-stone-300 mb-3">Erlaube Benachrichtigungen, um erinnert zu werden, wenn neue Verbindungen auf dich warten.</p>
          <div className="flex gap-2">
            <button
              onClick={requestPermission}
              className="px-3 py-1.5 bg-brand text-white dark:bg-brand-light dark:text-brand-dark text-xs font-medium rounded-lg"
            >
              Aktivieren
            </button>
            <button
              onClick={dismissPrompt}
              className="px-3 py-1.5 bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium rounded-lg"
            >
              Später
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
