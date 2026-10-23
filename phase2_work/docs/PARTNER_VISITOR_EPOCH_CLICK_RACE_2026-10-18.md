# P0 #56 – Besucher-Einwilligungs-Epochenwechsel beim Klick (18.10.2026)

**DRAFT / NO-GO**, aufbauend auf PR #107.

## Befund
Vor der Klicktransaktion und innerhalb derselben wird die positive sichere Einwilligungsversion des Besuchers geprüft. Ohne Bindung beider Lesungen konnte eine geänderte, wieder gültige Version nach zwischenzeitlichem Widerruf und erneuter Zustimmung den ursprünglich gestarteten Klick dennoch attributionfähig lassen.

## Korrektur
`recordPartnerClick` liest nach der Vorabprüfung die konkrete `visitorConsentVersion` und verlangt im Firestore-Transaktionszustand neben Erwachsenenstatus, Consent, Quarantäne und Löschstatus dieselbe Version. Stimmt sie nicht überein, erfolgen weder Zählererhöhung noch Audit-Anlage noch Übergabe des `klar_referral`-Parameters. Die direkte validierte Partnerziel-Weiterleitung bleibt möglich.

## Regression und Grenzen
Eine neue In-Memory-Vitest-Regression simuliert eine Versionsänderung von 1 auf 2 genau vor der Transaktion und verlangt fehlende Attribution, unveränderte Zähler und keinen Ledger-Eintrag. Die bestehende positive/Gültigkeitsprüfung aus PR #107 bleibt erhalten. Das Mock simuliert keine echten konkurrierenden Firestore-Schreibvorgänge; dafür sind Emulator-Tests mit dokumentiertem Consent-Widerruf und Regrant nötig. Auch das Review von Firebase Rules, Datenschutzrecht, tatsächlicher Conversion-Herkunft, Node22.23.3-Typechecks, Vitest, E2E, Build und unabhängigen Freigaben bleibt Pflicht. Keine Migration, kein Merge, kein Deployment, keine kostenpflichtigen GitHub-Actions-Läufe; **NO-GO**.
