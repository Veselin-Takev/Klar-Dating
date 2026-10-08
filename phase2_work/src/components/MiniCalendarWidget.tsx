import { klarStorage } from '../lib/userScopedStorage';
import { fetchDatePlans, fetchDateAvailability } from '../lib/datePlans';
import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

export function MiniCalendarWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [plannedDates, setPlannedDates] = useState<string[]>([]);
  const [availDates, setAvailDates] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());


  useEffect(() => {
    const saved = klarStorage.getItem('klar_dating_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHistoryDates(parsed.map((p: unknown) => p.date));
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }

    void Promise.all([fetchDatePlans(), fetchDateAvailability()]).then(([plans, avails]) => {
      setPlannedDates(plans.map(p => new Date(p.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }).replace('.', '')));
      setAvailDates(avails.map(p => new Date(p.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }).replace('.', '')));
    }).catch(() => setUiError('Kalenderdaten konnten nicht geladen werden.'));

  }, []);


  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  // Adjust so Monday is 0
  const startDay = firstDay === 0 ? 6 : firstDay - 1;

  const monthName = currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleDayClick = (day: number) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }).replace('.', '');


    const el = document.getElementById(`entry-${dateStr}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-brand', 'dark:ring-brand-light', 'ring-offset-2', 'dark:ring-offset-stone-900', 'transition-shadow');
      setTimeout(() => el.classList.remove('ring-2', 'ring-brand', 'dark:ring-brand-light', 'ring-offset-2', 'dark:ring-offset-stone-900'), 2000);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm h-full flex flex-col justify-center">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <CalendarIcon size={18} className="text-brand dark:text-brand-light" />
          Date-Kalender
        </h3>
        <div className="flex items-center gap-2">
          <button aria-label="Vorheriger Monat" onClick={prevMonth} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"><ChevronLeft size={16} /></button>
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 min-w-[70px] text-center">{monthName}</span>
          <button aria-label="Nächster Monat" onClick={nextMonth} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
          <div key={d} className="text-[10px] font-semibold text-stone-400">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1 content-start">
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="w-full aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
          const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }).replace('.', '');
          const hasEntry = historyDates.includes(dateStr);
          const isPlanned = plannedDates.includes(dateStr);
          const isAvail = availDates.includes(dateStr);
          const isToday = new Date().toDateString() === d.toDateString();

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              disabled={!hasEntry && !isPlanned && !isAvail}
              className={`w-full aspect-square rounded-full flex items-center justify-center text-[11px] font-medium transition-all relative ${
                hasEntry
                  ? 'bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light hover:bg-brand/20 dark:hover:bg-brand-light/20 cursor-pointer'
                  : 'text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800'
              } ${isToday && !hasEntry ? 'border border-stone-200 dark:border-stone-700' : ''}`}
            >
              {day}
              {isPlanned && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-rose-500" />
              )}
              {!isPlanned && isAvail && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
              )}
              {!isPlanned && !isAvail && hasEntry && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-brand dark:bg-brand-light" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
