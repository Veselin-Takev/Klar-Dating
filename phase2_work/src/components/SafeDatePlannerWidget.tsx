import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarClock, MapPin, Clock, ShieldCheck, Play, Square, BellRing } from 'lucide-react';
import { hapticFeedback, HAPTIC_PATTERNS } from '../lib/haptics';

export function SafeDatePlannerWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [person, setPerson] = useState('');
  const [location, setLocation] = useState('');
  const [timerType, setTimerType] = useState<'arrival' | 'home'>('arrival');
  const [durationMinutes, setDurationMinutes] = useState(30);

  const [activeTimer, setActiveTimer] = useState<{
    endTime: number;
    type: 'arrival' | 'home';
    person: string;
  } | null>(null);

  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const saved = klarStorage.getItem('klar_safe_timer');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.endTime > Date.now()) {
        setActiveTimer(parsed);
      } else {
        klarStorage.removeItem('klar_safe_timer');
      }
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (activeTimer) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = activeTimer.endTime - now;
        if (diff <= 0) {
          setTimeLeft('Zeit abgelaufen!');
          // Trigger notification
          const event = new CustomEvent('klar-in-app-notification', {
            detail: {
              title: "Sicherheits-Timer abgelaufen",
              body: `Dein Timer für ${activeTimer.type === 'arrival' ? 'Ankunft' : 'Heimweg'} (${activeTimer.person}) ist abgelaufen. Melde dich bei deinen Liebsten!`
            }
          });
          window.dispatchEvent(event);
          hapticFeedback(HAPTIC_PATTERNS.ERROR);
          setActiveTimer(null);
          klarStorage.removeItem('klar_safe_timer');
        } else {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${m}:${s < 10 ? '0' : ''}${s}`);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const startTimer = () => {
    if (!person) return;
    const endTime = Date.now() + durationMinutes * 60000;
    const newTimer = { endTime, type: timerType, person };
    setActiveTimer(newTimer);
    klarStorage.setItem('klar_safe_timer', JSON.stringify(newTimer));
    setIsOpen(false);
    hapticFeedback(HAPTIC_PATTERNS.SUCCESS);
  };

  const stopTimer = () => {
    setActiveTimer(null);
    klarStorage.removeItem('klar_safe_timer');
    setTimeLeft('');
    hapticFeedback(HAPTIC_PATTERNS.LIGHT_TAP);
  };

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-stone-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-xl">
            <ShieldCheck size={20} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Safe-Date Planer</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">Timer für deine Sicherheit</p>
          </div>
        </div>
        {!activeTimer && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline px-2 py-1"
          >
            {isOpen ? 'Abbrechen' : 'Neu'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && !activeTimer && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 mb-2">
              <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/50 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                <CalendarClock size={16} className="text-stone-400 shrink-0 ml-1" />
                <input
                  type="text"
                  placeholder="Date mit..."
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  className="w-full bg-transparent text-sm focus:outline-none dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/50 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                <MapPin size={16} className="text-stone-400 shrink-0 ml-1" />
                <input
                  type="text"
                  placeholder="Wo trefft ihr euch?"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-transparent text-sm focus:outline-none dark:text-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setTimerType('arrival')}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-colors ${timerType === 'arrival' ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-700/50 dark:text-teal-400' : 'bg-white border-stone-200 dark:bg-stone-800 dark:border-stone-700'}`}
                >
                  Ankunft
                </button>
                <button
                  onClick={() => setTimerType('home')}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-colors ${timerType === 'home' ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-900/20 dark:border-teal-700/50 dark:text-teal-400' : 'bg-white border-stone-200 dark:bg-stone-800 dark:border-stone-700'}`}
                >
                  Heimweg
                </button>
              </div>

              <div className="flex items-center gap-3 bg-stone-50 dark:bg-stone-800/50 p-2 rounded-xl border border-stone-200 dark:border-stone-700">
                <Clock size={16} className="text-stone-400 shrink-0 ml-1" />
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs font-medium text-stone-600 dark:text-stone-300 w-12 text-right">
                  {durationMinutes} Min
                </span>
              </div>

              <button
                onClick={startTimer}
                disabled={!person}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                <Play size={16} className="fill-current" />
                Timer starten
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTimer && (
        <div className="bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800/50 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <BellRing size={64} className="text-teal-500" />
          </div>
          <div className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1 z-10">
            {activeTimer.type === 'arrival' ? 'Ankunft-Check' : 'Heimweg-Check'}
          </div>
          <div className="text-3xl font-bold text-teal-700 dark:text-teal-300 tracking-tight font-mono mb-1 z-10">
            {timeLeft}
          </div>
          <div className="text-sm font-medium text-stone-600 dark:text-stone-400 mb-4 z-10">
            Date mit {activeTimer.person}
          </div>

          <button
            onClick={stopTimer}
            className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 px-6 py-2 rounded-full text-xs font-semibold flex items-center gap-2 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors z-10 shadow-sm"
          >
            <Square size={12} className="fill-current text-rose-500" />
            Sicher angekommen
          </button>
        </div>
      )}

      {!isOpen && !activeTimer && (
        <div className="text-center py-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700">
          <p className="text-xs text-stone-500 dark:text-stone-400">Kein aktiver Timer.</p>
        </div>
      )}
    </div>
  );
}
