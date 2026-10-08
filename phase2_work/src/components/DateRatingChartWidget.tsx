import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface DateHistoryEntry {
  id: string;
  matchName: string;
  title: string;
  date: string;
  rating?: number;
  note?: string;
}

export function DateRatingChartWidget() {
  const [data, setData] = useState<{name: string, value: number, color: string}[]>([]);

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_history");
    if (saved) {
      try {
        const history: DateHistoryEntry[] = JSON.parse(saved);

        let positive = 0;
        let neutral = 0;
        let negative = 0;

        history.forEach(entry => {
          if (entry.rating) {
            if (entry.rating >= 4) positive++;
            else if (entry.rating === 3) neutral++;
            else negative++;
          }
        });

        if (positive > 0 || neutral > 0 || negative > 0) {
          setData([
            { name: "Positiv", value: positive, color: "#10b981" }, // Emerald 500
            { name: "Neutral", value: neutral, color: "#f59e0b" },  // Amber 500
            { name: "Negativ", value: negative, color: "#ef4444" }, // Red 500
          ].filter(d => d.value > 0));
        } else {
          setData([]);
        }

      } catch (e) {
        console.warn("Failed to parse date history", e);
      }
    }
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <PieChartIcon size={18} className="text-brand dark:text-brand-light" />
            Date-Bewertungen
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Verteilung deiner Date-Erfahrungen
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
        {data.length > 0 ? (
          <div className="w-full h-full relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {/* BEFUND 11.08.2026: Der Schluessel enthielt einen
                      maskierten Platzhalter (Rueckstrich vor dem
                      Dollarzeichen). Dadurch bekam JEDES Segment denselben
                      Schluessel — React kann sie so nicht auseinanderhalten.
                      Nach dem Entfernen der Maskierung war `index` gar nicht
                      definiert: Die Rueckruffunktion nahm nur `entry`. Zwei
                      Fehler uebereinander, beide unsichtbar, weil der
                      Ausdruck als Text durchlief.
                      Bewacht von scripts/check-vorlagen.mjs. */}
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                {/* Der Tooltip-Formatter bleibt an die von Recharts erwartete
                    flexible Wertsignatur gekoppelt; der Wert wird erst fuer die
                    Anzeige in einen String ueberfuehrt. */}
                <Tooltip
                  formatter={(value: unknown) => [`${value} Dates`, 'Anzahl']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {data.map(entry => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-stone-600 dark:text-stone-300 font-medium">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-sm text-stone-500 bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4 w-full">
            Noch nicht genug bewertete Dates für eine Auswertung. <br/>
            Plane und bewerte Dates im Chat!
          </div>
        )}
      </div>
    </div>
  );
}
