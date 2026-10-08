import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Sparkles, MapPin, Clock, Plus, Trash2 } from 'lucide-react';
import { authFetch } from '../lib/authFetch';

interface Connection { id: string; name: string; age: number; }
interface Idea { id: string; title: string; description: string; locationType: string; city: string; region: string; connectionName: string; }
interface PlannedDate { id: string; connectionUid: string; connectionName: string; title: string; description: string; city: string; region: string; vibe: 'Casual'|'Romantic'|'Adventure'; startsAt: string; remindMe: boolean; reminderAt: string | null; }
interface Availability { id: string; startsAt: string; }

interface DatePlannerWidgetProps {
  userInterests: string[];
  location: string | null;
  profiles?: Array<{ id: string; name: string; age: number }>;
}

const VIBES = ['Casual', 'Romantic', 'Adventure'] as const;

export function DatePlannerWidget({ location }: DatePlannerWidgetProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [city, setCity] = useState(location || '');
  const [region, setRegion] = useState('');
  const [vibe, setVibe] = useState<typeof VIBES[number]>('Casual');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [plans, setPlans] = useState<PlannedDate[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [remindMe, setRemindMe] = useState(false);
  const [availabilityAt, setAvailabilityAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [c, p, a] = await Promise.all([
      authFetch('/api/date-planner/connections'),
      authFetch('/api/date-plans'),
      authFetch('/api/date-availability'),
    ]);
    if (c.ok) setConnections((await c.json()).connections ?? []);
    if (p.ok) setPlans((await p.json()).plans ?? []);
    if (a.ok) setAvailability((await a.json()).availability ?? []);
  };

  useEffect(() => { void load().catch(() => setMessage('Date-Daten konnten nicht geladen werden.')); }, []);

  const selectedConnection = useMemo(() => connections.find(c => c.id === selectedProfileId), [connections, selectedProfileId]);

  const generate = async () => {
    if (!selectedProfileId || !city) return;
    setLoading(true); setMessage('');
    try {
      const response = await authFetch('/api/date-planner/ideas', {
        method: 'POST', body: JSON.stringify({ connectionUid: selectedProfileId, city, region, vibe }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Date-Ideen derzeit nicht verfügbar.');
      setIdeas(Array.isArray(data.ideas) ? data.ideas : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Date-Ideen konnten nicht geladen werden.');
    } finally { setLoading(false); }
  };

  const savePlan = async () => {
    if (!selectedIdea || !selectedProfileId || !startsAt) return;
    setLoading(true); setMessage('');
    try {
      const response = await authFetch('/api/date-plans', {
        method: 'POST', body: JSON.stringify({
          connectionUid: selectedProfileId, title: selectedIdea.title, description: selectedIdea.description,
          city, region, vibe, startsAt: new Date(startsAt).toISOString(), remindMe,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Date konnte nicht gespeichert werden.');
      setPlans(prev => [...prev, data.plan].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)));
      setSelectedIdea(null); setStartsAt(''); setRemindMe(false);
      setMessage('Date wurde im Kalender gespeichert.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'); }
    finally { setLoading(false); }
  };

  const deletePlan = async (id: string) => {
    const response = await authFetch(`/api/date-plans/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) setPlans(prev => prev.filter(p => p.id !== id));
    else setMessage('Date konnte nicht gelöscht werden.');
  };

  const addAvailability = async () => {
    if (!availabilityAt) return;
    const response = await authFetch('/api/date-availability', { method: 'POST', body: JSON.stringify({ startsAt: new Date(availabilityAt).toISOString() }) });
    const data = await response.json();
    if (response.ok) { setAvailability(prev => [...prev, data.availability].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))); setAvailabilityAt(''); }
    else setMessage(data.error || 'Verfügbarkeit konnte nicht gespeichert werden.');
  };

  const deleteAvailability = async (id: string) => {
    const response = await authFetch(`/api/date-availability/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) setAvailability(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm space-y-5">
      <div>
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2"><Sparkles size={18} className="text-brand" />Date Planner</h3>
        <p className="text-xs text-stone-500 mt-1">Verbindung, Region/Stadt und Vibe auswählen; Vorschläge und Kalenderdaten werden serverseitig gespeichert.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">Verbindung
          <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm bg-stone-50 dark:bg-stone-900" aria-label="Verbindung auswählen">
            <option value="">Verbindung auswählen</option>{connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.age})</option>)}
          </select>
        </label>
        <label className="text-xs font-medium">Stadt
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="München, Berlin …" className="mt-1 w-full rounded-xl border p-3 text-sm bg-stone-50 dark:bg-stone-900" />
        </label>
        <label className="text-xs font-medium">Region / Viertel
          <input value={region} onChange={e => setRegion(e.target.value)} placeholder="z. B. Innenstadt" className="mt-1 w-full rounded-xl border p-3 text-sm bg-stone-50 dark:bg-stone-900" />
        </label>
        <div><span className="text-xs font-medium">Vibe</span><div className="mt-1 grid grid-cols-3 gap-2">{VIBES.map(v => <button type="button" key={v} onClick={() => setVibe(v)} className={`rounded-xl border p-2 text-xs ${vibe === v ? 'border-brand bg-brand/10 text-brand' : ''}`}>{v}</button>)}</div></div>
      </div>
      <button type="button" onClick={generate} disabled={loading || !selectedConnection || !city} className="w-full rounded-xl bg-brand p-3 text-white disabled:opacity-50">{loading ? 'Plane …' : 'Date-Ideen generieren'}</button>
      {message && <p role="status" aria-live="polite" className="text-sm text-stone-600">{message}</p>}

      {ideas.length > 0 && <div className="space-y-2"><h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Vorschläge</h4>{ideas.map(idea => <article key={idea.id} className="rounded-xl border p-3"><h5 className="font-medium">{idea.title}</h5><p className="text-sm text-stone-500">{idea.description}</p><p className="text-xs text-stone-400 mt-1">{idea.locationType} · {idea.city}{idea.region ? ` · ${idea.region}` : ''}</p><button type="button" onClick={() => setSelectedIdea(idea)} className="mt-2 rounded-lg bg-stone-100 px-3 py-2 text-xs">Date eintragen</button></article>)}</div>}

      {selectedIdea && <div className="rounded-xl border border-brand/30 p-4 space-y-3"><h4 className="font-medium">{selectedIdea.title}</h4><label className="text-xs font-medium flex flex-col gap-1">Datum und Uhrzeit<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="rounded-lg border p-2 text-sm" /></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={remindMe} onChange={e => setRemindMe(e.target.checked)} />2 Stunden vorher an Ort & Checkliste erinnern</label><div className="flex gap-2"><button type="button" onClick={() => setSelectedIdea(null)} className="flex-1 rounded-lg bg-stone-100 p-2">Abbrechen</button><button type="button" onClick={savePlan} disabled={!startsAt || loading} className="flex-1 rounded-lg bg-brand p-2 text-white disabled:opacity-50">Speichern</button></div></div>}

      <div className="space-y-2"><h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1"><CalendarDays size={14} /> Geplante Dates</h4>{plans.length === 0 ? <p className="text-sm text-stone-500">Noch keine Dates geplant.</p> : plans.map(plan => <div key={plan.id} className="flex items-start justify-between gap-3 rounded-xl border p-3"><div><p className="font-medium">{plan.title} · {plan.connectionName}</p><p className="text-xs text-stone-500"><Clock size={12} className="inline" /> {new Date(plan.startsAt).toLocaleString('de-DE')} · <MapPin size={12} className="inline" /> {plan.city}{plan.region ? `, ${plan.region}` : ''}</p><p className="text-xs text-stone-400">{plan.remindMe ? 'Erinnerung 2 Stunden vorher aktiv' : 'Keine Erinnerung'}</p></div><button type="button" onClick={() => void deletePlan(plan.id)} aria-label={`Date ${plan.title} löschen`} className="p-2"><Trash2 size={15} /></button></div>)}</div>

      <div className="space-y-2"><h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Verfügbarkeiten</h4><div className="flex gap-2"><input type="datetime-local" value={availabilityAt} onChange={e => setAvailabilityAt(e.target.value)} className="flex-1 rounded-lg border p-2 text-sm" /><button type="button" aria-label="Verfügbarkeit hinzufügen" onClick={() => void addAvailability()} disabled={!availabilityAt} className="rounded-lg bg-stone-100 px-3"> <Plus size={16} /> </button></div>{availability.map(item => <div key={item.id} className="flex justify-between text-sm"><span>{new Date(item.startsAt).toLocaleString('de-DE')}</span><button type="button" onClick={() => void deleteAvailability(item.id)} aria-label="Verfügbarkeit löschen"><Trash2 size={14} /></button></div>)}</div>
    </div>
  );
}
