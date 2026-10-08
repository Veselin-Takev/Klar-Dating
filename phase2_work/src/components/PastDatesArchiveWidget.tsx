import { klarStorage } from '../lib/userScopedStorage';
import { askAICoach } from "../lib/api";
import { useState, useEffect } from "react";
import { CalendarDays, Plus, User, FileText, CheckCircle2, XCircle, HelpCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { melde } from "../lib/fehler";

interface PastDate {
  id: string;
  matchName: string;
  date: string;
  atmosphere: string;
  seeAgain: 'yes' | 'no' | 'maybe' | null;
}

export function PastDatesArchiveWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [pastDates, setPastDates] = useState<PastDate[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const [matchName, setMatchName] = useState("");
  const [date, setDate] = useState("");
  const [atmosphere, setAtmosphere] = useState("");
  const [seeAgain, setSeeAgain] = useState<'yes' | 'no' | 'maybe' | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const savedAnalysis = klarStorage.getItem("klar_past_dates_analysis");
    if (savedAnalysis) {
      setAiAnalysis(savedAnalysis);
    }
  }, []);

  const analyzePastDates = async () => {
    if (pastDates.length === 0) return;
    setIsAnalyzing(true);
    try {
      const prompt = `Analysiere die folgenden vergangenen Dates und gib ein kurzes Fazit über die häufigsten Erfolgsfaktoren (z.B. Aktivitäten, Orte, Atmosphäre) für Dates, bei denen ein Wiedersehen gewünscht war ('yes'). Halte es kurz und motivierend (max. 3-4 Sätze). Nutze diese Erkenntnisse, um den Date-Planer für die Zukunft zu optimieren. Dates: ${JSON.stringify(pastDates)}`;
      const result = await askAICoach(prompt);
      setAiAnalysis(result);
      klarStorage.setItem("klar_past_dates_analysis", result);
    } catch (e) {
      melde("PastDatesArchiveWidget", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const saved = klarStorage.getItem("klar_past_dates_archive");
    if (saved) {
      try {
        setPastDates(JSON.parse(saved));
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const handleSave = () => {
    if (!matchName || !date || !seeAgain) return;

    const newEntry: PastDate = {
      id: Date.now().toString(),
      matchName,
      date,
      atmosphere,
      seeAgain
    };

    const updated = [newEntry, ...pastDates];
    setPastDates(updated);
    klarStorage.setItem("klar_past_dates_archive", JSON.stringify(updated));

    // Reset form
    setMatchName("");
    setDate("");
    setAtmosphere("");
    setSeeAgain(null);
    setIsAdding(false);
  };

  const getSeeAgainConfig = (status: 'yes' | 'no' | 'maybe' | null) => {
    switch(status) {
      case 'yes': return { icon: CheckCircle2, text: "Ja", color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" };
      case 'no': return { icon: XCircle, text: "Nein", color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10" };
      case 'maybe': return { icon: HelpCircle, text: "Vielleicht", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" };
      default: return { icon: HelpCircle, text: "?", color: "text-stone-500", bg: "bg-stone-50" };
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm h-full flex flex-col max-h-[500px]">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
            <CalendarDays size={18} className="text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-stone-100">Vergangene Dates</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Dokumentiere deine Treffen
            </p>
          </div>
        </div>

        {!isAdding && (
          <button aria-label="Date hinzufügen"
            onClick={() => setIsAdding(true)}
            className="p-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        <AnimatePresence mode="wait">
          {!isAdding && pastDates.length > 0 && (
             <div className="mb-4 bg-violet-50 dark:bg-violet-900/10 rounded-xl p-4 border border-violet-100 dark:border-violet-900/20">
               <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-semibold text-violet-900 dark:text-violet-100 flex items-center gap-1.5">
                   <Sparkles size={14} className="text-violet-500" />
                   KI-Erfolgsanalyse
                 </h4>
                 <button aria-label="Erfolgsanalyse aktualisieren" onClick={analyzePastDates} disabled={isAnalyzing} className="text-violet-500 hover:text-violet-700 disabled:opacity-50 transition-colors">
                   <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                 </button>
               </div>
               {aiAnalysis ? (
                 <p className="text-xs text-violet-800 dark:text-violet-200 leading-relaxed">{aiAnalysis}</p>
               ) : (
                 <p className="text-xs text-violet-600/70 dark:text-violet-400/70">Klicke auf Aktualisieren, um eine Analyse deiner Erfolgsfaktoren zu erstellen.</p>
               )}
             </div>
          )}
          {isAdding ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 bg-stone-50 dark:bg-stone-800/50 p-4 rounded-xl border border-stone-100 dark:border-stone-700"
            >
              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1 block">Verbindung Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={matchName}
                    onChange={(e) => setMatchName(e.target.value)}
                    placeholder="Mit wem?"
                    className="w-full text-sm py-2 pl-9 pr-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1 block">Datum</label>
                <div className="relative">
                  <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-sm py-2 pl-9 pr-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1 block">Atmosphäre & Notizen</label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-3 text-stone-400" />
                  <textarea
                    value={atmosphere}
                    onChange={(e) => setAtmosphere(e.target.value)}
                    placeholder="Wie war die Stimmung? Was habt ihr gemacht?"
                    className="w-full text-sm py-2 pl-9 pr-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-violet-500/20 min-h-[80px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Wiedersehen geplant?</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSeeAgain('yes')}
                    className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border transition-colors ${seeAgain === 'yes' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 text-emerald-600' : 'bg-white border-stone-200 dark:bg-stone-800 dark:border-stone-700 text-stone-500 hover:bg-stone-50'}`}
                  >
                    <CheckCircle2 size={16} />
                    <span className="text-xs font-medium">Ja</span>
                  </button>
                  <button
                    onClick={() => setSeeAgain('maybe')}
                    className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border transition-colors ${seeAgain === 'maybe' ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 text-amber-600' : 'bg-white border-stone-200 dark:bg-stone-800 dark:border-stone-700 text-stone-500 hover:bg-stone-50'}`}
                  >
                    <HelpCircle size={16} />
                    <span className="text-xs font-medium">Vielleicht</span>
                  </button>
                  <button
                    onClick={() => setSeeAgain('no')}
                    className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border transition-colors ${seeAgain === 'no' ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 text-rose-600' : 'bg-white border-stone-200 dark:bg-stone-800 dark:border-stone-700 text-stone-500 hover:bg-stone-50'}`}
                  >
                    <XCircle size={16} />
                    <span className="text-xs font-medium">Nein</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-2 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 text-sm font-medium hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  disabled={!matchName || !date || !seeAgain}
                  className="flex-1 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Speichern
                </button>
              </div>
            </motion.div>
          ) : pastDates.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center py-8"
            >
              <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mb-3">
                <CalendarDays size={24} className="text-stone-300 dark:text-stone-600" />
              </div>
              <h4 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Keine Dates archiviert</h4>
              <p className="text-xs text-stone-500 max-w-[200px] mb-4">
                Dokumentiere hier deine vergangenen Dates und wie sie gelaufen sind.
              </p>
              <button
                onClick={() => setIsAdding(true)}
                className="text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-4 py-2 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors"
              >
                Erstes Date hinzufügen
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {pastDates.map(dateObj => {
                const status = getSeeAgainConfig(dateObj.seeAgain);
                const StatusIcon = status.icon;

                return (
                  <div key={dateObj.id} className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700 group relative">
                    <button aria-label="Date löschen"
                      onClick={() => {
                        const newDates = pastDates.filter(d => d.id !== dateObj.id);
                        setPastDates(newDates);
                        klarStorage.setItem("klar_past_dates_archive", JSON.stringify(newDates));
                      }}
                      className="absolute top-3 right-3 p-1 text-stone-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XCircle size={14} />
                    </button>

                    <div className="flex items-center justify-between mb-3 pr-6">
                      <div>
                        <h4 className="font-semibold text-stone-900 dark:text-stone-100">{dateObj.matchName}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          <CalendarDays size={12} />
                          {new Date(dateObj.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md ${status.bg} ${status.color}`}>
                        <StatusIcon size={12} />
                        Wiedersehen
                      </div>
                    </div>

                    {dateObj.atmosphere && (
                      <div className="bg-white dark:bg-stone-800 rounded-lg p-3 text-sm text-stone-700 dark:text-stone-300 border border-stone-100 dark:border-stone-700">
                        {dateObj.atmosphere}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
