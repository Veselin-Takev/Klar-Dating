// ═══════════════════════════════════════════════════════════════════════════
// Was ein Gast darf — und was nicht
//
// Diese Datei importiert NICHTS. Kein Firebase, kein Express. Sie ist damit
// prüfbar (tests/gastrechte.spec.ts) — dieselbe Regel wie in `pure.ts`,
// `kiPolitik.ts` und `wiederholung.ts`.
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// `firestore.rules` enthielt 39 `allow`-Regeln, und keine einzige prüfte, ob
// die anmeldende Person ein Gast ist. Weder
// `request.auth.token.firebase.sign_in_provider` noch ein `isAnonymous`-Feld
// kamen vor — in `server.ts` ebenso wenig.
//
// Praktische Folge: „Als Gast fortfahren" gab VOLLE Rechte. Ein anonymes
// Konto ist in Sekunden erstellt, hinterlässt keine Spur und lässt sich
// beliebig oft neu anlegen. Bei einer Dating-App ist genau das das Profil,
// das man bei Belästigung und Betrug nicht mit vollen Rechten haben will.
//
// ── DIE LINIE (Produktentscheidung vom 14.08.2026) ────────────────────────
// Der Gastmodus dient der Vorschau. Sobald eine Handlung eine INTERAKTION
// MIT ANDEREN MENSCHEN auslöst, greift das Registrierungs-Gate.
//
//   erlaubt   Profile ansehen, Filter und Suche, KI-Werkzeuge ausprobieren
//   gesperrt  Kontakt aufnehmen, Icebreaker-Gate, Verifizierung, Abo
//
// ── WARUM EINE SPERRLISTE UND KEINE ERLAUBNISLISTE ────────────────────────
// Eine Erlaubnisliste müsste bei jedem der 116 Endpunkte gepflegt werden;
// ein vergessener Eintrag hiesse „für Gäste gesperrt", und die Funktion wäre
// still kaputt. Bei einer Sperrliste heisst ein vergessener Eintrag „für
// Gäste offen" — auch nicht schön, aber sichtbar, weil die Funktion dann
// funktioniert und im Test auffällt.
//
// Der Ausschlag gibt die Grösse: Die Sperrliste hat sieben Einträge und ist
// als Ganzes lesbar. Eine Erlaubnisliste mit 109 Einträgen liest niemand.
//
// ── WAS AUSDRÜCKLICH ERLAUBT BLEIBT, OBWOHL ES SCHREIBT ───────────────────
// · `/api/report` und `/api/block` — Melden und Blockieren sind
//   Schutzfunktionen. Sie einem Gast zu verwehren hiesse, jemanden, der
//   gerade belästigt wird, erst zur Registrierung zu zwingen.
// · `/api/account/alter` und `/api/einwilligung` — ohne sie kommt ein Gast
//   nicht durch die Altersabfrage und damit nirgendwohin.
// · `/api/account/delete` — das Recht auf Löschung gilt auch für Gäste
//   (Art. 17 DSGVO). Es an eine Registrierung zu binden wäre absurd.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Endpunkte, die eine Interaktion mit anderen Menschen auslösen oder ein
 * dauerhaftes Konto voraussetzen. Für Gäste gesperrt.
 */
export const GAST_GESPERRT: ReadonlySet<string> = new Set([
  // Kontakt ist die erste Nachricht an einen neuen Menschen. Sie erzeugt
  // beim Gegenüber eine Benachrichtigung — das geht nicht anonym.
  '/api/contact',
  '/api/contact/undo',
  // Das Icebreaker-Gate ist ein Austausch zu zweit.
  '/api/gate/answer',
  // Verifizierung setzt ein dauerhaftes Konto voraus; ein Gastkonto ist beim
  // naechsten Besuch weg, die biometrische Pruefung waere umsonst gemacht.
  '/api/verification/challenge',
  '/api/verification/submit',
  '/api/verification/decide',
  // Ein Gast hat kein Abo. Die beiden Wege wuerden ins Leere laufen.
  '/api/subscription/cancel',
  '/api/subscription/withdraw',
]);

/**
 * Eigene Stundengrenze für KI-Aufrufe von Gästen.
 *
 * WARUM NIEDRIGER: Ein Gastkonto entsteht in Sekunden, ohne E-Mail, ohne
 * Nachweis. Die Grenze von 60 Aufrufen pro Stunde und Konto (server.ts:444)
 * ist damit keine Grenze mehr — wer sie erreicht, meldet sich neu an. Eine
 * niedrigere Zahl macht das nicht unmöglich, aber unattraktiv: Der Aufwand
 * je gewonnenem Aufruf steigt.
 *
 * 15 reicht, um die Werkzeuge auszuprobieren — das ist der Zweck des
 * Gastmodus. Es reicht nicht, um die App dauerhaft kostenlos zu nutzen.
 */
export const GAST_KI_GRENZE = 15;

/** Wie Firebase den Anmeldeweg im Token nennt. */
const ANONYM = 'anonymous';

/**
 * Ist dieses Token ein Gastzugang?
 *
 * Firebase legt den Anmeldeweg unter `firebase.sign_in_provider` ab. Bei
 * `signInAnonymously()` steht dort `"anonymous"`.
 *
 * STRENG GEPRÜFT, nicht geraten: Fehlt das Feld oder hat es einen anderen
 * Typ, gilt das Token NICHT als Gast. Die Alternative — im Zweifel sperren —
 * würde bei einer Formatänderung von Firebase jede angemeldete Person
 * aussperren. Ein zu weit geöffnetes Gasttor ist dann immer noch durch die
 * Firestore-Regeln gedeckt, ein gesperrtes Konto durch nichts.
 */
export function istGast(token: unknown): boolean {
  if (token === null || typeof token !== 'object') return false;
  const firebaseTeil = (token as Record<string, unknown>)['firebase'];
  if (firebaseTeil === null || typeof firebaseTeil !== 'object') return false;
  const weg = (firebaseTeil as Record<string, unknown>)['sign_in_provider'];
  return weg === ANONYM;
}

/**
 * Darf ein Gast diesen Pfad aufrufen?
 *
 * @param pfad Der Pfad MIT führendem `/api`, so wie ihn die zentrale
 *             Middleware in `server.ts` bildet.
 */
export function gastDarf(pfad: unknown): boolean {
  if (typeof pfad !== 'string' || pfad.length === 0) return false;
  // Ein Pfad mit Abfrageteil oder Schrägstrich am Ende soll dieselbe Antwort
  // bekommen wie der Pfad selbst — sonst ist die Sperre mit `?x=1` umgehbar.
  const ohneAbfrage = pfad.split('?')[0] ?? '';
  const normiert =
    ohneAbfrage.length > 1 && ohneAbfrage.endsWith('/')
      ? ohneAbfrage.slice(0, -1)
      : ohneAbfrage;
  return !GAST_GESPERRT.has(normiert);
}

/** Der Fehlercode, an dem der Client das Registrierungs-Gate erkennt. */
export const CODE_KONTO_ERFORDERLICH = 'konto_erforderlich';

/** Der Satz, der dabei angezeigt wird. Steht hier, damit überall derselbe
 *  steht — dieselbe Begründung wie bei `fehlertext` in `kiPolitik.ts`. */
export const TEXT_KONTO_ERFORDERLICH =
  'Erstelle in wenigen Sekunden ein kostenloses Konto, um mit diesem Profil in Kontakt zu treten.';
