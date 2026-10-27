# Kontrollierte Dependency-Remediation — 2026-10-27

**Produktion: NO-GO.** Einzelne Dependency-Fixes und grüne CI ersetzen weder die offenen Security-Befunde noch unabhängige Freigaben oder echte Staging-/Rollback-Nachweise. Dieser Status ist kein Compliance-Testat.

## Integrierte Teilfixes

| PR / Änderung | Erfolgreiche vollständige CI / geprüfter Head | Verifizierter Main nach Integration |
| --- | --- | --- |
| #151: Vite 8.3.5, erzeugte Root-/App-Locks | [40483947064](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40483947064), `0962ff12e1d5dc5f8ab248dec78350cd2f081803` | `7fefc9dd5d78224575ce40b69066bbb1f1befe91` |
| #152: DOMPurify 3.4.17, ein Eintrag je Lock | [40486060641](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40486060641), `da33f21bfb8d3a83a258b36cf2fd52e3d8c7d8ab` | `4977ab50bf822838e01eb604770e29bc295d3998` |
| #153: follow-redirects 1.16.2, ein Eintrag je Lock | [40542268993](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40542268993), `edf3d1953440f2eb211a63014e07b6adb0cfb7f5` | `5304bbd8c53a99a76b30f6ea97a0781a03b163f9` |
| #154: zwei verschachtelte source-map-js-1.2.1-Einträge je Lock entfernt; vorhandene 1.2.2-Auflösung bleibt | [40552980574](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40552980574), `f02f921c2e076675604c8c766ef922d02733bef6` | `00a1f5fb97ccdf73021405e73372796c80fd20b4` |
| #155: concurrently 10.0.6 mit exakt shell-quote 1.12.0 | [40561835992](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40561835992), `b13ec308a59540e1c43982b173b8f26d77dc7fec` | `073382804805727f3f69b9945713655a6eef6e46` |
Jeder Main-Tree wurde nach regulärer Integration exakt mit dem geprüften Branch verglichen. DOMPurify-, Redirect- und Source-Map-Fixes verändern die Manifeste und übrigen Paketversionen nicht. Vite umfasst überprüfte transitive Build-Paketänderungen und die Auflösung bereits deklarierter Abhängigkeiten.

## Aktueller Kandidat

Festes geprüftes Auflösungsziel: **body-parser 1.20.9 und 2.4.0**. Beide im offiziellen npm-Register bestätigt, gezielte vollständige OSV-Antworten ohne Advisories. Vorhandene Parent-Ranges verlangen getrennte kompatible Major-Linien (u. a. Express-4-/Tooling-Pfade und Express 5). Deshalb wird ausschließlich der transitive Paketname innerhalb der bestehenden Ranges aktualisiert; kein globaler Major-Override und keine neue direkte Manifest-Abhängigkeit. Der Verifikator verlangt semantisch unveränderte Root-/App-Manifeste und exakt die Versionsmenge 1.20.9 / 2.4.0 in beiden Locks, keine ältere oder ungeprüfte Auflösung.

Syntax-/Toolchain-Pin-/Layout-/Whitespace-Gates lokal bestanden. Noch keine neuen Kandidatenlocks übernommen. Generator, Artefakt-/Graphreview, vollständiger differenzieller Scan und Pflicht-CI am tatsächlich übernommenen Commit stehen aus. Saubere Zielversionsabfragen belegen keine globale Befundfreiheit oder Kompatibilität.

Der vorherige direkte Shell-Quote-Versuch 40560759151 wurde verweigert und veröffentlichte kein Artefakt. Concurrently 10.0.5 band das Child exakt an 1.9.0; der später verifizierte Parent-Patch #155 löste dies ohne Override. Dieser Ablauf bleibt historischer Nachweis, keine Prüfgrenze wurde gelockert.

Aktuellster tatsächlicher PR-#140-Scan [40569766249](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40569766249) auf `67f1b7e44c76cd0d513cf7bcb61f9a4158bebf2c`: 15 Tests bestanden, **1.439 Versionen / 17 betroffene / 31 Advisories**, Exit 1. Gegenüber den historischen 25 Advisories sind die externen Befunddaten fortgeschrieben; normale CI 40569766212 dieses Heads zuletzt in Arbeit. Verbleibende Befunde sind keine Entwarnung und werden nicht ignoriert.
## Verifizierte Erzeugungsnachweise

Die folgenden Generatorläufe bestanden jeweils beide getrennten Linux-Frozen-Installationen. ZIP-Digest wurde mit GitHub verglichen; genau fünf Einträge, Source-Commit und alle vier Vorher-/Kandidatenhashes wurden lokal geprüft. Artefakte/Detailreviews liegen lokal außerhalb des Repositorys; unveränderte ältere Dokumentfassungen und Zwischenschritte sind über die Git-Historie nachvollziehbar.

