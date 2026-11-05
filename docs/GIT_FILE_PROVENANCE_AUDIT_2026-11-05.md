# Klar – Historischer Git-Dateivollständigkeits-Audit

**Stichtag:** 05.11.2026 · **Status:** laufende Integritätsprüfung; Produktionsfreigabe **NO-GO**.

## Prüfauftrag und Nachweisgrenzen
Wir prüfen, ob jede in heute erreichbaren Git-Commits versionierte Datei wiederherstellbar ist. Das ist NICHT gleichbedeutend mit der Aussage, dass sämtliche seit Projektbeginn lokal erstellten Dateien jemals in GitHub gespeichert wurden. Lokal ignorierte Archive, nicht eingecheckte Dateien, nicht mehr referenzierte/force-gepushte Commits, externe Git-LFS-Objekte und abgelaufene CI-Artefakte lassen sich nicht aus einem heutigen Git-Clone rekonstruieren.

## Direkt aus der GitHub-API verifizierte Snapshots
Alle Git-Baum-Abfragen waren vollständig (truncated=false).

| Git-Stand | SHA | Git-Blobs |
| --- | --- | ---: |
| Initialer erreichbarer main-Commit vom 06.10.2026 (nur README.md) | 65f6edd7998f726895293025f095fd6914e2b624 | 1 |
| Früher Dateiupload vom 08.10.2026 | 320833fc4a8291be5a00cbd2b8bbe55d0a61319e | 54 |
| Korrektur der phase2_work-Git-Nachverfolgung vom 08.10.2026 | a159e690afcbd77e20a992b77db3920d69709de9 | 1.008 |
| Release-Kandidat R2 | 286a991e776885199bb1028d380e239821de88ac | 1.070 |
| Geschütztes main | 96c3857c53f5ced31fe1394895185f42c75bc716 | 1.311 |
| Draft-Branch PR #325 | 7a73b9532036e7674652ab77e839048982d33bf4 | 1.328 |

GitHub meldete 336 Branches über vier paginierte Abfragen (100 + 100 + 100 + 36). Über den Git-Ref-Endpunkt wurden keine Tag-Referenzen gefunden. Die bloße Zunahme der Dateizahlen beweist NICHT, dass keine Datei geändert, gelöscht, umbenannt oder ursprünglich ausgelassen wurde.

## Konkrete offene Archiv-Provenienz
Auf main liegt Klar_Enterprise_Final_15.09.2026.SHA256SUMS mit einem SHA-256-Eintrag für /mnt/data/Klar_Enterprise_Final_15.09.2026.zip. Das ZIP selbst ist nicht im aktuellen main-Dateibaum vorhanden. In .gitignore werden unter anderem *.zip, *.tar.gz und release/ ausgeschlossen.

Der dokumentierte SHA-256-Wert beweist weder die heutige Existenz noch die Abrufbarkeit oder Prüfsummengleichheit des eigentlichen Release-Archivs. Bis die vollständige Historie geprüft ist, ist auch nicht ausgeschlossen, dass das Archiv früher versioniert war. Falls nicht, muss ein authentisches externes Archiv bereitgestellt und gegen die gespeicherte Prüfsumme geprüft werden. Es darf kein willkürlicher Ersatz erzeugt werden.

## Neu implementierter, lesender Vollhistorien-Audit
scripts/audit-git-history-retention.mjs verarbeitet die vollständig gefetchten Git-Referenzen und den ausgecheckten HEAD. Er ermittelt historische Dateipfade einschließlich entfernter Dateien, sämtliche aktuellen Ref-Tip-Bäume, alle erreichbaren Git-Objekte und die initialen Root-Commits. Der Audit verwendet git rev-list --objects --missing=print, git cat-file --batch-check und git fsck --full --no-reflogs.

Die Datei-Inventare und Git-Objekt-Prüfzähler werden vollständig als JSON bereitgestellt, die Entscheidung und die Grenzen zusätzlich als Markdown. Ein Pfad, der nicht mehr auf main, aber in einem alten erreichbaren Git-Commit liegt, ist grundsätzlich wiederherstellbar und kein nachgewiesener Verlust. Die Klassifikation trennt solche Pfade von Referenzen auf externe ZIP-Dateien.

Ein synthetischer Git-Regressions-Test prüft die Wiederherstellbarkeit entfernter Dateien sowie Fälle, in denen eine Datei nur auf einem alten Branch oder ausschließlich in einem historischen Commit liegt. Die separate GitHub Action .github/workflows/git-history-retention.yml nutzt Lesezugriff, einen vollständigen Fetch und gepinnte Actions; sie führt keine Produktionsaktion durch.

