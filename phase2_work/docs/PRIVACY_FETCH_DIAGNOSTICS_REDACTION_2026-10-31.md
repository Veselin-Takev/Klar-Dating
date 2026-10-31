# P1 #206 – Firebase-Download-Token nicht in Client-Diagnostik ausgeben

**Stand:** 31.10.2026 · **Status:** Draft / BLOCKED / NO-GO · **Branch:** `fix/206-redact-client-fetch-diagnostics-20261031`, isoliert auf `main` (`2808dc1cbb485f70b403681c108cea5a3361d950`), unabhängig von der P0-Retention-PR-Kette.

## Quellcodebefund

Das offene [Privacy-Issue #206](https://github.com/Veselin-Takev/Klar-Dating/issues/206) dokumentiert, dass `src/lib/klar.ts` mittels `getDownloadURL` Firebase-Profile-Foto-Downloadlinks als `photoURL` speichert. Solche URLs können ein langlebiges `?token=...`-Geheimnis enthalten. Im Bestand von `src/lib/api.ts` nutzte die Exportfunktion `monitoredFetch` das unbereinigte `input.toString()` sowohl in `console.debug` nach einer langsamen Anfrage als auch bei `melde` für Fetch-Ausnahmen; die ursprüngliche Exception konnte ebenfalls in die Diagnostik/Sentry gelangen. `fetchWithTimeout` sendete über den Browser-Event `klar_api_error` die unbereinigte `resource.toString()` und `error.message` weiter.

Damit gab es **einen nachweisbaren Pfad zur Offenlegung einer kopierten Capability-URL in lokalen Logs, Browser-Events oder optionaler Telemetrie**. Es ist **kein nachgewiesener Live-Datenabfluss**.

## Gezielte, risikoarme Umsetzung

- `monitoredFetch` führt Netzwerkanfragen unverändert aus und liefert dieselben Responses bzw. wirft dieselben Fehler an den Aufrufer. Für langsame Anfragen wird nur die ganzzahlige Dauer protokolliert – **kein Host, Pfad, Querystring, UID, Header oder Token**.
- Bei einem Fetch-Fehler wird an `melde` ausschließlich `http_request_failed` und eine **neu erzeugte, konstante** Fehlermeldung `Network request failed` übergeben, nie die originale Exception (einschließlich Stack und `cause`). Der originale Fehler wird für die aufrufende Fachlogik weitergeworfen.
- `fetchWithTimeout` behält das Browser-Event `klar_api_error` mit den bisherigen `message`-/`url`-Schlüsseln, setzt deren Inhalte aber auf den konstanten Standardfehler und `[redacted]`. Der aktive `GlobalApiOverlay` verwendet ohnehin keine detailinterne URL, sodass seine Accessibility- und Fehlermeldungslogik erhalten bleibt.
- `tests/fetchDiagnosticsPrivacy.spec.ts` verifiziert die tatsächliche Netzwerk-URL nur am Fetch-Aufruf, prüft dass eine langsame Anfrage trotz Token nicht in die Console leakt, ein beliebiger Fehler mit URL im Message/Stack Sentry-sicher sanitisiert wird, und dass das globale Fehlerereignis keine URL/Exception enthält.
- Ein obligatorischer `check:fetch-diagnostics-privacy`-Source-Gate ist in `check:enterprise` unmittelbar nach `check:ai-pii-sanitizer` eingebunden und erkennt ein Zurückfallen auf die rohe Anfrage-URL oder Exception.

## Strikte Release-Grenze

**Dieser PR behebt nur den diagnostischen Token-Leak-Pfad. Issue #206 bleibt offen und BLOCKED.** Insbesondere sind durch die Korrektur **nicht** gelöst: bestehende, kopierte Download-URLs, die Authentifizierung/Autorisierung pro Bild-Lesezugriff, Migration von `photoURL` auf einen nicht-bearer Opaque-Handle oder geschützten Bildlesepfad, einmalige Token-Rotation/-Revocation, Firestore-Projektionen, Referrer-/CDN-/Cache-Verhalten, aktiver Cloud-IAM-/Rules-Status, Erasure-/Legal-Hold-Prozesse, echte Staging-E2E und unabhängige Security-/DPO-/Legal-/SRE-Reviews.

Ein technischer PASS erfordert die **vollständige CI auf dem exakten Branch-HEAD** und unabhängige Reviews. Kein Produktionszugriff, keine Token-Rotation, kein Release, Merge oder Deployment. **Formal: BLOCKED / NO-GO.**
