# Kontrollierte Dependency-Remediation — 2026-10-27

**Produktion: NO-GO.** Einzelne Dependency-Fixes und grüne CI ersetzen weder die offenen Security-Befunde noch unabhängige Freigaben oder echte Staging-/Rollback-Nachweise. Dieser Status ist kein Compliance-Testat.

## Integrierte Teilfixes

| PR / Änderung | Erfolgreiche vollständige CI / geprüfter Head | Verifizierter Main nach Integration |
| --- | --- | --- |
| #151: Vite 8.3.5, erzeugte Root-/App-Locks | [40483947064](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40483947064), `0962ff12e1d5dc5f8ab248dec78350cd2f081803` | `7fefc9dd5d78224575ce40b69066bbb1f1befe91` |
| #152: DOMPurify 3.4.17, ein Eintrag je Lock | [40486060641](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40486060641), `da33f21bfb8d3a83a258b36cf2fd52e3d8c7d8ab` | `4977ab50bf822838e01eb604770e29bc295d3998` |
| #153: follow-redirects 1.16.2, ein Eintrag je Lock | [40542268993](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40542268993), `edf3d1953440f2eb211a63014e07b6adb0cfb7f5` | `5304bbd8c53a99a76b30f6ea97a0781a03b163f9` |
| #154: zwei verschachtelte source-map-js-1.2.1-Einträge je Lock entfernt; vorhandene 1.2.2-Auflösung bleibt | [40552980574](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40552980574), `f02f921c2e076675604c8c766ef922d02733bef6` | `00a1f5fb97ccdf73021405e73372796c80fd20b4` |

Jeder Main-Tree wurde nach regulärer Integration exakt mit dem geprüften Branch verglichen. DOMPurify-, Redirect- und Source-Map-Fixes verändern die Manifeste und übrigen Paketversionen nicht. Vite umfasst überprüfte transitive Build-Paketänderungen und die Auflösung bereits deklarierter Abhängigkeiten.

## Aktueller Kandidat

Festes Ziel: **concurrently 10.0.6**, dessen offizielles npm-Metadatum die benötigte Child-Version **shell-quote 1.12.0** exakt deklariert. Node-Anforderung >=22 passt zur gepinnten Toolchain. Gezielte vollständige OSV-Antworten für beide Zielversionen ohne Advisories geprüft. Root-/App-Manifeste dürfen ausschließlich `devDependencies.concurrently` auf exakt 10.0.6 ändern; alle übrigen Einträge müssen unverändert bleiben. Beide Locks müssen Parent-/Child-Zielversionen enthalten und dürfen shell-quote 1.9.0 nicht mehr enthalten.

Der erste direkte Child-Updateversuch [40560759151](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40560759151) auf `b5d76eec60fe10ed5296e1f0f6e75c5aead39f94` scheiterte im Verifikator mit `Unexpected generated change scope`; kein Artefakt wurde freigegeben und keine Locks übernommen. Der vorhandene Parent concurrently 10.0.5 bindet shell-quote exakt an 1.9.0. Statt die Grenze zu lockern oder per Major-/Global-Override zu umgehen, wird der kompatible Parent-Patch erzeugt. Der fehlgeschlagene Lauf bleibt als historischer Nachweis erhalten; neue Ausführung nur wegen der geänderten Update-Strategie.

Der neue Parent-Generator [40561359438](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40561359438) auf `50ad824f31c3cb247b3b833e8a27b77559d3a401` bestand beide getrennten Frozen-Installationen. ZIP-Digest `eeeb716b9170375f714ea1477cb4d2e551d4ae5234493c54841e991b36acb957`, fünf Einträge, Source- und sämtliche Vorher-/Kandidatenhashes geprüft. Der vollständige GitHub-Remote-Tree `1ad7353869f10a8214446f1d38cafa136f291f46` entsprach exakt dem lokalen Source-Tree; dieser API-Nachweis ersetzte den in diesem Lauf mit `getaddrinfo() thread failed to start` fehlgeschlagenen Git-Fetch. Keine ungeprüfte Remote-Übernahme.

Graphreview: genau zwei geänderte Einträge pro Lock, concurrently 10.0.5 → 10.0.6 und shell-quote 1.9.0 → 1.12.0. Die Manifeste ändern ausschließlich den Parent-Eintrag auf exakt 10.0.6. Vier Artefaktdateien im Entwicklungsbranch übernommen, beide Lockhashes `ef92db58deee53e192faab5b130c72a6a1d39b910d037839007c18fe185a188d`. Differenzieller vollständiger OSV-Vergleich: Ausgang **1.439 / 18 / 26**, Kandidat **1.439 / 17 / 25**. Lokale Syntax-/Toolchain-Pin-/Layout-/Whitespace-Gates bestanden. Vollständige Pflicht-CI am exakten neuen Commit mit übernommenen Dateien bleibt ausstehend. Generatorerfolg oder saubere Zielversionsabfrage ersetzt sie nicht.
## Verifizierte Erzeugungsnachweise