| Ziel | Generator / Source-Head | ZIP SHA-256 | Beide Kandidaten-Lockhashes |
| --- | --- | --- | --- |
| Vite 8.3.5 | [40482798433](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40482798433), `1d27fb42d66b17f804f56d032953a9121e0c3b29` | `719871e56b9b72c4d015624d26f265fc146e921df07f6cd885fb84d8ea27ccee` | `420c1a107d3f8a4e54e7d359333feb2c2dd0631874354856b22c6ec4004a6dda` |
| DOMPurify 3.4.17 | [40485769378](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40485769378), `97cbe5967ee51f0a26f51ea24803a3029d4dd5ef` | `ab412a2b68afa42ba0c65531eab8a1a165b134b106b0b31648eaf8846556566b` | `a82fb3b798a38da2ca8adb9a6bda0f6ebe4041642fcdfe9ec70b8fbe345b07ca` |
| follow-redirects 1.16.2 | [40541640098](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40541640098), `e3a591be7a5c7a2cd8b25507a8e4fd189942387b` | `aaf68b1c6a55e3d75be951e7beadd05e35d08908fc36ef6e1165f721aa628a32` | `e3fd4a98ab0e1599503d859ca451689629a10f37ab7dcb6288033efc830ee4f1` |
| source-map-js 1.2.2 | [40552680151](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40552680151), `8cad18c718ba11924b38ef5d33ece179fb28f631` | `fc92968e4ca6fb144a10a48b37c2b04824dc0bb1466da7bcf7339e18a3e2e276` | `4fe5123fe2ed93c82eeb77c35f8a8d47013b6136e1199ed78c07e4b1205fcdbc` |

Parent-/Child-Artefakt #155: Generator [40561359438](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40561359438) auf `50ad824f31c3cb247b3b833e8a27b77559d3a401`, ZIP-Digest `eeeb716b9170375f714ea1477cb4d2e551d4ae5234493c54841e991b36acb957`, beide Lockhashes `ef92db58deee53e192faab5b130c72a6a1d39b910d037839007c18fe185a188d`. Fünf Einträge und alle Quell-/Dateihashes geprüft. Der Remote-Tree `1ad7353869f10a8214446f1d38cafa136f291f46` entsprach exakt dem lokalen Source-Tree; API-Nachweis bei fehlgeschlagenem Git-Fetch.

Der erste Vite-Generator 40482007791 wurde nicht als Übernahmenachweis verwendet, da eigene Frozen-Prüfungen fehlten. Die dort beobachteten identischen Root-/App-Locks reproduzierten auch mit getrennter Erzeugung und bestanden anschließend beide Frozen-Prüfungen; eine gegenseitige Verzeichnisbeeinflussung ist nicht bestätigt.

## Scanergebnisse richtig vergleichen

| Geprüfter Snapshot / Kontrollvergleich | Versionen / betroffene Versionen / eindeutige Advisories |
| --- | --- |
| Vite-Kandidat samt unveränderter Functions-Lock | 1.440 / 20 / 33 |
| DOMPurify-Kandidat | 1.440 / 19 / 28 |
| Redirect-Kontrollscan: gemeinsamer Datenbestand, Ausgang → Kandidat | 1.440 / 20 / 29 → 1.440 / 19 / 27 |
| Source-Map-Kontrollscan: gemeinsamer Datenbestand, Ausgang → Kandidat | 1.440 / 19 / 27 → 1.439 / 18 / 26 |

Befunddaten sind zeitabhängig. Der unveränderte historische Redirect-Ausgangsgraph meldete zunächst 19 / 28, später 20 / 29; die Feedänderung wird nicht als Codewirkung ausgegeben. Präzise Wirkungsvergleiche erfolgen über die gemeinsam abgefragte Vereinigung beider Paketgraphen. Unbehandelte Detailbefunde bleiben vertraulich lokal, öffentliche Nachweise sind aggregiert.

PR #140 bleibt Draft. Tatsächliche Scans nach integrierten Teilfixes: [40538555128](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40538555128) auf `77a3e94228c85f613a282c081fec6ad2bd7d7a5d` bestätigte 1.440 / 19 / 28; [40552429356](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40552429356) auf `c277b4e2a8f0c4f87cfd573ede81d91f6b5041c3` bestätigte 1.440 / 19 / 27. Jeweils 15 Scanner-Tests bestanden, Exit 1 wegen Befunden. Nach #154 ist PR #140 regulär aktualisiert; neue tatsächliche CI-/Scan-Ergebnisse separat prüfen. Keine Ignoreliste, pauschale Baseline oder geänderte Befundschwelle. Exit 2 bedeutet unvollständige Prüfung.

Neuer tatsächlicher PR-#140-Scan nach #154: [40560383481](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40560383481) auf `3313eccfb9ae0c879ffb5e6ff14a90a0b6cefe6a` bestand 15 Scanner-Tests und meldete 1.439 / 18 / 26, Exit 1. Dies bestätigt den Source-Map-Ausgangsstand; noch kein CI-Scan des Parent-Kandidaten.

