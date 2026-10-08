import { useState, useEffect } from 'react';
import { perfTracker } from '../lib/performanceTracker';
import { Activity, Gauge, Database, ChevronDown, ChevronUp, X, RotateCcw } from 'lucide-react';

export function DevPerformanceOverlay() {
  const [reads, setReads] = useState(perfTracker.getFirestoreReads());
  const [renders, setRenders] = useState(perfTracker.getRenderDurations());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    return perfTracker.subscribe(() => {
      setReads(perfTracker.getFirestoreReads());
      setRenders(perfTracker.getRenderDurations());
    });
  }, []);

  // Also estimate current main component render time
  useEffect(() => {
    const t0 = performance.now();
    const timer = setTimeout(() => {
      const duration = performance.now() - t0;
      perfTracker.recordRenderDuration('MainLayout', duration);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  const renderEntries = Object.entries(renders);
  const latestDuration = renderEntries.length > 0 ? (renderEntries[renderEntries.length - 1]?.[1] ?? 0) : 0;

  return (
    <aside
      aria-label="Entwickler-Performance-Overlay"
      className="fixed bottom-16 right-3 z-[990] font-sans select-none"
    >
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 bg-stone-900/90 hover:bg-stone-900 text-stone-100 dark:bg-stone-100/90 dark:hover:bg-stone-100 dark:text-stone-900 px-3 py-1.5 rounded-full shadow-lg border border-stone-700/50 dark:border-stone-300 text-xs backdrop-blur-xs transition-all cursor-pointer"
          title="Performance-Overlay öffnen"
        >
          <Gauge size={13} className="text-emerald-400 dark:text-emerald-600 animate-pulse" />
          <span className="font-mono font-medium">{latestDuration}ms</span>
          <span className="opacity-40">|</span>
          <Database size={12} className="text-sky-400 dark:text-sky-600" />
          <span className="font-mono">{reads} Reads</span>
          <ChevronUp size={12} className="opacity-70" />
        </button>
      ) : (
        <div className="bg-stone-900/95 text-stone-100 dark:bg-stone-800/95 dark:text-stone-100 p-4 rounded-2xl shadow-2xl border border-stone-700/80 w-72 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-stone-800 mb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Activity size={14} />
              <span>Dev Performance</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => perfTracker.resetSession()}
                className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-stone-200"
                title="Session zurücksetzen"
              >
                <RotateCcw size={12} />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-stone-200"
                aria-label="Minimieren"
                title="Minimieren"
              >
                <ChevronDown size={14} />
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-stone-200"
                title="Ausblenden"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Firestore Reads Counter */}
          <div className="bg-stone-800/80 p-2.5 rounded-xl mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
                <Database size={15} />
              </div>
              <div>
                <div className="text-[11px] text-stone-400 font-medium">Firestore Reads</div>
                <div className="text-xs text-stone-300">Diese Session</div>
              </div>
            </div>
            <div className="text-lg font-mono font-bold text-sky-400">
              {reads}
            </div>
          </div>

          {/* Component Render Durations */}
          <div>
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Render-Dauer</span>
              <span className="font-mono text-[10px] text-stone-500">Ziel: &lt;16ms (60fps)</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {renderEntries.length === 0 ? (
                <div className="text-xs text-stone-500 italic py-1">Initialisiere Messung...</div>
              ) : (
                renderEntries.map(([comp, dur]) => (
                  <div key={comp} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-stone-800/50">
                    <span className="truncate max-w-[150px] text-stone-300">{comp}</span>
                    <span className={`font-mono font-medium ${
                      dur < 16 ? 'text-emerald-400' : dur < 30 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {dur} ms
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
