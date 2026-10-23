# P0 #55 – Zeitstempel-Konsistenz bei Partner-Conversion-Replays (2026-10-18)

**Status: Draft / NO-GO.** Aufbauend auf PR #111.

## Befund
Eine Conversion-Behauptung und der zugehörige pseudonymisierte Käufer-Claim werden innerhalb derselben Firestore-Transaktion mit identischem `createdAt` erzeugt. Ein signiertes Wiederholungsereignis überprüfte bereits Token-, Buyer-, Kampagnen-, Consent- und Statusbindung, aber nicht, ob die Entstehungszeit beider Datensätze noch konsistent war. Eine veränderte Claim-Zeitangabe konnte somit mit `duplicate:true` quittiert werden.

## Fix
Im Duplikat-Pfad wird nun verlangt, dass der Event-Zeitstempel ein parsebares Datums-String ist und `buyerClaim.createdAt` exakt `event.createdAt` entspricht. Eine fehlende, manipulierte oder widersprüchliche Claim-Zeitangabe führt zu HTTP 409 `partner_claim_inconsistent`, ohne eine neue Prämienbuchung oder einen Audit-Eintrag. Bestehende, unvollständige Legacy-Datensätze dürfen nicht automatisch repariert oder stillschweigend bestätigt werden.

## Prüfnachweise und Grenzen
Der ergänzte In-Memory-Vitest-Test manipuliert den Buyer-Claim-Zeitstempel mit einem historischen, ungültigen, numerischen und fehlenden Wert und erwartet die Quarantäne-Ablehnung. Der Test ist erst nach einem echten Vitest-Lauf ein Laufzeitnachweis. Unabhängige Erwerbsnachweise bleiben erforderlich: Ein signierter Provider-Webhook attestiert nicht den Kauf oder die Käuferidentität. Node 22.23.3, TypeScript, Vitest, Firestore Emulator/Rules, E2E, Build, Security/Privacy/Legal/Finance-Freigaben und Release-Nachweis stehen weiterhin aus.

Kein Merge, Deployment oder neuer GitHub-Actions-Lauf. P0 #55/#56 und Release #8 offen; **NO-GO**.
