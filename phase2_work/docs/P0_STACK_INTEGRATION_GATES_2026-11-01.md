# Klar P0 – Stacked-PR-Abhängigkeitsmatrix und sichere Integrationsreihenfolge

**Stand:** 2026-11-01 · **Scope:** ausschließliche Quell-/Governance-Inventur ohne Merge, Deployment, Kundendaten oder Cloud-Änderungen.  
**Release:** `productionApproved=false` · **BLOCKED / NO-GO**.  
**Main-Baseline:** `2808dc1cbb485f70b403681c108cea5a3361d950` (bei Erstellung geprüft).  
**Gültigkeit:** Jeder neue Commit, Rebase, Merge oder geänderte PR-Base erfordert neue Graph-/CI-Prüfung. Die Tabelle belegt Branch-Beziehungen, **nicht** deren Freigabe.

## 1. Tatsächlich geprüfte lineare P0-Test-/Governance-Kette

Alle genannten PRs waren am Prüftag **Draft, offen und nicht gemergt**. Jede Zeile zeigt den auf GitHub abgefragten PR-HEAD sowie den zu diesem Zeitpunkt vom Anbieter gemeldeten **Base-Commit**. In dieser Kette stimmt die Base-SHA der Folgezeile mit der HEAD-SHA der Vorgängerzeile überein. **Integrationsziel / Release SHA existiert damit noch nicht.**

