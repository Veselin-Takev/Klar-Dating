import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { BookHeart, Sparkles, CheckCircle2, PenLine, ArrowRight, Activity, CalendarDays, ChevronLeft, Archive, ArchiveRestore } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type Mood = "excited" | "relaxed" | "neutral" | "nervous" | "frustrated";
type DiaryEntry = {
  id: string;
  date: string;
  reflection: string;
  learning: string;
  activity: string;
  mood: Mood | null;
  isArchived?: boolean;
};
function isDiaryEntry(value: unknown): value is DiaryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && typeof entry.date === 'string' &&
    typeof entry.reflection === 'string' && typeof entry.learning === 'string' &&
    typeof entry.activity === 'string' &&
    (entry.mood === null || typeof entry.mood === 'string') &&
    (entry.isArchived === undefined || typeof entry.isArchived === 'boolean');
}
const MOODS: { id: Mood; label: string; emoji: string; color: string }[] = [
  { id: "excited", label: "Begeistert", emoji: "🤩", color: "bg-emerald-500 text-white" },
  { id: "relaxed", label: "Entspannt", emoji: "😌", color: "bg-blue-400 text-white" },
  { id: "neutral", label: "Neutral", emoji: "😐", color: "bg-stone-400 text-white" },
  { id: "nervous", label: "Nervös", emoji: "😬", color: "bg-yellow-500 text-white" },
  { id: "frustrated", label: "Frustriert", emoji: "😫", color: "bg-red-400 text-white" },
];

