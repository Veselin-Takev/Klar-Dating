import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { Flame, MessageCircle, Heart, X, Sparkles } from "lucide-react";
import { melde } from "../lib/fehler";

interface ProgressData {
  tonalityOverTime: {
    section: string;
    score: number;
    theme: string;
  }[];
  topics: {
    name: string;
    count: number;
  }[];
}

interface RelationshipProgressWidgetProps {
  chatHistory: { role: 'user' | 'verbindung', text: string }[];
  userName: string;
  targetName: string;
  onClose?: () => void;
}

export function RelationshipProgressWidget({ chatHistory, userName, targetName, onClose }: RelationshipProgressWidgetProps) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/analyze-relationship", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatHistory, userName, targetName })
        });

        if (!res.ok) {
          throw new Error("Fehler bei der Analyse.");
        }

        const result = await res.text().then(text => text ? JSON.parse(text) : {});
        setData(result);
      } catch (e) {
        melde("RelationshipProgressWidget", e);
        setError("Die Chat-Analyse konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    }

    if (chatHistory.length >= 2) {
      fetchData();
    } else {
      setIsLoading(false);
      setError("Nicht genug Nachrichten für eine aussagekräftige Analyse.");
    }
  // 14.08.2026: `chatHistory` ist ein Feld — am Inhalt haengen, nicht an
  // der Kennung. Die Laenge genuegt hier: Der Effekt wertet den Verlauf
  // aus, und ein Verlauf aendert sich, indem er waechst.
  }, [chatHistory.length, userName, targetName]);

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Heart size={18} className="text-brand dark:text-brand-light" />
            Beziehungsfortschritt
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            KI-Analyse von Tonalität und Hauptthemen
          </p>
        </div>
        {onClose && (
          <button aria-label="Analyse schließen" onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors bg-stone-100 dark:bg-stone-800 p-1.5 rounded-full">
            <X size={16} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-stone-500">
          <Sparkles className=" mb-3 text-brand dark:text-brand-light" size={24} />
          <p className="text-sm font-medium ">Analysiere Chat-Verlauf...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-sm text-rose-500 bg-rose-50 dark:bg-rose-900/10 rounded-xl">
          {error}
        </div>
      ) : data && (
        <div className="space-y-8">
          {/* Tonality Chart */}
          <div>
            <h4 className="text-xs font-semibold text-stone-800 dark:text-stone-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Flame size={14} className="text-orange-500" />
              Tonalitätswandel (Wärme)
            </h4>
            <div className="h-48 w-full -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.tonalityOverTime} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-stone-200 dark:text-stone-700" opacity={0.5} />
                  <XAxis className="text-stone-500 dark:text-stone-400"
                    dataKey="section"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                  />
                  <YAxis className="text-stone-500 dark:text-stone-400"
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                    labelStyle={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}
                    formatter={(value: unknown, _name: unknown, props: { payload?: { theme?: string } }) => {
                      const heat = typeof value === 'number' ? value : Number(value ?? 0);
                      const label = String(Number.isFinite(heat) ? heat : 0) + '% Wärme';
                      return [label, props.payload?.theme ?? ''];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Topics Chart */}
          <div>
            <h4 className="text-xs font-semibold text-stone-800 dark:text-stone-300 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <MessageCircle size={14} className="text-blue-500" />
              Themenhäufung
            </h4>
            <div className="h-40 w-full -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topics} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <XAxis className="text-stone-500 dark:text-stone-400" type="number" hide />
                  <YAxis className="text-stone-500 dark:text-stone-400"
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={80}
                    tick={{ fontSize: 10, fill: 'var(--color-stone-600)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.1)', padding: '4px 8px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 500, color: '#3b82f6' }}
                    formatter={(value: unknown) => [`${value} Erwähnungen`, 'Häufigkeit']}
                    labelStyle={{ display: 'none' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {data.topics.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
