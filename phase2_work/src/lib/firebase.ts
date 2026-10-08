import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, initializeFirestore, connectFirestoreEmulator, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// ═══════════════════════════════════════════════════════════════════════════
// Lokaler Entwicklungsmodus (09.08.2026)
//
// WOZU: Die App ist bis heute nie mit Datenbank gelaufen. Der Server ruft
// `initializeApp()` ohne Zugangsdaten; im Codespace gibt es keine
// Application Default Credentials, also scheitert jeder Firestore-Zugriff.
// Seit der Altersprüfung (DSG-02) ist das sperrend: Ohne Schreibzugriff kann
// `isAdult` nicht gesetzt werden, das Gate öffnet nie, und kein einziger
// KI-Endpunkt ist erreichbar.
//
// Mit `npm run dev:lokal` laufen Auth und Firestore als Emulator. Kein
// Konto, keine Kosten, keine echten Daten — und der ganze Weg von der
// Anmeldung über die Altersangabe bis zum KI-Coach ist begehbar.
//
// WARUM `demo-klar` STATT DER ECHTEN PROJEKT-ID: Bei einer ID mit dem
// Präfix `demo-` verlangt die Firebase-CLI keine Anmeldung und kann
// garantiert nie mit der echten Datenbank sprechen. Dieselbe ID benutzen
// die Regeltests — ein Versehen, das Testdaten in die Produktion schreibt,
// ist damit ausgeschlossen.
//
// Der Schalter ist `VITE_EMULATOR`, gesetzt vom Skript `dev:lokal`.
// Ohne ihn verhält sich diese Datei wie vorher.
// ═══════════════════════════════════════════════════════════════════════════

const emulator = import.meta.env.VITE_EMULATOR === 'true';

const config = emulator
  ? { ...firebaseConfig, projectId: 'demo-klar' }
  : firebaseConfig;

const app = initializeApp(config);

// ── BEFUND 10.08.2026, im Browser bestätigt ───────────────────────────────
// Hier stand fest verdrahtet `127.0.0.1:9099` und `127.0.0.1:8080`, mit dem
// Kommentar, VS Code reiche den Port durch. Das ist falsch: Im
// Browser-Codespace läuft die Seite auf dem Rechner der bedienenden Person,
// die Emulatoren im Container. `127.0.0.1` zeigt dort auf die eigene
// Maschine — Ergebnis: ERR_CONNECTION_REFUSED auf 127.0.0.1:9099.
//
// Ich hatte den Weg nicht ausprobieren können und die Annahme trotzdem als
// Tatsache in den Kommentar geschrieben. Der Fehler war die Behauptung,
// nicht die Adresse.
//
// Im Codespace ist derselbe Dienst unter der weitergeleiteten Adresse
// erreichbar: aus  …-3000.app.github.dev  wird  …-9099.app.github.dev,
// über HTTPS auf Port 443.
const imCodespace =
  typeof window !== 'undefined' && /\.app\.github\.dev$/.test(window.location.hostname);

/** Adresse eines Emulators — lokal 127.0.0.1, im Codespace die
 *  weitergeleitete. Die Portnummer steckt dort im Hostnamen. */
const emulatorHost = (port: number): string =>
  imCodespace ? window.location.hostname.replace(/-\d+\./, `-${port}.`) : '127.0.0.1';

export const auth = getAuth(app);

// Firestore muss VOR dem ersten Zugriff eingerichtet werden, deshalb hier
// und nicht weiter unten.
//
// WARUM NICHT `connectFirestoreEmulator` IM CODESPACE: Die Funktion setzt
// `ssl` auf das Ergebnis von `isCloudWorkstation(host)` — für
// `.app.github.dev` also `false`. Sie spräche unverschlüsselt gegen eine
// HTTPS-Adresse. Nachgesehen im Quelltext des firebase-js-sdk
// (packages/firestore/src/lite-api/database.ts), nicht vermutet.
// Deshalb im Codespace der Weg über `initializeFirestore` mit `ssl: true`.
//
// `experimentalForceLongPolling`: Die Portweiterleitung von Codespaces
// verträgt sich schlecht mit dem Streaming-Verfahren, das Firestore sonst
// benutzt. Langes Abfragen ist langsamer, aber es kommt an.
export const db = !emulator
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, firebaseConfig.firestoreDatabaseId)
  : imCodespace
    ? initializeFirestore(app, {
        host: emulatorHost(8080),
        ssl: true,
        experimentalForceLongPolling: true,
      })
    : getFirestore(app);

if (emulator) {
  connectAuthEmulator(
    auth,
    imCodespace ? `https://${emulatorHost(9099)}` : 'http://127.0.0.1:9099',
    { disableWarnings: true },
  );
  if (!imCodespace) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  // Deutlich sichtbar in der Konsole: Es ist nicht die echte Datenbank.
  console.info(
    '%cKlar läuft gegen die lokalen Emulatoren (Projekt demo-klar). Keine echten Daten.',
    'background:#3f4a3c;color:#fff;padding:2px 6px;border-radius:4px',
  );
  console.info(
    imCodespace
      ? `Emulatoren über die Codespaces-Weiterleitung: Auth ${emulatorHost(9099)}, ` +
        `Firestore ${emulatorHost(8080)}. Beide Ports müssen auf „Public" stehen.`
      : 'Emulatoren über 127.0.0.1 — Ports 9099 und 8080.',
  );
}

// Connection validation (Firebase Skill constraint)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();


export { app };
