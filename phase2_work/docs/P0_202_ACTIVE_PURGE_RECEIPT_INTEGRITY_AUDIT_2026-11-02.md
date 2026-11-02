# P0 #202 – Audit: fehlende Quittungsprüfung im aktiven Foto-Purge

**Auditdatum:** 2026-11-02  
**Quellbasis:** Draft PR #309, unveränderter Commit `1a291209a111788f72eb5187af339dc6232f8a12`, vollständige Enterprise-CI [#41464881430](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41464881430) SUCCESS.  
**Freigabestatus:** `productionApproved=false` – **BLOCKED / NO-GO**.

## Nachweis aus dem Source-Code

- `phase2_work/src/server/routes/complianceStorage.ts` bildet `verification_events.photoPurged === true` in `VerificationArtifactRecord.photoPurged` ab und überspringt im Due-Page-Preflight bei diesem Marker `assertCurrentVerificationPurgeCandidate`. Es gibt im aktiven Skip-Zweig keine Prüfung auf `photoPurgedAt` oder `auditDigest`.
- `phase2_work/src/server/platform/storageRetentionEngine.ts` liefert bei `artifact.photoPurged` unmittelbar `reason: 'already_purged'` zurück. Der HTTP-Handler kann damit `200 ok: true` zurückgeben, wenn alle Elemente bereits markiert sind, auch ohne eine konsistente Löschquittung nachzuweisen.
- Bestehende HTTP-Tests in `phase2_work/tests/verificationPurgeHttp.spec.ts` erstellen 100 bzw. 300 `photoPurged:true`-Datensätze **ohne** `photoPurgedAt` und `auditDigest` und erwarten `200`. Der Testbestand konserviert somit die Beweislücke.
- `generatePurgeAuditDigest(uid, challengeId, storagePath, purgedAt)` erzeugt SHA-256 **ohne Schlüssel und ohne Provider-Quittung**. Eine rechnerisch passende Prüfsumme allein ist *kein* Beweis, dass genau die erwartete GCS-Generation erfolgreich gelöscht wurde.

Dies ist ein **quellbasierter Konsistenz- und Auditbefund**, kein Nachweis eines aktuellen Produktionsvorfalls, einer realen Datenlöschung oder einer manipulierten Quittung.

## Empfohlene eng abgrenzbare Abnahme

1. Definiere mit DPO/Legal und SRE zunächst den **autoritativen, versionierten** Löschquittungs-Vertrag (einschließlich GCS-Bucket, Objektpfad, kanonischer Generation, providerseitiger Erfolg/Fehlercode, stabilem Request-/Work-ID, Firestore-Transaction/Version und nachvollziehbarer Herkunft). Bestehende Legacy-Records müssen read-only inventarisiert werden.
2. Die aktive Due-Page-Preflight-Route muss uneindeutige `already_purged`-Zustände und widersprüchliche Marker *vor jedem physikalischen Löschaufruf* verweigern. Keine boolesche Markierung als alleiniger Erfolgsnachweis.
3. Testmatrix: fehlender, beschädigter, widersprüchlicher oder fremder Receipt; alter `photoPurged:false`-Record mit vorhandenem Receipt; 100/300 positive, belegte Records; später ungültiger Datensatz blockiert GCS-Aufrufe des gesamten Batches; Fehlerantwort ohne PII.
4. Echte GCS-404/412-/Timeout-/Crash-Reconciliation mit generation-bound Evidence und idempotenter Durable-Queue >300 Aufträge; keine 404-as-success-Abkürzung. Tests in genehmigter Staging-Umgebung plus IAM-/Scheduler-Nachweise.
5. Unabhängige Security-, DPO-, Legal-, SRE- und ReleaseOwner-Signaturen für den exakten Release-Commit. P0 #254 Tenant-/Art.-17-/Storage-BOLA-Gates ebenfalls vollständig grün.

## Bearbeitungs- und Branch-Integrität

Ein geplanter aktiver Code-Fix wurde durch eine Tool-Sicherheitsprüfung beim abhängigen Repository-Schreibvorgang gestoppt. Der vorausgehende Teil-Commit wurde **vollständig zurückgenommen**; GitHub-Compare zum unveränderten Parent zeigt **keine Dateiänderungen** nach dem Revert. Es wurden **keine** neuen Source-Fixes, neuen Regressionstests, Produktivoperationen, Deployments oder Merges durchgeführt. Dieser Branch enthält nur diesen **Audit-Bericht**, keine funktionale Abhilfe; eine künftige sichere Implementierung muss separat geprüft und CI-zertifiziert werden.

**Freigabeentscheid:** NO-GO. Dieses Audit darf nicht als Production-GO, echte GCS-Quittung oder abgeschlossener P0-Remediation-Nachweis interpretiert werden.
