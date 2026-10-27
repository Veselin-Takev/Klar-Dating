# Kontrollierte Dependency-Lockerzeugung — 2026-10-27

**Vorbereiteter Prüflauf, keine behobenen Paketbefunde und keine Produktionsfreigabe.** Ziel ist ein regulär von Bun erzeugter, überprüfbarer Update-Kandidat für Vite 8.3.5 in Root und App. Manifest und Locks werden erst nach Artefaktprüfung in einem separaten Änderungsschritt übernommen.

## Anlass und aktueller Nachweis

PR #140: vollständige Enterprise-CI [40480201394](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40480201394) auf `76fc32257120062513b1e72ab972c5156f29e55e` erfolgreich. Separater [Security-Scan 40480201383](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40480201383): 15 Scanner-Tests bestanden, 1.439 eindeutige Versionen / 21 betroffene Versionen / 39 Advisories, Exit 1. PR #140 bleibt Draft bis zur Triage. Kein Scanner-Absturz und keine Ignoreliste/Baseline.

Das offizielle npm-Register meldete Vite 8.3.5 als verfügbar. Eine gezielte OSV-querybatch-Abfrage für diesen Kandidaten lieferte am 27.10.2026 eine vollständige Antwort ohne Advisories. Das ist keine globale Entwarnung und kein Kompatibilitätsnachweis. Paketgraph, Lock-Hashes und Scan müssen nach der tatsächlichen Auflösung neu geprüft werden.

Die lokale offizielle Bun-1.4.4-Binary startet, die Paketauflösung unter Windows bleibt jedoch mit EBADF blockiert. Eine lesende WSL-Inventur bestätigte: keine Linux-Installation vorhanden. Es wurde kein WSL installiert und keine kostenpflichtige Cloud-Ressource eingerichtet. Wiederholungen unveränderter fehlgeschlagener Kommandos sind kein Fortschrittsnachweis.

## Begrenzter GitHub-Actions-Lauf

- Eigener kurzlebiger GitHub-hosted Ubuntu-Job, maximal 15 Minuten; vorhandene CI-Infrastruktur.
- Token ausschließlich `contents: read`; Checkout-Anmeldung wird nicht persistiert. Keine Secrets, Produktionsumgebung, Cloud-Zugänge, Pushes oder automatischen PR-/Merge-Schritte.
- Bestehende genehmigte SHA-Pins für Checkout, Setup-Node, Setup-Bun und Artefakt-Upload. Node 22.23.3, Bun 1.4.4.
- Festes Ziel Vite 8.3.5, keine frei übergebenen Paket-/Shellparameter. `bun update` jeweils in Root und App mit `--exact --lockfile-only --ignore-scripts --no-env-file`.
- Der Verifikator erlaubt nur Änderungen an den vier bekannten Manifest-/Lockdateien. In den Manifesten darf sich ausschließlich `devDependencies.vite` auf exakt 8.3.5 ändern. Beide Locks bleiben vollständig reviewpflichtig, einschließlich transitiver Änderungen.
- Artefakt enthält nur diese vier Dateien und ein Manifest mit SHA-256 vor/nach Erzeugung, PR-Source-Head, tatsächlich ausgechecktem Commit und Toolchain-Versionen. Aufbewahrung drei Tage. Keine automatische Übernahme oder Produktionseignung.

Grundlage der Flags: [Bun Update](https://bun.com/docs/pm/cli/update), [Lockfile-Dokumentation](https://bun.com/docs/pm/lockfile). Lockfile-only schreibt keine node_modules, kann aber Registry-Metadaten/Artefakte im Runner-Cache abrufen. Lebenszyklusskripte bleiben deaktiviert, Integritäts-/TLS-Prüfung bleibt aktiv.

## Prüfstand und nächste Schritte

Lokal bestanden: Node-Syntaxprüfung des Verifikators, bestehende Toolchain-Pin- und Workflow-Layout-Gates. Der Linux-Generator und seine Artefakte sind vor dem ersten Lauf **noch nicht validiert**. Die normale CI dieses PR bleibt ebenfalls erforderlich.

Nach erfolgreichem Generatorlauf Artefakt-Source-Head und Hashes prüfen, Änderungen an allen vier Dateien reviewen, Kandidaten versionsgenau scannen und regulär committen. Danach unveränderte Frozen-Install-, Build-, Browser-/Emulator- und Pflicht-CI-Nachweise am exakten neuen Commit verlangen. Erst diese spätere Evidenz kann einen Teilfix belegen. Alle weiteren Befunde sowie reale Staging-/Rollback- und unabhängige Freigaben bleiben offen. **Produktion: NO-GO.**
