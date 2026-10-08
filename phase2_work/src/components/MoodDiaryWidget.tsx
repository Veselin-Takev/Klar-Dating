import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BookHeart, Smile, Frown, Meh, Save, CheckCircle2, History } from 'lucide-react';

interface MoodEntry {
  id: string;
  date: string;
  mood: 'happy' | 'neutral' | 'sad';
  notes: string;
  timestamp: number;
}

export function MoodDiaryWidget() {
  const { user } = useAuth();
  const [mood, setMood] = useState<'happy' | 'neutral' | 'sad' | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<MoodEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && showHistory && history.length === 0) {
      fetchHistory();
    }
  }, [user, showHistory]);

  const fetchHistory = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.moodHistory) {
          setHistory(data.moodHistory.sort((a: MoodEntry, b: MoodEntry) => b.timestamp - a.timestamp));
        }
      }
    } catch (e) {
      console.warn("Offline?", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !mood) return;
    setIsSaving(true);

    const newEntry: MoodEntry = {
      id: "0".substring(7),
      date: new Date().toLocaleDateString('de-DE'),
      mood,
      notes,
      timestamp: Date.now()
    };

    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      let updatedHistory = [newEntry];
      if (userDoc.exists() && userDoc.data().moodHistory) {
        updatedHistory = [newEntry, ...userDoc.data().moodHistory];
      }

      await setDoc(userRef, { moodHistory: updatedHistory }, { merge: true });

      setHistory(updatedHistory);
      setMood(null);
      setNotes('');
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (e) {
      console.warn("Offline?", e);
    } finally {
      setIsSaving(false);
    }
  };

  const getMoodIcon = (m: string) => {
    switch (m) {
      case 'happy': return <Smile className="text-emerald-500" size={24} />;
      case 'neutral': return <Meh className="text-amber-500" size={24} />;
      case 'sad': return <Frown className="text-rose-500" size={24} />;
      default: return null;
    }
  };

  const getRadarData = () => {
    const themes = { Aufregung: 0, Nervosität: 0, Freude: 0, Hoffnung: 0, Enttäuschung: 0 };
    history.forEach(entry => {
      const text = entry.notes.toLowerCase();
      if (text.match(/(aufgeregt|spannend|aufregung|date)/)) themes.Aufregung += 1;
      if (text.match(/(nervös|angst|unsicher|sorge)/)) themes.Nervosität += 1;
      if (text.match(/(freude|glücklich|schön|toll|super)/)) themes.Freude += 1;
      if (text.match(/(hoffnung|optimistisch|vielleicht)/)) themes.Hoffnung += 1;
      if (text.match(/(schade|enttäuscht|doof|schlecht)/)) themes.Enttäuschung += 1;
    });
    const total = Math.max(1, Object.values(themes).reduce((a, b) => a + b, 0));
    return Object.entries(themes).map(([subject, count]) => ({
      subject,
      A: Math.round((count / total) * 100 + 0), // random baseline to show something
      fullMark: 100
    }));
  };

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-5 shadow-sm border border-stone-100 dark:border-stone-700 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand/10 rounded-xl text-brand">
            <BookHeart size={20} />
          </div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100">Stimmungs-Tagebuch</h3>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-stone-400 hover:text-brand dark:hover:text-brand-light transition-colors p-1"
          title="Verlauf anzeigen"
        >
          <History size={18} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showHistory ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 mt-4"
          >
            {isLoading ? (
              <div className="text-center py-4 text-stone-500 text-sm ">Lade Verlauf...</div>
            ) : history.length > 0 ? (
              <div className="space-y-4">
                <div className="h-48 w-full bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-2 border border-stone-100 dark:border-stone-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRadarData()}>
                      <PolarGrid stroke="#e7e5e4" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#78716c' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Themen" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="max-h-60 overflow-y-auto pr-2 space-y-3">
                  {history.map((entry) => (
                    <div key={entry.id} className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">{entry.date}</span>
                        {getMoodIcon(entry.mood)}
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-stone-700 dark:text-stone-300 italic">"{entry.notes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-stone-500 text-sm">
                Noch keine Einträge vorhanden.
              </div>
            )}
            <button
              onClick={() => setShowHistory(false)}
              className="w-full py-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-medium rounded-xl mt-2"
            >
              Zurück zum Eintrag
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="entry"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-emerald-500">
                <CheckCircle2 size={48} className="mb-3" />
                <p className="font-medium">Tagebucheintrag gespeichert!</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
                  Wie war dein Date oder deine letzte Interaktion? Halte deine Gedanken fest.
                </p>

                <div className="flex justify-center gap-4 mb-4">
                  <button aria-label="Stimmung: schlecht"
                    onClick={() => setMood('sad')}
                    className={`p-3 rounded-full transition-all ${mood === 'sad' ? 'bg-rose-100 dark:bg-rose-900/30 ring-2 ring-rose-500 scale-110' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
                  >
                    <Frown size={28} className={mood === 'sad' ? 'text-rose-500' : ''} />
                  </button>
                  <button aria-label="Stimmung: neutral"
                    onClick={() => setMood('neutral')}
                    className={`p-3 rounded-full transition-all ${mood === 'neutral' ? 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-500 scale-110' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
                  >
                    <Meh size={28} className={mood === 'neutral' ? 'text-amber-500' : ''} />
                  </button>
                  <button aria-label="Stimmung: gut"
                    onClick={() => setMood('happy')}
                    className={`p-3 rounded-full transition-all ${mood === 'happy' ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-2 ring-emerald-500 scale-110' : 'bg-stone-100 dark:bg-stone-800 text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
                  >
                    <Smile size={28} className={mood === 'happy' ? 'text-emerald-500' : ''} />
                  </button>
                </div>

                <AnimatePresence>
                  {mood && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3"
                    >
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Was lief gut? Was würdest du beim nächsten Mal anders machen?"
                        className="w-full bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none h-24"
                      />
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 bg-brand text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {isSaving ? (
                          <div className="w-5 h-5 bg-white/50 rounded-full " />
                        ) : (
                          <>
                            <Save size={16} /> Eintrag speichern
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
