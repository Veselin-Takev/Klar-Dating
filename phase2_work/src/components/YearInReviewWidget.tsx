import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { CalendarDays, Star } from "lucide-react";

interface DateHistoryEntry {
  id: string;
  matchName: string;
  title: string;
  date: string;
  rating?: number;
  note?: string;
  photo?: string;
}

export function YearInReviewWidget() {
  const [timeline, setTimeline] = useState<DateHistoryEntry[]>([]);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_history");
    if (saved) {
      try {
        const history: DateHistoryEntry[] = JSON.parse(saved);

        // Filter by current year and sort chronologically
        const yearDates = history.filter(entry => {
          try {
            const dateObj = new Date(entry.date);
            if (isNaN(dateObj.getTime())) return false;
            return dateObj.getFullYear() === currentYear;
          } catch (e) {
            return false;
          }
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setTimeline(yearDates);
      } catch (e) {
        console.warn("Failed to parse date history", e);
      }
    }
  }, [currentYear]);

  const getMoodTag = (rating?: number) => {
    if (!rating) return { label: "Neutral", color: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300" };
    if (rating >= 4) return { label: "Top Date", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
    if (rating === 3) return { label: "Ganz okay", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    return { label: "Eher nicht", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" };
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <CalendarDays size={18} className="text-brand dark:text-brand-light" />
            Jahresrückblick {currentYear}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Deine Dating-Timeline des laufenden Jahres
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
        {timeline.length > 0 ? (
          <div className="relative border-l-2 border-stone-100 dark:border-stone-700 ml-3 py-2 space-y-6">
            {timeline.map((entry, index) => {
              const mood = getMoodTag(entry.rating);
              return (
                <div key={entry.id || index} className="relative pl-6">
                  {/* Timeline dot */}
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white dark:bg-stone-800 border-2 border-brand dark:border-brand-light" />

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      {formatDate(entry.date)}
                    </span>
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Date mit {entry.matchName}
                    </h4>

                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${mood.color}`}>
                        {mood.label}
                      </span>
                      {entry.rating && (
                        <div className="flex items-center gap-0.5 bg-stone-50 dark:bg-stone-800 px-1.5 py-0.5 rounded-full">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={8}
                              className={i < entry.rating! ? "text-amber-400 fill-amber-400" : "text-stone-300 dark:text-stone-700"}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-sm text-stone-500 bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4 min-h-[150px]">
            Noch keine Dates in diesem Jahr geloggt.<br/>
            Deine Timeline füllt sich bald!
          </div>
        )}
      </div>
    </div>
  );
}