export function SmartDatingDiaryWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [step, setStep] = useState<'nudge' | 'write' | 'done' | 'history'>('nudge');
  const [reflection, setReflection] = useState("");
  const [learning, setLearning] = useState("");
  const [activity, setActivity] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);
  const [pastEntries, setPastEntries] = useState<DiaryEntry[]>([]);
  const [historyTab, setHistoryTab] = useState<'active' | 'archived'>('active');

  const toggleArchive = (id: string) => {
    const diarySaved = klarStorage.getItem('klar_post_date_diary');
    if (diarySaved) {
      try {
        const parsed: unknown = JSON.parse(diarySaved);
        const diaries = Array.isArray(parsed) ? parsed.filter(isDiaryEntry) : [];
        const updated = diaries.map((d) => d.id === id ? { ...d, isArchived: !d.isArchived } : d);
        klarStorage.setItem('klar_post_date_diary', JSON.stringify(updated));
        loadEntries();
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  };

  const loadEntries = () => {
    const diarySaved = klarStorage.getItem('klar_post_date_diary');
    if (diarySaved) {
      try {
        const parsed: unknown = JSON.parse(diarySaved);
        const entries = Array.isArray(parsed) ? parsed.filter(isDiaryEntry) : [];
        setPastEntries(entries.reverse());
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  };

  useEffect(() => {
    loadEntries();
  }, [step]);

  const handleSave = () => {
    const today = new Date().toISOString().split('T')[0] || '';

    // Save to diary
    const diarySaved = klarStorage.getItem('klar_post_date_diary');
    let diaries: DiaryEntry[] = [];
    if (diarySaved) {
      try {
        const parsed: unknown = JSON.parse(diarySaved);
        diaries = Array.isArray(parsed) ? parsed.filter(isDiaryEntry) : [];
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
    diaries.push({
      id: Date.now().toString(),
      date: today,
      reflection,
      learning,
      activity,
      mood,
    });
    klarStorage.setItem('klar_post_date_diary', JSON.stringify(diaries));

    // Save to mood tracker for Vibe-Tracker
    if (mood) {
      const moodsSaved = klarStorage.getItem('klar_dating_moods');
      let moods = [];
      if (moodsSaved) {
        try { moods = JSON.parse(moodsSaved); } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
      }
      const newMoods = [...moods.filter((e: unknown) => e.date !== today), { date: today, mood }];
      klarStorage.setItem('klar_dating_moods', JSON.stringify(newMoods));
    }

    // Save to klar_dating_journals for global progress tracking
    const journalsSaved = klarStorage.getItem('klar_dating_journals');
    let journals = [];
    if (journalsSaved) {
       try { journals = JSON.parse(journalsSaved); } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
    const selectedMoodEmoji = MOODS.find(m => m.id === mood)?.emoji || '';
    journals.push({
       id: Date.now().toString(),
       date: today,
       timestamp: Date.now(),
       note: `Aktivität: ${activity}. Highlight: ${reflection}. Gelernt: ${learning}`,
       mood: mood,
       vibes: [selectedMoodEmoji]
    });
    klarStorage.setItem('klar_dating_journals', JSON.stringify(journals));

    setStep('done');
    setTimeout(() => {
      setStep('history');
      setReflection("");
      setLearning("");
      setActivity("");
      setMood(null);
    }, 2000);
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <BookHeart size={20} className="text-teal-500" />
            Dating-Tagebuch
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Erfahrungen & Stimmung festhalten
          </p>
        </div>

        {step === 'nudge' && pastEntries.length > 0 && (
          <button
            onClick={() => setStep('history')}
            className="p-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title="Einträge ansehen"
          >
            <CalendarDays size={18} />
          </button>
        )}
        {(step === 'write' || step === 'history') && (
           <button
             onClick={() => setStep('nudge')}
             className="text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center"
           >
             <ChevronLeft size={14} /> Zurück
           </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-start overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 'nudge' && (
            <motion.div
              key="nudge"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-800/50 p-4 rounded-2xl text-center my-auto"
            >
              <div className="bg-teal-100 dark:bg-teal-800 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles size={18} className="text-teal-600 dark:text-teal-300" />
              </div>
              <p className="text-sm text-stone-800 dark:text-stone-200 font-medium mb-1">Zeit für Reflexion!</p>
              <p className="text-xs text-stone-600 dark:text-stone-400 mb-4 leading-relaxed">
                Du hattest kürzlich ein Date. Nimm dir 2 Minuten, um deine Gedanken festzuhalten und zu lernen, welche Dates dir guttun.
              </p>
              <button
                onClick={() => setStep('write')}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <PenLine size={16} /> Neuen Eintrag schreiben
              </button>
            </motion.div>
          )}

          {step === 'write' && (
            <motion.div
              key="write"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 overflow-y-auto pr-1 pb-2"
            >
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Wie war die Stimmung (Vibe)?
                </label>
                <div className="flex justify-between gap-1">
                  {MOODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMood(m.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all border ${mood === m.id ? m.color + ' border-transparent' : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700 hover:border-teal-400'}`}
                    >
                      <span className="text-2xl filter drop-shadow-sm">{m.emoji}</span>
                      <span className="text-[9px] font-medium opacity-80">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Was habt ihr gemacht? (Aktivität)
                </label>
                <input
                  type="text"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  placeholder="Z.B. Kaffee trinken, Spaziergang, Kino..."
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Was war dein größtes Highlight?
                </label>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="Gute Gespräche, gemeinsame Hobbys..."
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[60px] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Was hast du für dich gelernt?
                </label>
                <textarea
                  value={learning}
                  onChange={(e) => setLearning(e.target.value)}
                  placeholder="Ich sollte klarer kommunizieren..."
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[60px] resize-none"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={(!reflection && !learning && !activity) || !mood}
                className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-stone-300 dark:disabled:bg-stone-700 disabled:text-stone-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0"
              >
                Eintrag speichern <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center text-center py-6 my-auto"
            >
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
                Reflexion gespeichert!
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Die Stimmung wurde zu deinem Vibe-Tracker hinzugefügt.
              </p>
            </motion.div>
          )}

          {step === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 overflow-y-auto pr-1 pb-2 h-full"
            >
              {pastEntries.length === 0 ? (
                <div className="text-center py-8 text-stone-500 text-sm">
                  Noch keine Einträge vorhanden.
                </div>
              ) : (
                <>
                  <div className="mb-2 pb-3 border-b border-stone-100 dark:border-stone-700">
                    <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-3">Vibe-Trend (Letzte Dates)</p>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                      {pastEntries.filter(e => !e.isArchived).slice(0, 10).map(entry => {
                        const moodInfo = MOODS.find(m => m.id === entry.mood);
                        return (
                          <div key={'trend-'+entry.id} className="flex flex-col items-center flex-shrink-0" title={new Date(entry.date).toLocaleDateString('de-DE')}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg filter drop-shadow-sm ${moodInfo ? moodInfo.color : 'bg-stone-100 dark:bg-stone-800'}`}>
                              {moodInfo ? moodInfo.emoji : '?'}
                            </div>
                            <span className="text-[9px] text-stone-400 mt-1 font-medium">{new Date(entry.date).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'})}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-4 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl">
                    <button
                      onClick={() => setHistoryTab('active')}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${historyTab === 'active' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100' : 'text-stone-500'}`}
                    >
                      Aktuelle
                    </button>
                    <button
                      onClick={() => setHistoryTab('archived')}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors ${historyTab === 'archived' ? 'bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100' : 'text-stone-500'}`}
                    >
                      Archiv
                    </button>
                  </div>

                  {pastEntries.filter(e => historyTab === 'active' ? !e.isArchived : e.isArchived).length === 0 && (
                    <div className="text-center py-6 text-stone-500 text-sm">
                       Keine Einträge in dieser Ansicht.
                    </div>
                  )}

                  {pastEntries.filter(e => historyTab === 'active' ? !e.isArchived : e.isArchived).map(entry => {
                    const moodInfo = MOODS.find(m => m.id === entry.mood);
                    return (
                      <div key={entry.id} className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-4 border border-stone-100 dark:border-stone-700 relative group">
                        <button
                          onClick={() => toggleArchive(entry.id)}
                          className="absolute top-3 right-3 p-1.5 bg-white dark:bg-stone-700 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-stone-200 dark:border-stone-600"
                          title={entry.isArchived ? "Wiederherstellen" : "Archivieren"}
                        >
                          {entry.isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                        </button>
                      <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-medium text-stone-500">
                           {new Date(entry.date).toLocaleDateString('de-DE')}
                         </span>
                         {moodInfo && (
                           <span className="text-lg" title={moodInfo.label}>{moodInfo.emoji}</span>
                         )}
                      </div>
                      {entry.activity && (
                        <p className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-2">
                          <Activity size={14} className="inline mr-1 text-teal-500"/>
                          {entry.activity}
                        </p>
                      )}
                      {entry.reflection && (
                        <div className="mb-2">
                          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Highlight</p>
                          <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{entry.reflection}</p>
                        </div>
                      )}
                      {entry.learning && (
                        <div>
                          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Learning</p>
                          <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{entry.learning}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
