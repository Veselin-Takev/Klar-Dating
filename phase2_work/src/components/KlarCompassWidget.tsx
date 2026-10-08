import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Compass, Sparkles, Target, Heart } from "lucide-react";
import { motion } from "motion/react";

interface KlarCompassWidgetProps {
  userInterests: string[];
}

export function KlarCompassWidget({ userInterests }: KlarCompassWidgetProps) {
  const [compassData, setCompassData] = useState<{
    topTraits: string[];
    complementaryInterests: string[];
    focusAdvice: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchCompass = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const savedBio = klarStorage.getItem("userBio") || "";
        const res = await fetch("/api/klar-compass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userInterests, userBio: savedBio })
        });

        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.text().then(text => text ? JSON.parse(text) : {});
        setCompassData(data);
      } catch (e) {
        console.warn("Failed to load compass", e);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    // We might want to cache this in klarStorage to avoid repeated API calls
    const cached = klarStorage.getItem("klar_compass_data");
    const cacheTime = klarStorage.getItem("klar_compass_time");

    // Refresh every 24 hours or if not present
    const isCacheValid = cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 24 * 60 * 60 * 1000;

    if (isCacheValid) {
      setCompassData(JSON.parse(cached));
    } else {
      fetchCompass();
    }
  // 14.08.2026: am Inhalt statt an der Kennung — siehe
  // scripts/effekt-abhaengigkeiten.mjs. `userInterests` ist ein Feld;
  // ein Elternteil, der es bei jedem Rendern neu bildet, loeste sonst
  // bei jedem Rendern einen Netzaufruf aus.
  }, [userInterests.join('|')]);

  // Save to cache when loaded
  useEffect(() => {
    if (compassData) {
      klarStorage.setItem("klar_compass_data", JSON.stringify(compassData));
      klarStorage.setItem("klar_compass_time", Date.now().toString());
    }
  }, [compassData]);

  if (error && !compassData) return null;

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-5 border border-stone-200 dark:border-stone-700 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 dark:bg-brand-light/5 rounded-bl-full -z-10" />

      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light rounded-xl">
          <Compass size={20} />
        </div>
        <div>
          <h3 className="font-serif font-medium text-lg text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
            Klar-Kompass
            <Sparkles size={14} className="text-brand dark:text-brand-light" />
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Dein Fokus für Qualitäts-Verbindungen</p>
        </div>
      </div>

      {isLoading && !compassData ? (
        <div className="space-y-4 ">
          <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-3/4" />
          <div className="h-20 bg-stone-100 dark:bg-stone-800 rounded-xl" />
        </div>
      ) : compassData ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <p className="text-sm text-stone-700 dark:text-stone-300 italic border-l-2 border-brand/30 pl-3 py-1">
            "{compassData.focusAdvice}"
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl border border-stone-100 dark:border-stone-700">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100 mb-2 uppercase tracking-wide">
                <Target size={14} className="text-brand" />
                Passende Werte
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(compassData.topTraits || []).map((trait, i) => (
                  <span key={i} className="text-[11px] px-2 py-1 bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-md text-stone-700 dark:text-stone-300">
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl border border-stone-100 dark:border-stone-700">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100 mb-2 uppercase tracking-wide">
                <Heart size={14} className="text-rose-500" />
                Ergänzende Interessen
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(compassData.complementaryInterests || []).map((interest, i) => (
                  <span key={i} className="text-[11px] px-2 py-1 bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-md text-stone-700 dark:text-stone-300">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
