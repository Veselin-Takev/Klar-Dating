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

## Gezieltes Review von PR #140 — 27.10.2026

Geprüfter bisheriger Head: `a9ab1a0262fa84bc6dfcc9dbdcb7ab173a2e3e38`. Normale Pflicht-CI [40470518973](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40470518973) erfolgreich. Der separate [Scan 40470518914](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40470518914) bestand alle zehn damaligen Scanner-Tests und meldete 1.439 eindeutige Versionen, 21 betroffene Versionen und 39 eindeutige Advisories mit Exit 1. **Die rote Prüfung ist ein vollständiges Ergebnis mit Befunden, kein Scanner-Absturz.** Frühere Aussagen über einen noch ausstehenden Lauf dieses Heads sind damit historisch.

Das Review fand zusätzlich eine Lücke in der Inventarvalidierung: Eine einzelne leere Lockdatei konnte unbemerkt bleiben, wenn andere Dateien Pakete lieferten. Der Scanner verlangt jetzt mindestens einen tatsächlich aufgelösten Eintrag pro Eingabedatei und verweigert Arrays als `packages`-Container. Root-Einträge und npm-Links zählen nicht als aufgelöste Pakete. Identische Versionen in mehreren gültigen Locks bleiben erlaubt und werden weiterhin dedupliziert. Unvollständiges Inventar führt im CLI weiterhin zu Exit 2, niemals zu einer sauberen Bewertung.

**15 lokale Node-Regressionen bestanden** unter Node 24.22.1. Die fünf zusätzlichen Tests prüfen vier ungültige Einzeldateien jeweils vor und nach einer gültigen Datei sowie ein gültiges gemischtes Bun-/npm-Inventar mit Duplikaten. Die Inventarisierung aller drei tatsächlichen lokalen Locks ergibt weiterhin 1.439 eindeutige Versionen; dies war keine erneute OSV-Abfrage. Hashes beziehen sich auf die gelesenen Bytes, daher können CRLF-Checkouts andere Hashes als Linux-CI liefern.

PR #150 ist nach erfolgreicher vollständiger CI [40478331492](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40478331492) auf Head `cbb65fb41185fcd82734beb6c0476ecc1c01851b` integriert. Main `c30f6f8fa8fcf64b8bcefcd38a671ee91fe66e3e` wurde auf identischen Tree geprüft und erhaltend in die Scanner-Arbeit übernommen. Der neue Scanner-Head benötigt eine neue Pflicht-CI und einen Scan; alte erfolgreiche CI gilt nicht für den neuen Head.

Offene Grenzen: Die 21 betroffenen Versionen sind nicht durch diese Prüferkorrektur behoben. Keine Ignoreliste/Baseline und keine geänderte Befundschwelle. Der separate Workflow läuft durch Pfadfilter nicht für jede beliebige Quelländerung und ist noch keine konfigurierte Branchschutzpflicht. Die Parser-Installation verwendet weiterhin den App-Dependency-Graph; minimaler isolierter Scanner-Build, SAST, Container-/OS-Scan und OpenSSF-Scorecard sind nicht nachgewiesen. Es besteht kein vollständiges Supply-Chain- oder Compliance-Testat.

Nächste Schritte: den neuen exakten Head prüfen, Advisory-Triage versionsgenau und vertraulich fortführen, Abhängigkeiten kontrolliert beheben und danach die dauerhafte Integration des Scanners entscheiden. PR bleibt bis zur Triage Draft. **Produktion weiterhin NO-GO.**

## 28 October 2026 – Audit-evidence extension (stacked draft)

The existing fail-closed OSV scan reports **aggregates only** to the CI
log. Run `40576879383` on PR #140 found **1,439 queried versions, 13
affected versions and 25 unique advisory IDs**. These are actual scan
counts, *not* proof of vulnerability-free dependencies. No dependency
suppression, waiver, baseline allow-list or severity downgrading is
permitted.

A separately reviewed stacked candidate now collects only the public
npm package name, pinned version and sorted OSV advisory IDs, with the
three committed lockfile SHA-256 hashes and scan timestamp. When the
full OSV query succeeds, it writes a versioned JSON report to an
absolute workflow-controlled runner-temp path and uploads it as
`klar-dependency-findings` for **7 days**. The detailed mapping is
not printed in public CI logs and is not checked into Git. A scan with
findings **still exits 1**; incomplete/unavailable OSV results still
fail closed and produce no clean verdict. Synthetic tests cover
per-package mapping, deduplication and invalid advisory IDs.

**Acceptance:** check the exact new commit, scanner regressions, scan
exit status and report artifact. Use the report to identify actual
packages and remediate pinned direct and transitive dependencies in
small batches, regenerating every affected lockfile and rerunning
full CI. Do not infer exploitability from a bare advisory ID: independently
evaluate reachability, fixed versions, runtime scope and any legal or
breaking upgrade risk. No automatic mass update is authorized.

**Production NO-GO:** the affected-version scan, independent
dependency review and mandatory release gates remain unresolved.

## 28 October 2026 – Isolated sharp 0.35.5 lockfile remediation candidate

The vendor-reviewed `GHSA-wq5f-xc86-pv6w` affects `sharp@0.35.4`;
the published fix is `0.35.5`. The committed app manifest currently
declares `sharp: ^0.35.3` in **devDependencies**. It must not be
conflated with proof of an exploitable production image-processing path.

A separate PR-scoped, read-only workflow builds a candidate
`bun add --dev --lockfile-only --ignore-scripts 'sharp@^0.35.5'`
using pinned Bun 1.4.4 and Node 22.23.3. It checks the exact
`sharp@0.35.5` resolved lock entry and produces an upload-only artifact
with `phase2_work/package.json` and *both* Bun locks. It never commits
to main, never deploys, never invokes arbitrary install scripts and is
intended to be removed or disabled after the reviewed candidate is
applied. The artifact is only a proposed dependency upgrade.

**Acceptance:** download that exact workflow artifact, inspect its
entire diff and unexpected transitive changes, apply atomically to a
new dedicated feature branch, rerun both enterprise CI and independent
OSV scan; retain other known OSV findings as blockers. The root
and app lockfiles must remain byte-identical. No expected pass on
unrelated vulnerable versions may be inferred. Independent Security,
Privacy, Legal and Release Owner approvals remain mandatory.
