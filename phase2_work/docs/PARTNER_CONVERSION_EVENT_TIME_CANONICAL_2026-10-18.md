# P0 #55 – Kanonische UTC-Zeitstempel bei Webhook-Replays (2026-10-18)

**DRAFT / NO-GO.** Baut auf PR #112 auf.

## Befund und Korrektur
Ein Conversion-Ereignis und sein Käufer-Claim werden atomar mit demselben `createdAt`-Wert gespeichert. Die bisherige Wiederholungsprüfung verlangte einen parsebaren Event-Zeitstempel und identische Claim-Zeit. `Date.parse` akzeptiert allerdings verschiedene nicht kanonische, mehrdeutige oder von der Laufzeit normalisierte Datumsformen. Die Wiederholungsprüfung verlangt deshalb nun zusätzlich exakt das vom Schreibpfad verwendete UTC-Format `YYYY-MM-DDTHH:mm:ss.sssZ` und einen verlustfreien ISO-Roundtrip. Nicht kanonische oder ungültige Werte führen zu `partner_claim_inconsistent` (409), statt das Replay erfolgreich zu bestätigen.

## Tests und Grenzen
In-Memory-Vitest-Szenarien prüfen ungültige sowie in Event und Claim übereinstimmende nicht kanonische Zeitangaben und einen unmöglichen Kalendertag. Die doppelte Testfixture-Wiederherstellung wurde entfernt. **Wichtig:** Stimmen zwei manipulierte, aber syntaktisch gültige Zeitstempel überein, ist ihre Unveränderlichkeit damit *nicht* kryptografisch bewiesen; die vorhandene Event-HMAC-Bindung authentifiziert Ereignisidentität, nicht jedes Speicherfeld. Diese zusätzliche Invariante ist kein Ersatz für append-only Rules, unabhängige Audit-Evidenz, Verifizierungsprozess oder Kauf-/Käuferbeweis.

Der neue Vitest-Test ist erst nach Ausführung nachgewiesen. Node 22.23.3, TypeScript, Firebase Emulator, Playwright, Build, npm audit, Security/Privacy/Legal/Finance-Freigaben ausstehend. Kein Merge, Deployment oder neuer Actions-Lauf. Issues #55/#56/#8 offen. **NO-GO.**