## Verfahren und Sicherheitsgrenzen

- Manueller GitHub-hosted Ubuntu-Lauf, maximal 15 Minuten. Token nur `contents: read`; keine persistierte Checkout-Anmeldung, Secrets, Produktionsumgebung, Cloud-Zugänge, Pushes oder automatischen Merges.
- Genehmigte immutable Action-Pins, Node 22.23.3 und Bun 1.4.4. Festes geprüftes Paket/Version statt freier Shellparameter.
- Root-/App-Manifest und jeweilige Lock in getrennten temporären Verzeichnissen. Offizielles npm-Register, `bun update --lockfile-only --ignore-scripts --no-env-file`, danach jeweils `bun ci --ignore-scripts --no-env-file` vor Upload. Integritäts-/TLS-Prüfung bleibt aktiv.
- Direkt gepinnte Parent-Updates verwenden zusätzlich `--exact`; transitive Parser folgen den vorhandenen Ranges und werden gegen die feste erlaubte Versionsmenge geprüft.
- Verifikator verlangt begrenzten Datei-Diff, unveränderte Manifest-Abhängigkeiten und exakten Zieleintrag. Zusätzlicher vollständiger Graphreview muss ältere/nested Auflösungen und unbeabsichtigte Änderungen prüfen. Einzelne passende Zielzeile genügt nicht.
- Artefakt enthält nur vier Manifest-/Lockdateien plus Quell-/Toolchain-/Vorher-/Kandidatenhashes. Aufbewahrung drei Tage. Dispatch bindet an `github.sha`; Ref-gebundene Concurrency.
- Erst nach Artefaktprüfung Dateien übernehmen, vollständigen Scan und Pflicht-CI auf dem exakten übernommenen Commit verlangen. Generator-/Vorbereitungs-CI ersetzt diese CI nicht. Danach regulär integrieren und Main-Tree vergleichen.

Ein begrenzter Git-Fetch mit frisch über Windows-DNS aufgelöster GitHub-Adresse, prozesslokalem `http.curloptResolve`, HTTP/1.1 und begrenzter Parallelität bestand nach dem früheren DNS-Threadfehler. TLS-Prüfung blieb aktiv, keine dauerhafte DNS-/Git-Konfiguration geändert. Grundlage: [Git-Konfiguration](https://git-scm.com/docs/git-config). Keine dauerhafte IP-Festlegung verwenden; Adresse vor einem solchen Lauf frisch ermitteln.

Die lokale Windows-Bun-Auflösung bleibt trotz offizieller Binary und eigener D:-Temp-/Cachepfade mit EBADF blockiert; Linux ist der belegte Erzeugungsweg. WSL ist nicht installiert, keine Installation wurde versucht. Hashes binden gelesene Bytes; CRLF-Checkouts können andere Hashes als Linux erzeugen. [Bun Update](https://bun.com/docs/pm/cli/update), [Lockfile-Dokumentation](https://bun.com/docs/pm/lockfile).

## Verbleibende Freigabegrenzen

Scanner noch keine konfigurierte Branchschutzpflicht; Pfadfilter erfassen nicht jede Quelländerung. Parserinstallation verwendet Appgraph. Minimaler isolierter Scannerbuild, SAST, Container-/OS-Scans und vollständige OpenSSF-Scorecard sind nicht nachgewiesen. Kein separates Staging-Projekt; echte Retention-, Last-, Lösch- und Rollback-Nachweise sowie unabhängige Security-/Datenschutz-/Finance-Abnahmen bleiben offen. Keine neue Cloud-Ressource oder reale Abrechnung aus diesen Prüfläufen. **Keine Produktionsfreigabe.**

### Parser-Artefakt übernommen; vollständige CI ausstehend

Generator [40570374455](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40570374455) auf `d2e8272332329f67009f7efa43d3014977c79e47` bestand beide getrennten Linux-Frozen-Installationen. ZIP-SHA256 `0d25dc7076f896ec42a4a0a577fc57a97bb676835cea098da8d90b1da37384f9`, exakt fünf Einträge sowie Source-/Vorher-/Kandidatenhashes geprüft. Nur zwei Locks übernommen; Manifeste unverändert. Pro Lock genau drei geänderte Einträge: body-parser 1.20.8 → 1.20.9, Express-Parser 2.3.0 → 2.4.0 sowie zusätzliche verschachtelte qs-6.17.0-Auflösung innerhalb der neuen Parent-Range. Übrige Pakete unverändert.

Differenzieller vollständiger OSV-Vergleich mit gemeinsamem Datenbestand am 27.10.2026: **1.439 / 17 / 31 → 1.439 / 15 / 30** (Versionen / betroffene Versionen / Advisories). Keine globale Entwarnung. Generator-Erfolg ersetzt die noch ausstehende vollständige CI am übernommenen Commit nicht.
