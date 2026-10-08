import { getDb as getFirestore } from './db.ts';
import { ZWISCHENSPEICHER_HOECHSTALTER_STUNDEN } from './kiPolitik.ts';

// ═══════════════════════════════════════════════════════════════════════════
// Klar — der Zwischenspeicher für KI-Auswertungen
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// `kiPolitik.ts` weist elf Endpunkten die Strategie `zwischenspeicher` zu:
// Fällt die KI aus, wird die letzte gültige Auswertung ausgeliefert — MIT
// ausgewiesenem Alter und dem Hinweis, dass sie gespeichert ist. Das gilt
// nur für Auswertungen, die sich langsam ändern und deren veralteter Stand
// nicht in die Irre führt.
//
// Bis heute gab es diesen Speicher nicht. Die betroffenen Endpunkte sind
// deshalb seit dem 11.08.2026 ehrlich gescheitert — richtig, aber ohne
// Nutzen. Diese Datei schliesst die Lücke.
//
// ── WAS DABEI NEU ENTSTEHT, UND WAS DAS NACH SICH ZIEHT ───────────────────
// Hier werden zum ersten Mal KI-Auswertungen ÜBER EINE PERSON dauerhaft
// gespeichert. Das ist eine neue Verarbeitung personenbezogener Daten, und
// sie zieht vier Pflichten nach sich, die alle in diesem Zug erfüllt sind:
//
//   1. ZWECKBINDUNG — ausschliesslich Ersatzanzeige bei Ausfall der KI.
//      Keine Auswertung, kein Profiling, keine Weitergabe.
//   2. SPEICHERFRIST — 36 Stunden (`kiPolitik.ts`). Ältere Einträge werden
//      beim Lesen gelöscht, nicht nur ignoriert. Ein Eintrag, der nicht mehr
//      benutzt werden darf, hat auch keinen Grund, weiter zu existieren.
//   3. AUSKUNFT (Art. 15 DSGVO) — der Speicher ist Teil von
//      `/api/account/export`. Siehe `datenschutz.ts`.
//   4. LÖSCHUNG (Art. 17 DSGVO) — der Speicher hängt in der Löschkaskade.
//      Siehe `trustAndSafety.ts`. Firestore löscht Unterkollektionen NICHT
//      mit dem Elterndokument; sie muss ausdrücklich aufgeräumt werden.
//
// ── WARUM ALS UNTERKOLLEKTION DES NUTZERS ─────────────────────────────────
// `users/{uid}/ki_zwischenspeicher/{endpunkt}` statt einer eigenen Sammlung
// auf oberster Ebene. Damit steht der Bezug zur Person im Pfad, Auskunft und
// Löschung finden ihn ohne Abfrage über ein Feld, und die Firestore-Regel
// ist eine Zeile.
//
// ── ZUGRIFF ───────────────────────────────────────────────────────────────
// Nur der Server. In `firestore.rules` steht ausdrücklich
// `allow read, write: if false` — obwohl schon die Vorgabe „alles gesperrt"
// gelten würde. Der ausdrückliche Eintrag ist Dokumentation: Er zeigt, dass
// die Sperre eine Entscheidung ist und kein Vergessen. Ein Regeltest
// bewacht sie.
// ═══════════════════════════════════════════════════════════════════════════

/** Was im Speicher liegt. */
export interface Eintrag {
  daten: Record<string, unknown>;
  /** ISO-8601, in UTC. */
  zeit: string;
}

/**
 * Aus einem Endpunktpfad einen gültigen Dokumentnamen machen.
 *
 * Firestore verbietet `/` in Dokumentnamen — `"/api/gemini/dating-readiness"`
 * wäre sonst ein Pfad über drei Ebenen statt ein Name. Ausserdem sind `.`,
 * `..` und Namen, die mit `__` beginnen und enden, unzulässig.
 */
export function schluessel(endpunkt: string): string {
  const roh = endpunkt
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_');
  // Ein leerer Name wäre ein Fehler, der erst in Firestore auffällt.
  return roh.length > 0 ? roh : 'unbenannt';
}

/**
 * Ist ein Eintrag noch verwertbar? Getrennt von der Firestore-Anbindung,
 * damit er ohne Datenbank prüfbar ist.
 *
 * Bewusst streng: Eine unlesbare oder in der Zukunft liegende Zeitangabe
 * gilt als nicht verwertbar. Ein Eintrag, dessen Alter man nicht kennt,
 * darf nicht als „Stand von …" ausgeliefert werden.
 */
export function istVerwertbar(
  zeit: string,
  jetzt: Date = new Date(),
  hoechstalterStunden: number = ZWISCHENSPEICHER_HOECHSTALTER_STUNDEN,
): boolean {
  const dann = Date.parse(zeit);
  if (!Number.isFinite(dann)) return false;
  const alterStunden = (jetzt.getTime() - dann) / 3_600_000;
  if (!Number.isFinite(alterStunden)) return false;
  if (alterStunden < 0) return false;
  return alterStunden <= hoechstalterStunden;
}

/** Der Pfad zur Unterkollektion. An einer Stelle, damit er nicht abweicht. */
export function pfad(uid: string): string {
  return `users/${uid}/ki_zwischenspeicher`;
}

/**
 * Letzten Stand lesen. Gibt `null` zurück, wenn es keinen gibt, er zu alt
 * ist oder etwas schiefgeht — nie einen Fehler nach aussen: Der
 * Zwischenspeicher ist eine Hilfe, kein Teil der Zusage.
 *
 * Ein zu alter Eintrag wird dabei GELÖSCHT, nicht nur übergangen.
 */
export async function lies(uid: string, endpunkt: string): Promise<Eintrag | null> {
  if (!uid) return null;
  try {
    const ref = getFirestore().collection(pfad(uid)).doc(schluessel(endpunkt));
    const schnappschuss = await ref.get();
    if (!schnappschuss.exists) return null;

    const d = schnappschuss.data() as Partial<Eintrag> | undefined;
    if (!d || typeof d.zeit !== 'string' || d.daten === null || typeof d.daten !== 'object') {
      // Unbrauchbarer Eintrag: weg damit, statt ihn jedes Mal neu zu prüfen.
      await ref.delete().catch(() => {});
      return null;
    }

    if (!istVerwertbar(d.zeit)) {
      await ref.delete().catch(() => {});
      return null;
    }

    return { daten: d.daten as Record<string, unknown>, zeit: d.zeit };
  } catch (e) {
    console.warn('Zwischenspeicher nicht lesbar:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Stand ablegen. Bewusst ohne Rückgabe und ohne Weiterreichen von Fehlern:
 * Ein misslungener Schreibvorgang darf eine geglückte Antwort nicht
 * verderben. Er wird protokolliert, mehr nicht.
 *
 * `herkunft` und `hinweis` werden NICHT mitgespeichert — sonst stünde beim
 * nächsten Ausfall `herkunft: 'ki'` in einer Antwort, die aus dem Speicher
 * kommt. `entscheideAntwort` setzt beide Felder selbst.
 */
export async function schreibe(
  uid: string,
  endpunkt: string,
  daten: Record<string, unknown>,
): Promise<void> {
  if (!uid) return;
  try {
    const { herkunft: _h, hinweis: _hw, standVom: _s, ...rein } = daten;
    await getFirestore()
      .collection(pfad(uid))
      .doc(schluessel(endpunkt))
      .set({ daten: rein, zeit: new Date().toISOString() });
  } catch (e) {
    console.warn('Zwischenspeicher nicht schreibbar:', e instanceof Error ? e.message : String(e));
  }
}
