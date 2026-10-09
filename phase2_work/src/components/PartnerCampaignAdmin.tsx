import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Archive, Check, CircleSlash, Pencil, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { authFetch } from '../lib/authFetch';

type Status = 'draft' | 'active' | 'inactive' | 'deleted';
type Campaign = {
  id: string;
  name: string;
  slug: string;
  destinationUrl: string;
  rewardLabel: string;
  termsSummary: string;
  brandVerified: boolean;
  status: Status;
  clickCount: number;
  qualifiedConversions: number;
  version: number;
  updatedAt: string;
};
type FormState = {
  name: string;
  slug: string;
  destinationUrl: string;
  rewardLabel: string;
  termsSummary: string;
  brandVerified: boolean;
  status: 'draft' | 'active' | 'inactive';
};
const emptyForm: FormState = {
  name: '', slug: '', destinationUrl: '', rewardLabel: '', termsSummary: '',
  brandVerified: false, status: 'draft',
};

export function PartnerCampaignAdmin() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await authFetch('/api/admin/partners');
      const data = await response.json().catch(() => ({})) as { campaigns?: Campaign[]; error?: string };
      if (!response.ok || !Array.isArray(data.campaigns)) throw new Error(data.error || 'Die Kampagnenverwaltung ist nicht erreichbar.');
      setCampaigns(data.campaigns);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Kampagnenverwaltung ist nicht erreichbar.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const resetForm = () => { setEditingId(null); setForm(emptyForm); };

  const edit = (campaign: Campaign) => {
    setEditingId(campaign.id);
    setForm({
      name: campaign.name,
      slug: campaign.slug,
      destinationUrl: campaign.destinationUrl,
      rewardLabel: campaign.rewardLabel,
      termsSummary: campaign.termsSummary,
      brandVerified: campaign.brandVerified,
      status: campaign.status === 'deleted' ? 'inactive' : campaign.status,
    });
    setMessage('');
    setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const isEditing = editingId !== null;
      const response = await authFetch(isEditing ? '/api/admin/partners/' + encodeURIComponent(editingId) : '/api/admin/partners', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({})) as { campaign?: Campaign; error?: string };
      if (!response.ok || !data.campaign) throw new Error(data.error || 'Die Kampagne konnte nicht gespeichert werden.');
      setMessage(isEditing ? 'Kampagne aktualisiert.' : 'Kampagne erstellt.');
      resetForm();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Kampagne konnte nicht gespeichert werden.');
    } finally { setBusy(false); }
  };

  const disable = async (campaign: Campaign) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await authFetch('/api/admin/partners/' + encodeURIComponent(campaign.id) + '/disable', { method: 'POST' });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Die Kampagne konnte nicht deaktiviert werden.');
      setMessage('Kampagne deaktiviert. Bestehende Links erzeugen keine neuen Zählungen oder Prämien.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Kampagne konnte nicht deaktiviert werden.');
    } finally { setBusy(false); }
  };

  const softDelete = async (campaign: Campaign) => {
    if (!window.confirm('Kampagne "' + campaign.name + '" als gelöscht markieren? Die Historie bleibt revisionssicher erhalten.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await authFetch('/api/admin/partners/' + encodeURIComponent(campaign.id), { method: 'DELETE' });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Die Kampagne konnte nicht gelöscht werden.');
      setMessage('Kampagne soft-gelöscht. Der Slug bleibt reserviert und die signierte Historie erhalten.');
      if (editingId === campaign.id) resetForm();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Kampagne konnte nicht gelöscht werden.');
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="partner-admin-heading" className="space-y-6">
      <header className="rounded-2xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-5">
        <h2 id="partner-admin-heading" className="font-serif text-2xl flex items-center gap-2"><ShieldCheck size={23} aria-hidden="true" /> Klar & Partner – Kampagnenverwaltung</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">Nur Firebase-Identitäten mit dem Custom Claim <code>admin: true</code> dürfen Kampagnen verwalten. Neue Links sind standardmäßig Entwürfe. Vor der Aktivierung muss die Marke anhand ihrer offiziellen Domain manuell verifiziert werden.</p>
      </header>

      {message && <p role="status" aria-live="polite" className="rounded-xl border border-stone-200 dark:border-stone-700 p-3 text-sm">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-amber-700 p-3 text-sm text-amber-800 dark:text-amber-300">{error}</p>}

      <form onSubmit={event => void submit(event)} className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold flex items-center gap-2">{editingId ? <Pencil size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />} {editingId ? 'Kampagne bearbeiten' : 'Partnerkampagne hinzufügen'}</h3>
          {editingId && <button type="button" onClick={resetForm} className="min-h-11 rounded-full border px-3 text-sm">Abbrechen</button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="partner-campaign-name" className="block text-sm font-medium mb-1.5">Markenname</label>
            <input id="partner-campaign-name" required minLength={2} maxLength={80} value={form.name} onChange={e => updateForm('name', e.target.value)} className="w-full min-h-11 rounded-xl border border-stone-300 dark:border-stone-600 bg-transparent px-3" />
          </div>
          <div>
            <label htmlFor="partner-campaign-slug" className="block text-sm font-medium mb-1.5">Eindeutiger Slug</label>
            <input id="partner-campaign-slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={48} value={form.slug} onChange={e => updateForm('slug', e.target.value.toLowerCase())} className="w-full min-h-11 rounded-xl border border-stone-300 dark:border-stone-600 bg-transparent px-3" aria-describedby="partner-slug-help" />
            <p id="partner-slug-help" className="text-xs mt-1 text-stone-500">Kleinbuchstaben, Zahlen und Bindestriche; einmal verwendete Slugs bleiben reserviert.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="partner-campaign-url" className="block text-sm font-medium mb-1.5">Offizielle HTTPS-Ziel- / Affiliate-URL</label>
            <input id="partner-campaign-url" type="url" required maxLength={2048} placeholder="https://partner.example.com/..." value={form.destinationUrl} onChange={e => updateForm('destinationUrl', e.target.value)} className="w-full min-h-11 rounded-xl border border-stone-300 dark:border-stone-600 bg-transparent px-3" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="partner-campaign-reward" className="block text-sm font-medium mb-1.5">Prämienbeschreibung</label>
            <input id="partner-campaign-reward" required minLength={2} maxLength={160} value={form.rewardLabel} onChange={e => updateForm('rewardLabel', e.target.value)} className="w-full min-h-11 rounded-xl border border-stone-300 dark:border-stone-600 bg-transparent px-3" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="partner-campaign-terms" className="block text-sm font-medium mb-1.5">Bedingungen / Kurzfassung</label>
            <textarea id="partner-campaign-terms" required minLength={8} maxLength={2000} rows={3} value={form.termsSummary} onChange={e => updateForm('termsSummary', e.target.value)} className="w-full rounded-xl border border-stone-300 dark:border-stone-600 bg-transparent p-3" />
          </div>
          <div>
            <label htmlFor="partner-campaign-status" className="block text-sm font-medium mb-1.5">Status</label>
            <select id="partner-campaign-status" value={form.status} onChange={e => updateForm('status', e.target.value as FormState['status'])} className="w-full min-h-11 rounded-xl border border-stone-300 dark:border-stone-600 bg-transparent px-3">
              <option value="draft">Entwurf</option>
              <option value="active">Aktiv</option>
              <option value="inactive">Deaktiviert</option>
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm sm:pt-6">
            <input type="checkbox" checked={form.brandVerified} disabled={!editingId} onChange={e => updateForm('brandVerified', e.target.checked)} className="h-5 w-5 accent-stone-800 disabled:opacity-40" />
            <span>Marke / Domain unabhängig geprüft (nur bestehende Kampagne)</span>
          </label>
        </div>
        <p className="text-xs leading-5 text-stone-500">Es werden keine geheimen Partner-Schlüssel im Dokument gespeichert. Für verifizierte Conversions muss der serverseitige Webhook-Schlüssel separat konfiguriert werden.</p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-5 py-2 flex items-center gap-2 disabled:opacity-50"><Save size={16} aria-hidden="true" /> {busy ? 'Speichere …' : editingId ? 'Änderungen speichern' : 'Kampagne erstellen'}</button>
          <button type="button" onClick={() => void load()} disabled={busy || loading} className="min-h-11 rounded-full border border-stone-300 dark:border-stone-600 px-4 py-2 flex items-center gap-2 disabled:opacity-50"><RefreshCw size={16} aria-hidden="true" /> Aktualisieren</button>
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl">Alle Kampagnen</h3>
          <span className="text-xs text-stone-500 tabular-nums">{campaigns.length} Einträge</span>
        </div>
        {loading && <p role="status" className="text-sm">Kampagnen werden geladen …</p>}
        {!loading && campaigns.length === 0 && <p className="rounded-xl border border-stone-200 dark:border-stone-700 p-5 text-sm">Noch keine Partnerkampagnen hinterlegt.</p>}
        {campaigns.map(campaign => (
          <article key={campaign.id} className="rounded-2xl border border-stone-200 dark:border-stone-700 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold">{campaign.name}</h4>
                <p className="text-xs text-stone-500 mt-1">{campaign.slug}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-stone-300 dark:border-stone-600 px-3 py-1 text-xs">{campaign.status}</span>
                <span className="rounded-full border border-stone-300 dark:border-stone-600 px-3 py-1 text-xs flex gap-1 items-center">{campaign.brandVerified ? <Check size={13} aria-hidden="true" /> : <CircleSlash size={13} aria-hidden="true" />} {campaign.brandVerified ? 'Marke geprüft' : 'Nicht geprüft'}</span>
              </div>
            </div>
            <p className="text-sm break-all">{campaign.destinationUrl}</p>
            <p className="text-sm text-stone-600 dark:text-stone-300">{campaign.rewardLabel}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <p className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3 text-sm"><span className="block text-xs text-stone-500">Klicks</span><strong className="text-lg tabular-nums">{campaign.clickCount}</strong></p>
              <p className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3 text-sm"><span className="block text-xs text-stone-500">Bestätigte Empfehlungen</span><strong className="text-lg tabular-nums">{campaign.qualifiedConversions}</strong></p>
              <p className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3 text-sm"><span className="block text-xs text-stone-500">Version</span><strong className="text-lg tabular-nums">{campaign.version}</strong></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => edit(campaign)} disabled={busy || campaign.status === 'deleted'} className="min-h-11 rounded-full border border-stone-300 dark:border-stone-600 px-4 py-2 flex items-center gap-2 text-sm disabled:opacity-50"><Pencil size={15} aria-hidden="true" /> Bearbeiten</button>
              {campaign.status === 'active' && <button type="button" onClick={() => void disable(campaign)} disabled={busy} className="min-h-11 rounded-full border border-stone-300 dark:border-stone-600 px-4 py-2 flex items-center gap-2 text-sm disabled:opacity-50"><Archive size={15} aria-hidden="true" /> Deaktivieren</button>}
              {campaign.status !== 'deleted' && <button type="button" onClick={() => void softDelete(campaign)} disabled={busy} className="min-h-11 rounded-full border border-amber-700 text-amber-800 dark:text-amber-300 px-4 py-2 flex items-center gap-2 text-sm disabled:opacity-50"><Trash2 size={15} aria-hidden="true" /> Soft-Delete</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PartnerCampaignAdmin;
