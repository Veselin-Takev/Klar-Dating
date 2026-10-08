import { useState, useEffect } from "react";
import { MessageCircle, Sparkles, Send } from "lucide-react";
import { Link } from "react-router";

export function MatchIcebreakersWidget({ profiles = [] }: { profiles?: Array<{ id: string; name: string; age: number; interests: string[]; photoUrl?: string }> }) {
  const [icebreakers, setIcebreakers] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Generating icebreakers
    setIcebreakers({
      [profiles[0]?.id || 'p1']: "Hi! Ich sehe du magst Kaffee. Welches ist dein Lieblings-Café?",
      [profiles[1]?.id || 'p2']: "Wow, du bist auch oft mit dem Fahrrad unterwegs? Was ist deine Lieblingsroute?",
      [profiles[2]?.id || 'p3']: "Guten Morgen! Hast du am Wochenende auch so gutes Wetter genossen?"
    });
  }, []);

  const generateNew = (id: string) => {
    setIsGenerating(true);
    setTimeout(() => {
      setIcebreakers(prev => ({
        ...prev,
        [id]: "Hey, tolles Profil! Hast du Lust am Wochenende was zu unternehmen?"
      }));
      setIsGenerating(false);
    }, 1000);
  };

  const verbindungen = profiles.slice(0, 3);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle size={20} className="text-brand" />
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Icebreaker-Vorschläge</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">KI-generiert für deine aktiven Verbindungen</p>
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto max-h-80 pr-2">
        {verbindungen.map(profile => (
          <div key={profile.id} className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border border-stone-100 dark:border-stone-700">
            <div className="flex items-center gap-3 mb-3">
              <img src={profile.photoUrl || ""} alt={profile.name} className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1">
                <span className="font-medium text-sm text-stone-900 dark:text-stone-100">{profile.name}</span>
                <span className="text-xs text-stone-500 block">Neues Verbindung</span>
              </div>
            </div>

            <div className="bg-white dark:bg-stone-800 border border-brand/20 rounded-xl p-3 text-sm text-stone-700 dark:text-stone-300 relative group">
              <Sparkles size={14} className="absolute top-3 right-3 text-brand opacity-50" />
              <p className="pr-6 italic">"{icebreakers[profile.id] || 'Lade Icebreaker...'}"</p>

              <div className="flex gap-2 mt-3">
                <Link
                  to={`/chat/${profile.id}`}
                  className="flex-1 py-1.5 bg-brand text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 hover:opacity-90 transition-opacity"
                >
                  <Send size={12} /> Senden
                </Link>
                <button aria-label="Neue Vorschläge erzeugen"
                  onClick={() => generateNew(profile.id)}
                  disabled={isGenerating}
                  className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg text-xs font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
