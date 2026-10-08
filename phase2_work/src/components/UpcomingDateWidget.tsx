import { klarStorage } from '../lib/userScopedStorage';
import { fetchDatePlans, type ServerPlannedDate } from '../lib/datePlans';
import { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Clock, MapPin, Bell, BellOff, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type PlannedDate = ServerPlannedDate;

const MOTIVATION_QUOTES = [
  "Sei einfach du selbst - das ist dein größter Trumpf!",
  "Atme tief durch. Du bist großartig, so wie du bist.",
  "Geh mit einem Lächeln rein und schau, was passiert.",
  "Es geht nicht darum perfekt zu sein, sondern echt.",
  "Hab Spaß und genieß den Moment!"
];

export function UpcomingDateWidget() {

  const [upcomingDate, setUpcomingDate] = useState<PlannedDate | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [showInAppToast, setShowInAppToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    const savedNotified = klarStorage.getItem('klar_notified_dates');
    if (savedNotified) {
      try {
        notifiedIdsRef.current = new Set(JSON.parse(savedNotified));
      } catch (e) { console.warn(e); ; }
    }
  }, []);

  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(p => setPermission(p));
    }
  };

  const triggerNotification = (dateId: string, matchName: string) => {
    if (notifiedIdsRef.current.has(dateId)) return;

    notifiedIdsRef.current.add(dateId);
    klarStorage.setItem('klar_notified_dates', JSON.stringify(Array.from(notifiedIdsRef.current)));

    const quote = MOTIVATION_QUOTES[Math.floor(0 * MOTIVATION_QUOTES.length)] || "Du packst das!";
    const title = `Date mit ${matchName}!`;

    if (permission === "granted" && "Notification" in window) {
      new Notification(title, { body: quote });
    }

    setToastMessage(quote);
    setShowInAppToast(true);
    setTimeout(() => setShowInAppToast(false), 8000);
  };

  useEffect(() => {
    const updateDate = async () => {
      try {
        const dates = await fetchDatePlans(); const now = new Date();
        const nextDate = dates.filter(d => new Date(d.date).getTime() > now.getTime() - 60 * 60 * 1000).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
        if (!nextDate) { setUpcomingDate(null); return; }
        setUpcomingDate(nextDate); const diffMs = new Date(nextDate.date).getTime() - now.getTime();
        if (diffMs <= 0) { setTimeRemaining('Jetzt!'); if (!notifiedIdsRef.current.has(nextDate.id)) triggerNotification(nextDate.id, nextDate.matchName); return; }
        if (diffMs <= 15 * 60 * 1000 && !notifiedIdsRef.current.has(nextDate.id + '_15m')) { notifiedIdsRef.current.add(nextDate.id + '_15m'); if (permission === 'granted' && 'Notification' in window) { const notif = new Notification('Date rückt näher!', { body: 'Dein Date startet in 15 Minuten.' }); notif.onclick = () => { window.location.href = '/rituals'; }; } setToastMessage('Dein Date startet in 15 Minuten.'); setShowInAppToast(true); setTimeout(() => setShowInAppToast(false), 8000); }
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)); const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)); setTimeRemaining(`In ${diffDays ? `${diffDays}t ` : ''}${diffHours ? `${diffHours}h ` : ''}${diffMinutes}m`);
      } catch { setUpcomingDate(null); }
    };
    void updateDate(); const interval = setInterval(() => void updateDate(), 1000); return () => clearInterval(interval);
  }, [permission]);

  if (!upcomingDate) return null;

  const d = new Date(upcomingDate.date);
  const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const dateStr = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <>
      <div className="bg-brand/5 dark:bg-brand-light/5 border border-brand/20 dark:border-brand-light/20 rounded-2xl p-4 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-brand dark:text-brand-light flex items-center gap-1.5">
            <CalendarIcon size={16} />
            Next Date
          </h3>
          <div className="flex items-center gap-2">
            {permission !== "granted" && (
              <button
                onClick={requestNotificationPermission}
                className="text-brand/50 hover:text-brand transition-colors p-1"
                title="Push-Benachrichtigungen aktivieren"
              >
                <BellOff size={14} />
              </button>
            )}
            <span className="text-xs font-bold text-brand dark:text-brand-light bg-brand/10 dark:bg-brand-light/10 px-2 py-1 rounded-full ">
              {timeRemaining}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-stone-900 dark:text-stone-100 truncate">
              {upcomingDate.matchName}
            </h4>
            <p className="text-sm text-stone-600 dark:text-stone-400 truncate flex items-center gap-1 mt-0.5">
              <MapPin size={12} /> {upcomingDate.idea}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-500 flex items-center gap-1 mt-0.5">
              <Clock size={12} /> {dateStr}, {timeStr} Uhr
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showInAppToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm"
          >
            <div className="bg-white dark:bg-stone-800 border border-brand/20 dark:border-brand-light/20 shadow-md rounded-2xl p-4 flex gap-3">
              <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand-light/10 flex flex-col items-center justify-center shrink-0 text-brand dark:text-brand-light">
                <Bell size={20} className="" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                  Es ist soweit: Date mit {upcomingDate.matchName}!
                </h4>
                <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">
                  {toastMessage}
                </p>
              </div>
              <button aria-label="Hinweis schließen"
                onClick={() => setShowInAppToast(false)}
                className="text-stone-400 hover:text-stone-600 self-start p-1"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
