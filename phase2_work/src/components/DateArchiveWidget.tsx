import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { MoodCalendarGridWidget } from "./MoodCalendarGridWidget";
import { Archive, TrendingUp, Lightbulb, Sparkles, CalendarDays, Upload, FileUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fetchDateArchiveAnalysis, fetchDateSummary } from "../lib/api";
import { melde } from "../lib/fehler";

interface Reflection {
  id: string;
  date: string;
  notes?: string;
  positive?: string;
  negative?: string;
  learned?: string;
  insight?: string;
  matchName?: string;
  aiSummary?: {
    moments: string[];
    learnings: string[];
  };
}

interface AnalysisResult {
  patterns: string[];
  learning: string;
}

export function DateArchiveWidget() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_reflections");
    if (saved) {
      setReflections(JSON.parse(saved));
    }
  }, []);

  // Auto-generate summaries
  useEffect(() => {
    const generateSummaries = async () => {
      const missingSummary = reflections.find(r => !r.aiSummary && (r.positive || r.notes));
      if (missingSummary && !generatingFor) {
        setGeneratingFor(missingSummary.id);
        try {
          const summary = await fetchDateSummary(missingSummary);
          const updated = reflections.map(r => r.id === missingSummary.id ? { ...r, aiSummary: summary } : r);
          setReflections(updated);
          klarStorage.setItem("klar_date_reflections", JSON.stringify(updated));
        } catch (e) {
          melde("Fehler bei Auto-Zusammenfassung", e);
        } finally {
          setGeneratingFor(null);
        }
      }
    };
    if (reflections.length > 0) {
      generateSummaries();
    }
  }, [reflections, generatingFor]);


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        parseCSV(text);
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    if (lines.length < 2) return;

    const newReflections: Reflection[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawLine = lines[i];
      if (!rawLine) continue;
      const line = rawLine.trim();
      if (!line) continue;

      // Basic CSV parsing
      const row: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current.trim());

      const dateStr = row[0] || new Date().toISOString();
      const notes = row[1] || "";
      const insight = row[2] || "";

      if (notes) {
        newReflections.push({
          id: Date.now().toString() + "0".substr(2, 9),
          date: dateStr,
          notes: notes,
          insight: insight
        });
      }
    }

    if (newReflections.length > 0) {
      const updated = [...newReflections, ...reflections];
      setReflections(updated);
      klarStorage.setItem("klar_date_reflections", JSON.stringify(updated));
    }
  };

  const handleAnalyze = async () => {
    if (reflections.length === 0) return;

    setIsLoading(true);
    setError(null);
    setShowAnalysis(true);

    try {
      const result = await fetchDateArchiveAnalysis(reflections);
      setAnalysis(result);
    } catch (e) {
      melde("DateArchiveWidget", e);
      setError("Konnte Archiv nicht analysieren.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col relative z-10">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Archive size={18} className="text-violet-500 dark:text-violet-400" />
            Date-Archiv & Muster
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Lerne aus vergangenen Dates
          </p>
        </div>
        <div className="text-xs font-semibold px-2 py-1 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-md shrink-0">
          {reflections.length} Dates
        </div>
      </div>

      <div className="mb-4"><MoodCalendarGridWidget /></div>
      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        {reflections.length === 0 ? (

          <div className="text-center py-6 text-sm text-stone-500 bg-stone-50 dark:bg-stone-800/50 rounded-xl flex flex-col items-center gap-3">
            Noch keine Dates im Journal protokolliert.
            <label className="cursor-pointer inline-flex items-center gap-2 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors">
              <Upload size={14} />
              Historie als CSV importieren
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

        ) : (
          <div className="space-y-4">
            {!showAnalysis ? (

              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={handleAnalyze}
                    className="flex-1 flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Sparkles size={16} />
                    KI-Musteranalyse
                  </button>
                  <label className="cursor-pointer shrink-0 flex items-center justify-center bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 w-10 h-10 rounded-xl transition-colors" title="CSV Import">
                    <FileUp size={16} />
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Vergangene Dates</h4>
                  {reflections.slice().reverse().map((ref) => (
                    <div key={ref.id} className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
                          <CalendarDays size={12} />
                          {new Date(ref.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                          {ref.matchName && <span className="ml-1 px-1.5 py-0.5 bg-stone-200 dark:bg-stone-700 rounded-md">{ref.matchName}</span>}
                        </div>
                      </div>

                      {ref.aiSummary ? (
                        <div className="space-y-3 mt-2">
                          <div>
                            <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider block mb-1">KI-Momente</span>
                            <ul className="space-y-1">
                              {(ref.aiSummary?.moments || []).map((m, i) => (
                                <li key={i} className="text-xs text-stone-700 dark:text-stone-300 flex gap-1.5 items-start">
                                  <span className="text-violet-400 mt-0.5">•</span> {m}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Lerneffekte</span>
                            <ul className="space-y-1">
                              {(ref.aiSummary?.learnings || []).map((l, i) => (
                                <li key={i} className="text-xs text-stone-700 dark:text-stone-300 flex gap-1.5 items-start">
                                  <span className="text-amber-400 mt-0.5">•</span> {l}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : generatingFor === ref.id ? (
                        <div className="flex items-center gap-2 text-xs text-stone-500  mt-2">
                          <Sparkles size={12} className="text-violet-500" />
                          Erstelle KI-Zusammenfassung...
                        </div>
                      ) : (
                        <p className="text-sm text-stone-700 dark:text-stone-300 line-clamp-2">
                          {ref.positive || ref.notes || "Keine Notizen verfügbar."}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-8 text-stone-500"
                  >
                    <Sparkles className=" mb-3 text-violet-500" size={24} />
                    <p className="text-sm font-medium ">Analysiere Erfolgsmuster...</p>
                  </motion.div>
                ) : error ? (
                  <div className="text-center py-6 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl">
                    {error}
                    <button onClick={() => setShowAnalysis(false)} className="mt-2 text-xs underline block mx-auto">Zurück</button>
                  </div>
                ) : analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="p-4 bg-violet-50 dark:bg-violet-500/10 rounded-xl border border-violet-100 dark:border-violet-800">
                      <h4 className="text-sm font-semibold text-violet-900 dark:text-violet-100 flex items-center gap-2 mb-3">
                        <TrendingUp size={16} className="text-violet-500" />
                        Erfolgsmuster
                      </h4>
                      <ul className="space-y-2">
                        {(analysis?.patterns || []).map((pattern, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-violet-800 dark:text-violet-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                            {pattern}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-800">
                      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2 mb-2">
                        <Lightbulb size={16} className="text-amber-500" />
                        Lernpunkt
                      </h4>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        {analysis.learning}
                      </p>
                    </div>

                    <button
                      onClick={() => setShowAnalysis(false)}
                      className="w-full py-2 text-sm font-medium text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
                    >
                      Zurück zum Archiv
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
