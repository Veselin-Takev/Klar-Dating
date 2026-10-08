import { useState, useEffect } from 'react';
import { getAppLogs, clearAppLogs, type AppLogEntry } from '../lib/appLogs';
import { Terminal, RefreshCw, Trash2, X, AlertTriangle, Bug, Info, FileText, ChevronRight } from 'lucide-react';

export function AdminLogViewerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'log'>('all');
  const [selectedLog, setSelectedLog] = useState<AppLogEntry | null>(null);

  const refreshLogs = () => {
    setLogs(getAppLogs(20));
  };

  useEffect(() => {
    if (isOpen) {
      refreshLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'error') return l.level === 'error';
    if (filter === 'warn') return l.level === 'warn';
    return l.level === 'log' || l.level === 'info';
  });

  const getBadge = (level: AppLogEntry['level']) => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
            <Bug size={12} /> ERROR
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <AlertTriangle size={12} /> WARN
          </span>
        );
      case 'info':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            <Info size={12} /> INFO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300">
            <FileText size={12} /> LOG
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light">
              <Terminal size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base text-stone-900 dark:text-white flex items-center gap-2">
                <span>Konsole & App-Fehlerprotokoll</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                  Letzte 20 Einträge
                </span>
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Echtzeit-Aufzeichnung von `console.log`, Warnungen und abgefangenen Exceptions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshLogs}
              className="p-2 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              title="Aktualisieren"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => {
                clearAppLogs();
                refreshLogs();
              }}
              className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
              title="Protokoll leeren"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Schließen"
              title="Schließen"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-4 py-2 bg-stone-100/50 dark:bg-stone-800/40 border-b border-stone-200 dark:border-stone-800 flex items-center gap-2 text-xs">
          <span className="text-stone-500 font-medium mr-1">Filter:</span>
          {(['all', 'error', 'warn', 'log'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {f === 'all' ? 'Alle' : f === 'error' ? 'Nur Fehler' : f === 'warn' ? 'Nur Warnungen' : 'Logs & Info'}
            </button>
          ))}
          <span className="ml-auto text-stone-400">
            {filteredLogs.length} Eintrag/Einträge angezeigt
          </span>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-sm">
              Keine entsprechenden Log-Einträge vorhanden.
            </div>
          ) : (
            <div className="overflow-x-auto border border-stone-200 dark:border-stone-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-700">
                    <th className="p-3 w-24">Zeit</th>
                    <th className="p-3 w-24">Typ</th>
                    <th className="p-3">Nachricht / Payload</th>
                    <th className="p-3 w-16 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800 font-mono">
                  {filteredLogs.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedLog(item)}
                      className="hover:bg-stone-50 dark:hover:bg-stone-800/60 cursor-pointer transition-colors"
                    >
                      <td className="p-3 text-stone-500 whitespace-nowrap">{item.timestamp}</td>
                      <td className="p-3">{getBadge(item.level)}</td>
                      <td className="p-3 text-stone-800 dark:text-stone-200 max-w-md truncate font-sans">
                        {item.message}
                      </td>
                      <td className="p-3 text-right">
                        <ChevronRight size={14} className="text-stone-400 inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Expanded detail viewer */}
          {selectedLog && (
            <div className="mt-4 p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getBadge(selectedLog.level)}
                  <span className="text-xs font-mono text-stone-500">{selectedLog.timestamp}</span>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                >
                  Schließen
                </button>
              </div>
              <div className="p-3 rounded-lg bg-stone-900 text-stone-100 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-48 select-all">
                {selectedLog.message}
                {selectedLog.stack && (
                  <div className="mt-2 pt-2 border-t border-stone-800 text-rose-300 text-[11px]">
                    {selectedLog.stack}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
