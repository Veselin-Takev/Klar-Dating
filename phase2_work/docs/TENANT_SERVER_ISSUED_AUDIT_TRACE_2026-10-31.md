# P0 #254 – Servereigene Tenant-Audit-Korrelations-ID

**Stand:** 31.10.2026 · **Ausgangsstand:** [PR #263](https://github.com/Veselin-Takev/Klar-Dating/pull/263), SHA `0b3e9afc87c2ade4ff6c4804c51799d05ab3560c` mit [CI #41239739422](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41239739422): `completed/success`. **Umsetzung:** isolierter, gestapelter Draft; **Production BLOCKED / NO-GO**.

## Nachweisbarer Sicherheitsbefund

`createTenantMiddleware()` übernahm bisher den von beliebigen Clients gesetzten Header `X-Trace-ID` als `tenantContext.traceId`, sofern er syntaktisch eine UUID war. `evaluateTenantFlag()` schreibt genau diese `traceId` unter `trace_id` in den strukturierten sicherheitsrelevanten Tenant-Audit-Datensatz. Dadurch kann ein nicht vertrauenswürdiger Client wiederholt denselben formal gültigen Korrelationswert angeben und Audit-Ereignisse verschiedener Anfragen absichtlich scheinbar zusammengehören lassen. **Das ist keine nachgewiesene Rechteausweitung**, beeinträchtigt aber Audit-Korrelation, Forensik und Zero-Trust-Evidence.

## Sicherheitsmaßnahme

- Der Express-Middleware-Pfad ignoriert `X-Trace-ID` als **autorisierende oder auditrelevante Quelle** und erzeugt für jede Anfrage eine neue serverseitige `randomUUID()`. Dies gilt unabhängig davon, ob der Header gültig, ungültig, mehrfach vorhanden oder nicht gesetzt ist.
- `authorizeTenant(input, deps)` bleibt eine niedrigere **serverinterne** Komponente, die für Unit-Tests explizite `traceId`-Werte erlaubt; deren Aufrufer müssen servereigene IDs setzen. Die tatsächlich vorgesehene HTTP-Grenze erzwingt dieses Verhalten. Die Identitätsprüfung per Firebase-Claims, aktive Tenant-/Membership-Datensätze, Rollen-Schnittmenge und ausgestellter unveränderlicher Kontext bleiben unverändert.
- Die neue Regression ruft die **echte Middleware** mehrfach mit identischen vom Client vorgegebenen UUIDs, nicht validen und duplizierten Headers sowie ohne Header auf. Für jeden erfolgreichen Request werden eine neue, eindeutige Server-ID, ein eingefrorener Kontext und die Übernahme **nur dieser** ID in die strukturierte Feature-Flag-Auditmeldung geprüft.
- Kein clientgesteuerter Header wird als vertrauenswürdiger Audit-Trace exportiert. Ein späteres Distributed-Tracing-/W3C-`traceparent`-Konzept benötigt eine gesonderte, klar **untrusted** externe Korrelationsreferenz; sie darf nie die serverseitige Audit-ID ersetzen.

## Grenzen / Rest-Risiken

Das ist eine **isolierte Foundation-Korrektur**, kein Nachweis, dass sämtliche bestehenden Legacy-HTTP-Routen schon die neue Middleware einsetzen. Ein aktiver produktiver Pino-Sink, manipulationssichere Audit-Speicherung, Retention, Trace-Ausbreitung und vollständige Host-/SRE-Korrelation bleiben unabhängig nachzuweisen. Ebenso offen: mandantensichere Firestore-/Storage-Rules, Admin-SDK-Bypass-Absicherung für alle realen Endpunkte, DSGVO Art. 17, BOLA/IDOR für Chats/KYC/Payments, verbindliche externe Scans aus Issue #8 sowie Security-, Datenschutz-/Legal-, Operations-/SRE- und Release-Owner-Abnahmen.

Der neue exakte SHA muss vollständig durch CI und unabhängige Prüfung. **Kein Merge, keine produktive Konfigurations- oder Datenänderung, kein Deployment. BLOCKED / NO-GO.**
