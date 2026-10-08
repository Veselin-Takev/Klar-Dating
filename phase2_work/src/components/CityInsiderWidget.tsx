import { useState } from "react";
import { MapPin, Coffee, Cloud, Sparkles, BookOpen, TreePine } from "lucide-react";
import { motion } from "motion/react";
import { melde } from "../lib/fehler";

interface InsiderLocation {
  name: string;
  description: string;
  category: string;
}

export function CityInsiderWidget({ location: initialLocation = "" }: { location?: string | null }) {
  const [location, setLocation] = useState(initialLocation || "Berlin");
  const [weather, setWeather] = useState("Sonnig");
  const [locations, setLocations] = useState<InsiderLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const weathers = ["Sonnig", "Regnerisch", "Bewölkt", "Kalt", "Stürmisch", "Heiß"];

  const handleFetch = async () => {
    if (!location) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/city-insider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, weather })
      });
      const data = await response.text().then(text => text ? JSON.parse(text) : {});
      setLocations(data.locations || []);
    } catch (e) {
      melde("CityInsiderWidget", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("buch") || cat.includes("book")) return <BookOpen size={16} />;
    if (cat.includes("park") || cat.includes("natur") || cat.includes("tree")) return <TreePine size={16} />;
    return <Coffee size={16} />;
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Sparkles size={20} className="text-indigo-500" />
            City Insider
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Ruhige Date-Spots nach Wetter
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {locations.length === 0 && !isLoading ? (
          <div className="space-y-3">
            <div className="relative">
              <MapPin size={16} className="absolute top-2.5 left-3 text-stone-400" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Stadt (z.B. Berlin)"
                className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="relative">
              <Cloud size={16} className="absolute top-2.5 left-3 text-stone-400" />
              <select
                value={weather}
                onChange={e => setWeather(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
              >
                {weathers.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>

            <button
              onClick={handleFetch}
              disabled={!location}
              className="w-full mt-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              Geheimtipps finden
            </button>
          </div>
        ) : isLoading ? (
           <div className="flex flex-col items-center justify-center py-8 text-stone-500">
              <Sparkles className=" mb-3 text-indigo-500" size={24} />
              <p className="text-xs font-medium  text-center px-4">
                Suche nach versteckten Perlen in {location}...
              </p>
            </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-medium text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">
                {location} • {weather}
              </div>
              <button onClick={() => setLocations([])} className="text-[10px] text-stone-400 hover:text-stone-600 underline">Neu</button>
            </div>

            <div className="space-y-3">
              {locations.map((loc, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={idx}
                  className="p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-xl"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-semibold text-sm text-indigo-900 dark:text-indigo-100 flex items-center gap-1.5">
                      <span className="text-indigo-500">{getIcon(loc.category)}</span>
                      {loc.name}
                    </h4>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-md shrink-0">{loc.category}</span>
                  </div>
                  <p className="text-xs text-stone-700 dark:text-stone-300 leading-snug pl-5">{loc.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
