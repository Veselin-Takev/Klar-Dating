import { useState, useEffect } from 'react';
import { AlertOctagon, WifiOff } from 'lucide-react';
import { useModalAccessibility } from '../lib/useModalAccessibility';

export function GlobalErrorOverlay() {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const visible = hasError || isOffline;
  const { dialogRef, onKeyDown } = useModalAccessibility<HTMLDivElement>(undefined, visible);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let fehlversuche = 0;
    const checkConnection = async () => {
      if (isOffline) return;
      try {
        const antwort = await fetch('/api/health', { cache: 'no-store' });
        if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
        fehlversuche = 0;
        setHasError(false);
      } catch (err) {
        fehlversuche += 1;
        console.warn(`Verbindungsprüfung fehlgeschlagen (${fehlversuche}/2):`, err);
        if (fehlversuche >= 2) {
          setHasError(true);
          setErrorMessage('Verbindung zum Server fehlgeschlagen. Bitte versuche es später erneut.');
        }
      }
    };

    const interval = setInterval(checkConnection, 30000);
    checkConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOffline]);

  if (!visible) return null;

  const title = isOffline ? 'Keine Internetverbindung' : 'Systemfehler';
  const description = isOffline
    ? 'Bitte überprüfe deine Netzwerkverbindung, um Klar weiter zu nutzen.'
    : errorMessage || 'Ein unerwarteter Fehler ist aufgetreten. Wir arbeiten bereits an einer Lösung.';

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="global-error-title"
        aria-describedby="global-error-description"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="bg-white dark:bg-stone-800 rounded-3xl p-6 w-full max-w-sm text-center shadow-sm"
      >
        <div aria-hidden="true" className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          {isOffline ? (
            <WifiOff size={32} className="text-rose-600 dark:text-rose-400" />
          ) : (
            <AlertOctagon size={32} className="text-rose-600 dark:text-rose-400" />
          )}
        </div>
        <h2 id="global-error-title" className="text-xl font-bold text-stone-900 dark:text-white mb-2">
          {title}
        </h2>
        <p id="global-error-description" className="text-stone-500 dark:text-stone-400 mb-6">
          {description}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full min-h-11 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors"
        >
          Neu laden
        </button>
      </div>
    </div>
  );
}
