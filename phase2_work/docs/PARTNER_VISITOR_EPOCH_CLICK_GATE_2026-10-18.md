# P0 #56 – Besucher-Einwilligungsversion vor Partner-Klicktracking (18.10.2026)

**Draft / NO-GO.** Stacked auf PR #106.

## Befund
Die Besucherautorisierung beim Partnerlink-Klick verlangte Anmeldung, Volljährigkeit, `partnerReferralConsent=true` und keine Quarantäne. Eine gültige `partnerReferralVersion` wurde jedoch anders als bei Link-Eigentümern und Käufern nicht geprüft. Ein Legacy-Besucher mit unvollständiger Einwilligungshistorie konnte deshalb die Klickzähler erhöhen und einen Audit-Eintrag auslösen.

## Änderung
Die Vorabprüfung und die Firestore-Transaktion für `recordPartnerClick` verlangen nun jeweils eine ausdrücklich gespeicherte positive sichere Ganzzahl als Besucher-Einwilligungsversion. Fehlende, `null`-, nichtpositive, textuelle und gebrochene Werte verhindern Tracking; direkte Weiterleitung zum validierten Partnerziel bleibt möglich, aber ohne `klar_referral`-Parameter. Die bestehende Authentifizierungs-, Erwachsenen-, Quarantäne- und Löschstatusprüfung bleibt erhalten.

## Nachweise und Freigabe
Der statische Test `scripts/check-partner-visitor-consent.mjs` prüft beide Versionsgrenzen. Ein neuer In-Memory-Vitest-Test fordert fehlende Klick-/Audit-Schreibvorgänge bei sechs ungültigen Versionen. Dieser Test muss unter Node v22.23.3 mit installierten Abhängigkeiten und anschließend mit dem Firebase Emulator ausgeführt werden; Mock-Tests allein können parallele Transaktionen und echte Rules nicht beweisen.

Die Maßnahme ersetzt weder die unabhängige Kauf-/Käuferverifikation noch Art.-7-/Art.-17-Einwilligungsnachweise. Vollständige Node22/TypeScript/Vitest/Firebase/Playwright/Build- und Security/Privacy/Legal/Finance-Gates ausstehend. Keine produktiven Änderungen, kein Merge, kein bezahlter CI-Neulauf. **NO-GO, P0 #56/#55 und #8 weiterhin offen.**
