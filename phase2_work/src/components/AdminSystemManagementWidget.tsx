import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { ShieldAlert, Terminal, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { motion } from 'motion/react';

export function AdminSystemManagementWidget() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [systemEvents, setSystemEvents] = useState<{ id: string, type: 'info' | 'warn' | 'error', message: string, time: string }[]>([]);

  useEffect(() => {
    // Sync UI with actual klarStorage event if already set
    const currentMode = klarStorage.getItem('klar_maintenance_mode') === 'true';
    setIsMaintenance(currentMode);

    try {
      const savedEvents = klarStorage.getItem('klar_system_events');
      if (savedEvents) {
        setSystemEvents(JSON.parse(savedEvents));
      } else {
        const initial = [
          { id: '1', type: 'info' as const, message: 'KLAR Admin-Konsole initialisiert', time: new Date().toISOString() }
        ];
        setSystemEvents(initial);
        klarStorage.setItem('klar_system_events', JSON.stringify(initial));
      }
    } catch {
      setSystemEvents([]);
    }
  }, []);

  const toggleMaintenance = () => {
    const newState = !isMaintenance;
    setIsMaintenance(newState);
    klarStorage.setItem('klar_maintenance_mode', String(newState));

    const newEvent = {
      id: Date.now().toString(),
      type: (newState ? 'warn' : 'info') as 'error' | 'info' | 'warn',
      message: `Wartungsmodus ${newState ? 'aktiviert' : 'deaktiviert'}${newState && maintenanceReason ? `: ${maintenanceReason}` : ''}`,
      time: new Date().toISOString()
    };

    setSystemEvents(prev => {
      const updated = [newEvent, ...prev].slice(0, 15);
      klarStorage.setItem('klar_system_events', JSON.stringify(updated));
      return updated;
    });

    // Dispatch system-wide event
    window.dispatchEvent(new CustomEvent('klar-maintenance-mode', {
      detail: newState ? 'on' : 'off'
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-stone-800 p-4 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700">
        <div className="flex flex-col mb-4">
          <h2 className="font-bold text-stone-900 dark:text-white mb-2 flex items-center gap-2">
            <ShieldAlert className="text-amber-500" size={20} />
            Echtzeit Systemsteuerung
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
            Globale Flags und Notfallschalter. Ein aktivierter Wartungsmodus blockiert den Zugang für alle nicht-Admin User sofort.
          </p>
          <div className="flex items-center justify-between gap-4 bg-stone-50 dark:bg-stone-900/50 p-4 rounded-xl border border-stone-100 dark:border-stone-700">
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1 block">Wartungsgrund</label>
              <input
                type="text"
                disabled={isMaintenance}
                placeholder="Grund (z.B. Datenbank-Migration)"
                value={maintenanceReason}
                onChange={(e) => setMaintenanceReason(e.target.value)}
                className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col items-end pt-5">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggleMaintenance}
                className={`px-6 py-2 rounded-xl font-medium text-sm flex items-center gap-2 transition-colors ${
                  isMaintenance
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20'
                }`}
              >
                {isMaintenance ? 'Wartung stoppen' : 'Wartung erzwingen'}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 overflow-hidden">
        <div className="p-4 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center bg-stone-50/50 dark:bg-stone-900/20">
          <h2 className="font-bold text-stone-900 dark:text-white flex items-center gap-2">
            <Terminal size={18} className="text-stone-500" />
            Kritische Systemereignisse (Live)
          </h2>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Live</span>
          </div>
        </div>
        <div className="divide-y divide-stone-100 dark:divide-stone-700/50">
          {systemEvents.map(event => (
            <div key={event.id} className="p-4 flex items-start gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
              <div className="mt-0.5">
                {event.type === 'error' ? <AlertCircle size={16} className="text-rose-500" /> :
                 event.type === 'warn' ? <Activity size={16} className="text-amber-500" /> :
                 <CheckCircle2 size={16} className="text-emerald-500" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">{event.message}</p>
                <p className="text-xs text-stone-500 mt-1">{new Date(event.time).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {systemEvents.length === 0 && (
            <div className="p-6 text-center text-stone-500 text-sm">Keine Ereignisse verzeichnet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
