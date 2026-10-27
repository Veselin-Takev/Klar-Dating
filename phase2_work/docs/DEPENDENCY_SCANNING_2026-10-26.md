# Automatisches Dependency-Scanning – 26.10.2026

Produktionsstatus: **NO-GO**. SEC-02 bleibt offen.

Der separate Workflow scannt bei relevanten PR-/Main-Änderungen, wöchentlich und
manuell die exakten npm-Versionen aus Root-Bun-, App-Bun- und Functions-npm-Lock.
Er verwendet OSV querybatch, dedupliziert identische Versionen und bindet die
aggregierte Ausgabe über SHA-256 an alle drei Eingabedateien. Keine Paketnamen,
Advisory-Details, Tokens oder Anwendungsdaten werden in den Scanbericht geschrieben.
Die Anfrage an OSV enthält ausschließlich Paketnamen und Versionen.

Exit 0: vollständige Antwort ohne gemeldete Advisories. Exit 1: Befunde vorhanden.
Exit 2: Scan unvollständig/fehlerhaft. Unaufgelöste Pagination, ungültige Lockeinträge,
Netzfehler und inkonsistente Antworten ergeben niemals eine saubere Bewertung.
Keine Ignoreliste und keine pauschale Baseline-Ausnahme. Auch Dev-/optionale
Paketversionen zählen; ein Befund ist nicht automatisch nachgewiesene Ausnutzbarkeit.

Zehn lokale Node-Regressionstests bestanden. Die echte lokale OSV-Abfrage mit dem neuen Scanner bestätigt 1.438 Versionen, 21 betroffene Versionen und 39 eindeutige Advisories; alle drei Lock-Hashes wurden ermittelt. Echter Workflow-Lauf noch ausstehend.
Der bisherige Audit fand 21 betroffene Versionen / 39 Advisories. Deshalb ist ein
roter Scan erwartbar und erfordert Triage/Fixes, keinen unveränderten Wiederholungslauf.
Die neue Prüfung ist noch keine durch Branchschutz verpflichtend konfigurierte
Freigabebedingung. Schutzregeln wurden nicht verändert. Bestehende validate-CI,
SCA-Ergebnis und Produktionsentscheidung müssen separat ausgewertet werden.

Runner: GitHub-hosted Ubuntu, Token nur contents:read, keine persistierte
Checkout-Anmeldung, 15 Minuten Timeout. Die bestehende eingefrorene App-Auflösung
liefert TypeScript als JSONC-Parser; Installationsskripte bleiben deaktiviert.
Dies ist noch kein isolierter minimaler Scanner-Build, Container-/OS-Scan,
SAST oder vollständiger OpenSSF-Scorecard-Lauf. Weitere Härtung bleibt offen.

Nach Integration zuerst den echten Scanlauf und seine Lock-Hashes dokumentieren,
Befunde versionsgenau behandeln und danach die verpflichtende Integration bewerten.
Keine unabhängige Security-Abnahme, Cloud-Billing-Kontrolle, Lasttest- oder
Staging-/Produktionsfreigabe wird daraus abgeleitet.

## Fortschreibung 27.10.2026: genehmigte Toolchain und tatsächlicher Scan

Der echte Scan40397909553 auf42a50838b53e157069119ddb2297b8e98ad320df führte alle
zehn Regressionen erfolgreich aus und meldete1.438Versionen/21betroffeneVersionen/
39Advisories, Exit1. Das ist ein vollständiger Scan mit Befunden. Die damalige
reguläre CI40397909542 bestand; ihre grüne Bewertung hebt die Befunde nicht auf.
Der PR bleibt Draft, keine pauschale Baseline oder Ignoreliste.

Nach Integration des koordinierten Bun-Updates143 wird auch dieser neue Workflow
auf Bun1.4.4 synchronisiert. Setup-Action-SHA, Node22.23.3, read-only Token und
persist-credentials:false bleiben erhalten. Keine zusätzlichen Rechte oder
geänderte Befundschwelle. Der neue Head benötigt erneut vollständige CI und Scan.
Die Functions-Teilkorrektur141 ist im übernommenen Main enthalten; Root-/App-Locks
sind weiterhin betroffen. Keine neue globale Scan-Zahl vor Ausführung behaupten.

PR143 bestand vollständige CI40468901898 auf e87ba310da10ea81c470a0912df90791d072368c
und wurde als05e2cdc1525b7d6fc417b67502b473348217545e in Main integriert;
exakter Tree-Vergleich bestanden. Neue offizielle lokale Bun1.4.4 startet, aber ein
isolierter zod-Lockfile-Probelauf scheitert weiterhin an EBADF beim Temp-Verzeichnis,
auch mit eigenen BUN_TMPDIR/BUN_INSTALL/Temp-/Cache-Verzeichnissen auf D:.
Das ist kein behobener Paketbefund und kein lokaler Frozen-Install-Erfolg.
Keine unveränderten Wiederholungen oder Abschaltung von TLS-Prüfungen.

Produktionsstatus bleibt NO-GO. Keine neue Cloud-Ressource oder reale Abrechnung.

Erneute vollständige lokale OSV-Abfrage am27.10.2026 nach Main-Synchronisierung:
1.439eindeutige Versionen,21betroffene Versionen,39Advisories. Alle drei Lock-Hashes
wurden ermittelt. Die zusätzliche Version stammt aus der geänderten Functions-Auflösung;
dieser lokale Scan ersetzt nicht den ausstehenden CI-Lauf des neuen Heads.
