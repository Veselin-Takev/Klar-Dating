import { useState } from "react";
import { Sparkles, BookHeart, Tag, PenLine, ChevronRight, SmilePlus } from "lucide-react";
import { motion } from "motion/react";
import { melde } from "../lib/fehler";

interface JournalAnalysis {
  dynamicAnalysis: string;
  behaviorPatterns: string;
  advice: string;
}

export function SmartDatingJournalWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<JournalAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"text" | "quicklog">("text");
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([]);
  const emojis = ["😊", "😍", "🤔", "😬", "🥱", "🤩", "🤯", "🥰", "🥶", "🥳"];

  const toggleEmoji = (emoji: string) => {
    if (selectedEmojis.includes(emoji)) {
      setSelectedEmojis(selectedEmojis.filter(e => e !== emoji));
    } else {
      if (selectedEmojis.length < 3) {
        setSelectedEmojis([...selectedEmojis, emoji]);
      }
    }
  };

  const generateFromEmojis = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/generate-reflection-from-emojis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emojis: selectedEmojis })
      });
      const data = await response.text().then(text => text ? JSON.parse(text) : {});
      if (data.notes) {
        setNotes(data.notes);
        setMode("text");
      }
    } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; } finally {
      setIsLoading(false);
    }
  };

  const availableVibes = ["Aufregend", "Entspannt", "Unangenehm", "Tiefgründig", "Oberflächlich", "Romantisch", "Freundschaftlich", "Langweilig"];

  const toggleVibe = (vibe: string) => {
    if (selectedVibes.includes(vibe)) {
      setSelectedVibes(selectedVibes.filter(v => v !== vibe));
    } else {
      setSelectedVibes([...selectedVibes, vibe]);
    }
  };

  const handleAnalyze = async () => {
    if (!notes) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/dating-journal-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, vibes: selectedVibes })
      });
      const data = await response.text().then(text => text ? JSON.parse(text) : {});
      setAnalysis(data);
    } catch (e) {
      melde("SmartDatingJournalWidget", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm flex flex-col relative z-10 overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}


      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <BookHeart size={20} className="text-rose-500" />
            KI-Dating-Journal
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Reflektiere dein Date & erkenne Muster
          </p>
        </div>
        {!analysis && !isLoading && (
          <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
            <button onClick={() => setMode("text")} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${mode === "text" ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100" : "text-stone-500"}`}>Text</button>
            <button onClick={() => setMode("quicklog")} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors flex items-center gap-1 ${mode === "quicklog" ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100" : "text-stone-500"}`}><SmilePlus size={10} /> Quick-Log</button>
          </div>
        )}
      </div>

      {!analysis && !isLoading ? (
        <div className="space-y-4">
          {mode === "quicklog" ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-800/30">
                <p className="text-xs text-rose-800 dark:text-rose-300 mb-3 font-medium">
                  Wähle bis zu 3 Emojis, die dein Date beschreiben. Die KI erstellt daraus einen ersten Entwurf.
                </p>
                <div className="flex flex-wrap gap-2">
                  {emojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => toggleEmoji(emoji)}
                      className={`text-2xl w-12 h-12 flex items-center justify-center rounded-xl transition-all ${selectedEmojis.includes(emoji) ? "bg-rose-200 dark:bg-rose-800 scale-110 shadow-sm" : "bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 opacity-70 hover:opacity-100"}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={generateFromEmojis}
                disabled={selectedEmojis.length === 0}
                className="w-full mt-2 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Sparkles size={16} />
                Entwurf generieren
              </button>
            </motion.div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-2">
                  <PenLine size={14} /> Wie war das Date? (Notizen)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={4000}
                  placeholder="Wir waren im Park spazieren. Es war nett, aber er hat viel von seiner Ex erzählt..."
                  className="w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 min-h-[100px] resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1.5 mb-2">
                  <Tag size={14} /> Stimmungstags
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableVibes.map(vibe => (
                    <button
                      key={vibe}
                      onClick={() => toggleVibe(vibe)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        selectedVibes.includes(vibe)
                          ? 'bg-rose-100 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400'
                          : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                      }`}
                    >
                      {vibe}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!notes}
                className="w-full mt-2 bg-rose-500 hover:bg-rose-600 text-white font-medium py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Sparkles size={16} />
                Date analysieren lassen
              </button>
            </>
          )}
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-10 text-stone-500">
          <Sparkles className=" mb-3 text-rose-500" size={28} />
          <p className="text-sm font-medium  text-center px-4">
            Deine Notizen werden analysiert...
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-wrap gap-1.5">
              {selectedVibes.map(v => (
                <span key={v} className="text-[10px] font-medium text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">
                  {v}
                </span>
              ))}
            </div>
            <button onClick={() => { setAnalysis(null); setNotes(""); setSelectedVibes([]); }} className="text-[10px] text-stone-400 hover:text-stone-600 underline shrink-0">Neuer Eintrag</button>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/50 rounded-xl">
              <h4 className="font-semibold text-sm text-rose-900 dark:text-rose-100 mb-1.5 flex items-center gap-1.5">
                <Sparkles size={14} className="text-rose-500" />
                Date-Dynamik
              </h4>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{analysis?.dynamicAnalysis}</p>
            </div>

            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-xl">
              <h4 className="font-semibold text-sm text-indigo-900 dark:text-indigo-100 mb-1.5 flex items-center gap-1.5">
                <ChevronRight size={14} className="text-indigo-500" />
                Erkannte Muster
              </h4>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{analysis?.behaviorPatterns}</p>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-xl">
              <h4 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100 mb-1.5 flex items-center gap-1.5">
                <BookHeart size={14} className="text-emerald-500" />
                Advice für dich
              </h4>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{analysis?.advice}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
