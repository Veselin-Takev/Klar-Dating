import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { MessageSquare, Copy, Check, Search } from "lucide-react";

export function RecentIntrosWidget({ onSelect }: { onSelect?: (text: string) => void }) {
  const [recentIntros, setRecentIntros] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    // Load from local storage initially
    const loadIntros = () => {
      try {
        const saved: unknown = JSON.parse(klarStorage.getItem("klar_saved_smart_intros") || "[]");
        setRecentIntros(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : []);
      } catch (e) {
        console.warn("Failed to parse saved intros", e);
      }
    };

    loadIntros();

    // Check periodically for new intros
    const interval = setInterval(loadIntros, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (e: React.MouseEvent, text: string, idx: number) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (recentIntros.length === 0) return null;

  const filteredIntros = recentIntros
    .filter(intro => intro.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 5);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 p-1.5 rounded-lg">
          <MessageSquare size={16} />
        </div>
        <h3 className="font-semibold text-stone-900 dark:text-stone-100">Zuletzt generierte Intros</h3>
      </div>

      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-stone-400" />
        </div>
        <input
          type="text"
          placeholder="In Entwürfen suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 dark:focus:ring-brand-light/20 transition-all dark:text-stone-100 placeholder:text-stone-400"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {["Hobby", "Reisen", "Humor", "Musik", "Essen"].map(tag => (
          <button
            key={tag}
            onClick={() => setSearchTerm(searchTerm === tag ? "" : tag)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              searchTerm === tag
                ? "bg-brand dark:bg-brand-light text-white"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredIntros.length > 0 ? (
          filteredIntros.map((intro, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700/50 group ${onSelect ? "cursor-pointer hover:border-brand/30 dark:hover:border-brand-light/30" : ""}`}
              onClick={() => onSelect && onSelect(intro)}
            >
              <p className="text-sm text-stone-700 dark:text-stone-300 italic flex-1 leading-relaxed">
                "{intro}"
              </p>
              <button
                onClick={(e) => handleCopy(e, intro, idx)}
                className="p-2 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-brand dark:hover:text-brand-light transition-colors shadow-sm shrink-0"
                title="Kopieren"
              >
                {copiedIndex === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-stone-500 dark:text-stone-400 text-center py-4">Keine passenden Intros gefunden.</p>
        )}
      </div>
    </div>
  );
}
