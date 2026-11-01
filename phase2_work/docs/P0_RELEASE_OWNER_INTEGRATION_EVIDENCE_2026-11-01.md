# Integrierte Sicherheits-Evidenz: P0 #202/#254 und ReleaseOwner-Governance

**Stand:** 2026-11-01  
**Scope:** rein quellenbasierte, **ungemergte Draft-Integration** ohne Produktionsfreigabe; keine Änderung an produktiven Regeln, IAM, GCS, Scheduler oder Kundendaten.  
**Status:** **BLOCKED / NO-GO**, `productionApproved=false`.

## 1. Geprüfte Commit-Provenienz

- `main`: `2808dc1cbb485f70b403681c108cea5a3361d950`.
- P0-Testkette: [Draft #291](https://github.com/Veselin-Takev/Klar-Dating/pull/291) Head `b3aa77c199fc8f94a28490b13ba91e87aaadf07a`. Vollständige [CI #41350043310](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41350043310) **SUCCESS** mit 5 nativen Storage-, 6 Tenant-Firestore- und 6 Retention-Firestore-Tests; 200 Vitest-Dateien / 1.473 Tests, Production Smoke und 26 Browser-Tests. Inbegriffen: echter CI-Fehlkonfigurations-Negativtest ohne Firebase-Emulator.
- Separater Release-Governance-Fix: [Draft #292](https://github.com/Veselin-Takev/Klar-Dating/pull/292), Head `c7e83d309fb64fff132b0e513db682c6acf21f1e`. Vollständige [CI #41352169125](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41352169125) **SUCCESS**, darunter 64 `node:test`-Freigabeprüfungen, 192 Vitest-Dateien / 1.372 Tests, Production Smoke und 26 Browser-Tests.
- Der Vergleich **vor** diesem Integrationsschritt ergab: `phase2_work/scripts/release-go-evidence.mjs` und `phase2_work/scripts/test-release-go-evidence.mjs` in #291 waren inhaltlich **bytegleich mit `main`**. Es gab damit keinen Konflikt zwischen dem P0-Branch und diesen beiden Dateien. Nur diese **zwei** Pfade wurden im neuen Integrations-Branch durch ihre exakten, bereits getesteten Versionen aus #292 ersetzt (jeweils GitHub-Contents-API mit gepruefter Ausgangs-Blob-SHA). Die vorgeschaltete 19-stufige P0-Kette wurde nicht neu geschrieben.
- **Wichtig:** Die jeweiligen grünen Parent-CI-Läufe können die **neue Kombination** nicht zertifizieren. Der kombinierte, endgültige Integrations-HEAD erfordert eigene neue volle CI und **einen** extern überprüfbaren SHA-/Artefakt-Beleg.

## 2. Gegenstand des Integrationsnachweises

| Kontrolle | Erwartung an den neuen gemeinsamen HEAD |
| --- | --- |
| GO-Struktur | `ReleaseOwner` wird zusätzlich zu Security, DPO, Legal und SRE mit `approved:true`, exakt freizugebendem Commit, Approver und Nachweislink erzwungen |
| Rollentrennung | Release Owner darf nicht dieselbe normalisierte Prüferidentität wie Security/DPO/Legal/SRE verwenden; struktureller Vergleich, keine externe Identitätsattestierung |
| P0 Tenant-Mediencharakterisierung | 5 tatsächlich ausgeführte native Storage-Fälle einschließlich Auth-Anonymous-Gast mit erlaubter Legacy-Lesbarkeit, verbotenen Fremd-Writes/Deletes |
| P0 Firestore | 6 tatsächlich ausgeführte native Tenant Rules Fälle; Legacy-UID- und Zukunfts-Tenant-Pfade, keine sichere Live-Cutover-Behauptung |
| P0 Retention | 6 tatsächlich ausgeführte native Firestore-Queue/CAS-Fälle; **inerter** Prototyp ohne aktive GCS-Arbeitsqueue |
| CI-Fail-Closed | Wirklicher negativer `CI=true`-Vitest-Lauf ohne Emulator muss kontrolliert fehlschlagen, nicht still SKIP liefern |
| Vollständige Pipeline | Static/Security-Gates, Typecheck, Functions Build, Tests, Build, Production Smoke, 26 Browser/E2E-Fälle und Lockfile-/Toolchain-Provenienz **auf dem neuen HEAD** |

## 3. Verbleibende harte produktive Freigabesperren

1. **P0 #202 – Biometrische Retention:** Der nur strukturell geprüfte Firestore-Queue-Prototyp ist nicht an eine autorisierte, laufende Löschkette gebunden. Keine behauptete sichere Verarbeitung >300 fälliger Fälle oder echte GCS-Generation-/Legal-Hold-/404-/412-/Crash-Reconciliation, Scheduler-/IAM-Provenienz, Audit-Receipts oder DPO/AppSec/SRE-Freigabe.
2. **P0 #254 – Mandantentrennung und Medien-Policy:** Keine vollständig migrierte tenantisolierte Datenbasis oder produktiv attestierte Rules/IAM/Admin-SDK-BOLA-Kontrolle. Die eingecheckte Profilbild-`signedIn()`-Regel gestattet Anonym-Gästen lokalen direkten Medienlesezugriff; Product/DPO/Legal müssen über zulässige Gast-/Alters-/Blockierungs-/Tenant-Sichtbarkeit, Widerruf alter URLs und Art.-17-Kaskade entscheiden.
3. **Genuine Release-Governance:** Eine gelungene **strukturelle** ReleaseOwner-Prüfung ersetzt keine tatsächliche Unterzeichner-Authentifizierung, freigegebene Change-/Release-IDs, vollwertige SCA/SBOM/OCI-Provenienz, genehmigte Staging-/Prod-Runbooks, Monitoring/Backup/Restore oder unabhängige Security/DPO/Legal/SRE/ReleaseOwner-Signaturen.

## 4. Prüf- und Integrationsdisziplin

- Nur Draft/Feature-Branch; weder direktes Schreiben nach `main` noch blindes Mergen von #291/#292 oder der alternativen #285–#287-Suiten.
- Vor einem CI-PASS des **neuen** Branches sind Quellkompatibilität und volle Exact-HEAD-CI zu verifizieren. Der neue Commit wird hier bewusst **nicht** vorzeitig als bestanden bezeichnet.
- Die Entscheidung bleibt `productionApproved=false`, **Production BLOCKED / NO-GO**. Weder Emulator-PASS noch Source-Policy werden als Produktiv-Daten-/Migrations-/DSGVO-Beleg ausgelegt.
