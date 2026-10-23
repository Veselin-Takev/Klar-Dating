# P0 #55 — Partner-Webhook-Auditsemantik: Behauptung statt Verifikation (18.10.2026)

**Status: Draft / NO-GO.** Basiert auf PR #95; keine Produktivänderungen.

## Befund und Änderung
Ein signierter Partner-Webhook mit behaupteter `qualified_conversion` wurde bislang als `partner_conversion_verified` im HMAC-Audit-Ledger erfasst, obwohl die Fachlogik nur `proofStatus=partner_assertion_only` und `rewardStatus=pending_verification` anlegt und keine echte Käufer- oder Kaufbestätigung vorliegt. Dadurch konnten nachgelagerte Audits oder Metriken die Behauptung mit einer verifizierten Conversion verwechseln.

Die Audit-Ereignisklasse lautet nun `partner_conversion_asserted`. Erfasste Conversion-Datensätze verbleiben unverändert im Status `pending_verification`, qualifizierte Zähler und Prämien werden nicht hochgezählt. Der In-Memory-Vitest-Test fordert genau ein `partner_conversion_asserted`-Ereignis und verbietet das falsche `partner_conversion_verified`-Ereignis.

## Betriebs-/Migrationsrisiko
Die Umbenennung betrifft ausschließlich **neue** Ereignisse. Bestehende signierte Audit-Ledger-Einträge dürfen nicht im Nachhinein verändert werden, da dies ihre Integritätskette beschädigen würde. Historische `partner_conversion_verified`-Ereignisse sind **nicht** als unabhängig verifiziert zu interpretieren: bei Auswertungen separat als Legacy-Providerbehauptungen klassifizieren. Monitoring, Abfragen, Dashboards, Alerting und Exportprozesse auf beide Bezeichnungen prüfen und versionsbewusst behandeln. Die Normalisierung muss bei der Auswertung passieren, nicht durch Mutation alter Ledger-Einträge.

## Validierung und Freigabegrenze
`npx vitest run tests/partnerReferralService.spec.ts` mit gepinntem Node 22.23.3 ausführen, danach Firestore-Emulator- und HTTP-Signaturtests. Ledger-Verifikation nach HMAC-SHA256, DSGVO-Datenminimierung, Observability- sowie unabhängige Finance/Privacy/Security-Freigabe gehören zu den Pflichtnachweisen. Die Regelung beweist weiterhin weder echte Kaufzahlung noch Käuferidentität.

OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html — konsistente Ereignisnamen und Vertrauensniveau externer Meldungen.
Firebase Firestore transactions: https://firebase.google.com/docs/firestore/manage-data/transactions — atomare Erstellung von Conversion und Audit.

Nicht gemergt, nicht deployed, keine GitHub Actions neu gestartet. Issues #55 und #8 bleiben OPEN; **NO-GO**.
