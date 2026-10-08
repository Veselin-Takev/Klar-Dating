import { useMemo } from "react";
import { CalendarPlus, CalendarClock } from "lucide-react";

interface Message {
  role: 'user'|'verbindung';
  text: string;
}

interface ChatDateExtractorWidgetProps {
  messages: Message[];
  profileName: string;
}

export function ChatDateExtractorWidget({ messages, profileName }: ChatDateExtractorWidgetProps) {
  // Simple heuristic to find date proposals
  const extractedDate = useMemo(() => {
    const timeRegex = /(morgen|heute|freitag|samstag|sonntag|wochenende) (um|gegen)?\s?(\d{1,2}(:\d{2})?\s?(uhr|pm|am)?)/i;
    const activityRegex = /(kaffee|essen|spazieren|drink|bier|wein|kino|treffen)/i;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      // Skip very short or very long messages
      if (msg.text.length < 5 || msg.text.length > 200) continue;

      const timeMatch = msg.text.match(timeRegex);
      const activityMatch = msg.text.match(activityRegex);

      if (timeMatch || (activityMatch && (msg.text.toLowerCase().includes("wann") || msg.text.toLowerCase().includes("um")))) {
        return {
          id: i,
          title: `Date mit ${profileName}`,
          description: activityMatch ? `Vorgeschlagene Aktivität: ${activityMatch[0]}` : "Treffen",
          timeStr: timeMatch ? timeMatch[0] : "Bald",
          rawText: msg.text,
          role: msg.role
        };
      }
    }
    return null;
  }, [messages, profileName]);

  if (!extractedDate) return null;

  return (
    <div className="mx-4 my-2  from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20 border border-violet-100 dark:border-violet-800/50 rounded-2xl p-3 shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="bg-violet-100 dark:bg-violet-800/50 text-violet-600 dark:text-violet-300 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
          <CalendarClock size={20} />
        </div>
        <div className="overflow-hidden">
          <p className="text-xs font-semibold text-violet-900 dark:text-violet-100 flex items-center gap-1">
            Terminvorschlag erkannt
          </p>
          <p className="text-[11px] text-violet-700/80 dark:text-violet-300/80 truncate">
            "{extractedDate.timeStr}" – {extractedDate.description}
          </p>
        </div>
      </div>

      <button
        onClick={() => {
          const eventTitle = encodeURIComponent(extractedDate.title);
          const eventDetails = encodeURIComponent(`Vorgeschlagen von ${extractedDate.role === 'user' ? 'mir' : profileName}:\n"${extractedDate.rawText}"`);
          window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&details=${eventDetails}`, '_blank');
        }}
        className="ml-2 shrink-0 bg-violet-600 hover:bg-violet-700 text-white p-2 rounded-xl transition-colors flex items-center justify-center"
        title="In Kalender übernehmen"
      >
        <CalendarPlus size={18} />
      </button>
    </div>
  );
}
