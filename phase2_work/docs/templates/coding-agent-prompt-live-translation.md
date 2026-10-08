# SYSTEM INSTRUCTION FÜR CODING-AGENT: Implementierung Live-Übersetzung

**Kontext:** Du implementierst die Live-Übersetzung für die Dating-App "Klar".
**Wichtigste Regel:** Verwende NIEMALS die Wörter "Swipe", "Match", "Like" oder "Deck". Nutze "Kontakt", "Verbindung" und "Vorschlag". Das UI ist strikt minimalistisch (keine bg-gradients, keine Schlagschatten, keine unnötigen Animationen).

## Aufgaben-Paket 1: Backend (`server.ts`)
1. Suche den Endpunkt `POST /api/messages/send`.
2. Lese `users/{receiverId}`, um das Feld `preferredLanguage` zu ermitteln (Default "de").
3. Implementiere einen Fetch-Call gegen `http://translator-node:8000/translate` (mit 1200ms Timeout via `AbortController`).
4. **Fallback-Logik:** Wenn der Aufruf fehlschlägt (Catch), schreibe die Nachricht normal in Firestore, setze aber `translationError: true`.
5. **Erfolgs-Logik:** Speichere die übersetzte Variante als `text` und die ursprüngliche Eingabe als `originalText`. Setze `sourceLanguage` und `targetLanguage`.

## Aufgaben-Paket 2: Frontend (`src/components/MessageBubble.tsx` oder wo Nachrichten gerendert werden)
1. Lese die neuen Felder (`originalText`, `translationError`, `sourceLanguage`) aus dem Nachrichten-Objekt aus.
2. Implementiere einen lokalen State (`useState`), um zwischen `text` und `originalText` umzuschalten.
3. Lege den `onClick`-Handler auf die gesamte Nachrichtenblase (Touch-Target-Sicherheit).
4. Füge einen dezenten Text-Knoten (11px, Textfarbe `text-stone-500` light / `text-stone-400` dark) unter der Blase hinzu.
   - Text bei Übersetzung: "Übersetzt aus [Sprache]."
   - Text nach Toggle: "Original anzeigen. Tippe zum Übersetzen."
   - Text bei Fehler: "Original (Übersetzung derzeit nicht verfügbar)."
5. Sorge für barrierefreie Zugänglichkeit (`aria-label`, `tabIndex`).

## Qualitätskriterien für den Code:
- Keine `console.error` im Frontend, nutze `melde("MessageBubble", e)`.
- Keine leeren `catch`-Blöcke.
- Kein UI-Slop (kein Konfetti, keine bunten Ränder).
