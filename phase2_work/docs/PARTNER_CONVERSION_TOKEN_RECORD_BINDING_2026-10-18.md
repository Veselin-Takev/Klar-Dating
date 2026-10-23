# P0 #55 — Signierte Referral-Metadatenbindung bei Partner-Conversions (2026-10-18)

**DRAFT / NO-GO**, auf PR #110 aufgebaut.

## Befund
Der Klickpfad verifiziert bereits, dass `ownerUid`, `campaignId` und die Consent-Version des gespeicherten Referral-Datensatzes dem HMAC-signierten Token entsprechen. Der Partner-Conversion-Webhook hatte diese Kontrolle nicht. Deshalb hätte ein manipuliertes Referral-Dokument trotz gültiger ursprünglicher Token-ID einer anderen Kampagne beziehungsweise Version zugeordnet werden können.

## Umsetzung
`recordPartnerConversion` berechnet vor der Kampagnen-/Käuferverarbeitung das signierte Token aus der aktuell gespeicherten Eigentümer-ID, Kampagnen-ID und einer positiven sicheren Versionsnummer erneut. Bei Abweichung wird HTTP 404 `partner_link_not_found` geliefert. Innerhalb der Firestore-Transaktion muss die gespeicherte Referral-Version zusätzlich exakt mit der anfangs validierten übereinstimmen, ebenso wie Eigentümer und Kampagne. Diese Prüfung schützt sowohl neue Behauptungen als auch Duplikat-Replays.

Die neue In-Memory-Vitest-Regression manipuliert jeweils Eigentümer, Kampagne oder Versionsnummer und fordert eine Ablehnung ohne gespeicherte Conversion. Sie ersetzt keine E2E-Signatur-, Firestore-Emulator- oder Rules-Prüfung.

## Freigabeblocker
Ein signierter Partner-Webhook beweist keinen Kauf und keine unabhängige Käuferzuordnung; Belohnungen bleiben `pending_verification`. Vollständige Node 22.23.3-Typechecks, Vitest, Firebase-Emulator-Tests, Playwright, Build, Datenschutz- und unabhängige Security/Privacy/Legal/Finance-Freigaben sind weiter offen. Kein Merge, Deploy oder zusätzlicher Actions-Lauf. **NO-GO**.
