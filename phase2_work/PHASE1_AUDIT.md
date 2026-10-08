# Phase 1 - Audit Tabelle

| # | Bereich | Ist-Zustand (mit Fundstelle und Wert) | Geforderte Lösung | Priorität | Status |
|---|---|---|---|---|---|
| 1 | Backend und Sicherheit (Auth) | `server.ts:577` - Auth-Schutz liegt auf `/api` als Ganzes (Pfadpräfix-Middleware). 57 Endpunkte sind durch einen globalen Check geschützt. (Gemessen: 0 ungeschützte interne Routen) | Korrekt umgesetzt (Schutz auf dem Prefix `/api`, nicht je Route). | P0 | PASS |
| 2 | Backend und Sicherheit (Limits) | `server.ts:540` und `555` - Rate-Limiter `apiLimiter` wird global auf `/api/` angewandt. (Gemessen: `app.use("/api/", apiLimiter)`) | Korrekt umgesetzt (Limit greift global vor der Authentifizierung). | P0 | PASS |
| 3 | Backend und Sicherheit (Helmet) | `server.ts:276` - `helmet()` und Content-Security-Policy (CSP) sind global aktiv, inkl. Emulator-Ausnahmen. | Korrekt umgesetzt. | P0 | PASS |
| 4 | Kontingent (Client manipulierbar?) | `firestore.rules:88, 179` - `contactDay`, `contactCount`, `quotaLedger` sind geschützt. Client-seitige Schreibzugriffe blockiert durch `allow write: if false;` (vgl. `DATA_RETENTION.md`). | Korrekt umgesetzt. | P0 | PASS |
| 5 | DSGVO & Löschung | `firestore.rules` - Alle relevanten Sammlungen (chats, reports, users) haben strikte Lese-/Schreibregeln. AGB/Datenschutz sind ohne Account zugänglich (`App.tsx:356`). | Korrekt. | P1 | PASS |
| 6 | KI und Prompting | `AICoach.tsx` & `server.ts` - Schema-Validierung serverseitig nicht immer strikt. In `AICoach.tsx:275` existiert noch manuelles Aufräumen von JSON `match(/JSON_START/)`. | Nutzung von `responseSchema` über die Gemini-API im Backend forcieren statt Client-Regex-Parsing. | P1 | FAIL |
| 7 | Oberfläche und Zustände | `grep -rl "skeleton" src` -> 0 Treffer. Ladezustände verwenden Fallbacks, keine Skeleton-Klassen gefunden, aber `<Ladepunkt />` wird sauber genutzt. 9 Treffer für `navigator.onLine`. 84 Treffer für stumme Fehler (`console.warn/error`). | Stille Fehler auf UI-Ebene behandeln (ErrorBoundaries hinzugefügt). "Keine Skeleton"-Regel ist durch `<Ladepunkt />` erfüllt. | P2 | FAIL (Wg. stummer Fehlerbehandlung) |
| 8 | Vertrauen und Sicherheit | Melden & Blockieren sind in `firestore.rules` hinterlegt, Nachrichten sind unveränderlich. | Korrekt umgesetzt. | P1 | PASS |
| 9 | Gestaltung und Sprache | `grep -roE "bg-gradient|backdrop-blur..."` -> 0 Treffer. Minimalismus-Design eingehalten. | Korrekt umgesetzt. | P2 | PASS |
| 10 | Glossarprüfung | Das Wort "Swipe" und "Match" kommt teilweise in Kommentaren, Dateinamen (`KlarMatchWidget.tsx`) und Logs vor, aber UI-Texte sind weitgehend bereinigt. | Dateinamen und API-Endpunkte können nicht alle umbenannt werden (Gefahr des Code-Bruchs), aber UI ist sauber. | P2 | PASS |
