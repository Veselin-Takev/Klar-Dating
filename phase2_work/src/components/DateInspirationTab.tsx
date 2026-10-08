import React, { useState, useEffect } from 'react';
import { getUserStorageItem } from '../lib/userScopedStorage';
import { MapPin, Sparkles, Heart, RefreshCw } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// ── WAS HIER AM 14.08.2026 ENTFERNT WURDE ─────────────────────────────────
// Im Kopf des Bildschirms stand neben einem Wettersymbol eine Temperatur.
// Sie kam aus `0`:
//
//     // Simulate weather API call
//     const isRaining = false;
//     const temp = 0 + 5;
//
// Ohne Koordinaten stand dort fest eingebaut „20 °C, sonnig" — eine Zahl,
// die nicht einmal wechselte. Beides ging ausserdem als `weather` an
// `/api/date-inspiration` und stand dort im Prompt: Die KI richtete
// ihre Date-Ideen nach einem Wetter, das niemand gemessen hatte.
//
// Entscheidung vom 14.08.2026: gestrichen. Der Wetterteil ist auch aus dem
// Prompt auf dem Server entfernt.
//
// WIEDERVORLAGE: Wenn eine echte Wetterquelle drankommt, gehoert sie an
//   diese Stelle und an `/api/date-inspiration` zurueck. Sie braucht
//   einen eigenen Endpunkt, damit die Koordinaten nicht vom Geraet aus zu
//   einem Dritten gehen, dazu einen Zwischenspeicher (das Wetter aendert
//   sich nicht im Minutentakt) und einen ehrlichen Fehlerfall: Steht keine
//   Auskunft zur Verfuegung, wird KEIN Wetter angezeigt statt eines
//   angenommenen. Nicht betroffen sind `SmartDatePlannerWidget` und
//   `CityInsiderWidget` — dort WAEHLT die Person das Wetter selbst aus
//   einer Liste, das ist eine Angabe und keine Behauptung der App.
// ═══════════════════════════════════════════════════════════════════════════
import { auth } from '../lib/firebase';

export const DateInspirationTab: React.FC<{ userInterests?: string[], userCoords?: {lat: number, lng: number} | null }> = ({ userInterests = [], userCoords }) => {
  const [uiError, setUiError] = useState<string | null>(null);

  const [ideas, setIdeas] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [city, setCity] = useState<string>("Deinem Standort");

  const fetchInspiration = async () => {
    setIsLoading(true);
    try {
      // ENTFERNT 14.08.2026: Hier standen `0`-Wetter und ein fest
      // eingebautes „20 °C, sonnig" fuer den Fall ohne Koordinaten. Beides
      // ging als `weather` in den KI-Prompt und stand als Zahl im Kopf des
      // Bildschirms. Siehe den Kommentar am Anfang der Datei.
      if (userCoords) setCity("Aktueller Standort");

      let interestsToUse = userInterests;
      if (!interestsToUse || interestsToUse.length === 0) {
        const saved = getUserStorageItem('userInterests');
        if (saved) {
           try { interestsToUse = JSON.parse(saved); } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
        }
      }

      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/date-inspiration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({ interests: (Array.isArray(interestsToUse) ? interestsToUse.join(", ") : "Allgemein") })
      });
      if (!res.ok) throw new Error("API failed");
      const data = await res.text().then(text => text ? JSON.parse(text) : {});
      setIdeas(data.ideas || []);
    } catch (err) {
      console.error("Failed to load date inspiration", err);
      setIdeas([
        {
          title: "Kaffee & Spaziergang",
          description: "Ein klassisches Date, das immer funktioniert. Holt euch einen Kaffee und geht durch den Park.",
          category: "Casual",
          whyItWorks: "Bietet eine entspannte Atmosphäre zum Reden."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInspiration();
  }, [userCoords, userInterests]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-stone-800 rounded-3xl p-4 shadow-sm border border-stone-100 dark:border-stone-700 relative overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="absolute top-0 left-0 w-full h-32  from-brand/10 to-transparent dark:from-brand-light/10 z-0"></div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif text-stone-900 dark:text-stone-100">Date Inspiration</h2>
          <Sparkles className="text-brand dark:text-brand-light" size={24} />
        </div>

        <div className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-4 mb-6 flex items-center justify-between border border-stone-100 dark:border-stone-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-sm text-brand dark:text-brand-light">
              <MapPin size={20} />
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Dein Standort</p>
              <p className="font-semibold text-stone-900 dark:text-stone-100">{city}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mb-4 -mx-4 px-4 pb-4">
          {isLoading ? (
            <div className="flex flex-col gap-4 "><div className="h-32 bg-stone-100 dark:bg-stone-800 rounded-2xl"></div><div className="h-32 bg-stone-100 dark:bg-stone-800 rounded-2xl"></div></div>
          ) : (
            <div className="flex flex-col gap-4">
              {ideas.map((idea, idx) => (
                <div key={idx} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-lg text-xs font-bold uppercase tracking-wide">
                      {idea.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-serif font-medium text-stone-900 dark:text-stone-100 mb-2">{idea.title}</h3>
                  <p className="text-sm text-stone-600 dark:text-stone-300 mb-4 leading-relaxed">{idea.description}</p>

                  <div className="bg-brand/5 dark:bg-brand-light/5 p-3 rounded-xl flex items-start gap-2">
                    <Heart className="text-brand dark:text-brand-light shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-brand-dark dark:text-brand-light/90 font-medium">{idea.whyItWorks}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={fetchInspiration}
          disabled={isLoading}
          className="w-full mt-auto py-3 px-4 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shrink-0 disabled:opacity-70"
        >
          {isLoading ? <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700  mb-3"></div> : <RefreshCw size={18} />}
          Neue Ideen generieren
        </button>
      </div>
    </div>
  );
};
