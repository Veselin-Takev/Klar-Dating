import { klarStorage } from '../lib/userScopedStorage';
import { fetchDatePlans } from '../lib/datePlans';
import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Link } from 'react-router';

export function DashboardDateBanner() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [visible, setVisible] = useState(false);
  const [pastDate, setPastDate] = useState<unknown>(null);

  useEffect(() => {
    void fetchDatePlans().then(dates => {
      const savedLogs = klarStorage.getItem('klar_reflection_logs'); const logs = savedLogs ? JSON.parse(savedLogs) : []; const now = new Date();
      const past24hDates = dates.filter(d => (now.getTime() - new Date(d.date).getTime()) / (1000 * 60 * 60) > 24);
      const unreflected = past24hDates.find(pd => !logs.some((l: unknown) => typeof l === 'object' && l !== null && 'date' in l && new Date(String((l as {date: string}).date)).toLocaleDateString() === new Date(pd.date).toLocaleDateString()));
      if (unreflected) { setPastDate(unreflected); setVisible(true); }
    }).catch(() => setUiError('Kalenderdaten konnten nicht geladen werden.'));
  }, []);

  if (!visible || !pastDate) return null;

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 flex items-start sm:items-center justify-between gap-4 shadow-sm mb-6">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start sm:items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-800/50 rounded-full text-indigo-600 dark:text-indigo-400 shrink-0">
          <AlertCircle size={20} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Ausstehende Date-Reflexion</h4>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">Dein Date mit {pastDate.matchName} ist über 24 Stunden her. Nimm dir einen Moment Zeit für dein Journal.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link to="/rituals" className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
          Jetzt reflektieren
        </Link>
        <button aria-label="Hinweis schließen" onClick={() => setVisible(false)} className="p-1.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
