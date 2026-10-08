import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './components/ThemeProvider.tsx';
import { installAuthFetch } from './lib/authFetch';
import { initAppLogTracker } from './lib/appLogs';
import './index.css';
import * as Sentry from '@sentry/react';
import { minimizeDiagnosticEvent } from './lib/telemetryPrivacy';
import { ErrorBoundary } from './components/ErrorBoundary';

// P0-3: Muss VOR dem ersten Rendern laufen — die Widgets schicken ihre erste
// Anfrage bereits im ersten useEffect. Wäre die Hülle danach installiert,
// liefe genau dieser Aufruf ohne Token.
installAuthFetch();
initAppLogTracker();

// Browser performance traces and automatic session tracking remain disabled
// until a separately reviewed purpose and data contract exists. Operational
// latency metrics remain available server-side without browser session payloads.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  enabled: import.meta.env.PROD,
  defaultIntegrations: false,
  integrations: [Sentry.globalHandlersIntegration(), Sentry.dedupeIntegration()],
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSendTransaction: () => null,
  beforeSend: minimizeDiagnosticEvent,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider><App /></ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);


// BEFUND 10.08.2026, teuer bezahlt: Im Entwicklungsmodus lieferte der
// Service Worker alte Bausteine aus. Eine korrigierte firebase.ts und ein
// korrigiertes Dashboard.tsx lagen im Repo, im Browser lief weiter die alte
// Fassung -- die Konsole zeigte Zeilennummern, die es nicht mehr gab. Bis
// das auffiel, verging eine Stunde.
//
// Deshalb: Registrierung nur im gebauten Stand. Beim Entwickeln wird eine
// vorhandene Registrierung aktiv entfernt und der Speicher geleert, damit
// dieselbe Falle nicht ein zweites Mal zuschnappt.
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((alle) => {
      for (const r of alle) {
        void r.unregister();
      }
      if (alle.length > 0) {
        console.info(
          'Entwicklungsmodus: Service Worker entfernt. Einmal neu laden, ' +
            'dann laeuft garantiert der aktuelle Stand.',
        );
      }
    });
    if ('caches' in window) {
      void caches.keys().then((namen) => namen.forEach((n) => caches.delete(n)));
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((fehler) => console.warn('SW-Registrierung fehlgeschlagen:', fehler));
    });
  }
}
