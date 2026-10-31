# P0 #254 – Feature-Flag-Audit auch bei ungültigen Flag-Bezeichnern

**Prüfstand:** 31.10.2026 · **Status:** isolierter Draft / **Production BLOCKED / NO-GO**. **Parent:** [PR #264](https://github.com/Veselin-Takev/Klar-Dating/pull/264), SHA `b5a55e4e4b327ae8567ff56bb6c33d72ddac5942`, erfolgreich geprüfte [Enterprise-CI #41240658380](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41240658380) (`completed/success`).

## Konkreter Audit-Befund

`src/server/multitenant/tenantFlags.ts:evaluateTenantFlag()` stellte schon ein über Firebase-ID-Token und aktive Membership validiertes `TenantContext` sicher. Die Entscheidung über gültige Flag-Datensätze sowie Storage-Fehler wurde im `finally` strukturiert protokolliert. **Die Validierung des Flagnamens** (`flagIdSchema.parse(flagName)`) lief jedoch **vor** dem `try/finally`: Ein manipulierter oder überlanger Flag-Name konnte so eine Ablehnung auslösen, ohne dass die sicherheitsrelevante Denial-Auditmeldung mit `tenant_id`, `trace_id` und Zeitstempel geschrieben wurde.

Das ist kein nachgewiesener Zugriff auf fremde Tenant-Daten; der existierende Repository-Pfad validierte den Namen ebenfalls vor Firestore. Es ist eine überprüfbare Lücke in der **Vollständigkeit des sicherheitsrelevanten Audits** und damit der späteren Incident-Forensik.

## Umsetzung

- Die Flag-Namensvalidierung erfolgt innerhalb des bestehenden `try`-Blocks, der immer über `finally` auditiert. Ungültige Namen lösen weiterhin eine Ausnahme aus und führen zu **keinem** Firestore-Zugriff.
- Der Auditor verwendet bis zur erfolgreichen Validierung ausschließlich den konstanten Wert `[invalid_flag_id]` als `flag_name`. Rohwerte wie Pfad-Traversal, potenzielle E-Mail-Identifikatoren oder Steuerzeichen werden **nicht** geloggt; auch kein neues PII-Feld wird eingeführt.
- Die Logentscheidung enthält wie bisher `tenant_id`, die nach PR #264 serverseitig erzeugte `trace_id`, einen Zeitstempel, `enabled:false` und `outcome:'denied'`. Für gültige Flag-IDs und Storage-Fehler bleibt das bestehende Verhalten erhalten.
- Ein nicht verfügbarer oder ausfallender Audit-Sink führt weiterhin zu einer Ablehnung; die neue Prüfung führt keine stillschweigende Fallback-Ausgabe auf stdout ein.
- Neue Tenant-Foundation-Tests prüfen vier unterschiedlich manipulierte Flag-IDs (Pfad, Kleinschreibung, Überlänge, PII-ähnlich) gegen den **realen Service- und Repository-Adapter**. Die Tests verlangen exakt eine strukturierte Denial-Meldung je Versuch, keinerlei DB-Zugriff und keinerlei Kopie der untrusted Werte in den Logger. Ein zweiter Test prüft die Ablehnung, falls der Logger selbst bei ungültiger ID ausfällt.

## Offene Integrations- und Compliance-Gates

`assertIssuedTenantContext()` muss weiterhin **vor** dem Audit prüfen, ob überhaupt eine vertrauenswürdige Identität ausgestellt wurde; es wird **nicht** versucht, beliebige oder gefälschte Identity-Objekte als echte Tenants zu protokollieren. Diese Foundation ist weiterhin nicht nachweislich an alle produktiven Legacy-Routen angebunden. Für ein vollständiges auditierbares Zero-Trust-System sind ein tatsächlich konfigurierter Pino-Sink, sichere Speicherung und Unveränderlichkeit, definierte Retention, Threat Monitoring sowie unabhängige Firestore-Rules-/Admin-SDK-, DSGVO-Art.-17-, Chat/KYC/Payment-BOLA- und Release-Owner-Prüfungen nötig. Die externen Pflichtscans aus Issue #8 bleiben offen.

**Verbindliche Abnahme:** vollständige SHA-gebundene Enterprise-CI des neuen Commits, unabhängige AppSec-/Datenschutz-/SRE-Prüfung und offizielle Release-Owner-Freigabe. **Kein Merge, kein Deployment, keine produktive Daten-/IAM-/Rules-Änderung. BLOCKED / NO-GO.**
