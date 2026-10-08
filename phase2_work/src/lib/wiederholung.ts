// ═══════════════════════════════════════════════════════════════════════════
// Wann darf der Client eine gescheiterte Anfrage wiederholen?
//
// Diese Datei importiert NICHTS. Sie läuft ohne Firebase, ohne Browser und
// ohne installierte Pakete — und ist genau deshalb prüfbar
// (tests/wiederholung.spec.ts). Dieselbe Regel wie in `pure.ts` und
// `kiPolitik.ts`.
//
// ── DER BEFUND VOM 13.08.2026 ─────────────────────────────────────────────
// `fetchWithTimeout` in `src/lib/api.ts` wiederholte jede Antwort mit
// Status >= 500, bis zu zweimal, mit wachsender Wartezeit:
//
//     if (!response.ok && response.status >= 500 && attempt < retries) {
//        throw new Error(`Server error: ${response.status}`);   // -> Neuversuch
//     }
//
// In dieser App bedeutet 503 aber fast immer `ki_kontingent`: Das
// KI-Kontingent ist erschöpft (siehe `fehlerStatus` in `kiPolitik.ts`). Und
// der Server hat vorher bereits selbst wiederholt — `beantworte` fragt
// `lohntWiederholung(code)` und versucht es erneut, wenn es lohnt.
//
// Damit lagen ZWEI Wiederholungsschichten übereinander: aus einem Ausfall
// wurden bis zu drei Anfragen vom Client, jede davon mit den Versuchen des
// Servers darin. Im Betrieb am 13.08. war das Stundenkontingent von 60
// Anfragen nach einem einzigen Laden des Dashboards aufgebraucht.
//
// Ein erschöpftes Kontingent wird durch Nachfragen nicht voller. Die
// Wiederholung hat den Zustand nicht behoben, sondern verlängert.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Wiederholt wird nur, was der Server NICHT schon selbst entschieden hat.
// Eine Antwort aus `kiPolitik.ts` trägt immer ein Feld `code` — daran ist
// sie zu erkennen. Wer ein `code` schickt, hat seine Wiederholungen hinter
// sich; der Client legt keine zweite Runde darauf.
//
// Alles andere mit 5xx — ein abgestürzter Prozess, ein Neustart, ein
// vorgelagerter Dienst — hat keinen `code` und darf wiederholt werden.
// Netzwerkfehler ohne jede Antwort laufen gar nicht durch diese Funktion;
// sie landen im `catch` und werden weiterhin wiederholt.
// ═══════════════════════════════════════════════════════════════════════════

/** Trägt die Antwort ein `code`-Feld aus `kiPolitik.ts`? */
export function hatFehlercode(koerper: unknown): boolean {
  if (koerper === null || typeof koerper !== "object") return false;
  const wert = (koerper as Record<string, unknown>)["code"];
  return typeof wert === "string" && wert.length > 0;
}

/**
 * Darf der Client diese Antwort wiederholen?
 *
 * @param status  HTTP-Status der Antwort.
 * @param koerper Bereits geparster Antwortkörper, oder `null`, wenn er sich
 *                nicht lesen liess. Nicht lesbar heisst: kein `code`, also
 *                keine Antwort aus `kiPolitik.ts` — dann gilt die 5xx-Regel.
 */
export function sollWiederholen(status: number, koerper: unknown): boolean {
  // 4xx ist eine Aussage über die Anfrage, nicht über den Zustand des
  // Dienstes. Sie wird beim zweiten Mal nicht anders. Das schliesst 429
  // ausdrücklich ein.
  if (status < 500) return false;
  // Der Server hat nach eigener Regel entschieden und ggf. selbst wiederholt.
  if (hatFehlercode(koerper)) return false;
  return true;
}
