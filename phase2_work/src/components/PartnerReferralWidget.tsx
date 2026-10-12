import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Copy, ExternalLink, Gift, Handshake, QrCode, Share2, ShieldCheck } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import qrcode from '../vendor/qrcode-generator.js';

type PartnerCampaign = {
  id: string;
  name: string;
  slug: string;
  rewardLabel: string;
  termsSummary: string;
  brandVerified: boolean;
  status: string;
};
type ReferralCard = {
  campaign: PartnerCampaign;
  url: string;
  clickCount: number;
  qualifiedConversions: number;
};

export function PartnerReferralWidget() {
  const [loaded, setLoaded] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [referrals, setReferrals] = useState<ReferralCard[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState<Record<string, boolean>>({});
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const linkRequest = useRef(0);

  const loadLinks = useCallback(async () => {
    const requestId = ++linkRequest.current;
    setLoadingLinks(true);
    setError('');
    try {
      const response = await authFetch('/api/partner/referrals');
      const data = await response.json().catch(() => ({})) as { referrals?: ReferralCard[]; error?: string };
      if (!response.ok || !Array.isArray(data.referrals)) throw new Error('partner_links_unavailable');
      if (requestId === linkRequest.current) setReferrals(data.referrals);
    } catch {
      if (requestId === linkRequest.current) setError('Deine Partnerübersicht ist gerade nicht verfügbar. Bitte versuche es später erneut.');
    } finally { if (requestId === linkRequest.current) setLoadingLinks(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await authFetch('/api/partner/consent');
        const data = await response.json().catch(() => ({})) as { allowed?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error || 'Der Einwilligungsstatus konnte nicht geladen werden.');
        if (!active) return;
        const nextAllowed = data.allowed === true;
        setAllowed(nextAllowed);
        setLoaded(true);
        if (nextAllowed) await loadLinks();
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Partnerlinks sind derzeit nicht verfügbar.');
          setLoaded(true);
        }
      }
    })();
    return () => { active = false; };
  }, [loadLinks]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of referrals) {
      try {
        const qr = qrcode(0, 'M');
        qr.addData(item.url);
        qr.make();
        next[item.campaign.id] = qr.createDataURL(5, 4);
      } catch {
        // QR generation is local-only; a failed encoder never sends the URL to a third party.
      }
    }
    setQrCodes(next);
  }, [referrals]);

  const changeConsent = async (nextAllowed: boolean) => {
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await authFetch('/api/partner/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed: nextAllowed }),
      });
      const data = await response.json().catch(() => ({})) as { allowed?: boolean; error?: string };
      if (!response.ok || data.allowed !== nextAllowed) throw new Error(data.error || 'Die Einwilligung konnte nicht bestätigt werden.');
      if (!nextAllowed) ++linkRequest.current;
      setAllowed(nextAllowed);
      setMessage(nextAllowed ? 'Deine Einwilligung wurde gespeichert.' : 'Deine Einwilligung wurde widerrufen; bestehende Links werden nicht länger nachverfolgt.');
      if (nextAllowed) await loadLinks();
      else { setLoadingLinks(false); setReferrals([]); setShowQr({}); setQrCodes({}); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Einwilligung konnte nicht bestätigt werden.');
    } finally { setBusy(false); }
  };

  const recordInteraction = async (campaignId: string, action: 'copy' | 'share' | 'qr_view') => {
    const response = await authFetch('/api/partner/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, action }),
    });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(data.error || 'Die Aktion konnte nicht im signierten Audit-Ledger bestätigt werden.');
  };

  const copyLink = async (item: ReferralCard) => {
    setBusy(true); setMessage(''); setError('');
    try {
      await recordInteraction(item.campaign.id, 'copy');
      await navigator.clipboard.writeText(item.url);
      setMessage('Partnerlink kopiert.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Der Link konnte nicht kopiert werden.');
    } finally { setBusy(false); }
  };

  const shareLink = async (item: ReferralCard) => {
    if (typeof navigator.share !== 'function') {
      await copyLink(item);
      return;
    }
    setBusy(true); setMessage(''); setError('');
    try {
      await recordInteraction(item.campaign.id, 'share');
      await navigator.share({ title: 'Klar & Partner – ' + item.campaign.name, text: 'Eine Partnerempfehlung aus Klar.', url: item.url });
      setMessage('Teilen geöffnet.');
    } catch (reason) {
      // A dismissed native share sheet is not an app error.
      if (reason instanceof Error && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Der Link konnte nicht geteilt werden.');
    } finally { setBusy(false); }
  };

  const toggleQr = async (item: ReferralCard) => {
    const visible = showQr[item.campaign.id] === true;
    if (!visible) {
      setBusy(true); setError('');
      try { await recordInteraction(item.campaign.id, 'qr_view'); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Der QR-Code konnte nicht im Ledger bestätigt werden.'); setBusy(false); return; }
      finally { setBusy(false); }
    }
    setShowQr(current => ({ ...current, [item.campaign.id]: !visible }));
  };

  const openPartner = async (item: ReferralCard) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await authFetch('/api/partner/open/' + encodeURIComponent(item.campaign.id), { method: 'POST' });
      const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || typeof data.url !== 'string' || !data.url.startsWith('https://')) throw new Error(data.error || 'Der Partnerlink konnte nicht sicher geöffnet werden.');
      window.location.assign(data.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Der Partnerlink konnte nicht geöffnet werden.');
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="partner-referral-heading" className="space-y-6 text-stone-900 dark:text-stone-100">
      <header className="rounded-3xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F5] dark:bg-stone-900 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-[#E8E0D5] dark:bg-stone-800 p-3" aria-hidden="true"><Handshake size={24} /></div>
          <div className="min-w-0">
            <h2 id="partner-referral-heading" className="font-serif text-2xl">Klar & Partner</h2>
            <p className="mt-2 text-sm leading-6 text-stone-700 dark:text-stone-300">Teile von Klar geprüfte Partnerangebote mit einem persönlichen Link oder QR-Code. Dein Name, deine E-Mail-Adresse und dein Profil werden nicht an die Marke übertragen.</p>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><ShieldCheck size={18} aria-hidden="true" /> Deine Entscheidung zur Partner-Nachverfolgung</h3>
        <p className="text-sm leading-6 text-stone-600 dark:text-stone-300">Damit Klar deine Links personalisieren und gültige Empfehlungen zählen darf, benötigen wir deine gesonderte Einwilligung. Wir speichern nur die nötige Zuordnung, aggregierte Klickzahlen und bestätigte Empfehlungen in einem HMAC-SHA256-signierten Audit-Ledger. Keine Drittanbieter-IDs, E-Mail-Adressen, IP-Adressen oder User-Agent-Daten werden im Partner-Ledger gespeichert. Du kannst die Einwilligung jederzeit widerrufen.</p>
        <label className="flex items-start gap-3 text-sm leading-6">
          <input type="checkbox" checked={allowed} disabled={!loaded || busy} onChange={event => void changeConsent(event.target.checked)} className="mt-1 h-5 w-5 rounded border-stone-400 accent-stone-800" />
          <span>Ich willige in die Personalisierung meiner Partnerlinks sowie die Zählung technisch geprüfter Klicks und bestätigter Empfehlungen ein.</span>
        </label>
        <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">Beim Besuch einer Partnerseite gelten zusätzlich die Datenschutz- und Angebotsbedingungen des jeweiligen Partners.</p>
      </div>

      {message && <p role="status" aria-live="polite" className="rounded-xl border border-stone-200 dark:border-stone-700 p-3 text-sm">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-amber-700 p-3 text-sm text-amber-800 dark:text-amber-300">{error}</p>}

      {allowed && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl">Deine Partner und Prämien</h3>
            <button type="button" onClick={() => void loadLinks()} disabled={loadingLinks || busy} className="min-h-11 rounded-full border border-stone-300 dark:border-stone-600 px-4 py-2 text-sm disabled:opacity-50">
              {loadingLinks ? 'Aktualisiere …' : 'Aktualisieren'}
            </button>
          </div>
          {loadingLinks && <p role="status" className="text-sm text-stone-600 dark:text-stone-300">Partnerlinks werden geladen …</p>}
          {!loadingLinks && referrals.length === 0 && !error && <p className="rounded-2xl border border-stone-200 dark:border-stone-700 p-5 text-sm">Aktuell gibt es keine aktivierten, geprüften Partnerkampagnen.</p>}
          <div className="grid gap-4">
            {referrals.map(item => (
              <article key={item.campaign.id} className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">Geprüfter Partner</p>
                    <h4 className="font-serif text-xl mt-1">{item.campaign.name}</h4>
                    <p className="text-sm text-stone-600 dark:text-stone-300 mt-2">{item.campaign.termsSummary}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-stone-300 dark:border-stone-600 px-3 py-1 text-xs">Aktiv</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#FAF8F5] dark:bg-stone-800 p-3">
                    <p className="text-xs text-stone-600 dark:text-stone-300">Gezählte Klicks</p>
                    <p className="text-2xl font-serif tabular-nums mt-1">{item.clickCount}</p>
                  </div>
                  <div className="rounded-xl bg-[#FAF8F5] dark:bg-stone-800 p-3">
                    <p className="text-xs text-stone-600 dark:text-stone-300">Bestätigte Empfehlungen</p>
                    <p className="text-2xl font-serif tabular-nums mt-1">{item.qualifiedConversions}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 dark:border-stone-700 p-4">
                  <div className="flex items-start gap-2">
                    <Gift size={18} className="mt-0.5" aria-hidden="true" />
                    <div><p className="font-medium">Prämie laut Kampagne</p><p className="text-sm mt-1">{item.campaign.rewardLabel}</p><p className="text-xs text-stone-500 dark:text-stone-400 mt-2">Es zählen ausschließlich signierte, idempotente Partner-Rückmeldungen mit erfüllten Alters- und Einwilligungsbedingungen. Dieser Zähler bestätigt keine Auszahlung durch Klar.</p></div>
                  </div>
                </div>

                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300" htmlFor={'partner-link-' + item.campaign.id}>Persönlicher Empfehlungslink</label>
                <div className="flex gap-2">
                  <input id={'partner-link-' + item.campaign.id} value={item.url} readOnly className="min-w-0 flex-1 rounded-xl border border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 p-3 text-xs focus:outline-none focus:ring-2 focus:ring-stone-600" />
                  <button type="button" onClick={() => void copyLink(item)} disabled={busy} aria-label={'Link kopieren: ' + item.campaign.name} className="min-h-11 min-w-11 rounded-xl border border-stone-300 dark:border-stone-600 p-3 disabled:opacity-50"><Copy size={16} aria-hidden="true" /></button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void shareLink(item)} disabled={busy} className="min-h-11 rounded-full border border-stone-300 dark:border-stone-600 px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"><Share2 size={16} aria-hidden="true" /> Teilen</button>
                  <button type="button" onClick={() => void toggleQr(item)} disabled={busy} aria-expanded={showQr[item.campaign.id] === true} className="min-h-11 rounded-full border border-stone-300 dark:border-stone-600 px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"><QrCode size={16} aria-hidden="true" /> {showQr[item.campaign.id] ? 'QR-Code ausblenden' : 'QR-Code anzeigen'}</button>
                  <button type="button" onClick={() => void openPartner(item)} disabled={busy} className="min-h-11 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"><ExternalLink size={16} aria-hidden="true" /> Partner öffnen <ArrowUpRight size={14} aria-hidden="true" /></button>
                </div>

                {showQr[item.campaign.id] && (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F5] p-4 dark:bg-stone-800">
                    {qrCodes[item.campaign.id]
                      ? <img src={qrCodes[item.campaign.id]} alt={'QR-Code für ' + item.campaign.name + ' Partnerlink'} className="h-52 w-52 rounded-xl bg-white p-2" />
                      : <p role="status" className="text-sm">Der lokale QR-Code konnte nicht erzeugt werden. Der Empfehlungslink bleibt verfügbar.</p>}
                    <p className="text-xs text-center text-stone-600 dark:text-stone-300">Der QR-Code wird ausschließlich im Browser erzeugt; die URL wird nicht an einen QR-Code-Dienst übertragen.</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default PartnerReferralWidget;
