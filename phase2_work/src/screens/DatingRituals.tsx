import { klarStorage } from '../lib/userScopedStorage';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import { ConsistencyStreakWidget } from '../components/ConsistencyStreakWidget';
import { ArrowLeft, Wind, Heart, Sparkles, Brain, Clock, PlayCircle, Plus, Trash2, CalendarDays } from 'lucide-react';

const exercises = [
  {
    id: '4-7-8',
    title: '4-7-8 Atmung',
    description: 'Baut akute Nervosität vor einem Date oder Chat ab. Fokussiert auf Ausatmung zur Pulsberuhigung.',
    duration: '2 Min.',
    icon: <Wind size={20} />,
    color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
  },
  {
    id: 'box-breathing',
    title: 'Box Breathing',
    description: 'Für mehr Fokus und Klarheit, wenn die Konversation unübersichtlich wird.',
    duration: '3 Min.',
    icon: <Brain size={20} />,
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
  },
  {
    id: 'self-compassion',
    title: 'Selbstmitgefühl',
    description: 'Nach einer Absage oder Ghosting. Verbinde dich wieder mit deinem eigenen Wert.',
    duration: '5 Min.',
    icon: <Heart size={20} />,
    color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
  },
  {
    id: 'confidence',
    title: 'Confidence Boost',
    description: 'Visualisiere ein positives Date und tanke Selbstbewusstsein, bevor du das Haus verlässt.',
    duration: '4 Min.',
    icon: <Sparkles size={20} />,
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
  }
];

