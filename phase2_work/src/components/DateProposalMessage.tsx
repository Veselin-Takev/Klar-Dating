import { useState } from "react";
import { CalendarDays, Clock, CheckCheck, Bell } from "lucide-react";

interface DateProposalMessageProps {
  msg: unknown;
  profileName: string;
}

export function DateProposalMessage({ msg, profileName }: DateProposalMessageProps) {
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [remindersSet, setRemindersSet] = useState(false);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderDate) return;

    const date = new Date(reminderDate);
    if (isNaN(date.getTime())) return;

    if (!("Notification" in window)) {
      alert("Dein Browser unterstützt keine lokalen Benachrichtigungen.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const now = new Date().getTime();
      const targetTime = date.getTime();

      const time24h = targetTime - 24 * 60 * 60 * 1000;
      const time1h = targetTime - 1 * 60 * 60 * 1000;
      const time15m = targetTime - 15 * 60 * 1000;

      if (time24h > now) {
        setTimeout(() => {
          new Notification("Date Erinnerung", { body: `Morgen ist dein Date: ${msg.proposalDetails.title}!` });
        }, time24h - now);
      }

      if (time1h > now) {
        setTimeout(() => {
          new Notification("Date Erinnerung", { body: `In einer Stunde ist dein Date: ${msg.proposalDetails.title}!` });
        }, time1h - now);
      }

      if (time15m > now) {
        setTimeout(() => {
          const notif = new Notification("Bereit fürs Date?", {
            body: "Zeit für dein 2-Minuten Dating-Ritual (Atemübungen), um entspannt zu starten. Tippe hier!"
          });
          notif.onclick = () => {
             window.open(window.location.origin + '/rituals', '_blank');
          };
        }, time15m - now);
      }

      // Confirm scheduling
      new Notification("Erinnerungen geplant", {
        body: `Wir erinnern dich 24h, 1h und 15 Minuten (Ritual-Reminder) vor deinem Date am ${date.toLocaleDateString('de-DE')}.`,
      });

      setRemindersSet(true);
      setShowReminderPicker(false);
    }
  };

  const role = msg.role;
  const details = msg.proposalDetails;

  return (
    <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
      role === 'user'
        ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-tr-sm'
        : 'bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-tl-sm'
    }`}>
      <div className="flex flex-col gap-2 mb-1 mt-1">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <CalendarDays size={16} /> Date-Vorschlag
        </div>
        <div className={`p-3 rounded-xl ${role === 'user' ? 'bg-white/20' : 'bg-stone-50 dark:bg-stone-800'}`}>
          <h5 className="font-medium text-sm mb-1">{details.title}</h5>
          <p className="text-xs opacity-90 mb-2">{details.description}</p>
          <div className="flex items-center gap-1 text-xs opacity-90 mb-3">
            <Clock size={12} /> {details.time}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                const eventTitle = encodeURIComponent(`Date mit ${role === 'user' ? profileName : 'Mir'}: ${details.title}`);
                const eventDetails = encodeURIComponent(details.description);
                window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&details=${eventDetails}`, '_blank');
              }}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                role === 'user'
                  ? 'bg-white text-brand hover:bg-white/90'
                  : 'bg-brand text-white hover:bg-brand/90'
              }`}
            >
              <CalendarDays size={14} />
              In Kalender eintragen
            </button>

            {!remindersSet ? (
              <button
                onClick={() => setShowReminderPicker(!showReminderPicker)}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  role === 'user'
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-800 dark:text-stone-200'
                }`}
              >
                <Bell size={14} />
                Erinnerungen aktivieren
              </button>
            ) : (
              <div className={`text-center text-[10px] py-1 ${role === 'user' ? 'text-white/80' : 'text-stone-500'}`}>
                Erinnerungen inkl. Ritual-Reminder aktiviert ✓
              </div>
            )}

            {showReminderPicker && !remindersSet && (
              <form onSubmit={handleSchedule} className="mt-2 flex flex-col gap-2">
                <input
                  type="datetime-local"
                  required
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className={`w-full p-2 text-xs rounded-lg border ${
                    role === 'user'
                      ? 'bg-white text-stone-900 border-white/50'
                      : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-600'
                  }`}
                />
                <button
                  type="submit"
                  className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    role === 'user'
                      ? 'bg-white text-brand hover:bg-white/90'
                      : 'bg-brand text-white hover:bg-brand/90'
                  }`}
                >
                  Speichern
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      {role === 'user' && (
        <div className="flex justify-end mt-1">
          <CheckCheck size={14} className={msg.isRead ? "text-blue-500" : "text-brand-light/70 dark:text-brand/50"} />
        </div>
      )}
    </div>
  );
}
