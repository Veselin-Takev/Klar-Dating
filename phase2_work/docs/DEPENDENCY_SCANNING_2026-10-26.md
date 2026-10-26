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
