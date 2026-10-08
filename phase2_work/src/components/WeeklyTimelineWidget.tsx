import { klarStorage } from '../lib/userScopedStorage';
import { fetchDatePlans } from '../lib/datePlans';
import { useState, useEffect, useRef } from "react";
import { Calendar, Clock, CheckCircle2, ChevronRight, Download, FileImage, FileText } from "lucide-react";
import { motion } from "motion/react";
// 12.08.2026: `html2canvas` -> `html2canvas-pro`. Der urspruengliche
// Paketstand versteht die Farbfunktion `oklch()` nicht, die Tailwind v4
// durchgehend verwendet — jeder PDF-Export brach mit „Attempting to
// parse an unsupported color function oklch" ab. Der Fork kann sie.
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import type { PlannedDate } from "./UpcomingDateWidget";

export function WeeklyTimelineWidget() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() || 7); // 1-7, 7 = Sunday
  const [dates, setDates] = useState<PlannedDate[]>([]);
  const [journals, setJournals] = useState<unknown[]>([]);

  useEffect(() => {
    void fetchDatePlans().then(setDates).catch(() => setDates([]));

    const journalsRaw = klarStorage.getItem('klar_dating_journals');
    if (journalsRaw) setJournals(JSON.parse(journalsRaw));
  }, []);

  const getWeekDays = () => {
    const today = new Date();
    const currentDay = today.getDay() || 7; // 1-7
    const result = [];

    // Start from Monday (1) to Sunday (7)
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - currentDay + i);
      result.push({
        id: i,
        name: d.toLocaleDateString("de-DE", { weekday: 'short' }),
        date: d.getDate(),
        fullDate: d.toISOString().split('T')[0],
        isToday: i === currentDay
      });
    }
    return result;
  };


  const exportAsImage = async () => {
    if (!widgetRef.current) return;
    try {
      const canvas = await html2canvas(widgetRef.current, { scale: 2, backgroundColor: null });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = "Klar-Dating-Timeline.png";
      link.click();
      setShowExportMenu(false);
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const exportAsPDF = async () => {
    if (!widgetRef.current) return;
    try {
      const canvas = await html2canvas(widgetRef.current, { scale: 2, backgroundColor: null });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save("Klar-Dating-Timeline.pdf");
      setShowExportMenu(false);
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  const weekDays = getWeekDays();
  const selectedDateObj = weekDays.find(d => d.id === selectedDay);

  // Find events for selected day
  const eventsForSelectedDay = dates.filter(d => d.date.startsWith(selectedDateObj?.fullDate || ""));
  const journalsForSelectedDay = journals.filter(j => j.date.startsWith(selectedDateObj?.fullDate || ""));

  return (
    <div ref={widgetRef} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Calendar size={20} className="text-indigo-500" />
            Deine Dating-Woche
          </h3>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-2 text-stone-400 hover:text-indigo-500 dark:hover:text-indigo-400 bg-stone-100 dark:bg-stone-800 rounded-full transition-colors"
            title="Exportieren"
          >
            <Download size={16} />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg z-50 overflow-hidden" data-html2canvas-ignore="true">
              <button
                onClick={exportAsImage}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
              >
                <FileImage size={16} className="text-indigo-500" />
                Als Bild (PNG)
              </button>
              <div className="h-px bg-stone-100 dark:bg-stone-700" />
              <button
                onClick={exportAsPDF}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
              >
                <FileText size={16} className="text-rose-500" />
                Als PDF
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        {weekDays.map(day => (
          <button
            key={day.id}
            onClick={() => setSelectedDay(day.id)}
            className={`flex flex-col items-center justify-center w-10 h-14 rounded-full transition-all ${
              selectedDay === day.id
                ? "bg-indigo-500 text-white shadow-md scale-110"
                : day.isToday
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                  : "bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
            }`}
          >
            <span className="text-[10px] uppercase font-bold">{day.name}</span>
            <span className="text-sm font-semibold">{day.date}</span>
          </button>
        ))}
      </div>

      <div className="min-h-[120px] bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-4 border border-stone-100 dark:border-stone-700">
        {eventsForSelectedDay.length === 0 && journalsForSelectedDay.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 dark:text-stone-500 py-6">
            <Clock size={24} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">Keine Events geplant.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventsForSelectedDay.map(event => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-stone-800 p-3 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between shadow-sm"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 mb-1 block">Date</span>
                  <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">{event.matchName}</h4>
                  <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5"><Clock size={12}/> {new Date(event.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit'})}</p>
                </div>
                <ChevronRight size={16} className="text-stone-400" />
              </motion.div>
            ))}

            {journalsForSelectedDay.map((journal, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-between shadow-sm"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Reflektiert
                  </span>
                  <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Journal-Eintrag</h4>
                  {journal.person && <p className="text-xs text-stone-500 mt-0.5">über {journal.person}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
