# Server-Modularisierung

Stand: 2026-10-26. Aktiver Server: phase2_work/server.ts.
Frühere Statusangaben zu noch nicht ausgelagerten Webhook-/Chat-Routern waren veraltet.

| Bereich | Aktueller Zustand |
|---|---|
| Health / Account | Router in src/server/routes/health.ts und account.ts |
| Stripe-Webhooks | routes/webhooks.ts; Raw-Body-Mount vor JSON-Parser erhalten |
| Chat / Gates | routes/chat.ts; gemeinsame API-Zugriffskontrolle im Server |
| Billing, Partner, Launch, Date-Plans, Empfehlungen u.a. | Weitere eigene Router vorhanden |
| Request-Korrelation, Traces, Metriken, Fehler-Snapshots | In diesem Review nach middleware/requestDiagnostics.ts ausgelagert |
| Verbleibende KI-Handler | Noch umfangreich inline in server.ts |
| Bootstrap-only server.ts | Noch nicht erreicht |

## Modulgrenzen

- server.ts: App-Zusammenbau, Middleware-Reihenfolge und fachliche Router-Mounts.
- src/server/middleware/: übergreifender HTTP-Lifecycle ohne fachliche Handler.
- src/server/routes/: Transport, Eingabegrenzen und explizite Abhängigkeiten.
- src/server/platform/ und bestehende Services: fachliche Regeln und Infrastrukturzugriff.
- tests/: HTTP-Verträge, Auth-/Policy-Negativfälle und echte Emulatorprüfungen gemäß Testsuite.

Die drei Diagnose-Middlewares bleiben an ihren bisherigen Positionen. Eine gemeinsame Verlagerung an den App-Anfang
würde etwa verändern, welche CSP-/Parser-/Auth-Abweisungen in den einzelnen Metriken enthalten sind.
Beim Auslagern weiterer Routen müssen Scanner, Request-Policy-Listen und tatsächliche Mounts zusammen geprüft werden.
Der Stripe-Webhook benötigt weiterhin unveränderte Requestbytes vor dem JSON-Parser.

[Prüfbefunde, Validierung und nächste Arbeitspakete](CODE_STRUCTURE_REVIEW_2026-10-26.md).
Die vorhandenen produktionsbezogenen Freigaben werden durch diesen Strukturumbau nicht ersetzt.
