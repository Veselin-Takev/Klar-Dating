# Kontrollierte Dependency-Lockerzeugung — 2026-10-27

## Fortschreibung: Vite integriert, nächster transitive Update-Kandidat

PR #151 ist nach vollständiger erfolgreicher CI [40483947064](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40483947064) auf `0962ff12e1d5dc5f8ab248dec78350cd2f081803` regulär integriert. Main `7fefc9dd5d78224575ce40b69066bbb1f1befe91` wurde auf identischen Dateistand geprüft. Die weiter unten als ausstehend bezeichnete CI der übernommenen Vite-Dateien ist damit bestätigt. PR #140 wurde regulär mit diesem Main aktualisiert; neue Scan-/CI-Ergebnisse sind separat zu bewerten.

Nächster **vorbereiteter** Kandidat ist die transitive DOMPurify-Version 3.4.17, im offiziellen npm-Register bestätigt. Der manuelle Hilfsworkflow verwendet weiterhin getrennte temporäre Projekte, Frozen-Installationen, feste Toolchain und read-only Token. Das feste Ziel ist nun DOMPurify statt Vite; eine neue direkte Manifest-Abhängigkeit ist ausdrücklich unzulässig. Der Verifikator verlangt semantisch unveränderte Root-/App-Manifeste und den exakten Zieleintrag in beiden Bun-Locks.

Für den tatsächlichen manuellen Aufruf ist die Source-Bindung auf den Dispatch-Commit ergänzt (`github.sha`, wenn kein PR-Event vorliegt); Artefaktname und Concurrency verwenden ebenfalls den zutreffenden Ref/Commit. Keine freien Paketparameter, Secrets oder Pushrechte. Dies korrigiert die vorher nur für PR-Events passende Source-Umgebungsvariable.

Lokal bestanden: Verifikator-Syntax, bestehende Toolchain-Pin-/Workflow-Layout-Gates. Generatorlauf, Artefaktprüfung, neuer vollständiger Scan und CI des später tatsächlich übernommenen DOMPurify-Kandidaten fehlen noch. Aktuelle Paket-/Lockdateien bleiben in diesem Vorbereitungsschritt unverändert. Keine zusätzliche Entwarnung und keine Produktionsfreigabe.

## Aktueller Stand: isoliert erzeugten Kandidaten übernommen

Der zweite Generator [40482798433](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40482798433) auf `1d27fb42d66b17f804f56d032953a9121e0c3b29` bestand einschließlich **beider getrennten Frozen-Installationen** mit deaktivierten Lifecycle-Skripten. Enterprise-CI [40482798388](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40482798388) dieses Generator-Heads ebenfalls erfolgreich; diese CI gilt noch nicht für die später übernommenen Paketdateien.

Neues Artefakt-ZIP: SHA-256 `719871e56b9b72c4d015624d26f265fc146e921df07f6cd885fb84d8ea27ccee`, mit GitHub-Digest verglichen. Exakt fünf Einträge, Source-Head, alle vier Vorher-/Kandidatenhashes und Paketgraph-Differenzen lokal geprüft. Die Root-/App-Locks werden auch bei getrennter Erzeugung identisch und bestehen beide Frozen-Prüfungen; die frühere Vermutung einer gegenseitigen Verzeichnisbeeinflussung ist damit nicht bestätigt. Der initiale fehlende Frozen-Nachweis wurde durch diesen neuen Lauf ergänzt.

Die vier überprüften Artefaktdateien sind jetzt als Update-Kandidat im Entwicklungsbranch übernommen: beide Manifeste pinnen Vite 8.3.5; die Locks wurden von Bun erzeugt, nicht manuell bearbeitet. Graphreview: 38 geänderte Root- und 23 App-Lockeinträge, einschließlich transitiver Build-Pakete und Auflösung bereits deklarierter Abhängigkeiten. Beide Lock-Hashes: `420c1a107d3f8a4e54e7d359333feb2c2dd0631874354856b22c6ec4004a6dda`.

Vollständige lokale OSV-Abfrage des neuen Kandidaten samt unveränderter Functions-Lockdatei am 27.10.2026: **1.440 eindeutige Versionen / 20 betroffene Versionen / 33 Advisories**. Gegenüber dem geprüften Ausgangsgraphen 1.439 / 21 / 39 ist das eine Teilreduktion, keine saubere Gesamtbewertung und keine unabhängige Freigabe. Weitere Befunde bleiben Release-Blocker.

Der Hilfsworkflow ist nun ausschließlich manuell auslösbar, damit jeder nachfolgende PR-Commit keinen weiteren Kandidatenlauf erzeugt. Keine automatische Übernahme oder Schreibrechte. Vollständige Pflicht-CI am exakten neuen Commit mit übernommenen Paketdateien bleibt **ausstehend**; erst danach darf regulär integriert werden. Die folgenden Abschnitte dokumentieren den historischen Aufbau und die ursprünglichen Prüfgrenzen. **Produktion bleibt NO-GO.**

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

## Erste Linux-Ausführung und zusätzliche Isolation

Der erste Generatorlauf [40482007791](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40482007791) auf `657fd84622f0142828c489e177c6db95ea356d5a` bestand. Das heruntergeladene ZIP hatte den auf GitHub angezeigten Digest `e35aa9a5253752571ce7e3820331f847aa36f1898551aba13c81df61f9ff9ba2`; genau fünf erwartete Archiveinträge, Source-Head und alle Vorher-/Kandidatenhashes wurden lokal geprüft. Der erste Kandidat hatte 1.440 eindeutige Versionen / 20 betroffene Versionen / 33 Advisories in einer vollständigen lokalen OSV-Abfrage. **Nicht übernommen:** Root-/App-Locks waren nach der verschachtelten Erzeugung identisch; ein eigener Frozen-Install-Nachweis fehlte. Die Befundreduktion ist noch kein integrierter Fix.

Der Generator arbeitet jetzt pro Manifest/Lockpaar in getrennten temporären Verzeichnissen außerhalb des Checkout-Baums und führt dort jeweils `bun ci --ignore-scripts --no-env-file` vor dem Zurückkopieren aus. Beide Befehle verwenden explizit das offizielle npm-Register. Damit wird eine gegenseitige Beeinflussung verschachtelter Projektverzeichnisse vermieden und fehlgeschlagene Frozen-Installationen verhindern den Artefakt-Upload. Neues Artefakt und neuer exakter Head bleiben erneut zu prüfen; der erste Download wird nicht als Freigabenachweis wiederverwendet. Lokale Windows-Frozen-Installation bleibt unbestätigt. Vollständige App-CI muss auf dem späteren Commit mit den tatsächlich übernommenen Kandidatendateien laufen.
