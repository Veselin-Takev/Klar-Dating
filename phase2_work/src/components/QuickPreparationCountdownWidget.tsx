import { klarStorage } from '../lib/userScopedStorage';
import { fetchDatePlans } from '../lib/datePlans';
import { useState, useEffect } from "react";
import { Clock, CheckCircle2, Wind, Shirt, Sparkles, PartyPopper, X, Plus } from "lucide-react";
import { motion } from "motion/react";

interface PlannedDate {
  id: string;
  matchName: string;
  idea: string;
  date: string;
}

export function QuickPreparationCountdownWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [nextDate, setNextDate] = useState<PlannedDate | null>(null);
  const [minutesUntil, setMinutesUntil] = useState<number | null>(null);
  const [ritualStep, setRitualStep] = useState<number>(0);
  const [breathingTimer, setBreathingTimer] = useState(60);

  const [customTasks, setCustomTasks] = useState<{id: string, text: string, done: boolean}[]>([]);
  const [newTask, setNewTask] = useState('');

  useEffect(() => {
    const saved = klarStorage.getItem('klar_dateprep_tasks');
    if (saved) {
      try { setCustomTasks(JSON.parse(saved)); } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const saveTasks = (t: {id: string, text: string, done: boolean}[]) => {
    setCustomTasks(t);
    klarStorage.setItem('klar_dateprep_tasks', JSON.stringify(t));
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    saveTasks([...customTasks, { id: Date.now().toString(), text: newTask.trim(), done: false }]);
    setNewTask('');
  };

  const toggleTask = (id: string) => {
    saveTasks(customTasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const removeTask = (id: string) => {
    saveTasks(customTasks.filter(t => t.id !== id));
  };

  const [isBreathing, setIsBreathing] = useState(false);

  useEffect(() => {
    const checkDates = async () => {
      try { const dates = await fetchDatePlans(); const now = new Date(); const closest = dates.map(d => ({ ...d, parsedDate: new Date(d.date) })).filter(d => d.parsedDate > now).sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())[0]; if (!closest) { setNextDate(null); setMinutesUntil(null); return; } setNextDate(closest); setMinutesUntil(Math.floor((closest.parsedDate.getTime() - now.getTime()) / 60000)); } catch { setNextDate(null); setMinutesUntil(null); setUiError('Kalenderdaten konnten nicht geladen werden.'); }
    };
    void checkDates(); const interval = setInterval(() => void checkDates(), 60000); return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval: unknown;
    if (isBreathing && breathingTimer > 0) {
      interval = setInterval(() => {
        setBreathingTimer(prev => prev - 1);
      }, 1000);
    } else if (breathingTimer === 0) {
      setIsBreathing(false);
    }
    return () => clearInterval(interval);
  }, [isBreathing, breathingTimer]);

  if (!nextDate || minutesUntil === null) {
    return null; // Don't show if no upcoming date
  }

  const isRitualTime = minutesUntil <= 30 && minutesUntil > 0;


  if (!isRitualTime) {
    // Dormant state - optional, but good for UI context
    return (
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

        <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400 mb-4">
          <Clock className="text-brand dark:text-brand-light" size={20} />
          <div>
            <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Nächstes Date mit {nextDate.matchName}</p>
            <p className="text-xs">In {minutesUntil > 1440 ? Math.floor(minutesUntil / 1440) + ' Tagen' : Math.floor(minutesUntil / 60) + ' Stunden'}</p>
          </div>
        </div>

        <div className="mt-2 border-t border-stone-100 dark:border-stone-700 pt-4">
          <h4 className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-3 uppercase tracking-wider">Meine Date-Vorbereitungs-Checkliste</h4>
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-2">
            {customTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <button onClick={() => toggleTask(t.id)} className={`w-5 h-5 rounded shrink-0 flex items-center justify-center border transition-colors ${t.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800'}`}>
                  {t.done && <CheckCircle2 size={14} />}
                </button>
                <span className={`text-sm flex-1 ${t.done ? 'text-stone-400 line-through' : 'text-stone-700 dark:text-stone-300'}`}>{t.text}</span>
                <button aria-label="Aufgabe entfernen" onClick={() => removeTask(t.id)} className="text-stone-400 hover:text-rose-500 opacity-50 hover:opacity-100"><X size={14}/></button>
              </div>
            ))}
            {customTasks.length === 0 && <p className="text-xs text-stone-500">Z.B. Reservierung bestätigen, Outfit bügeln...</p>}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Aufgabe hinzufügen..." className="flex-1 text-sm bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 focus:outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/20 transition-all" />
            <button aria-label="Aufgabe hinzufügen" onClick={addTask} disabled={!newTask.trim()} className="bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-3 rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors flex items-center justify-center">
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="bg-brand dark:bg-brand-light border border-transparent rounded-3xl p-6 shadow-md h-full flex flex-col relative overflow-hidden text-white dark:text-stone-900">
      <div className="absolute top-0 right-0 p-4 opacity-20">
        <Sparkles size={64} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {ritualStep === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={20} />
              <span className="text-sm font-semibold uppercase tracking-wider">Countdown</span>
            </div>
            <h3 className="text-2xl font-serif font-medium mb-1">
              Noch {minutesUntil} Minuten
            </h3>
            <p className="text-sm opacity-90 mb-6">
              Dein Date mit {nextDate.matchName} steht an. Zeit für einen schnellen Check-in!
            </p>

            <button
              onClick={() => setRitualStep(1)}
              className="bg-white text-brand dark:bg-stone-800 dark:text-brand-light py-3 px-4 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors shadow-sm"
            >
              Vorbereitungs-Ritual starten
            </button>
          </motion.div>
        )}

        {ritualStep === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Shirt size={20} />
              </div>
              <h3 className="text-lg font-medium">Outfit & Check</h3>
            </div>

            <ul className="space-y-3 mb-6 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 opacity-80 shrink-0" />
                <span>Outfit sitzt und du fühlst dich wohl?</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 opacity-80 shrink-0" />
                <span>Schlüssel, Geldtasche, Handy dabei?</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 opacity-80 shrink-0" />
                <span>Ein kurzer Blick in den Spiegel!</span>
              </li>
            </ul>

            <button
              onClick={() => setRitualStep(2)}
              className="bg-white text-brand dark:bg-stone-800 dark:text-brand-light py-3 px-4 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors"
            >
              Alles bereit! Weiter
            </button>
          </motion.div>
        )}

        {ritualStep === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col justify-center items-center text-center">
            <Wind size={32} className="mb-3" />
            <h3 className="text-lg font-medium mb-2">Kurz durchatmen</h3>
            <p className="text-sm opacity-90 mb-6">
              Nimm dir einen Moment, um anzukommen. Sei authentisch, sei du selbst.
            </p>

            {!isBreathing && breathingTimer === 60 ? (
              <button
                onClick={() => setIsBreathing(true)}
                className="w-32 h-32 rounded-full border-4 border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors mb-4"
              >
                <span className="font-semibold tracking-wide uppercase text-sm">Start</span>
              </button>
            ) : breathingTimer > 0 ? (
              <div className="w-32 h-32 rounded-full border-4 border-white flex flex-col items-center justify-center mb-4 relative overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-white/20"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                />
                <span className="text-3xl font-serif z-10">{breathingTimer}</span>
                <span className="text-[10px] uppercase tracking-widest z-10">Sek</span>
              </div>
            ) : (
              <div className="w-32 h-32 rounded-full bg-white text-brand dark:bg-stone-800 dark:text-brand-light flex items-center justify-center mb-4">
                <CheckCircle2 size={40} />
              </div>
            )}

            <button
              onClick={() => setRitualStep(3)}
              className="mt-2 text-sm font-medium underline opacity-80 hover:opacity-100 transition-opacity"
            >
              {breathingTimer > 0 ? 'Überspringen' : 'Weiter'}
            </button>
          </motion.div>
        )}

        {ritualStep === 3 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col justify-center items-center text-center">
            <PartyPopper size={48} className="mb-4" />
            <h3 className="text-2xl font-serif font-medium mb-2">Du bist bereit!</h3>
            <p className="text-sm opacity-90 mb-6">
              Viel Spaß bei deinem Date mit {nextDate.matchName}. Bleib locker und genieße die Zeit.
            </p>

            <button
              onClick={() => setRitualStep(0)} // Reset or could close
              className="bg-white text-brand dark:bg-stone-800 dark:text-brand-light py-3 px-8 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors shadow-sm"
            >
              Los geht's!
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
