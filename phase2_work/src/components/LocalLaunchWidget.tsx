import { useEffect, useState } from 'react';
import { MapPin, Share2, Users, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { fetchWithTimeout } from '../lib/api';

const CITIES = ['München', 'Berlin', 'Hamburg', 'Köln', 'Frankfurt am Main'] as const;
type City = typeof CITIES[number];

type Summary = { city: City; activeUsers: number; verifiedUsers: number; band: string; message: string };

export function LocalLaunchWidget() {
  const { user, profileData, updateProfileData } = useAuth();
  const [city, setCity] = useState<City | ''>((profileData?.location as City) || '');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [saving, setSaving] = useState(false);
  const [shared, setShared] = useState(false);
  const [founding, setFounding] = useState<{ member: boolean; rank: number | null; reason?: string } | null>(null);

  const hasAccount = Boolean(user?.uid && !user.isAnonymous);
  
  useEffect(() => {
    if (!hasAccount || !city) return;
    let cancelled = false;
    fetchWithTimeout(`/api/launch/summary?city=${encodeURIComponent(city)}`, { timeout: 10000, retries: 0 })
      .then(async response => response.ok ? response.json() as Promise<Summary> : null)
      .then(data => { if (!cancelled && data) setSummary(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [city, hasAccount]);

  if (!hasAccount) return null;

  const claimFounding = async () => {
    try {
      const response = await fetchWithTimeout('/api/launch/founding-claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 10000, retries: 0,
      });
      if (response.ok) setFounding(await response.json() as { member: boolean; rank: number | null; reason?: string });
    } catch { /* optional launch enhancement; core onboarding continues */ }
  };

  const saveCity = async (value: City) => {
    setCity(value);
    setSaving(true);
    try {
      await updateProfileData({ location: value });
      await fetchWithTimeout('/api/activation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'launch_city_selected', metadata: { city: value } }), timeout: 10000, retries: 0,
      });
      await claimFounding();
    } finally { setSaving(false); }
  };

  const share = async () => {
    try {
      const response = await fetchWithTimeout('/api/referral', { timeout: 10000, retries: 0 });
      if (!response.ok) throw new Error('Referral unavailable');
      const data = await response.json() as { shareUrl?: string };
      if (!data.shareUrl) throw new Error('Referral URL missing');
      const url = data.shareUrl;
      if (navigator.share) await navigator.share({ title: 'Klar – echte Verbindungen', text: 'Komm in meine lokale Klar-Community.', url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      void fetchWithTimeout('/api/activation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'referral_shared' }), timeout: 10000, retries: 0 });
    } catch { /* user cancelled share or clipboard is unavailable */ }
  };

  return (
    <section aria-labelledby="klar-local-launch" className="mb-4 rounded-2xl border border-brand/20 bg-brand/5 dark:bg-brand/10 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand text-white p-2"><MapPin size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id="klar-local-launch" className="font-semibold text-stone-900 dark:text-stone-100">Deine lokale Klar-Community</h2>
            <Sparkles size={15} className="text-brand" aria-hidden="true" />
          </div>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">Wir priorisieren lokale Dichte, damit aus Vorschlägen echte Begegnungen werden.</p>
          <label className="mt-3 block text-xs font-medium text-stone-600 dark:text-stone-400" htmlFor="klar-launch-city">Deine Stadt</label>
          <select id="klar-launch-city" value={city} disabled={saving} onChange={e => void saveCity(e.target.value as City)} className="mt-1 w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm">
            <option value="">Stadt auswählen</option>
            {CITIES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          {summary && (
            <div className="mt-3 space-y-2 text-sm text-stone-700 dark:text-stone-300">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-brand" aria-hidden="true" />
                <span>{summary.message} {summary.activeUsers > 0 ? `Aktuell ${summary.activeUsers} aktive Profile.` : ''}</span>
              </div>
              {summary.verifiedUsers > 0 && (
                <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <ShieldCheck size={14} aria-hidden="true" />
                  <span>{summary.verifiedUsers} verifizierte Profile in dieser Community</span>
                </div>
              )}
            </div>
          )}
          {founding?.member && (
            <div className="mt-3 rounded-xl border border-brand/20 bg-white/70 dark:bg-stone-900/30 p-3">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Founding 500</p>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">Du bist Mitglied der ersten 500 Klar-Community-Mitglieder{founding.rank ? ` (#${founding.rank})` : ''}.</p>
            </div>
          )}
          <button type="button" onClick={() => void share()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-900">
            <Share2 size={15} aria-hidden="true" /> {shared ? 'Link geteilt' : 'Passende Menschen einladen'}
          </button>
        </div>
      </div>
    </section>
  );
}
