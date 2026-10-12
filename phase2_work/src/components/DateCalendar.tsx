import { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Trash2 } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { useAuth } from '../lib/AuthContext';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../i18n/format';
import { normalizeLanguage } from '../i18n/locale';

interface PlannedDate { id: string; connectionName: string; title: string; description: string; city: string; region: string; startsAt: string; remindMe: boolean; }

export function DateCalendar() {
  const { user, loading: authLoading } = useAuth();
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [dates, setDates] = useState<PlannedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    // Authentication transitions must never expose a previous user's plans.
    setDates([]);
    setMessage('');
    if (authLoading) { setLoading(true); return () => { active = false; }; }
    if (!user) { setLoading(false); return () => { active = false; }; }
    setLoading(true);
    void (async () => {
      try {
        const response = await authFetch('/api/date-plans');
        const data: unknown = await response.json();
        if (!response.ok) throw new Error('Kalender nicht verfügbar.');
        if (active) {
          const plans = data && typeof data === 'object' && 'plans' in data ? data.plans : null;
          setDates(Array.isArray(plans) ? plans : []);
        }
      } catch {
        if (active) setMessage('Kalender nicht verfügbar.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.uid, authLoading]);

  const remove = async (id: string) => {
    const response = await authFetch(`/api/date-plans/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) setDates(prev => prev.filter(item => item.id !== id));
    else setMessage('Date konnte nicht gelöscht werden.');
  };

  const displayDate = (value: string) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? formatDate(timestamp, language, timeZone) : 'Datum nicht verfügbar';
  };

  return <div className="flex-1 overflow-y-auto p-6 space-y-6">
    <div className="flex items-center gap-2"><CalendarIcon className="text-brand" size={24} /><div><h3 className="text-xl font-serif">Date Calendar</h3><p className="text-xs text-stone-500">Serverseitig gespeicherte Termine und Erinnerungen.</p></div></div>
    {message && <p role="status" aria-live="polite" className="text-sm text-stone-600">{message}</p>}
    {loading ? <p className="text-sm text-stone-500">Kalender wird geladen …</p> : dates.length === 0 ? <div className="text-center py-12 rounded-2xl border border-dashed"><CalendarIcon size={48} className="mx-auto text-stone-300 mb-4" /><p className="text-stone-500">Noch keine Dates geplant.</p></div> : <div className="space-y-3">{dates.map(d => <article key={d.id} className="rounded-2xl border p-4 bg-white dark:bg-stone-800"><div className="flex justify-between gap-3"><div><h4 className="font-semibold">{d.title}</h4><p className="text-sm text-stone-600">mit {d.connectionName}</p><p className="text-xs text-stone-500 mt-1"><Clock size={12} className="inline" /> {displayDate(d.startsAt)}</p><p className="text-xs text-stone-500"><MapPin size={12} className="inline" /> {d.city}{d.region ? ` · ${d.region}` : ''}</p><p className="text-xs text-stone-400 mt-1">{d.remindMe ? '2-Stunden-Erinnerung aktiv' : 'Keine Erinnerung'}</p></div><button type="button" onClick={() => void remove(d.id)} aria-label={`Date ${d.title} löschen`} className="p-2"><Trash2 size={16} /></button></div><p className="mt-3 text-sm text-stone-600">{d.description}</p></article>)}</div>}
  </div>;
}
