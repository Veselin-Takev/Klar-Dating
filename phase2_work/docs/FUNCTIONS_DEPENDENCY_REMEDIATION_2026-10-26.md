# Functions-Abhängigkeitskorrektur – 26.10.2026

**Produktion: NO-GO. SEC-02 bleibt repositoryweit offen.**

Der Functions-Graph ersetzt die transitive uuid-Version durch 11.1.1 mittels
auf gaxios begrenztem Override. Diese korrigierte Linie stellt weiterhin einen
CommonJS-Export bereit; ein ungeprüfter Wechsel zur neuesten ESM-Hauptversion
würde nicht dieselbe Kompatibilitätsannahme erlauben. Das npm-10.9.2-generierte
Lockfile ändert ausschließlich diesen Paketeintrag. Keine manuelle Integritätswertpflege.

Verifikation lokal unter Node 24.22.1:
- npm ci mit deaktivierten Installationsskripten erfolgreich (266 Pakete).
- Functions-TypeScript-Build erfolgreich.
- Zwei neue Tests prüfen den tatsächlich von gaxios aufgelösten CommonJS-Export
  und die reale Multipart-Erzeugung über einen synthetischen Adapter ohne Netzwerk.
- Beide Tests laufen künftig beim Functions-Build und damit auch im vorhandenen CI-Gate.
- Vollständige OSV-querybatch-Antwort für 266 Functions-Lockeinträge: **0 betroffene
  Einträge zum Abfragezeitpunkt**. Keine unresolved Pagination; kein globaler Clean-Befund.

Vollständige Node-22-/Emulator-/Browser-CI dieses neuen Stands steht aus.
Root-/App-Bun-Locks sind unverändert und enthalten weiterhin Befunde. Die globale
Anzahl betroffener Versionen muss deshalb durch diesen Functions-Patch nicht sinken.
Der rote Scanner in PR #140 wird nicht ignoriert oder durch diese Teilkorrektur
als erfolgreich umgedeutet. Spätere Advisories können den Functions-Befund ändern.

## Bestätigte vorherige Checkpoints

PR #138 ist nach vollständiger CI40393650472 auf Head
`4d384a961083842243c5224c79e5f28d8b03495d` integriert:
Main-Merge `deeb0e47831cb2000138f7ec80218abe3e9f4397`.
PR #139 ist nach Konfliktauflösung und erfolgreicher CI40397481367 auf Head
`12db5cf6f51613730c1b8b0f444cd263e3bd7152` integriert:
Main-Merge `f11e8b5bb550d614c1cabcc63e3fc18bbe035226`.
Beide Main-Trees wurden gegen die jeweiligen geprüften Branches verglichen.
Historische pending-Angaben dieser Checkpoints beschreiben frühere Zeitpunkte.

PR #140: Der echte Scan40397909553 bestätigt am 26.10.2026 um 20:42 UTC
1.438 eindeutige Versionen / 21 betroffene Versionen / 39 Advisories und Exit 1.
Alle zehn Scannerregressionen bestehen auch in diesem Job. Die reguläre validate-CI
ist separat auszuwerten; keine unabhängige Security- oder Produktionsfreigabe.

Rollback: Override, Lockänderung und zugehörigen Test-/Buildschritt gemeinsam
regulär revertieren; eingefrorene Installation und Build prüfen. Dies würde die
vorherige Abhängigkeitsversion wiederherstellen und erfordert neue Sicherheitsbewertung.
Keine Cloud-Ressourcen oder Produktionsdeployments durch diese Änderung.
