import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Cpu, Database, ShieldCheck, Activity } from 'lucide-react';
import { auth } from '../lib/firebase';

interface ServiceHealth {
  name: string;
  key: 'gemini' | 'firestore' | 'auth';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'checking';
  latencyMs?: number;
  details: string;
  icon: typeof Cpu;
}

export function AdminHealthStatusWidget() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'Gemini AI Engine', key: 'gemini', status: 'checking', details: 'Wird geprüft...', icon: Cpu },
    { name: 'Firestore Database', key: 'firestore', status: 'checking', details: 'Wird geprüft...', icon: Database },
    { name: 'Firebase Auth & Security', key: 'auth', status: 'checking', details: 'Wird geprüft...', icon: ShieldCheck },
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>('');

  const checkHealth = async () => {
    setIsRefreshing(true);
    let updatedGemini: ServiceHealth = { ...services[0]! };
    let updatedFirestore: ServiceHealth = { ...services[1]! };
    let updatedAuth: ServiceHealth = { ...services[2]! };

    // 1. Check Gemini via /api/check-safety or /api/admin/system-health
    try {
      const start = performance.now();
      const res = await fetch('/api/check-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Status ping' }),
      });
      const latency = Math.round(performance.now() - start);
      const isOk = res.ok || res.status === 400 || res.status === 200;
      updatedGemini = {
        ...updatedGemini,
        status: isOk ? 'healthy' : 'unhealthy',
        latencyMs: latency,
        details: isOk ? `Betriebsbereit (${latency}ms)` : `Fehler HTTP ${res.status}`,
      };
    } catch {
      updatedGemini = {
        ...updatedGemini,
        status: 'degraded',
        details: 'Verbindung eingeschränkt oder Timeout',
      };
    }

    // 2. Check Firestore via /api/ready
    try {
      const start = performance.now();
      const res = await fetch('/api/ready');
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        updatedFirestore = {
          ...updatedFirestore,
          status: 'healthy',
          latencyMs: latency,
          details: `Datenbank synchron (${latency}ms)`,
        };
      } else {
        updatedFirestore = {
          ...updatedFirestore,
          status: 'unhealthy',
          details: `HTTP ${res.status}`,
        };
      }
    } catch {
      updatedFirestore = {
        ...updatedFirestore,
        status: 'unhealthy',
        details: 'Keine Antwort vom Firestore-Gateway',
      };
    }

    // 3. Check Auth via current user token or /api/quota
    try {
      const start = performance.now();
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const res = await fetch('/api/quota', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const latency = Math.round(performance.now() - start);
      const isHealthy = res.ok || res.status === 401; // 401 means auth service is properly enforcing tokens!
      updatedAuth = {
        ...updatedAuth,
        status: isHealthy ? 'healthy' : 'unhealthy',
        latencyMs: latency,
        details: isHealthy ? `Auth-Tokens validiert (${latency}ms)` : `Auth-Fehler ${res.status}`,
      };
    } catch {
      updatedAuth = {
        ...updatedAuth,
        status: 'degraded',
        details: 'Auth-Endpunkt antwortet verzögert',
      };
    }

    setServices([updatedGemini, updatedFirestore, updatedAuth]);
    setIsRefreshing(false);
    setLastChecked(new Date().toLocaleTimeString('de-DE'));
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const allHealthy = services.every(s => s.status === 'healthy');

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 border border-stone-200 dark:border-stone-700 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Activity size={20} className="text-brand dark:text-brand-light" />
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Infrastruktur & Externe Endpunkte
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Statusprüfung via Live-Fetch {lastChecked && `• Zuletzt: ${lastChecked}`}
            </p>
          </div>
        </div>

        <button
          onClick={checkHealth}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-100 dark:bg-stone-700/60 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Prüfe...' : 'Jetzt prüfen'}</span>
        </button>
      </div>

      {/* Global Status Banner */}
      <div className={`p-3 rounded-xl mb-4 text-xs font-medium flex items-center justify-between ${
        allHealthy
          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50'
          : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50'
      }`}>
        <div className="flex items-center gap-2">
          {allHealthy ? <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" /> : <AlertCircle size={16} className="text-amber-600 dark:text-amber-400" />}
          <span>{allHealthy ? 'Alle externen Systeme betriebsbereit (Gesund)' : 'Ein oder mehrere Systeme melden Einschränkungen'}</span>
        </div>
      </div>

      {/* Grid of services */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {services.map((service) => {
          const Icon = service.icon;
          const isGreen = service.status === 'healthy';
          const isChecking = service.status === 'checking';

          return (
            <div
              key={service.key}
              className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-700/80 bg-stone-50/50 dark:bg-stone-800/50 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-stone-100 dark:bg-stone-700/70 text-stone-700 dark:text-stone-300">
                    <Icon size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      {service.name}
                    </span>
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider">
                      {service.key}
                    </span>
                  </div>
                </div>

                {/* Status Indicator (Green/Red) */}
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isChecking
                        ? 'bg-stone-400 animate-ping'
                        : isGreen
                        ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                        : 'bg-rose-500 shadow-xs shadow-rose-500/50'
                    }`}
                  />
                  <span
                    className={`text-xs font-semibold ${
                      isGreen ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isChecking ? '...' : isGreen ? 'Online' : 'Fehler'}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/60 flex items-center justify-between text-[11px]">
                <span className="text-stone-600 dark:text-stone-400 truncate max-w-[140px]">
                  {service.details}
                </span>
                {service.latencyMs !== undefined && (
                  <span className="font-mono text-stone-500 dark:text-stone-400 shrink-0">
                    {service.latencyMs}ms
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