## Enterprise-Abnahmegates
1. Den Audit auf dem exakten PR-Commit in GitHub Actions vollständig ausführen, die JSON-/Markdown-Artefakte abrufen und das Ergebnis mit dem Head-SHA dokumentieren. Ein Script-Commit ohne erfolgreichen Vollhistorienlauf ist noch KEIN Integritätsnachweis.
2. Bei fehlenden Git-Objekten/Korruption als kritischen Integritätsbefund eskalieren; keine automatische Git-History-Umschreibung, kein Force-Push oder Branch-Pruning durchführen.
3. Historische, inzwischen entfernte Dateipfade einzeln nach Art des Wechsels prüfen (absichtliche Löschung, Umbenennung, Quarantäne oder Verlust). Nicht pauschal wieder in main einfügen, insbesondere keine entfernten Secrets oder persönlichen Daten.
4. Die Release-Archive aus vor dem initialen Git-Commit datierten Projektständen über einen externen authentischen Speicherort belegen; SHA-256 bytegenau gegen das versionierte Manifest prüfen.
5. In der Release-Governance und Linear Verantwortliche für Archive, Beweisaufbewahrung, SRE und AppSec benennen. Nachvollziehbare Nachweise langfristig außerhalb ablaufender CI-Artefakte sichern.

## Unveränderter Freigabestatus
Der P0-Befund VES-5 (Firestore/GCS Post-Authorization TOCTOU und All-Writer-Fencing) bleibt offen. PR #317–#325 bleiben ungemergt. Die produktive Foto-Löschung ist gesperrt und productionApproved=false. Dieser Dateiaudit ersetzt weder Cloud-IAM-/TTL-Nachweise noch AppSec-/DPO-/SRE-/Release-Owner-Freigaben.

**Aussagegrenze:** Weder vollständige erreichbare Git-Objekte noch ein grüner CI-Lauf können beweisen, dass alle lokal erstellten Dateien aus der Zeit vor der ersten Git-Einlieferung je erhalten geblieben sind.

## Reproduzierter Vollhistorien-Nachweis (GitHub Actions #1)

**Workflow:** https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42117202145
**Geprüfter erster Audit-Commit:** 37579d4651438aac3982d7131b7689c4e7b204b1
**Ergebnis:** SUCCESS, native Regression 1/1 bestanden, Git-Objektprüfung REACHABLE_GIT_HISTORY_INTACT_WITH_EXTERNAL_LIMITATIONS, git fsck bestanden.

| Kennzahl | Messwert |
| --- | ---: |
| Remote-Branches zum Audit-Zeitpunkt | 337 (inklusive neuem Audit-Branch) |
| Git-Tags | 0 |
| Alle erreichbaren Git-Objekte | 18.930 |
| Fehlende Git-Objekte | 0 |
| Historisch einzigartige Git-Dateipfade | 1.694 |
| Dateipfade auf main | 1.311 |
| Historische Dateipfade nicht mehr auf main | 383 |
| Historische Pfade auf keiner Branch-Spitze, aber weiterhin über Git-Commits erreichbar | 10 |
| Submodule/Gitlinks | 0 |
| Fehlende externe Archiv-Referenzen aus SHA256SUMS-Dateien | 2 Referenzen auf dasselbe ZIP |

**Interpretation:** Alle in diesem vollständigen Ref-Fetch erreichbaren Objekte sind verfügbar und Integrität der Git-Objektdaten wurde geprüft. 383 alte Dateipfade fehlen auf dem main-Tip, aber das ist nicht gleichbedeutend mit Dateiverlust; 10 Namen liegen ausschließlich in historischen Commits und sind aus der Historie wiederherstellbar. Die 2 SHA256SUMS-Referenzen stammen aus zwei versionierten Prüfsummendateien (Repository-Wurzel und phase2_work), welche **dasselbe** extern gespeicherte Klar_Enterprise_Final_15.09.2026.zip referenzieren. Für das tatsächliche ZIP gibt es aus Git allein keinen Erhaltungsbeleg.

**Maschinenlesbare Evidence:** https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42117202145/artifacts/13457501807 (JSON und Markdown, SHA256 des CI-Artefakts bf34a7c5ae884977bee5f8a5b62fc00407b90f3ac651a1dae2e2c41ecbe504bd; GitHub-Aufbewahrung bis 05.12.2026). Enthalten sind sämtliche 1.694 historisch erfassten Pfade und die Liste der 10 rein historischen Pfade. Die Git-Objekte selbst werden durch Git-Referenzen erhalten, das zeitlich begrenzte CI-Berichtartefakt ist kein langfristiges Archiv.

