import { useState, useRef, useMemo } from "react";
import { History, TrendingUp, Heart, Download, Image as ImageIcon, FileText, Plus, X, CalendarDays, CheckCircle, Sparkles, Target, Mic, FileSpreadsheet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "motion/react";
// 12.08.2026: `html2canvas` -> `html2canvas-pro`. Der urspruengliche
// Paketstand versteht die Farbfunktion `oklch()` nicht, die Tailwind v4
// durchgehend verwendet — jeder PDF-Export brach mit „Attempting to
// parse an unsupported color function oklch" ab. Der Fork kann sie.
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import { NotificationService } from "../services/notificationService";
import { melde } from "../lib/fehler";

type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type DateEntry = {
  id: number;
  date: string;
  name: string;
  mood: number;
  learning: string;
  type: string;
};

const initialPastDates: DateEntry[] = [
  { id: 1, date: "12. Mai", name: "Kaffee mit Anna", mood: 60, learning: "Guter Zuhörer, aber zu wenig von mir erzählt.", type: "Kennenlernen" },
  { id: 2, date: "28. Mai", name: "Spaziergang mit Lisa", mood: 75, learning: "Entspannter, wenn wir uns draußen bewegen.", type: "Erstes Date" },
  { id: 3, date: "15. Juni", name: "Dinner mit Sarah", mood: 70, learning: "Tiefgründige Themen erst später ansprechen.", type: "Folgedate" },
  { id: 4, date: "02. Juli", name: "Eisessen mit Mia", mood: 85, learning: "Ehrlich sein zahlt sich aus. Sehr authentisch.", type: "Kennenlernen" },
  { id: 5, date: "20. Juli", name: "Museum mit Julia", mood: 95, learning: "Gemeinsame Interessen machen alles leichter!", type: "Folgedate" },
];

const PREDEFINED_QUESTIONS = [
  "Was habe ich heute über mich selbst gelernt?",
  "Welches Gefühl hat dieses Date hauptsächlich in mir ausgelöst?",
  "Gab es Momente, in denen ich mich verstellt habe?",
  "Was würde ich beim nächsten Mal anders machen?",
  "Hat dieses Date meinen langfristigen Zielen gedient?",
];

export function DatingTimelineWidget() {
  const [dates, setDates] = useState<DateEntry[]>(initialPastDates);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ date: "", name: "", mood: 70, learning: "", type: "Erstes Date" });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [moodFilter, setMoodFilter] = useState<'all' | 'positive' | 'neutral' | 'reflective'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '7days' | '1month'>('all');

  const [aiSummary, setAiSummary] = useState<{ summary: string, trend: string } | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const widgetRef = useRef<HTMLDivElement>(null);

  const filteredDates = useMemo(() => {
    return dates.filter(d => {
      // Mood filter
      if (moodFilter === 'positive' && d.mood < 75) return false;
      if (moodFilter === 'neutral' && (d.mood < 40 || d.mood >= 75)) return false;
      if (moodFilter === 'reflective' && d.mood >= 40) return false;

      // Time filter (simplified string parsing for demo purposes)
      if (timeFilter !== 'all') {
        const entryMonth = d.date.split('.')[1]?.trim();
        const currentMonth = "Juli"; // Mocking current month
        if (timeFilter === '1month' && entryMonth !== currentMonth) return false;
      }
      return true;
    });
  }, [dates, timeFilter]);

  const avgMood = useMemo(() => {
    if (dates.length === 0) return 0;
    return Math.round(dates.reduce((acc, d) => acc + d.mood, 0) / dates.length);
  }, [dates]);

  const handleSaveEntry = () => {
    if (!newEntry.name || !newEntry.date) return;


    const d = new Date(newEntry.date);
    const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }).replace('.', '');

    const newDate = {
      id: Date.now(),
      date: dateStr,
      name: newEntry.name,
      mood: Number(newEntry.mood),
      learning: newEntry.learning,
      type: newEntry.type
    };

    const newDatesList = [...dates, newDate];
    setDates(newDatesList);

    if (newDatesList.length % 5 === 0 && newDatesList.length > 0) {
          }

    setShowAddForm(false);
    setNewEntry({ date: "", name: "", mood: 70, learning: "", type: "Erstes Date" });

    if (!newDate.learning.trim()) {
      setTimeout(() => {
        NotificationService.promptDateReflection(newDate.name);
      }, 3000); // remind after 3 seconds for demo purposes
    }
  };

  const startRecording = () => {
    const SpeechRecognition = (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      || (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Spracherkennung wird in diesem Browser nicht unterstützt.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
          };

    recognition.onresult = async (event: SpeechRecognitionEventLike) => {
      const result = event.results[0]?.[0];
      if (!result || typeof result.transcript !== 'string') return;
      const transcript = result.transcript;
      setIsRecording(false);

      setNewEntry(prev => ({ ...prev, learning: "Zusammenfassung wird erstellt..." }));
      try {
        const res = await fetch("/api/summarize-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcript })
        });
        if (res.ok) {
          const data = await res.text().then(text => text ? JSON.parse(text) : {});
          setNewEntry(prev => ({ ...prev, learning: data.summary }));
        } else {
          setNewEntry(prev => ({ ...prev, learning: transcript }));
        }
      } catch (e) {
        setNewEntry(prev => ({ ...prev, learning: transcript }));
      }
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };

  const handleGenerateQuestion = () => {
        const q = PREDEFINED_QUESTIONS[Math.floor(0 * PREDEFINED_QUESTIONS.length)];
    setNewEntry(prev => ({
      ...prev,
      learning: prev.learning ? prev.learning + "\n\nKI-Frage: " + q : "KI-Frage: " + q
    }));
  };

  const generateWeeklySummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const res = await fetch("/api/timeline-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: dates.slice(-5) })
      });
      if (res.ok) {
        const data = await res.text().then(text => text ? JSON.parse(text) : {});
        setAiSummary(data);
      }
    } catch (e) {
      melde("DatingTimelineWidget", e);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleExport = async (type: 'png' | 'pdf' | 'csv') => {
    if (!widgetRef.current) return;
    setIsExporting(true);
    setShowExportMenu(false);

    if (type === 'csv') {
      const csvContent = "data:text/csv;charset=utf-8,"
        + "Datum,Name,Typ,Stimmung,Lerneffekt\n"
        + dates.map(d => `${d.date},"${d.name}","${d.type}",${d.mood},"${(d.learning || '').replace(/"/g, '""')}"`).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.href = encodedUri;
      link.download = "dating-timeline.csv";
      link.click();
      setIsExporting(false);
      return;
    }

    try {
      const canvas = await html2canvas(widgetRef.current, {
        scale: 2,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1c1917' : '#ffffff',
        onclone: (document) => {
          const el = document.getElementById('timeline-export-container');
          if (el) {
            el.style.height = 'auto';
            el.style.overflow = 'visible';
            const scrollContainer = el.querySelector('.overflow-y-auto') as HTMLElement;
            if (scrollContainer) {
              scrollContainer.style.overflow = 'visible';
            }
          }
        }
      });

      const image = canvas.toDataURL("image/png");

      if (type === 'png') {
        const link = document.createElement("a");
        link.href = image;
        link.download = "dating-timeline.png";
        link.click();
      } else {
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(image, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save("dating-timeline.pdf");
      }
    } catch (error) {
      console.error("Export failed", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div id="timeline-export-container" ref={widgetRef} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative text-stone-900 dark:text-stone-100">

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2 text-stone-900 dark:text-stone-100">
            <History size={20} className="text-indigo-500" />
            Dating-Verlauf & Klar-Gefühl
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Deine Entwicklung über die letzten Dates
          </p>
        </div>

        <div className="relative flex items-center gap-2" data-html2canvas-ignore="true">
          <button
            onClick={() => {
                            setShowAddForm(true);
            }}
            disabled={isExporting}
            className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-full transition-colors flex items-center gap-1 disabled:opacity-50"
            title="Neuer Eintrag"
          >
            <Plus size={16} />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="p-2 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 rounded-full transition-colors flex items-center gap-1 disabled:opacity-50"
              title="Exportieren"
            >
              <Download size={16} />
            </button>

            <AnimatePresence>
            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg overflow-hidden z-50"
              >
                <button
                  onClick={() => handleExport('png')}
                  className="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2"
                >
                  <ImageIcon size={16} className="text-stone-500" /> Als Bild (PNG)
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2"
                >
                  <FileText size={16} className="text-stone-500" /> Als PDF
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2"
                >
                  <FileSpreadsheet size={16} className="text-stone-500" /> Als CSV
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Goal Progress and Average Summary */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 shrink-0">
        <div className="flex-1 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-2xl border border-stone-100 dark:border-stone-700">
          <div className="flex items-center gap-1.5 text-indigo-500 mb-1.5">
            <Target size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Ziel: Langfristige Beziehung</span>
          </div>
          <div className="w-full bg-stone-200 dark:bg-stone-700 rounded-full h-1.5 mb-1.5">
            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '65%' }}></div>
          </div>
          <p className="text-[10px] text-stone-500 dark:text-stone-400">Gut auf Kurs basierend auf deinen letzten 5 Dates.</p>
        </div>

        <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-2xl border border-stone-100 dark:border-stone-700 min-w-[120px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Ø Stimmung (30d)</span>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-stone-800 dark:text-stone-100 leading-none">{avgMood}%</span>
            <TrendingUp size={14} className={avgMood > 70 ? "text-emerald-500 mb-0.5" : "text-amber-500 mb-0.5"} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 shrink-0">
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
          {(['all', 'positive', 'neutral', 'reflective'] as const).map(f => (
            <button
              key={f}
              onClick={() => {
                                setMoodFilter(f);
              }}
              className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${moodFilter === f ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
            >
              {f === 'all' ? 'Alle' : f === 'positive' ? 'Positiv' : f === 'neutral' ? 'Neutral' : 'Reflektierend'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
          {(['all', '7days', '1month'] as const).map(f => (
            <button
              key={f}
              onClick={() => {
                                setTimeFilter(f);
              }}
              className={`px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${timeFilter === f ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
            >
              {f === 'all' ? 'Immer' : f === '7days' ? '7 Tage' : '1 Monat'}
            </button>
          ))}
        </div>
      </div>


      {/* Mini Calendar */}
      <div className="mb-4 shrink-0 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-2xl border border-stone-100 dark:border-stone-700">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">Aktivitätskalender</h4>
        <div className="flex gap-1 overflow-x-auto hide-scrollbar pb-1">
          {Array.from({length: 14}).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (13 - i));
            const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }).replace('.', '');
            const hasEntry = dates.some(entry => entry.date === dateStr);
            return (
              <button
                key={i}
                onClick={() => {
                                    const el = document.getElementById(`entry-${dateStr}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-stone-900');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-stone-900'), 1500);
                  }
                }}
                className={`flex-shrink-0 w-8 flex flex-col items-center justify-center py-1.5 rounded-lg transition-all ${hasEntry ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
              >
                <span className="text-[9px] font-medium uppercase mb-0.5">{d.toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                <span className={`text-xs font-bold ${hasEntry ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>{d.getDate()}</span>
                {hasEntry && <span className="w-1 h-1 rounded-full bg-indigo-500 mt-1" />}
              </button>
            )
          })}
        </div>
      </div>
\n      {/* Chart */}
      <div className="h-32 mb-4 w-full shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredDates} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-stone-200 dark:text-stone-800" />
            <XAxis className="text-stone-500 dark:text-stone-400" dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8b5cf6' }} />
            <YAxis className="text-stone-500 dark:text-stone-400" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor' }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tw-colors-white, #1c1917)' }}
              itemStyle={{ color: '#4f46e5', fontSize: '12px', fontWeight: 600 }}
              labelStyle={{ color: '#6b7280', fontSize: '10px', marginBottom: '4px' }}
            />
            <Line
              type="monotone"
              dataKey="mood"
              name="Klar-Gefühl"
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Calendar Indicator */}
      <div className="flex items-center justify-between gap-1 mb-6 shrink-0 bg-stone-50 dark:bg-stone-800/50 p-2 rounded-xl">
        {Array.from({length: 7}).map((_, i) => {
          const isDateDay = i === 1 || i === 4; // Mocking activity days
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[8px] text-stone-400 font-medium">{['Mo','Di','Mi','Do','Fr','Sa','So'][i]}</span>
              <div className={`w-2 h-2 rounded-full ${isDateDay ? 'bg-indigo-500' : 'bg-stone-200 dark:bg-stone-700'}`} />
            </div>
          )
        })}
        <button
          onClick={generateWeeklySummary}
          disabled={isGeneratingSummary}
          className="ml-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-colors"
        >
          {isGeneratingSummary ? <span className="w-3 h-3 bg-current opacity-50 rounded-full "></span> : <Sparkles size={12} />}
          KI-Wochenfazit
        </button>
      </div>

      {aiSummary && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 p-3 rounded-2xl shrink-0">
          <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 mb-1">
            <Sparkles size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">Dein KI-Trend: {aiSummary.trend}</span>
          </div>
          <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{aiSummary.summary}</p>
        </motion.div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 relative">
        {filteredDates.slice().reverse().map((date, index) => (
          <motion.div
            key={date.id}
            id={`entry-${date.date}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative pl-6"
          >
            {index !== filteredDates.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-[-24px] w-px bg-stone-200 dark:bg-stone-800" />
            )}

            <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center border-2 border-white dark:border-stone-900 z-10">
              <CalendarDays size={10} className="text-indigo-500" />
            </div>

            <div className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-3 border border-stone-100 dark:border-stone-700">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{date.name}</h4>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400">{date.type}</span>
                </div>
                <span className="text-[10px] font-medium text-stone-500 bg-white dark:bg-stone-800 px-2 py-0.5 rounded-full border border-stone-200 dark:border-stone-700">
                  {date.date}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mb-2 mt-1">
                <Heart size={12} className={date.mood >= 80 ? "text-rose-500" : date.mood < 40 ? "text-amber-500" : "text-stone-400"} />
                <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                  Stimmung: {date.mood}%
                </span>
              </div>

              <div className="bg-white dark:bg-stone-800 p-2.5 rounded-xl border border-stone-100 dark:border-stone-700">
                <div className="flex items-center gap-1.5 mb-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Lerneffekt</span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed whitespace-pre-wrap">
                  {date.learning}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
        {filteredDates.length === 0 && (
          <div className="text-center py-8 text-stone-500 dark:text-stone-400 text-sm">
            Keine Einträge für diese Filter gefunden.
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-40 bg-white dark:bg-stone-800 rounded-3xl p-6 flex flex-col h-full border border-stone-200 dark:border-stone-700"
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100">Neuer Tagebucheintrag</h3>
              <button aria-label="Formular schließen"
                onClick={() => setShowAddForm(false)}
                className="p-2 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 rounded-full bg-stone-100 dark:bg-stone-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="verlauf-datum" className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Datum</label>
                  <input
                    id="verlauf-datum"
                    name="verlauf-datum"
                    type="date"
                    value={newEntry.date}
                    onChange={e => setNewEntry({...newEntry, date: e.target.value})}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label htmlFor="verlauf-typ" className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Date-Typ</label>
                  <select
                    id="verlauf-typ"
                    name="verlauf-typ"
                    value={newEntry.type}
                    onChange={e => setNewEntry({...newEntry, type: e.target.value})}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-stone-900 dark:text-stone-100"
                  >
                    <option>Erstes Date</option>
                    <option>Kennenlernen</option>
                    <option>Folgedate</option>
                    <option>Freunde treffen</option>
                    <option>Anderes</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="verlauf-aktivitaet" className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">Aktivität / Person</label>
                <input
                  id="verlauf-aktivitaet"
                  name="verlauf-aktivitaet"
                  type="text"
                  placeholder="z.B. Kaffee mit Anna"
                  value={newEntry.name}
                  onChange={e => setNewEntry({...newEntry, name: e.target.value})}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-stone-900 dark:text-stone-100"
                />
              </div>
              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <label htmlFor="verlauf-stimmung" className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Stimmung ({newEntry.mood}%)
                  </label>
                  <span className="text-[10px] text-stone-400">{newEntry.mood >= 75 ? 'Positiv' : newEntry.mood >= 40 ? 'Neutral' : 'Reflektierend'}</span>
                </div>
                <input
                  id="verlauf-stimmung"
                  name="verlauf-stimmung"
                  type="range"
                  min="0" max="100"
                  value={newEntry.mood}
                  onChange={e => setNewEntry({...newEntry, mood: Number(e.target.value)})}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="verlauf-notiz" className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Notiz / Lerneffekt</label>
                  <div className="flex gap-2">
                    <button onClick={startRecording} className={`text-[10px] font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${isRecording ? 'bg-rose-50 text-rose-500 ' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-700'}`}>
                      <Mic size={10} /> {isRecording ? 'Höre zu...' : 'Sprache'}
                    </button>
                    <button onClick={handleGenerateQuestion} className="text-[10px] text-indigo-500 font-medium flex items-center gap-1 hover:text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">
                      <Sparkles size={10} /> KI-Reflexion
                    </button>
                  </div>
                </div>
                <textarea
                  id="verlauf-notiz"
                  name="verlauf-notiz"
                  placeholder="Was hast du gelernt? Wie war es?"
                  value={newEntry.learning}
                  onChange={e => setNewEntry({...newEntry, learning: e.target.value})}
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            <div className="pt-4 mt-auto border-t border-stone-100 dark:border-stone-700 shrink-0">
              <button
                onClick={handleSaveEntry}
                disabled={!newEntry.date || !newEntry.name}
                className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} />
                Eintrag speichern
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
          </div>
  );
}
