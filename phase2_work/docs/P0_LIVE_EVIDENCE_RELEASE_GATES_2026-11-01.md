# Klar: P0 #202/#254 als ausdrückliche Pflichtnachweise im technischen Release-Gate

**Datum:** 2026-11-01 · **Status:** DRAFT / Production BLOCKED–NO-GO · **Basis:** [integrierter Draft #293](https://github.com/Veselin-Takev/Klar-Dating/pull/293), exakter SHA `e372270fa5bc43663355c8f2d8191f125c5d55b4`.

## Technischer Befund

`scripts/release-go-evidence.mjs` verlangt eine vollständige und commitgebundene Freigabestruktur mit generischen Integrationsfeldern (u.a. `firestoreRules`, `art17CascadeTransactions`, `retentionLegalHolds`) und fünf signierten Rollen, jedoch **keine explizit benannten** Pflichtnachweise für die noch offenen zwei produktionskritischen P0-Issues. Ein künstliches `GO`-Objekt konnte strukturell gültig sein, obwohl es **keine gesonderten Nachweisfelder** für Admin-SDK-BOLA, Tenant-Migration, Medien-Policy, GCS-Generation-/Fehlerquittungen oder dauerhaftes Lösch-Backlog enthielt. Das ist ein Mangel der *Schema-Abdeckung*, nicht der Beweis einer realen Freigabe oder eines Cloud-Angriffs.

## Zusätzliche Mindestnachweise für strukturelles GO

Die bestehende Liste `mandatoryIntegrationNames` erhält sechs unverzichtbare, separat benannte `mandatoryP0IntegrationNames`:

| Pflichtfeld | Extern unabhängig zu prüfender Inhalt |
| --- | --- |
| `tenantAdminSdkBola` | Same-/Cross-Tenant-UID/Auth-JWT/Membership-/Revocation-/Admin-SDK-BOLA/IDOR-Negativtests, Storage/Firestore Rules und deployed IAM |
| `tenantMigrationArt17` | genehmigtes Legacy→Tenant-Mapping, Art.-17-Kaskade, unsichere Zuordnungen in Quarantäne, Restore und Rollback |
| `profileMediaVisibilityPolicy` | signierte Product-/DPO-/Legal-ADR für Gast-/Alter-/Block-/Tenant-Medienzugriff, Widerruf alter Download-URLs |
| `biometricGcsGenerationReceipts` | autorisierte Entscheidung + Hold-Prüfung, generation-fenced GCS-Deletes, echte 404/412-/Timeout-/Crash-Reconciliation, unveränderliche Receipts |
| `biometricRetentionDurableQueue` | persistente idempotente Work-Queue, Lease/Write-ahead-CAS und reproduzierbarer sicherer Durchsatz von **mehr als 300** fälligen Einträgen |
| `biometricRetentionSchedulerIam` | live ausgeführte Scheduler-/Servicekonto-/Bucket-IAM- und Rules-Fingerprints sowie geplante Migration und abgesicherter Rollback |

Jedes Pflichtfeld muss wie die bisherigen Integrationen `status: PASS`, **genau** den freizugebenden `GITHUB_SHA` und einen strukturell zulässigen externen Evidenzlink vorweisen. Die vorhandenen signaturpflichtigen Rollen Security, DPO, Legal, SRE und ReleaseOwner bleiben separat verpflichtend. **Die Prüfung auf URL-Format und Commit-String ist keine kryptografische Validierung realer Artefakte oder Personensignaturen.** Geschützte GitHub-Umgebungen und unabhängige menschliche Nachweisprüfung dürfen nicht entfallen.

## Tests und Sicherheitsgrenze

- `scripts/test-release-go-evidence.mjs`: Die vollständige synthetische Positivfixture muss weiterhin die erweiterten Strukturanforderungen erfüllen. Pro neuem P0-Feld werden fehlender Eintrag, `SKIPPED`, falscher Commit und fehlender Link zwingend abgewiesen. Zusätzlich überprüft ein Test, dass die tatsächliche `RELEASE_MANIFEST.json` trotz einer künstlich gesetzten Environment-Freigabe bei allen sechs P0-Pflichtnachweisen **NO-GO** bleibt.
- Die bisherigen generischen 13 Integrationen und 14 Mandatory-Gates werden **nicht entfernt**; nur zusätzliche verifizierbare Datenpflichten werden eingeführt.
- Neue exakte Feature-SHA benötigt vollständige `check:enterprise`-CI, Typprüfung, echte 5 Storage-/6 Tenant-Firestore-/6 Retention-Firestore-Emulatorfälle inklusive No-Emulator-Negativtest, Vitest, Build, Smoke und Browser. Eltern-PR-PASS wird **nicht** auf diesen Commit übertragen.
- Keine echte Betriebs-/Freigabe-Evidenz wird erzeugt, kein generierter GO-Record gespeichert. **Keine** Änderungen an `main`, Security Rules, GCS, Kundenobjekten, Firestore-Produktivdaten, Scheduler oder IAM.

**P0 #202 und #254 bleiben OPEN; `productionApproved=false`; Production BLOCKED / NO-GO.** Keine Integration oder Freigabe ohne extern geprüfte P0-Belege und unabhängige Signaturen.