**Nachkontrolle CI:** Die allgemeine Enterprise-CI #1767 für denselben Commit scheiterte an ihrer Workflow-Toolchain-Policy (zusätzlicher Audit-Workflow enthielt zunächst keine Setup-Bun-Aktion mit Pin Bun 1.4.4). Kein Code-/Objektintegritätsfehler. Die neue Audit-Workflow-Datei wurde deshalb im Folgecommit 9769cbf145b11a6d0c4af59b9371dbbbcb99e9da um die freigegebene gepinnte Bun-Aktion ergänzt. Für den finalen Head ist eine unabhängige erneute CI-Prüfung erforderlich.

**Enterprise-Entscheidung:** Git-intern *erreichbare* Dateien sind nach dieser Prüfung erhalten; die Erhaltung aller Dateien **seit der tatsächlichen Produktentwicklung vor dem ersten Git-Commit** sowie extern gespeicherter ZIP-Archive ist **nicht bewiesen**. Vor einer Garantieerklärung sind externe Release-Backups und Prüfsummen unabhängig zu belegen. Produktionsfreigabe bleibt NO-GO; productionApproved=false.

## 05.11.2026 – v149/R2 Mastervergleich und Dokumentations-Branch-Nachweis

**Exact trees, all `truncated=false`:** v149 branch `0042bbff95e2092c804407fd8559aa6d8e3d37ed` (1.034 Blobs), R2 `286a991e776885199bb1028d380e239821de88ac` (1.070 Blobs), geschütztes `main` `96c3857c53f5ced31fe1394895185f42c75bc716` (1.311 Blobs). **0 fehlende v149-Pfade auf main, 0 fehlende R2-Pfade auf main.** Unterschiede einzelner Blob-SHAs sind spätere Änderungen, nicht identische Codebytes. Ursprüngliche Blob-Versionen sind weiterhin über die jeweiligen Commits abrufbar.

**Dedicated documentation branch:** `docs/ci-governance-audit-2026-10-23`, unveränderlicher Baseline-Tip `e7907d494d9fa3e2383110893182dc252cd8c18a` (1.175 Blobs, darunter 155 `phase2_work/docs/` und 221 `phase2_work/scripts/`; alle 1.034 v149-Pfade vorhanden). Die ursprüngliche Datei `phase2_work/docs/P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md` ist **nur dort, nicht auf main**, unter Blob-SHA `f82ea61e5baf2516000916baba2d53478c675bef`, Dateigröße 32.796 Bytes erhalten. Der Diff der Documentation-Baseline gegen main zeigt 15 ausschließlich auf dieser Branch vorhandene Governance-Dokumente. Der ursprüngliche Blob wurde nicht verändert.

**Aktualisierung:** Ein neues, separates Markdown-Addendum wurde auf der dedizierten Dokumentations-Branch unter `phase2_work/docs/REPOSITORY_INTEGRITY_V149_2026-11-05.md` hinzugefügt, Commit `7cfce1fa2ffc9a61e38ab834306b48fb2a52a2a2`. Keine bestehende P0-Datei, Scriptdatei oder Branch-Historie wurde dabei überschrieben. Der Basis-Dokumentationszweig ist eigenständig und nicht ein Deployment-/Releasezweig.

**Technischer Zusatz-Guard:** `scripts/check-v149-documentation-provenance.mjs` prüft read-only nach vollständigem Remote-Fetch: sämtliche v149-/R2-Dateipfade gegen `main`, die gesamte Governance-Dokumentations-/Scripts-Teilmenge der festen Dokumentations-Baseline gegen den aktuellen dedizierten Ref, den originalen P0-Evidence-Blob-SHA und getrennte dokumentationsspezifische Pfade. Zwei Failure-Szenarien im neuen synthetischen Test erzwingen Fail-Closed bei fehlendem Basispfad oder verändertem P0-Blob. Der GitHub-Workflow ist dafür erweitert. Eine grüne CI auf dem **neuen** exakten HEAD bleibt bis zur Ausführung abzuwarten.

**Grenze:** Von GitHub nicht sichtbar sind uncommitted working-tree changes auf Entwicklergeräten, archivierte lokale ZIPs oder absichtlich nicht mehr referenzierte Git-Objekte. Diese Aussage bestätigt deshalb die Integrität des derzeit erreichbaren, committed Git-Graphs und der v149-/R2-Pfade, nicht sämtliche jemals erzeugten Entwicklungsassets. VES-10 und der P0-Release-Blocker VES-5 bleiben offen; `productionApproved=false`.
