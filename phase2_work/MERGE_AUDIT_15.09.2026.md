# Klar Enterprise Merge Audit — 15.09.2026

## Konsolidierungsentscheidung

Die beiden Uploads wurden als zwei Entwicklungsstände desselben Produkts verglichen.

**Basis:** `Klar_15.09.2026`

**Selektiv übernommen aus:** `remix-klar-cl_15.09.2026`

Übernommen wurden nur Änderungen, die im Vergleich nachweisbar einen Qualitätsgewinn darstellen und keine Sicherheits-/Produktionsgarantie durch Mocking oder erfundene Daten unterlaufen:

- KI-Endpunkt-Inventar in `src/server/kiPolitik.ts` vervollständigt (`/api/ai-list`, `/api/analyze-reflection`, `/api/ai-coach`).
- KI-Endpunkt-Liste in `server.ts` mit den tatsächlich vorhandenen KI-Routen synchronisiert.
- Drei hinter der UI-Auslieferung liegende, nicht erreichbare Demo-Endpunkte entfernt.
- Service Worker um eine deterministische `sollAbfangen()`-Entscheidung ergänzt und vor `respondWith()` eingebunden.
- Fehlende zugängliche Beschriftungen in `ImageCropperModal.tsx` ergänzt.

## Bewusst NICHT übernommen

Der Remix-Stand enthält mehrere Änderungen, die für ein Enterprise-Paket nicht als Verbesserung gelten:

- `handleVerificationDecide()` ersetzt die echte Firebase-Admin-Berechtigungsprüfung durch ein festes `moderator: true`-Mock.
- Der Verifizierungsfoto-Speicherpfad wird durch einen Mock ersetzt; echte Speicherung wird auskommentiert.
- Teile der Server-Authentifizierung/DB-Anbindung werden durch Mock-/Fehlerpfade ersetzt.
- `AdminDashboard` zeigt feste, künstliche Testergebnisse an (`mockTestResults`).
- Mehrere Produkt-/UI-Änderungen sind nicht durch eine belastbare End-to-End-Prüfung abgesichert.

Diese Änderungen würden Sicherheits-, Datenintegritäts- oder Observability-Garantien schwächen und wurden deshalb verworfen.

## Prüfungen in dieser Umgebung

Erfolgreich ausgeführt:

- Service-Worker-Durchreiche: **10/10**
- KI-Ersatzstrategie: **23/23 KI-Endpunkte**
- Kontrastprüfung: **alle geprüften Paare**
- Hook-/Importprüfung: **grün**
- Namens-/Undefined-Use-Prüfung: **grün**
- JSON-Form-/KI-Antwortprüfung: **grün**
- Doppelte-Einstellungen-Prüfung: **grün**
- Meilenstein-Schreibstellen: **7/7**
- feste Diagrammdaten: **0**
- erfundene Aussagen: **0**
- OAuth-Zusatzberechtigungen: **0**
- Löschkaskaden-Prüfung innerhalb der erlaubten Toleranz: **grün**
- Skript-Vollständigkeit: **grün**
- CSP-Direktiven: **12/12**
- Effekt-Abhängigkeiten: **grün**
- KI-Guardrail-Prüfung konnte wegen unvollständiger `node_modules` nicht ausgeführt werden.

## Nicht vollständig ausführbar

Die vollständige TypeScript-/Vitest-/Firebase-Validierung konnte in dieser Ausführungsumgebung nicht abgeschlossen werden:

- Repository verlangt Node `>=22.22.2`; verfügbar ist Node `22.16.0`.
- `npm ci` konnte hier wegen der Ausführungs-/Installationsumgebung nicht vollständig beendet werden.
- Dadurch fehlen u. a. `vite/client` und weitere installierte Tooling-Abhängigkeiten.
- Build, Serverstart, Browser-/E2E-Tests, Firebase-Emulator-Regeltests und Storage-Regeltests wurden daher **nicht als erfolgreich behauptet**.

## Bekannte statische Restbefunde des Basiscodes

Die bestehenden Ratchet-Prüfungen melden weiterhin:

- Formularfelder ohne `id`/`name`: **60** bei Schwelle **59**.
- Labels ohne Feldbezug: **29** bei Schwelle **28**.
- Initial fest eingebundene eigene Dateien: **46** bei Schwelle **41**.

Diese Punkte sind im Archiv dokumentiert und absichtlich nicht durch das bloße Anheben der Schwellenwerte „grün gemacht“.

## Fazit

Das Archiv ist ein **konsolidierter Enterprise-Kandidat**, der den sichereren der beiden Stände als Basis verwendet und nachweisbare Verbesserungen des zweiten Stands integriert.

Es wäre sachlich falsch, ihn unter den hier verfügbaren Bedingungen als „lückenlos getestet, fehlerfrei und endgültig produktionsbereit“ zu deklarieren. Vor einem echten Go-Live müssen mindestens Node `22.22.2+`, ein vollständiges `npm ci`, Typecheck, Build, Unit-/Integrationstests, Firebase Firestore **und Storage**-Regeltests sowie Browser-/E2E- und Security-Tests erfolgreich durchlaufen.
