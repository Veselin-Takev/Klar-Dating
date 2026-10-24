# P0 #55/#56 – Strikte Partner-Eigentümer-Einwilligungsversion (18.10.2026)

**Draft / NO-GO.** Aufbauend auf PR #105.

## Befund
Während die Käufer-Conversion eine positive sichere Ganzzahl für die Einwilligungsversion verlangt, verwendeten die Eigentümerpfade der Partnerlinks bei fehlender oder beschädigter Version weiterhin stillschweigend Version 1. Betroffen waren das transaktionale Ausstellen von Links, das Protokollieren von Interaktionen, die öffentliche Klickzuordnung (auch deren Transaktionsprüfung) und die Besitzerprüfung bei Conversion-Replays. Das hätte eine Legacy-Linkberechtigung aus einem nicht nachweisbaren Einwilligungszeitraum fortsetzen können.

## Fix
Die impliziten Version-1-Fallbacks der Eigentümerprüfung wurden entfernt. Nur eine explizite `partnerReferralVersion` als positive sichere Ganzzahl, die der Linkversion entspricht, berechtigt zur Ausstellung, Interaktion, Klickzuordnung oder Conversion. Bereits beim Auflisten wird bei vorhandener Zustimmung, aber ungültiger Version mit HTTP 403 `partner_consent_epoch_missing` abgelehnt; es wird kein Link angelegt. Ungültige Versionen bleiben bei vorhandenen Links nicht attributionfähig.

## Tests, Architektur und Restbefunde
Negative In-Memory-Vitest-Szenarien decken fehlende, `null`-, nichtpositive, textuelle und gebrochene Eigentümer-Versionen bei Linklisten und signierten Conversion-Behauptungen ab. Führe zusätzlich echte Firebase-Emulator-Tests für Klick- und Linktransaktionen sowie gleichzeitige Widerrufe aus. Firestore wiederholt Transaktionen bei konkurrierenden Änderungen (https://firebase.google.com/docs/firestore/manage-data/transactions); diese Eigenschaft wird durch statische Prüfungen nicht bewiesen.

Wichtig: Der allgemeine `requirePartnerUserData`-Fallback dient bislang auch anderen Kontozuständen; die Änderung begrenzt hier ausdrücklich die Partnerberechtigungen, ohne Profile automatisch umzuschreiben. Historische Konten benötigen freigegebene Einwilligungsbereinigung. Unabhängige Kauf-/Käuferverifikation, vollständiger Node 22.23.3-Testlauf, Security/Privacy/Legal/Finance und Produktfreigabe fehlen. Kein Merge nach main, Cloud-Deployment oder neuer GitHub-Actions-Lauf. #55/#56/#8 bleiben OPEN.