Die folgenden Generatorläufe bestanden jeweils beide getrennten Linux-Frozen-Installationen. ZIP-Digest wurde mit GitHub verglichen; genau fünf Einträge, Source-Commit und alle vier Vorher-/Kandidatenhashes wurden lokal geprüft. Artefakte/Detailreviews liegen lokal außerhalb des Repositorys; unveränderte ältere Dokumentfassungen und Zwischenschritte sind über die Git-Historie nachvollziehbar.

| Ziel | Generator / Source-Head | ZIP SHA-256 | Beide Kandidaten-Lockhashes |
| --- | --- | --- | --- |
| Vite 8.3.5 | [40482798433](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40482798433), `1d27fb42d66b17f804f56d032953a9121e0c3b29` | `719871e56b9b72c4d015624d26f265fc146e921df07f6cd885fb84d8ea27ccee` | `420c1a107d3f8a4e54e7d359333feb2c2dd0631874354856b22c6ec4004a6dda` |
| DOMPurify 3.4.17 | [40485769378](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40485769378), `97cbe5967ee51f0a26f51ea24803a3029d4dd5ef` | `ab412a2b68afa42ba0c65531eab8a1a165b134b106b0b31648eaf8846556566b` | `a82fb3b798a38da2ca8adb9a6bda0f6ebe4041642fcdfe9ec70b8fbe345b07ca` |
| follow-redirects 1.16.2 | [40541640098](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40541640098), `e3a591be7a5c7a2cd8b25507a8e4fd189942387b` | `aaf68b1c6a55e3d75be951e7beadd05e35d08908fc36ef6e1165f721aa628a32` | `e3fd4a98ab0e1599503d859ca451689629a10f37ab7dcb6288033efc830ee4f1` |
| source-map-js 1.2.2 | [40552680151](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40552680151), `8cad18c718ba11924b38ef5d33ece179fb28f631` | `fc92968e4ca6fb144a10a48b37c2b04824dc0bb1466da7bcf7339e18a3e2e276` | `4fe5123fe2ed93c82eeb77c35f8a8d47013b6136e1199ed78c07e4b1205fcdbc` |

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
- Root-/App-Manifest und jeweilige Lock in getrennten temporären Verzeichnissen. Offizielles npm-Register, `bun update --exact --lockfile-only --ignore-scripts --no-env-file`, danach jeweils `bun ci --ignore-scripts --no-env-file` vor Upload. Integritäts-/TLS-Prüfung bleibt aktiv.
- Verifikator verlangt begrenzten Datei-Diff, unveränderte Manifest-Abhängigkeiten und exakten Zieleintrag. Zusätzlicher vollständiger Graphreview muss ältere/nested Auflösungen und unbeabsichtigte Änderungen prüfen. Einzelne passende Zielzeile genügt nicht.
- Artefakt enthält nur vier Manifest-/Lockdateien plus Quell-/Toolchain-/Vorher-/Kandidatenhashes. Aufbewahrung drei Tage. Dispatch bindet an `github.sha`; Ref-gebundene Concurrency.
- Erst nach Artefaktprüfung Dateien übernehmen, vollständigen Scan und Pflicht-CI auf dem exakten übernommenen Commit verlangen. Generator-/Vorbereitungs-CI ersetzt diese CI nicht. Danach regulär integrieren und Main-Tree vergleichen.

Die lokale Windows-Bun-Auflösung bleibt trotz offizieller Binary und eigener D:-Temp-/Cachepfade mit EBADF blockiert; Linux ist der belegte Erzeugungsweg. WSL ist nicht installiert, keine Installation wurde versucht. Hashes binden gelesene Bytes; CRLF-Checkouts können andere Hashes als Linux erzeugen. [Bun Update](https://bun.com/docs/pm/cli/update), [Lockfile-Dokumentation](https://bun.com/docs/pm/lockfile).

## Verbleibende Freigabegrenzen

Scanner noch keine konfigurierte Branchschutzpflicht; Pfadfilter erfassen nicht jede Quelländerung. Parserinstallation verwendet Appgraph. Minimaler isolierter Scannerbuild, SAST, Container-/OS-Scans und vollständige OpenSSF-Scorecard sind nicht nachgewiesen. Kein separates Staging-Projekt; echte Retention-, Last-, Lösch- und Rollback-Nachweise sowie unabhängige Security-/Datenschutz-/Finance-Abnahmen bleiben offen. Keine neue Cloud-Ressource oder reale Abrechnung aus diesen Prüfläufen. **Keine Produktionsfreigabe.**
