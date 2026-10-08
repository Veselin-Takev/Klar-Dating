import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect, useRef } from "react";
import { Compass, HeartHandshake, EyeOff, ShieldAlert, Sparkles, CheckCircle2, BellOff, Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const COMPATIBILITY_PROFILES = [
  {
    id: "verbindung-1",
    initials: "M. K.",
    distance: "5 km",
    interests: ["Kunst", "Tiefgründige Gespräche", "Kaffee"],
    communicationStyle: "Analytisch & Ruhig",
    compatibilityScore: 92,
    matchReason: "Ihr schätzt beide tiefgründige Gespräche und habt einen ähnlichen analytischen Ansatz beim Dating.",
    values: ["Langfristigkeit", "Tiefgründigkeit"]
  },
  {
    id: "verbindung-2",
    initials: "J. S.",
    distance: "12 km",
    interests: ["Natur", "Achtsamkeit", "Lesen"],
    communicationStyle: "Intuitiv & Direkt",
    compatibilityScore: 88,
    matchReason: "Eure gemeinsamen Interessen an Achtsamkeit und Natur bieten eine tolle Basis für entspannte erste Dates.",
    values: ["Aktivitätslevel", "Natur"]
  },
  {
    id: "verbindung-3",
    initials: "T. B.",
    distance: "3 km",
    interests: ["Slow Food", "Podcasts", "Design"],
    communicationStyle: "Bedacht & Offen",
    compatibilityScore: 85,
    matchReason: "Euer bedachter Kommunikationsstil passt sehr gut zusammen. Ihr beide lasst euch gerne Zeit beim Kennenlernen.",
    values: ["Langfristigkeit", "Genuss"]
  },
  {
    id: "verbindung-4",
    initials: "L. R.",
    distance: "2 km",
    interests: ["Comedy", "Ausgehen", "Konzerte"],
    communicationStyle: "Humorvoll & Direkt",
    compatibilityScore: 89,
    matchReason: "Ein ähnlicher Humor und die Vorliebe für lockere Abende versprechen viel Spaß und Leichtigkeit.",
    values: ["Spaß", "Leichtigkeit"]
  }
];

export function MatchCompassWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [activeProfileIndex, setActiveProfileIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<'interested' | 'pass' | null>(null);

  const [permission, setPermission] = useState<NotificationPermission>("default");
  const notifiedMatchesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
    const savedNotified = klarStorage.getItem('klar_notified_matches');
    if (savedNotified) {
      try {
        notifiedMatchesRef.current = new Set(JSON.parse(savedNotified));
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(p => setPermission(p));
    }
  };

  const filteredProfiles = selectedFilter
    ? COMPATIBILITY_PROFILES.filter(p => p.values.includes(selectedFilter) ||
      (selectedFilter === "Langfristigkeit" && p.values.includes("Tiefgründigkeit")) ||
      (selectedFilter === "Spaß" && p.values.includes("Leichtigkeit")) ||
      (selectedFilter === "Aktivitätslevel" && p.values.includes("Natur")))
    : COMPATIBILITY_PROFILES;

  const currentProfile = filteredProfiles[activeProfileIndex];

  useEffect(() => {
    if (currentProfile && !notifiedMatchesRef.current.has(currentProfile.id) && permission === "granted" && "Notification" in window) {
      const timer = setTimeout(() => {
        new Notification("Neuer Verbindung-Vorschlag!", {
          body: `Person ${currentProfile.initials} passt zu deinem Kommunikationsstil (${currentProfile.compatibilityScore}% Übereinstimmung).`,
        });
        notifiedMatchesRef.current.add(currentProfile.id);
        klarStorage.setItem('klar_notified_matches', JSON.stringify(Array.from(notifiedMatchesRef.current)));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentProfile, permission]);

  if (!currentProfile && activeProfileIndex !== -1) return null;

  const handleNext = () => {
    setFeedback(null);

    if (activeProfileIndex < filteredProfiles.length - 1) {
      setActiveProfileIndex(prev => prev + 1);
    } else {
      setActiveProfileIndex(-1); // Finished
    }
  };

  const handleInterest = (isInterested: boolean) => {
    setFeedback(isInterested ? 'interested' : 'pass');
    setTimeout(() => {
      handleNext();
    }, 1500);
  };

  if (activeProfileIndex === -1 || !currentProfile) {
    return (
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col justify-center items-center text-center">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

        <div className="w-16 h-16 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h3 className="font-serif text-xl text-stone-900 dark:text-stone-100 mb-2">
          Alle Vorschläge angesehen
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Wir melden uns diskret, sobald es eine beidseitige Übereinstimmung gibt.
        </p>
        <button
          onClick={() => setActiveProfileIndex(0)}
          className="mt-6 px-6 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 rounded-xl text-sm font-medium transition-colors"
        >
          Nochmal ansehen
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Compass className="text-brand dark:text-brand-light" size={20} />
          Verbindung-Kompass
        </h3>
        <div className="flex items-center gap-2">
          {permission !== "granted" && (
            <button
              onClick={requestNotificationPermission}
              className="text-stone-400 hover:text-brand dark:hover:text-brand-light transition-colors p-1"
              title="Push-Benachrichtigungen für neue Verbindungen aktivieren"
            >
              <BellOff size={16} />
            </button>
          )}
          <span className="text-xs font-medium bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light px-2 py-1 rounded-md">
            {activeProfileIndex + 1} / {filteredProfiles.length}
          </span>
        </div>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 mb-4 pb-1">
        {["Alle", "Langfristigkeit", "Spaß", "Aktivitätslevel"].map(filter => (
          <button
            key={filter}
            onClick={() => {
              setSelectedFilter(filter === "Alle" ? null : filter);
              setActiveProfileIndex(0);
              setFeedback(null);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              (selectedFilter === filter || (filter === "Alle" && !selectedFilter))
                ? 'bg-stone-800 text-stone-100 dark:bg-stone-100 dark:text-stone-900'
                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            {filter === "Alle" && <Filter size={12} className="inline mr-1" />}
            {filter}
          </button>
        ))}
      </div>

      <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
        Diskrete Vorschläge basierend auf deinen Werten und deinem Kommunikationsstil. Nur echte Kontakte.
      </p>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {feedback ? (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/90 dark:bg-stone-800/90 rounded-2xl"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${feedback === 'interested' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'}`}>
                {feedback === 'interested' ? <HeartHandshake size={32} /> : <EyeOff size={32} />}
              </div>
              <p className="font-medium text-stone-900 dark:text-stone-100">
                {feedback === 'interested' ? 'Interesse diskret hinterlegt' : 'Vorschlag übersprungen'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={currentProfile.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-700 rounded-2xl p-5"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-stone-200 dark:bg-stone-800 rounded-full flex items-center justify-center text-lg font-serif text-stone-600 dark:text-stone-300">
                    {currentProfile.initials}
                  </div>
                  <div>
                    <h4 className="font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
                      Person {currentProfile.initials}
                      <ShieldAlert size={14} className="text-emerald-500"  />
                    </h4>
                    <span className="text-xs text-stone-500">{currentProfile.distance} entfernt</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-serif text-brand dark:text-brand-light">{currentProfile.compatibilityScore}%</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Verbindung-Score</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">Gemeinsame Interessen</span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentProfile.interests.map((interest, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md text-xs text-stone-700 dark:text-stone-300">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1 block">Kommunikationsstil</span>
                  <p className="text-sm text-stone-800 dark:text-stone-200 font-medium">
                    {currentProfile.communicationStyle}
                  </p>
                </div>

                <div className="bg-brand/5 dark:bg-brand-light/5 rounded-xl p-3 border border-brand/10 dark:border-brand-light/10">
                  <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed flex gap-2">
                    <Sparkles size={14} className="text-brand dark:text-brand-light shrink-0 mt-0.5" />
                    {currentProfile.matchReason}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => handleInterest(false)}
                  className="flex-1 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 rounded-xl text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
                >
                  <EyeOff size={16} /> Passt nicht
                </button>
                <button
                  onClick={() => handleInterest(true)}
                  className="flex-1 py-2.5 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm"
                >
                  <HeartHandshake size={16} /> Diskret merken
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