export const DatingRituals: React.FC = () => {
  const { t } = useTranslation();
  const [uiError, setUiError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [activeExercise, setActiveExercise] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'exercises' | 'gratitude'>('exercises');
  const [gratitudeEntries, setGratitudeEntries] = useState<{id: string, text: string, date: string}[]>([]);
  const [newGratitude, setNewGratitude] = useState('');

  useEffect(() => {
    const saved = klarStorage.getItem('klar_gratitude_journal');
    if (saved) {
      try { setGratitudeEntries(JSON.parse(saved)); } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const saveGratitude = (entries: {id: string, text: string, date: string}[]) => {
    setGratitudeEntries(entries);
    klarStorage.setItem('klar_gratitude_journal', JSON.stringify(entries));
  };


  const markRitualCompleted = () => {
    try {
      const saved = klarStorage.getItem('klar_rituals_streak');
      let count = 1;
      let vacationUntil: string | undefined;
      let resumeGrace = false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.vacationUntil === 'string' && new Date(data.vacationUntil).getTime() >= today.getTime()) {
          vacationUntil = data.vacationUntil;
        }
        resumeGrace = typeof data.resumeGraceUntil === 'string' && new Date(data.resumeGraceUntil).getTime() >= today.getTime();
        const lastDate = new Date(data.lastDate);
        lastDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - lastDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          return; // Already completed today
        } else if (diffDays === 1 || vacationUntil || resumeGrace) {
          count = Number.isSafeInteger(data.count) && data.count > 0 ? data.count + 1 : 1;
        }
      }

      klarStorage.setItem('klar_rituals_streak', JSON.stringify({ count, lastDate: today.toISOString(), ...(vacationUntil ? { vacationUntil } : {}) }));
      window.dispatchEvent(new Event('klar_ritual_completed'));
    } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
  };

  const addGratitude = () => {
    markRitualCompleted();
    if (!newGratitude.trim()) return;
    const entry = { id: Date.now().toString(), text: newGratitude.trim(), date: new Date().toISOString() };
    saveGratitude([entry, ...gratitudeEntries]);
    setNewGratitude('');
  };

  const deleteGratitude = (id: string) => {
    saveGratitude(gratitudeEntries.filter(e => e.id !== id));
  };

  const [phase, setPhase] = useState<'inhale' | 'hold1' | 'exhale' | 'hold2'>('inhale');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const [sessionTimeLeft, setSessionTimeLeft] = useState(180);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      if (activeExercise === '4-7-8') {
        if (phase === 'inhale') { setPhase('hold1'); setTimeLeft(7); }
        else if (phase === 'hold1') { setPhase('exhale'); setTimeLeft(8); }
        else if (phase === 'exhale') { setPhase('inhale'); setTimeLeft(4); }
      } else {
        if (phase === 'inhale') { setPhase('hold1'); setTimeLeft(4); }
        else if (phase === 'hold1') { setPhase('exhale'); setTimeLeft(4); }
        else if (phase === 'exhale') { setPhase('hold2'); setTimeLeft(4); }
        else if (phase === 'hold2') { setPhase('inhale'); setTimeLeft(4); }
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, phase, activeExercise]);

  useEffect(() => {
    let sessionInterval: ReturnType<typeof setInterval>;
    if (isActive && sessionTimeLeft > 0) {
      sessionInterval = setInterval(() => {
        setSessionTimeLeft(t => t - 1);
      }, 1000);
    } else if (isActive && sessionTimeLeft === 0) {
      stopExercise();
    }
    return () => clearInterval(sessionInterval);
  }, [isActive, sessionTimeLeft]);

  const startExercise = (id: string, durationStr?: string) => {
    if (!durationStr) durationStr = "3 Min.";
    setActiveExercise(id);
    klarStorage.setItem("klar_last_ritual_engagement", Date.now().toString());
    setIsActive(true);
    setPhase('inhale');
    setTimeLeft(4);

    // Parse duration string (e.g. "3 Min.")
    // FUN-05 (Final Audit 08.08.2026): Hier stand /(\\d+)/ — im Quelltext
    // zwei Zeichen, Backslash und d. Der Ausdruck suchte damit nach einem
    // echten Backslash gefolgt von Ziffern und traf nie. „3 Min." wurde nie
    // erkannt, jede Uebung lief auf den Ersatzwert von 180 Sekunden.
    const minMatch = durationStr.match(/(\d+)/);
    const durationSec = minMatch ? parseInt(minMatch[1] || "0") * 60 : 180;

    setSessionTimeLeft(durationSec);
  };

  const stopExercise = () => {
    if (sessionTimeLeft < 150) markRitualCompleted(); // Mark complete if they did some of it
    klarStorage.setItem('klar_last_ritual_date', new Date().toLocaleDateString('de-DE'));
    window.dispatchEvent(new Event('storage'));
    setIsActive(false);
    setActiveExercise(null);
  };

  return (
    <div className="min-h-[100dvh] bg-light-bg dark:bg-dark-bg flex flex-col">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-light-bg/80 dark:bg-dark-bg/80  z-10 border-b border-stone-200 dark:border-stone-700">
        <div className="flex items-center gap-3">
          <button aria-label="Zurück"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
          >
            <ArrowLeft size={20} className="text-stone-700 dark:text-stone-300" />
          </button>
          <h1 className="font-serif text-xl font-medium text-stone-900 dark:text-stone-100">{t("rituals.title")}</h1>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 pb-24 overflow-y-auto">
        <div className="bg-stone-50 dark:bg-stone-800 rounded-2xl p-6 mb-8 border border-stone-200 dark:border-stone-700 text-center">
          <div className="w-16 h-16 bg-brand/10 text-brand dark:bg-brand-light/10 dark:text-brand-light rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} />
          </div>
          <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100 mb-2">{t("rituals.safeSpace")}</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {t("rituals.safeSpaceDesc")}
          </p>
        </div>


        <div className="flex bg-stone-200/50 dark:bg-stone-800/50 p-1 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('exercises')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'exercises' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
          >
            {t("rituals.breathing")}
          </button>
          <button
            onClick={() => setActiveTab('gratitude')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'gratitude' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
          >
            {t("rituals.gratitude")}
          </button>
        </div>


        <ConsistencyStreakWidget />
        <div className="space-y-4">
          <AnimatePresence mode="wait">

          {activeTab === 'gratitude' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-white dark:bg-stone-800 p-5 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm">
                <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100 mb-2">Wofür bist du heute dankbar?</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">Halte kleine, positive Dating-Momente fest. Ein gutes Gespräch, ein nettes Lächeln oder einfach Klarheit.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGratitude}
                    onChange={e => setNewGratitude(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addGratitude()}
                    placeholder="Ich bin dankbar für..."
                    className="flex-1 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand/50"
                  />
                  <button
                    aria-label="Dankbarkeit hinzufügen"
                    onClick={addGratitude}
                    disabled={!newGratitude.trim()}
                    className="bg-brand dark:bg-brand-light text-white dark:text-stone-900 px-4 rounded-xl font-medium disabled:opacity-50 transition-opacity"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Archiv</h4>
                {gratitudeEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <Heart size={32} className="mx-auto text-stone-300 dark:text-stone-700 mb-3" />
                    <p className="text-stone-500 text-sm">Noch keine Einträge. Fang heute damit an!</p>
                  </div>
                ) : (
                  gratitudeEntries.map(entry => (
                    <div key={entry.id} className="bg-white dark:bg-stone-800 p-4 rounded-2xl border border-stone-100 dark:border-stone-700 flex gap-4 group">
                      <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 flex items-center justify-center shrink-0">
                        <Heart size={18} className="fill-current" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 flex items-center gap-1">
                            <CalendarDays size={12} />
                            {new Date(entry.date).toLocaleDateString('de-DE')}
                          </span>
                          <button aria-label="Eintrag löschen" onClick={() => deleteGratitude(entry.id)} className="text-stone-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="text-stone-700 dark:text-stone-300 text-sm">{entry.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
          {activeTab === 'exercises' && (
            <>
              {activeExercise ? (
              <motion.div
                key="exercise"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-stone-800 rounded-3xl p-8 border border-stone-200 dark:border-stone-700 flex flex-col items-center justify-center min-h-[400px] text-center"
              >
                <h3 className="font-serif text-2xl text-stone-900 dark:text-stone-100 mb-8">
                  {exercises.find(e => e.id === activeExercise)?.title}
                </h3>

                <div className="relative w-48 h-48 flex items-center justify-center mb-8 mx-auto">
                  <motion.div
                    animate={{
                      scale: phase === 'inhale' ? 1.5 : (phase === 'exhale' ? 1 : (phase === 'hold1' ? 1.5 : 1)),
                      opacity: phase.includes('hold') ? 0.7 : 1
                    }}
                    transition={{ duration: timeLeft, ease: "linear" }}
                    className="absolute inset-0 bg-brand/20 dark:bg-brand-light/20 rounded-full"
                  />
                  <div className="absolute inset-4 bg-brand/30 dark:bg-brand-light/30 rounded-full flex items-center justify-center  z-10">
                    <span className="text-4xl font-light text-brand-dark dark:text-brand-light font-serif">
                      {timeLeft}
                    </span>
                  </div>
                </div>

                <p className="text-lg font-medium text-stone-600 dark:text-stone-300 mb-2 uppercase tracking-widest h-8">
                  {phase === 'inhale' && "Einatmen"}
                  {(phase === 'hold1' || phase === 'hold2') && "Halten"}
                  {phase === 'exhale' && "Ausatmen"}
                </p>
                <div className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-8">
                  Verbleibende Zeit: {Math.floor(sessionTimeLeft / 60)}:{(sessionTimeLeft % 60).toString().padStart(2, '0')}
                </div>

                <button
                  onClick={stopExercise}
                  className="px-6 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  Beenden
                </button>
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {exercises.map(exercise => (
                  <button
                    key={exercise.id}
                    onClick={() => startExercise(exercise.id, exercise.duration || "3 Min.")}
                    className="w-full text-left bg-white dark:bg-stone-800 p-5 rounded-2xl border border-stone-200 dark:border-stone-700 hover:border-brand dark:hover:border-brand-light transition-all shadow-sm hover:shadow-md group"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${exercise.color}`}>
                        {exercise.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-serif text-lg text-stone-900 dark:text-stone-100 mb-1 group-hover:text-brand dark:group-hover:text-brand-light transition-colors">{exercise.title}</h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mb-3 leading-relaxed">{exercise.description}</p>
                        <div className="flex items-center gap-4 text-xs font-medium text-stone-700 dark:text-stone-300">
                          <span className="flex items-center gap-1.5"><Clock size={14} className="text-stone-400" /> {exercise.duration}</span>
                          <span className="flex items-center gap-1.5 text-brand dark:text-brand-light"><PlayCircle size={14} /> Starten</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
</>
)}
</AnimatePresence>

        </div>
      </main>
    </div>
  );
};

export default DatingRituals;
