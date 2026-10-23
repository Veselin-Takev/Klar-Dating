# ADR — Enterprise Admin Status: evidence-first und fail-closed (2026-10-19)

**Status:** Feature-Branch-Korrektur, keine Produktionsfreigabe. **NO-GO.**

## Verifizierter Befund

Der alte AdminHealthStatusWidget führte für einen Gesundheitscheck einen POST gegen /api/check-safety aus und klassifizierte HTTP 400 als gesund. Bei der Firebase-Auth-Prüfung wurde ein HTTP 401 als gesund eingestuft; /api/ready wurde als weitergehender Systembeweis verwendet. Das sind keine hinreichenden Auth-/AI-Evidenzen. Das §312k-Compliance-Widget zeigte zudem pauschale 100-%-Werte, „100 % PII-frei“ und einen „Audit-Ready“-Status ohne unabhängige Bestätigung.

## Lösung

- Der bestehende Backend-Endpunkt GET /api/admin/health-check ist bereits durch requireAuth, requireRole(admin/trust_safety/super_admin) und adminHealthCheckLimiter geschützt. Das Widget nutzt ausschließlich diesen read-only Endpunkt mit Firebase-ID-Token.
- Strikte Boolean-Prüfung im getypten Parser; Fehler, fehlende Rechte, unvollständige Antworten, abgelaufene Messungen oder ungültige Latenzen werden niemals grün dargestellt. Der Messwert ist die Healthcheck-Dauer, ausdrücklich **nicht** API-P95.
- Auth-State-Listener invalidiert den Status beim Logout/Kontowechsel. AbortController und Request-Sequenz verhindern, dass alte Antworten die aktuelle Identität überschreiben. Polling höchstens alle 120 Sekunden.
- API-P95/SLO, DSGVO Art.17/TTL/Legal Holds, KI-Budget und Security-/CI-Gates zeigen explizit **Nicht verifiziert**, solange keine autorisierte beweissichere Datenschnittstelle existiert.
- §312k-Audit zeigt nur Statusmarker aus maximal 100 angeforderten Datensätzen, keine Rechtskonformitätsquote. Filterwechsel invalidieren alte Antworten; CSV-Fehler sind generisch, Erfolgshinweis-Timer werden bereinigt.
- Zehn Node22-native Quellen-/Modelltests unter `check:enterprise-dashboard` werden in `check:enterprise` eingebunden. Statische Quellenchecks ersetzen keine E2E-/React-/Browser-/Firestore-Emulator-Tests.

## Grenzen und Datenschutz

Serverseitige Firebase-Admin-Operationen umgehen Firestore Security Rules und müssen per IAM/Backend-Auth abgesichert werden. Der Status verwendet nur Read-only-Boolesche Dienstchecks und die Healthcheck-Dauer. Keine PII, Token oder per-Tenant-Budgets werden im Dashboard ausgewiesen. Ein erfolgreiches Admin-Healthcheck ist kein Security/Legal/DPO/SRE Release-GO.

## Rollback / N-1

Keine Firestore-Schema-, Index-, Rules-, API- oder Datenspeicheränderung; N-1-Client-/Datenkompatibilität bleibt. Rollback der Dashboard-Dateien darf keine Falschgrün-Logik oder feste DSGVO-/§312k-Konformitätsbehauptungen wieder einführen. TTL-Löschungen sind durch einen UI-Rollback nicht reversibel.

Quellen: https://firebase.google.com/docs/firestore/security/rules-conditions ; https://opentelemetry.io/docs/specs/otel/metrics/data-model/ .
