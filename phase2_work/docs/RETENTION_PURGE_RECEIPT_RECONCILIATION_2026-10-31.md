# P0 #202 – generationgebundene Löschbelege statt ungeprüfter `photoPurged`-Erfolgsmeldungen
**Stand:** 31.10.2026 · **Status:** Draft / BLOCKED / NO-GO · **Parent:** [PR #233](https://github.com/Veselin-Takev/Klar-Dating/pull/233) (`e0d289984b1602371a3e1574922e26d9a16c6837`)

## Quellcodebefund und Bedrohungsgrenze

Die aus [PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) über [#229](https://github.com/Veselin-Takev/Klar-Dating/pull/229) und [#233](https://github.com/Veselin-Takev/Klar-Dating/pull/233) zusammengesetzte Retention-Architektur arbeitet bereits mit HMAC, Firestore-Scan-Lease/Cursor/Checkpoint, Entscheidungsprüfung, GCS `ifGenerationMatch`, per-Event `photoPurgeIntent`, Hold-Gates und generationgebundenem `photoPurgeProof`. Vor diesem Patch wurde aber ein `verification_events`-Datensatz mit `photoPurged === true` in `executeVerificationRetentionBatch` unmittelbar als `already_purged` übersprungen und in der HTTP-Zusammenfassung unter `skippedCount` geführt, **ohne** die Qualität des vorhandenen Belegs zu prüfen.

Das ist eine **Audit- und Accounting-Lücke**; es beweist weder einen realen Datenschutzvorfall noch eine tatsächliche unberechtigte Löschung. Vorhandene Altbelege könnten ohne vollständige generationgebundene Nachweise fälschlich als erfolgreich abgeschlossen erscheinen. Ein stilles erneutes Löschen zur „Reparatur“ wäre ebenso unvertretbar.

## Eng begrenzter Fail-Closed-Fix

Neue `hasVerifiedPhotoPurgeReceipt(data, artifact)` in `src/server/routes/complianceStorage.ts` prüft **ausschließlich** bereits als gelöscht markierte Datensätze:

1. `photoPurged` ist ausdrücklich `true`, die Entscheidung hat exakt einen zulässigen Finalzustand.
2. `photoPurgedAt` ist ein valider Löschzeitpunkt **nach** `decidedAt`; `photoPurgeProof.verifiedAt` ist ein valider Zeitpunkt frühestens zur Löschung.
3. Der gespeicherte `auditDigest` stimmt mit `generatePurgeAuditDigest(uid, challengeId, storagePath, photoPurgedAt)` überein.
4. Ein vorhandener, format- und entscheidungsgleicher `photoPurgeIntent` bindet `generation`, `storagePath`, `decidedAt` und finalen Status.
5. `photoUploadGeneration` ist als ursprünglicher Upload-Beleg vorhanden und stimmt mit der `photoPurgeIntent.generation` überein.
6. `photoPurgeProof.generation`, `method` (`delete_acknowledged` oder `absence_reconciled`) und SHA-256-`evidenceDigest` stimmen mit dem gespeicherten Beleg überein.

Der Scanner **überspringt ohne Storage-Zugriff** einen bereits als erledigt markierten Record **nur bei kohärentem Beleg**. Andernfalls wird der Datensatz nicht als `already_purged` anerkannt, sondern über `invalid = docs.length - artifacts.length` im **aggregierten `failedCount`** gezählt. Die HTTP-Schnittstelle liefert entsprechend **503 statt 200**, wenn solche unbelegten Records vorhanden sind. Es findet **keine** automatische Wiederholung einer Löschung und **keine** Offenlegung von UID/Storage-Pfaden in der HTTP-Antwort statt.

Die bestehenden Upload-Provenienz-, Claim-/Lease-, Storage-Hold-, Status- und Generation-Schutzschranken bleiben unverändert.

## Verifikation und Regressionen

- `tests/complianceStoragePurge.spec.ts`: synthetischer gültiger `delete_acknowledged`- und `absence_reconciled`-Beleg, fehlende `photoPurgeProof`, falsche Originalgeneration, Intent-/Pfad-/UID-/Entscheidungs-Zuordnung, falsche Digests, ungültige/inkonsistente Zeitpunkte und falsche Methoden.
- `scripts/check-compliance-storage-purge.mjs`: statisches Pflichtgate für Prüfung des Abschlussbelegs und dessen Einbindung in die ungültige/fehlgeschlagene Zählung.
- Der Parent-Head `e0d289984b1602371a3e1574922e26d9a16c6837` hat bei Erstellung dieses Dokuments den laufenden CI-Job [#41180298630](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41180298630) noch nicht vollständig abgeschlossen. **Der neue Branch benötigt unabhängig davon einen exakten CI-PASS.** Keine Aussagen zu echten Cloud-Tests oder Live-Datensätzen.

## Explizite Grenzen und Freigabesperren

- Die Prüfung beweist nur **interne Konsistenz von Firestore-Belegen**, nicht fortdauernde Abwesenheit eines Objekts in Cloud Storage nach dem Abschluss. GCS kann durch einen privilegierten Writer später erneut beschrieben werden. Daher fehlt weiterhin das **von allen Service-Account-/Admin-SDK-/Entscheidungs-Writer-Prozessen beachtete Fencing**.
- Vorher als gelöscht markierte **historische** Datensätze ohne moderne `photoUploadGeneration`-/Proof-Struktur werden nun **nicht** als erledigt gewertet. Sie bleiben ohne automatische physische Löschung für eine **DPO-/Legal-/SRE-genehmigte Reconciliation**, echte GCS-Inventur und datensparsame Löschbelege offen. Eine bloße aktuelle GCS-Generation darf die ursprüngliche Beweiskette nicht ersetzen.
- Die Dateizeit-/Datenformatregeln sind synthetisch getestet, jedoch nicht mit realen produktiven Firestore-Timestamps, GCS Holds, 404/412-Konflikten oder Crash-/Lease-Recovery belegt.
- Zusätzlich offen: echte Storage-Rules-Migration (keine Legacy-Clientuploads), TTL/Storage-Regeln, Cloud-Scheduler-/IAM-/Secret-/Alarm-Inventur, formal bewertete DSGVO-Aufbewahrungsfristen, vollständige Integrationstests auf SHA, unabhängige AppSec/DPO/Legal/SRE/Release Owner-Prüfung.

**Keine Änderung an `main`, kein Merge/Deployment, keine produktive Foto-/Kontodaten-Löschung oder Cloud-Abfrage. Formeller Status: BLOCKED / NO-GO.**
