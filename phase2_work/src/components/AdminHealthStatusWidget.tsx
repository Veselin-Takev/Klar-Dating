import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Activity, RefreshCw, AlertCircle, ShieldCheck, Database } from 'lucide-react';
import { isFresh, parseEnterpriseObservation, type EnterpriseObservation, type HealthFlag } from './enterpriseDashboardHealth';

const POLL_MS = 120_000;
const unverified = [
  { title: 'API-P95 & SLO', why: 'Keine verifizierte Latenz-Zeitreihe angebunden' },
  { title: 'DSGVO Art. 17 & TTL', why: 'Live-Retention und Legal-Hold-Nachweise fehlen' },
  { title: 'KI-Budget-Ledger', why: 'Keine autorisierte Budget-Aggregation angebunden' },
  { title: 'Security- und CI-Gates', why: 'Keine signierte Produktionsfreigabe angebunden' },
] as const;

function Status({ value }: { value: HealthFlag | 'unknown' }) {
  const label = value === 'healthy' ? 'Prüfung erfolgreich' : value === 'unhealthy' ? 'Prüfung fehlgeschlagen' : 'Nicht verifiziert';
  const color = value === 'healthy' ? 'text-emerald-700 dark:text-emerald-300'
    : value === 'unhealthy' ? 'text-rose-700 dark:text-rose-300' : 'text-stone-600 dark:text-stone-300';
  return <span className={`text-xs font-semibold ${color}`}>{label}</span>;
}

/** Read-only admin observations; never a substitute for release, GDPR or AI compliance evidence. */
export function AdminHealthStatusWidget() {
  const [observation, setObservation] = useState<EnterpriseObservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const requestRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const mountedRef = useRef(false);

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const request = ++sequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('UNAUTHENTICATED');
      const token = await user.getIdToken();
      if (controller.signal.aborted) return;
      const response = await fetch('/api/admin/health-check', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('UNAVAILABLE');
      const result = parseEnterpriseObservation(await response.json(), Date.now());
      if (!mountedRef.current || sequenceRef.current !== request || controller.signal.aborted) return;
      setObservation(result);
      setNow(Date.now());
    } catch {
      if (!mountedRef.current || sequenceRef.current !== request || controller.signal.aborted) return;
      setObservation(null);
      setError('Geschützte Betriebsprüfung nicht verfügbar oder nicht berechtigt.');
    } finally {
      if (mountedRef.current && sequenceRef.current === request) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = onAuthStateChanged(auth, user => {
      sequenceRef.current += 1;
      requestRef.current?.abort();
      setObservation(null);
      setNow(Date.now());
      if (user) void refresh();
      else {
        setLoading(false);
        setError('Keine authentifizierte Admin-Sitzung.');
      }
    });
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (auth.currentUser) void refresh();
    }, POLL_MS);
    return () => {
      mountedRef.current = false;
      sequenceRef.current += 1;
      requestRef.current?.abort();
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [refresh]);

  const verified = isFresh(observation, now);
  const rows = [
    { id: 'firestore', title: 'Firestore', value: verified ? observation!.firestore : 'unknown', detail: 'Geschützter Server-Lesecheck' },
    { id: 'auth', title: 'Firebase Auth', value: verified ? observation!.auth : 'unknown', detail: 'Serverseitiger Firebase-Admin-Check' },
  ] as const;
  return (
    <section aria-label="Enterprise Betriebs- und Compliance-Status" className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-stone-900 dark:text-stone-100"><Activity size={20}/>Enterprise Status & Compliance</h2>
        <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Enterprise Status aktualisieren"
          className="rounded-lg border border-stone-300 dark:border-stone-600 px-3 py-2 text-xs disabled:opacity-50 flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>{loading ? 'Prüfe ...' : 'Aktualisieren'}
        </button>
      </div>
      <p className="text-xs text-stone-500 mt-2">Autorisierte Messungen, keine Produktionsfreigabe. Automatische Prüfung alle 120 Sekunden.</p>
      <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">
        Healthchecks belegen weder das Release-GO noch Datenschutz-, SLO- oder KI-Budget-Konformität.
      </p>
      {error && <p role="alert" className="flex items-center gap-2 text-xs text-rose-700 mt-3"><AlertCircle size={15}/>{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4" aria-live="polite">
        {rows.map(row => (
          <div key={row.id} className="rounded-xl border border-stone-200 dark:border-stone-700 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
              {row.id === 'auth' ? <ShieldCheck size={17}/> : <Database size={17}/>} {row.title}
            </p>
            <Status value={row.value}/>
            <p className="text-xs text-stone-500 mt-1">{row.detail}</p>
          </div>
        ))}
      </div>
      <h3 className="font-semibold text-sm mt-5">Weitere Enterprise-Nachweise</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        {unverified.map(item => (
          <div key={item.title} className="border border-dashed border-stone-300 dark:border-stone-600 rounded-xl p-3">
            <p className="text-xs font-semibold">{item.title}: <span className="text-amber-700 dark:text-amber-300">Nicht verifiziert</span></p>
            <p className="text-xs text-stone-500 mt-1">{item.why}</p>
          </div>
        ))}
      </div>
      {verified && observation && typeof observation.requestLatencyMs === 'number' && (
        <p className="text-xs text-stone-500 mt-4">Dauer des Admin-Checks: {observation.requestLatencyMs} ms (kein API-P95).</p>
      )}
    </section>
  );
}
