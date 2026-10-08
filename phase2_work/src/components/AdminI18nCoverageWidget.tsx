import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { Globe, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';

interface MissingKey {
  id: string;
  lng: string;
  namespace: string;
  key: string;
  fallbackValue: string;
  timestamp: string;
  context: string;
}

export function AdminI18nCoverageWidget() {
  const [missingKeys, setMissingKeys] = useState<MissingKey[]>([]);

  const loadMissingKeys = () => {
    try {
      const keys = JSON.parse(klarStorage.getItem('klar_missing_i18n_keys') || '[]');
      setMissingKeys(keys.sort((a: MissingKey, b: MissingKey) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadMissingKeys();
    const handleUpdate = () => loadMissingKeys();
    window.addEventListener('klar-missing-i18n-updated', handleUpdate);
    return () => window.removeEventListener('klar-missing-i18n-updated', handleUpdate);
  }, []);

  const handleClear = () => {
    klarStorage.removeItem('klar_missing_i18n_keys');
    setMissingKeys([]);
  };

  return (
    <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="text-blue-500" size={20} />
          <h2 className="font-bold text-stone-900 dark:text-white">i18n Coverage & Fehlende Übersetzungen</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-stone-100 dark:bg-stone-700 px-2 py-1 rounded-md">
            Total Missing: {missingKeys.length}
          </span>
          {missingKeys.length > 0 && (
            <button
              onClick={handleClear}
              className="p-1.5 text-stone-400 hover:text-red-500 transition-colors bg-stone-100 dark:bg-stone-700 rounded-md"
              title="Alle leeren"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {missingKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-stone-400">
          <CheckCircle2 size={32} className="text-green-500 mb-2" />
          <p className="text-sm font-medium">Alle UI-Elemente sind vollständig übersetzt.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-700 text-xs text-stone-500 uppercase">
                <th className="pb-2 font-semibold">Schlüssel (Key)</th>
                <th className="pb-2 font-semibold">Sprache</th>
                <th className="pb-2 font-semibold">Fallback</th>
                <th className="pb-2 font-semibold">Kontext</th>
              </tr>
            </thead>
            <tbody>
              {missingKeys.map((item) => (
                <tr key={item.id} className="border-b border-stone-100 dark:border-stone-700/50 last:border-0">
                  <td className="py-2.5">
                    <span className="font-mono text-xs text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800/50 px-1.5 py-0.5 rounded">
                      {item.key}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className="text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1 w-max">
                      <AlertTriangle size={10} />
                      {item.lng.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 text-xs text-stone-600 dark:text-stone-400 max-w-[150px] truncate">
                    {item.fallbackValue || '-'}
                  </td>
                  <td className="py-2.5 text-xs text-stone-500 max-w-[100px] truncate">
                    {item.context}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
