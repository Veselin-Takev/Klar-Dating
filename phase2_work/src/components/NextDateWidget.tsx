import { fetchDatePlans, type ServerPlannedDate } from '../lib/datePlans';
import { useState, useEffect } from "react";
import { Clock, CalendarHeart, ExternalLink, Download } from "lucide-react";
import { motion } from "motion/react";

export function NextDateWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [nextDate, setNextDate] = useState<ServerPlannedDate | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    const updateDate = async () => {
      try {
        const parsedDates = await fetchDatePlans();
        const now = new Date();
        const futureDates = parsedDates.filter(d => new Date(d.date).getTime() > now.getTime() - 60 * 60 * 1000).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const upcoming = futureDates[0];
        setNextDate(upcoming ?? null);
        if (!upcoming) return;
        const diffMs = new Date(upcoming.date).getTime() - now.getTime();
        if (diffMs <= 0) { setTimeRemaining('Jetzt!'); setDaysRemaining(0); return; }
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setDaysRemaining(diffDays);
        const parts: string[] = []; if (diffDays > 0) parts.push(`${diffDays}t`); if (diffDays > 0 || diffHours > 0) parts.push(`${diffHours}h`); parts.push(`${diffMinutes}m`); setTimeRemaining(`In ${parts.join(' ')}`);
      } catch (e) { console.warn(e); setUiError('Date-Kalender konnte nicht geladen werden.'); }
    };
    void updateDate(); const interval = setInterval(() => void updateDate(), 60000); return () => clearInterval(interval);
  }, []);

  const downloadICS = (title: string, description: string, dateStr: string, matchName: string) => {
    const startDate = new Date(dateStr);
    const endDate = new Date(startDate.getTime() + 120 * 60000); // 2 hours

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Klar Dating//Date Planner//DE',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:Date mit ${matchName}`,
      `DESCRIPTION:${title} - ${description}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `date_${matchName.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openCalendar = () => {
    if (!nextDate) return;
    const start = new Date(nextDate.date);
    const end = new Date(start.getTime() + 120 * 60000);
    const format = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '').split('Z')[0] + 'Z';
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Date+mit+${encodeURIComponent(nextDate.matchName)}&dates=${format(start)}/${format(end)}&details=${encodeURIComponent(nextDate.idea || '')}`;
    window.open(url, '_blank');
  };

  if (!nextDate) {
    return (
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col justify-center items-center text-center relative z-10 overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

        <div className="w-12 h-12 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-4 text-stone-400 dark:text-stone-500">
          <CalendarHeart size={24} />
        </div>
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-1">Kein anstehendes Date</h3>
        <p className="text-xs text-stone-500 dark:text-stone-400">Nutze den Date Planner, um dein nächstes Date zu organisieren.</p>
      </div>
    );
  }

  const dateObj = new Date(nextDate.date);
  const formattedDate = dateObj.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'short' });
  const formattedTime = dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className=" from-brand/10 to-transparent dark:from-brand-light/10 dark:to-transparent border border-brand/20 dark:border-brand-light/20 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <CalendarHeart size={20} className="text-brand dark:text-brand-light" />
            Nächstes Date
          </h3>
          <p className="text-xs font-bold uppercase tracking-wider text-brand dark:text-brand-light mt-2 flex items-center gap-1.5">
            <Clock size={12} />
            {timeRemaining}
          </p>
        </div>

        {daysRemaining !== null && daysRemaining <= 1 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center justify-center bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded text-[10px] font-bold uppercase"
          >
            Bald!
          </motion.div>
        )}
      </div>

      <div className="flex-1 mt-2 space-y-4">
        <div>
          <h4 className="text-2xl font-serif text-stone-900 dark:text-stone-100 leading-tight">
            mit {nextDate.matchName}
          </h4>
          <p className="text-sm font-medium text-stone-600 dark:text-stone-400 mt-1 flex items-center gap-1.5">
            <CalendarHeart size={14} className="text-stone-400" />
            {formattedDate}, {formattedTime} Uhr
          </p>
        </div>

        <div className="bg-white/60 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/50 dark:border-stone-700/50 ">
          <p className="text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
            {nextDate.idea || "Keine spezifische Idee hinterlegt"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-brand/10 dark:border-brand-light/10">
        <button
          onClick={openCalendar}
          className="flex-1 py-2 px-2 bg-white dark:bg-stone-800 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors flex items-center justify-center gap-1.5"
        >
          <ExternalLink size={14} />
          Google
        </button>
        <button
          onClick={() => downloadICS(nextDate.idea || "Date", "Date Erinnerung", nextDate.date, nextDate.matchName)}
          className="flex-1 py-2 px-2 bg-white dark:bg-stone-800 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors flex items-center justify-center gap-1.5"
        >
          <Download size={14} />
          .ics
        </button>
      </div>
    </div>
  );
}