| Reihenfolge | PR / Zweck (stark gekürzt) | Exakter HEAD | Exakter Base-Commit |
| --- | --- | --- | --- |
| 0 | `main` | `2808dc1cbb485f70b403681c108cea5a3361d950` | – |
| 1 | [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) Alt-Cron-Foto-Purge fail-closed | `54ef22b87d40c90711e575d7e133b9311417f2f1` | `2808dc1cbb485f70b403681c108cea5a3361d950` |
| 2 | [#271](https://github.com/Veselin-Takev/Klar-Dating/pull/271) GCS-Generation/HTTP-Quittung | `d7acb084e0bc3d4b28d1efd317fd442ca7eb93aa` | `54ef22b87d40c90711e575d7e133b9311417f2f1` |
| 3 | [#272](https://github.com/Veselin-Takev/Klar-Dating/pull/272) begrenzte Decision-Pagination | `61c78d3311dfdba2dec7910f11505d32e2f34479` | `d7acb084e0bc3d4b28d1efd317fd442ca7eb93aa` |
| 4 | [#273](https://github.com/Veselin-Takev/Klar-Dating/pull/273) Read-only Retention Census | `5223b4c796c46c126a1f7ebfc5bebf931ffa991a` | `61c78d3311dfdba2dec7910f11505d32e2f34479` |
| 5 | [#274](https://github.com/Veselin-Takev/Klar-Dating/pull/274) inerte Lease-State-Machine | `0a01784efb56870969f81598e166072500b4f406` | `5223b4c796c46c126a1f7ebfc5bebf931ffa991a` |
| 6 | [#275](https://github.com/Veselin-Takev/Klar-Dating/pull/275) Write-ahead Intent | `7b30adf79e8020101b081ec80e5f4edb0e7d0460` | `0a01784efb56870969f81598e166072500b4f406` |
| 7 | [#276](https://github.com/Veselin-Takev/Klar-Dating/pull/276) Firestore Emulator/CAS | `a8c2830ae325ddf49d07e22508f235898df70204` | `7b30adf79e8020101b081ec80e5f4edb0e7d0460` |
| 8 | [#277](https://github.com/Veselin-Takev/Klar-Dating/pull/277) Lease-/Receipt-Invarianten | `4c1e04eef8935753b990a50ef4ca99432414c334` | `a8c2830ae325ddf49d07e22508f235898df70204` |
| 9 | [#278](https://github.com/Veselin-Takev/Klar-Dating/pull/278) typisierte Pre-Delete-Commands | `bcaede0ea892f6a7ce5b42371bdad9f2d9ae0774` | `4c1e04eef8935753b990a50ef4ca99432414c334` |
| 10 | [#279](https://github.com/Veselin-Takev/Klar-Dating/pull/279) serverseitige Zeit | `2dc5716610740d6196efbbee07b23d7f2a7ed0b3` | `bcaede0ea892f6a7ce5b42371bdad9f2d9ae0774` |
| 11 | [#280](https://github.com/Veselin-Takev/Klar-Dating/pull/280) Command-Descriptor-Schutz | `4f53bcfef9d31ddbd9672465b2362ee1f7d726ac` | `2dc5716610740d6196efbbee07b23d7f2a7ed0b3` |
| 12 | [#281](https://github.com/Veselin-Takev/Klar-Dating/pull/281) Dual-P0-Gates/Inventar | `26e9ed2a15bf8e5af468fc35b3e0fb45ddd92f5d` | `4f53bcfef9d31ddbd9672465b2362ee1f7d726ac` |
| 13 | [#282](https://github.com/Veselin-Takev/Klar-Dating/pull/282) Firestore/Storage-Source-Review | `5c82c3c2f7847a63eef09a863e194106cfba96d9` | `26e9ed2a15bf8e5af468fc35b3e0fb45ddd92f5d` |
| 14 | [#283](https://github.com/Veselin-Takev/Klar-Dating/pull/283) Tenant Rules Emulator | `d2d77d700bcdf8cfd54b943a244f6faafb7590b8` | `5c82c3c2f7847a63eef09a863e194106cfba96d9` |
| 15 | [#284](https://github.com/Veselin-Takev/Klar-Dating/pull/284) Tenant Storage Emulator | `47d4fbc3afc1e9a3207d01d11621d1079929af5d` | `d2d77d700bcdf8cfd54b943a244f6faafb7590b8` |
| 16 | [#288](https://github.com/Veselin-Takev/Klar-Dating/pull/288) Storage-Metadata/Risk-Gate **konsolidiert** | `c358d4360e36ef7a68555c2471f17648358557f7` | `47d4fbc3afc1e9a3207d01d11621d1079929af5d` |
| 17 | [#289](https://github.com/Veselin-Takev/Klar-Dating/pull/289) CI-Emulator Fail-Closed | `fd62b44c0c763ca58ae358fd10c92138b1aff3b3` | `c358d4360e36ef7a68555c2471f17648358557f7` |
| 18 | [#290](https://github.com/Veselin-Takev/Klar-Dating/pull/290) reale Emulator-Fehlkonfiguration | `a93fdc993beb294b684404a26be30a67d23f27b3` | `fd62b44c0c763ca58ae358fd10c92138b1aff3b3` |
| 19 | [#291](https://github.com/Veselin-Takev/Klar-Dating/pull/291) Gastprofil-Mediensichtbarkeit | `b3aa77c199fc8f94a28490b13ba91e87aaadf07a` | `a93fdc993beb294b684404a26be30a67d23f27b3` |

**Exact-HEAD CI auf der zuletzt geprüften Kettenspitze:** [#291 / Run 41350043310](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41350043310) **SUCCESS**. Log bestätigt **5 native Storage, 6 Tenant Firestore und 6 Retention Firestore** Tests tatsächlich ausgeführt, **200 Vitest-Dateien / 1.473 Tests**, Production Smoke, 26 Browser-Fälle sowie das absichtliche fehlende-Emulator-Negativszenario **PASS**. Alle Werte betreffen ausschließlich den **ungemergten Head** `b3aa77c1…`.

## 2. Andere relevante PRs dürfen NICHT blind integriert werden

- [#285](https://github.com/Veselin-Takev/Klar-Dating/pull/285) HEAD `170a0586b22aed47a37c8d82e6cf6843896c6c32` zweigt **von #282** ab. Die alternativen [#286](https://github.com/Veselin-Takev/Klar-Dating/pull/286) HEAD `1090aae0747c0b4163d46cbb234b0e7fff9f80da` und [#287](https://github.com/Veselin-Takev/Klar-Dating/pull/287) HEAD `4ea1cd63a38eae45284dcb84722ec43e53c7aa81` bauen beide auf #285 auf. Ihre Metadaten-/Regeltests überlappen teilweise mit **#288 → #291**; nur nach Diffs und Negativtest-Äquivalenzanalyse fehlende, einzigartige Prüfungen übertragen, **nicht beide Varianten merge-picken**.
- [#268](https://github.com/Veselin-Takev/Klar-Dating/pull/268) HEAD `71c0d31c6e8ad3e8c681f793dd3daba285d50c7c` ist ein **separater main-basierter Tenant-Inventur-Draft**. Die integrierte #281-Kette enthält bereits das `check:tenant-inventory`-Gating; eine erneute Übernahme darf keine doppelten/inkonsistenten Enterprise-Aufrufe oder Statusgates erzeugen.
- [#253](https://github.com/Veselin-Takev/Klar-Dating/pull/253) HEAD `80f1b45f31944222e6c92c5d9e25881d55e700dd` ist ein **separater main-basierter Multi-Tenant-Foundation-Draft**. Seine serverseitigen Tenant-Abstraktionen und die tatsächliche Legacy-zu-Tenant-Migration sind **nicht als produktiv integriert** belegt. Das Quellinventar und die Emulator-Tests in #291 genügen **nicht** für aktive tenant-isolierte Chats, KYC, Payment, Storage oder Admin SDK.
- [#270](https://github.com/Veselin-Takev/Klar-Dating/pull/270) ist ein eigenständiger **main-basierter Governance-Draft**. Dokumentationsänderungen werden an ihm geprüft und nicht stillschweigend mit Source-PRs vermischt.
- Untere Ketten-Commits können durch nachfolgende Squash-, Rebase- oder Konfliktlösungen andere SHAs bekommen. **Keine** grünen Eltern-CI-Ergebnisse auf neue zusammengeführte Artefakte übertragen.

## 3. Verbindliche Integrationsplanung (NICHT autorisierte Durchführung)

1. **Freeze und Review:** Alle Heads, Bases und endgültigen Diff-/CODEOWNERS-Reviews erneut erfassen; kritische Retention-/Tenant-Flows getrennt von Produkt-/Marketing-Migration fachlich prüfen. Keine PR-Auswahl allein nach grüner CI.
2. **P0 #202 AppSec/DPO-Entscheidung:** Alt-Cron-Foto-Purge-Blockierung aus #269 gegen aktiv deployed Scheduler prüfen. Entscheidungsgebundene GCS-Deletes nur mit autorisierter, dauerhafter Queue, generation-gebundenen Write-ahead-Intent-/Belegprotokollen, 404/412-/Timeout-/Hold-Reconciliation und **>300 tatsächlich sicher abgearbeiteten fälligen Jobs** ermöglichen. Der inerte Lease-/CAS-Prototyp aus #274–#280 **löscht nicht**. Keine Live-Aktivierung ohne signierte Freigabe.
3. **P0 #254 Produkt/DPO/Legal-Policy:** Sichtbarkeit von Profilbild/Metadata/Download-URL ausdrücklich für Gäste, unverifizierte, minderjährige, blockierte, gelöschte, revoked und fremdmandantliche Viewer bestimmen. Backend/Rules/Admin-SDK-Autorisierung sowie URL-Token-Revocation und Datenschutz-Folgen genehmigen; bisheriges `signedIn()` ist **kein** fachlicher Beschluss.
4. **Tenant-Cutover:** #253-Fundament gegen reale Datenflüsse und Legacy-Ownership inventarisieren, UID→Tenant-Mapping pro Datensatz und Art.-17-Kaskade unabhängig prüfen; bei Ambiguität in Quarantäne, kein Default-Tenant. Erst nach Migrations-Dry-Run, Restore-/Rollback-Beleg und getrennten BOLA/IDOR-Negativtests Tenant-Produktivbetrieb erwägen.
5. **Integrations-Branch:** Unter genehmigtem Release-Verfahren deduplizierten finalen SHA erzeugen und exakt dort Node 22.23.3, Lockfile/SBOM/SCA, statische Enterprise-Gates, Native-Emulator-CI inklusive Missing-Emulator-Negativtest, Typecheck, Builds, E2E, Last-/SLO-Test, Staging IAM/Rules-/Scheduler-/GCS-Belege, Backups/Restore und Canary/Rollback **neu** prüfen.
6. **Unabhängige Signaturen:** AppSec, Product, DPO/Legal, SRE/Operations, QA und Release Owner dokumentieren ihre exakten Artefakt-/Deploy-SHAs und zeichnen GO. Vorher `productionApproved=false`.

## 4. Freigaberegister

| Pflichtnachweis | Aktueller Status |
| --- | --- |
| Source/CI #291 auf eigenem SHA | **PASS** (nur Entwicklung) |
| Doppelte Source-PRs dedupliziert und endgültig fachlich reviewed | **BLOCKED** |
| Signierte Guest-/Adult-/Tenant-Profile-Media-ADR | **BLOCKED** |
| Live Storage/Firestore Rules, IAM und Admin SDK Tenant-/UID-/ACL-Proofs | **BLOCKED** |
| Rechtskonforme Tenant-/Art.-17-Migration mit Restore/Backfill | **BLOCKED** |
| P0 #202 autorisierte GCS-Hold-/404/412-/Crash-Receipts, echte >300-Queue, Scheduler-Provenienz | **BLOCKED** |
| Final integrierter SHA, Security-/Compliance-/SRE-Reviews und formale Release-Signaturen | **BLOCKED** |

**Keine** produktive Freigabe behaupten, bis sämtliche Felder kryptografisch und fachlich unabhängig belegt sind. Bestehende grüne CI-Läufe reduzieren nur die lokale Implementierungsunsicherheit.
