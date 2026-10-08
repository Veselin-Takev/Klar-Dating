import { useState } from "react";
import { Sparkles, MapPin, Heart, Compass, Navigation } from "lucide-react";
import { motion } from "motion/react";
import { melde } from "../lib/fehler";

interface VibeSpot {
  name: string;
  description: string;
  vibeMatch: string;
}

export function SmartVibeMapWidget({ location: initialLocation = "" }: { location?: string | null }) {
  const [location, setLocation] = useState(initialLocation || "Hamburg");
  const [vibes, setVibes] = useState<string[]>(["entspannt", "kreativ", "kulinarisch"]);
  const [spots, setSpots] = useState<VibeSpot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const popularVibes = ["entspannt", "romantisch", "abenteuerlich", "kreativ", "kulinarisch", "kulturell", "naturverbunden"];

  const handleFetch = async () => {
    if (!location || vibes.length === 0) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/smart-vibe-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, vibes: vibes })
      });
      const data = await response.text().then(text => text ? JSON.parse(text) : {});
      setSpots(data.spots || []);
    } catch (e) {
      melde("SmartVibeMapWidget", e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVibe = (vibe: string) => {
    if (vibes.includes(vibe)) {
      setVibes(vibes.filter(v => v !== vibe));
    } else {
      if (vibes.length < 3) {
        setVibes([...vibes, vibe]);
      }
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Compass size={20} className="text-fuchsia-500" />
            Smart-Vibe Map
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Locations, die zu euren Vibes passen
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {spots.length === 0 && !isLoading ? (
          <div className="space-y-4">
            <div className="relative">
              <MapPin size={16} className="absolute top-2.5 left-3 text-stone-400" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Stadt (z.B. Hamburg)"
                className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">Bevorzugte Vibes (max. 3)</p>
              <div className="flex flex-wrap gap-1.5">
                {popularVibes.map(vibe => (
                  <button
                    key={vibe}
                    onClick={() => toggleVibe(vibe)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                      vibes.includes(vibe)
                        ? 'bg-fuchsia-100 dark:bg-fuchsia-900/30 border-fuchsia-200 dark:border-fuchsia-800/50 text-fuchsia-700 dark:text-fuchsia-400'
                        : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
                    }`}
                  >
                    {vibe}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleFetch}
              disabled={!location || vibes.length === 0}
              className="w-full mt-2 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Navigation size={16} />
              Vibe-Spots entdecken
            </button>
          </div>
        ) : isLoading ? (
           <div className="flex flex-col items-center justify-center py-8 text-stone-500">
              <Sparkles className=" mb-3 text-fuchsia-500" size={24} />
              <p className="text-xs font-medium  text-center px-4">
                Mappe {vibes.join(", ")} Vibes für {location}...
              </p>
            </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {vibes.map(v => (
                  <span key={v} className="text-[9px] font-bold uppercase tracking-wider text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-100 dark:bg-fuchsia-900/30 px-1.5 py-0.5 rounded-md">
                    {v}
                  </span>
                ))}
              </div>
              <button onClick={() => setSpots([])} className="text-[10px] text-stone-400 hover:text-stone-600 underline shrink-0">Ändern</button>
            </div>

            <div className="space-y-3">
              {spots.map((spot, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={idx}
                  className="p-3 bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 rounded-xl"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-semibold text-sm text-stone-900 dark:text-stone-100">{spot.name}</h4>
                    <span className="text-[9px] font-bold tracking-wider text-stone-500 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                      <Heart size={10} className="text-fuchsia-500" />
                      {spot.vibeMatch}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-snug">{spot.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
