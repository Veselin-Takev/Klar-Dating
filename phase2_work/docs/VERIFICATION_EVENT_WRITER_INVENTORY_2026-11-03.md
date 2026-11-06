# P0 #202 — Verification-event source inventory gate (2026-11-03)

**Status:** Review candidate on PR #203. **Production BLOCKED / NO-GO.** This is static regression prevention, not an approved or deployed cross-service deletion protocol.

## Scoped inventory on the feature branch

The scanner covers production files in `phase2_work/server.ts`, `phase2_work/src/server/**` and `phase2_work/functions/src/**`. Test and specification files are excluded.

| Literal access | Count | Role and authority boundary |
| --- | ---: | --- |
| `src/server/klarCore.ts` | 1 | Moderation transaction **creates** the decision record (`entscheidung`, `decidedAt`, `storagePath`, `fotoLoeschenAb`) |
| `src/server/datenschutz.ts` | 1 | DSGVO data-subject export **reads** the collection |
| `src/server/trustAndSafety.ts` | 1 | Art. 17 account-deletion flow deletes matching verification-event records after a bounded storage cleanup stage |
| `src/server/routes/complianceStorage.ts` | 3 | Decision-aware purge query plus transactional intent/proof updates |

These are reviewed **literal references** in these server/Functions sources, not a claim that all runtime access is covered. Dynamic collection names, other processes, Firebase Console, external Admin SDK jobs, other project directories and cloud IAM operations are outside the static scanner.

## Enforced fail-closed review gate

- `scripts/check-verification-event-writers.mjs` traverses server/Functions source files and fails if the number of literal references changes or a new source file references `verification_events` without a reviewed policy entry.
- Each approved file retains a representative operation signature to detect accidental removal of its reviewed access mode.
- `scripts/test-verification-event-writers.mjs` includes mutation regressions: new writer, extra reference, removed creation signature and missing authorized source.
- Both run through `check:retention-p0`, which is already a constituent of `check:enterprise`.
- The gate must be rerun on the **exact final commit**. A source-only green result is not a Firestore/Storage emulator test, penetration test or evidence of deployed configuration.

## P0 cross-service risk remains open

`deleteVerificationStorageFile` performs a Firestore authorization recheck **before** a generation-conditional GCS delete. The existing adversarial test demonstrates a decision revocation after that recheck which still permits deletion in the mock. GCS generation CAS does **not** protect against a concurrent change in Firestore decision or legal-hold state for an unchanged object generation.

Before enabling production purges, AppSec, DPO/Legal and SRE must approve a common transactional state machine and distributed fencing/compensation contract for **all** mutation paths, including account deletion. Demonstrate a negative race test which prevents unsafe deletion, as well as crash, stale lease, object hold, 404/412, audit receipt and retention/Art.-17 compatibility cases in emulator and staging.

**No change to `main`, Cloud Scheduler, GCS objects, production credentials or live data is authorized by this documentation. `productionApproved=false`.**

## CI regression and correction

The first integrated GitHub Actions run [41605092106](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41605092106) **failed** on its new baseline assertion: the retired legacy `functions/src/deleteExpiredPhotos.ts` contains a plain-language comment mentioning `verification_events.fotoLoeschenAb` but does not access that collection. Four of five mutation tests passed. This was a static-scanner false positive, not evidence of a live photo deletion.

The scanner now checks **quoted literal collection/path names**, not bare prose references; an additional regression ensures comments in the retired scheduler do not break the gate, while a separate test rejects newly introduced collection-name aliases. This does **not** detect dynamically concatenated names and is not a semantic TypeScript/Firestore data-flow analysis. The updated exact PR commit and new CI must pass independently before the gate can be accepted.

**The P0 cross-service delete race remains unresolved; no GO claim.**

## Fail-closed widersprüchliche Moderationsfelder (03.11.2026)

`src/server/routes/complianceStorage.ts` normalisierte bisher nur `entscheidung ?? status`. Bei gleichzeitig vorhandenen gegensätzlichen Werten (z. B. `entscheidung='bestaetigt'`, `status='in_pruefung'`) konnte deshalb trotz explizitem Pending-Status eine als genehmigt interpretierte Löschung in Betracht kommen.

Die neue Funktion `readConsistentVerificationDecision` normalisiert beide Felder unabhängig und wirft `verification_photo_decision_conflict`, falls die Werte voneinander abweichen. Unbekannte nichtleere Werte werden niemals als Löschfreigabe interpretiert. **Die gleiche Prüfung erfolgt bei der Batch-Auswahl und bei der erneuten Prüfung unmittelbar vor der Storage-Löschung.**

Neue Tests: `tests/complianceStoragePurge.spec.ts` mit positiven und negativen Kombinationen; `tests/verificationPurgeHttpEmulator.spec.ts` prüft auf dem echten lokalen Firestore-Emulator die Antwort 503 sowie das Ausbleiben von Storage-Delete, `photoPurgeIntent` und `photoPurgeProof` bei widersprüchlichen Entscheidungen.

**Grenzen:** Diese Änderung löst weder die bestehende *Post-Authorization*-TOCTOU-Race-Condition über Firestore und GCS noch den Konflikt aller externen Admin-SDK-Schreibpfade. Keine Live-/Staging-Evidenz und keine unabhängigen Security-/DPO-/SRE-Freigaben. Freigabe: **NO-GO**, `productionApproved=false`.

## Post-Intent-Konflikt: Emulator-Negativtest

Der Emulator-Test `fails closed if canonical decision changes after purge intent but before final authorization` simuliert nun eine **nach der dauerhaften Purge-Intent-Speicherung** eintreffende, mit `status='approved'` unvereinbare kanonische Entscheidung `entscheidung='abgelehnt'`. Die zweite Storage-Metadatenabfrage ist dafür ein deterministischer Synchronisationspunkt. Erwartet werden HTTP 503, null physische Löschaufrufe, unverändertes `photoPurged=false`, erhaltenes Intent und **kein** `photoPurgeProof`.

Der Test beweist bei erfolgreichem Firestore-Emulator-Lauf nur die Schutzwirkung **vor** der letzten Autorisierungsprüfung; Änderungen zwischen dieser Prüfung und dem tatsächlichen GCS-Delete bleiben technisch nicht ausgeschlossen. Jede neue Test-SHA benötigt vollständige CI- und Emulator-Evidenz. Production NO-GO.

## Bounded-Scan-Fehlerisolierung bei widersprüchlichen Entscheidungen

Ein einzelner fälliger Verifizierungsdatensatz mit widersprüchlichem `entscheidung`/`status` löste zuvor in `docs.flatMap` die Exception `verification_photo_decision_conflict` aus. Damit brach die **gesamte Seite** ab und sonst gültige, fristgerechte Löschungen wurden unnötig zurückgestellt.

Der Batch-Handler isoliert jetzt **ausschließlich diesen bekannten Konflikttyp** auf Datensatzebene: Der widersprüchliche Datensatz wird niemals an die Storage-Löschfunktion übergeben, wird in `invalid = docs.length - artifacts.length` als Fehler gezählt, und die übrigen gültigen Datensätze durchlaufen unverändert die transaktionalen Schutz- und Löschschritte. Andere, unbekannte Fehler lösen weiterhin den bisherigen Fail-Closed-Abbruch aus. Sind Konfliktzeilen enthalten, antwortet das HTTP-API aufgrund von `failedCount > 0` weiterhin mit **503**. Der dauerhafte Scan-Cursor/wrap-Mechanismus muss den Fehlerdatensatz später erneut zur Prüfung bringen; ein erfolgreicher Gesamtabschluss wird nicht behauptet.

Ein neuer Firestore-Emulator-Negativtest erstellt zwei fällige Einträge: einen widersprüchlichen und einen gültigen. Erwartet: `processed=2`, `purgedCount=1`, `failedCount=1`, **503**; nur das gültige Objekt wird gelöscht, während der Konflikteintrag ohne `photoPurgeIntent` und `photoPurgeProof` bleibt.

**Grenzen:** Keine atomare Absicherung der nachgelagerten Firestore/GCS-Race, kein Nachweis über produktive Daten oder Cloud-Berechtigungen. CI/Emulator gegen die aktuelle exakte SHA sowie unabhängige AppSec-/DPO-/SRE-Freigaben sind weiterhin notwendig. `productionApproved=false`; **NO-GO**.

## Default-Deny-Deployment-Sperre vor Firestore/GCS

Der signierte Admin-Endpunkt `POST /api/admin/purge-verification-storage` bleibt ab diesem Review-Branch vorerst **standardmäßig deaktiviert**. Nach erfolgreicher HMAC-Authentifizierung fordert die Route exakt `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED=true` (klein geschrieben, keine Leerzeichen). Fehlender oder abweichender Wert ergibt **HTTP 503 / verification_storage_purge_disabled**, bevor `getDb()`, die Firestore-Lease oder der GCS-Bucket geöffnet wird. Ein unautorisierter Request bleibt 401. Dies ist ein zusätzlicher Runtime-Interlock gegen eine versehentliche destruktive Aktivierung; der bestehende signierte Scheduler erhält bei deaktivierter Route ein Fehlerergebnis und darf kein erfolgreiches Retention-Result melden.

**Aktivierung ist hiermit NICHT freigegeben.** Die DPO-/AppSec-/SRE-/Release-Owner-Abnahme muss ein vollständiges All-Writer-Fencing-Konzept, die deterministische **Post-Authorization**-Race-Negativprüfung, realen Staging- und Storage-/Scheduler-/IAM-Nachweis sowie den fachlichen Zeitplan für datenschutzkonforme Löschung und die Überwachung des Retention-Backlogs umfassen. Eine reine Änderung der Umgebungsvariable ist weder Schutz gegen die Firestore/GCS-Race noch ein Produktions-GO.

Tests: Unit-Test für exakte Schalterwerte; lokale Firestore-Emulator-Route mit gültiger Signatur und **ohne** Schalter muss 503 ohne DB-/GCS-Zugriff und ohne `photoPurgeIntent`/`photoPurgeProof` ergeben. Der `check:compliance-storage-purge`-Gate bewacht die Präsenz dieser Runtime-Sperre.

**Neue SHA benötigt eine vollständige erfolgreiche CI sowie unabhängige Abnahmen.** Produktionsfreigabe unverändert `productionApproved=false`, **NO-GO**.

## Signierter Request-Body: keine synthetische HMAC-Eingabe

**Quellbefund:** Bisher setzte die Compliance-Route bei fehlendem `Buffer` als HMAC-Prüfgrundlage ersatzweise `Buffer.from('{}')`. Die globale `express.json()`-Middleware war in `server.ts` vor der Purge-Route registriert. Dadurch wurde der signierte Scheduler-Body unter Umständen bereits in ein Objekt verwandelt und bei der HMAC-Prüfung nicht als tatsächlich empfangene Bytefolge verwendet. Ein simpler `Buffer`-Zwang in der Route allein würde gültige Scheduler-Aufrufe blockieren.

**Korrektur:** Der exakt benannte Pfad `/api/admin/purge-verification-storage` bekommt in `server.ts` vor dem globalen JSON-Parser einen begrenzten `express.raw({ inflate:false, type:'application/json', limit:'2kb' })`-Parser. Die Route lehnt fehlende/non-raw Request-Bytes mit **415** ab und berechnet den HMAC ausschließlich auf dem tatsächlich empfangenen Buffer; anschließend gelten unverändert Signaturprüfung (401), Default-Deny-Deployment-Sperre (503), Rate Limiter, Lease und Retention-Regeln. Ein neuer Emulator-HTTP-Test sendet `text/plain` mit von der tatsächlichen Payload abweichender Signatur und verlangt 415 sowie keinerlei Intent-/Storage-/Audit-Mutation.

`scripts/check-compliance-storage-purge.mjs` prüft jetzt die relative Registrierungsreihenfolge des pfadspezifischen Raw-Parsers, globalen JSON-Parsers und Compliance-Routers sowie das Fehlen des synthetischen HMAC-Body-Fallbacks.

**Wichtig:** Dies ist eine Quellcode-/Testkorrektur auf dem Draft-Branch, keine unabhängig abgenommene Cloud-Konfiguration. Die Race nach der letzten Firestore-Prüfung, All-Writer-Fencing, produktive Retention-Evidenz, Backlog-Überwachung und unabhängige AppSec-/DPO-/SRE-Freigaben bleiben ausstehend. Kein Deployment/GO.

## Parser-Inventar: CI-Regression und gezielte Reparatur (03.11.2026)

Die letzte für #203 getestete SHA `885153dfc5bfba7d8a5ecfd41a8935c1195ab667` hatte [Actions Run 41614325781](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41614325781) **completed/failure**. Im Schritt **Tests** bestanden 1.431/1.432 Vitest-Tests; `tests/requestBodyPolicy.spec.ts:68` meldete `expected 15 to be 14`, weil die neu bewusst auf den Compliance-Pfad beschränkte `express.raw`-Middleware den bisherigen Parser-Baseline-Zähler von 14 auf 15 erhöht hat. Dies ist ein *Test-Inventar-Drift*, kein Nachweis eines erfolgreichen vollständigen CI-Laufs.

Der Test wurde auf dem bestehenden Draft-Feature-Branch aktualisiert: Er erwartet nun 15 aktive Parserstellen mit `inflate: false` und prüft darüber hinaus, dass **exakt ein** scoped Raw-Parser für `/api/admin/purge-verification-storage` registriert ist und seine Position **nach** `rejectEncodedRequestBodies`, **vor** dem globalen `express.json`-Parser und **vor** dem Purge-Router liegt. Damit wird kein bloßer Zahlenwert erhöht, sondern der Zweck der Parser-Sicherheitsgrenze ausdrücklich regressionsgesichert.

Reparatur-Code-Commit: `1acf3d77e69fccc69ced15a2f370ce08cf4c57fc`; [exakte CI 41616689790](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41616689790) war bei Dokumentationserstellung **in_progress**. Dokumentations-Folgecommits benötigen erneut CI-Readback. Der Firestore/GCS-Post-Authorization-TOCTOU-Befund sowie unabhängige Security/DPO/SRE-Freigaben bleiben davon unberührt. **NO-GO**; kein Deployment/Merge.


## VES-5 Review-Fortsetzung: Alle Cloud-Aufrufe zusätzlich ohne Test-Bucket-Injektion blockiert (05.11.2026)

Die `server.ts`-Registrierung der Compliance-Route übergibt lediglich `getDb`, **keinen** `getBucket`-Override. Die neue Sicherheitsschranke `typeof deps.getBucket === 'function'` ist zusätzlich zur unverändert deaktivierten P0-Live-Freigabekonstante, der aktivierungsabhängigen Feature-Flag-Prüfung und dem isolierten `demo-klar`-Emulator-Kontext erforderlich. Dies verhindert, dass lediglich per Umgebungsvariablen vorgetäuschte Emulator-Konfigurationen den Produktionspfad mit einem echten SDK-Bucket erreichen. Neue HTTP-Emulatortests und statischer Entrypoint-Guard sind Bestandteil der separaten Draft-PR-Änderung. Die tatsächliche Cross-Service-TOCTOU-Race bleibt offen; eine unabhängige Bestätigung sämtlicher Admin-SDK-Writer in der Cloud steht aus. Keine Produktionsfreigabe.


## VES-5 – Admin SDK Storage-Writer-Drift-Inventar (06.11.2026, Review)

Der bisherige Check `scripts/check-verification-event-writers.mjs` inventarisiert statisch die Firestore-Collection-`verification_events`, nicht aber die **physischen GCS-Löschpfade**. Ein neuer unabhängiger source-only Guard `scripts/check-verification-storage-writers.mjs` erfasst deshalb bekannte direkte `verification/`-Storage-Prefixe und `file.delete`-Aufrufe in `server.ts`, `src/server/**` und `functions/src/**` (ohne Tests):

| Pfad | Funktion | Statischer Grenzwert |
| --- | --- | --- |
| `src/server/klarCore.ts` | Erzeugt/prüft den alten Nutzerfoto-Pfad | 2 `verification/`-Pfadliterale, 0 File-Deletes |
| `src/server/routes/complianceStorage.ts` | Signierter, source-locked Review-Purge mit Generation-CAS | 1 Pfadliterale, 1 `file.delete` mit `ifGenerationMatch` und P0-Konstante weiterhin `false` |
| `functions/src/retention.ts` | Art.-17-Löschung über Storage-Bucket | 1 Pfadliterale, 1 `file.delete` mit `ifGenerationMatch`, Hold-Checks |
| `src/server/trustAndSafety.ts` | Art.-17-Orchestrator, ruft die Storage-Löschung auf | gesonderte Quelle-/Aufrufsignatur verlangt |

Fehlende, neu eingeführte oder verdoppelte direkte Storage-Writer lösen ein **CI-FAIL** aus. Negative Mutationstests prüfen neue Writer-Dateien, geänderte GCS-Generation-CAS, freigeschaltete P0-Konstante, entfernte Hold-Checks und gebrochene Art.-17-Anbindung. Die neue Test- und Inventarprüfung ist in `check:retention-p0` und somit im Enterprise Static Gate verankert.

**Beweisgrenze:** Dies ist eine lexikalische Source-Drift-Erkennung, keine AST-/Data-Flow-Analyse. Dynamisch zusammengesetzte Pfade, benannte indirekte Lösch-Helper, externe Worker, Firebase Console, deployed Storage Rules, Admin-SDK-IAM und sonstige Buckets können davon unentdeckt bleiben. Ein erfolgreicher Test beweist **nicht**, dass die Firestore/GCS-Post-Authorization-TOCTOU-Lücke verhindert wird. Das nötige transaktional koordinierte All-Writer-Fencing und der deterministische *nach der letzten Firestore-Freigabe* einsetzende Widerrufstest bleiben VES-5-P0-Freigabegates. Kein Merge, keine Live-Löschung, `productionApproved=false` / NO-GO bis AppSec/DPO/SRE/Release-Owner die Cloud-/IAM-/Emulator-/Staging-Nachweise abnehmen.


## VES-5 Review-Grenzen und CI-Readback (06.11.2026)

Der aktuelle Review-Head von Draft PR #329 ist `631c180a208a64686572a26511708c8d5e21e630`. Der GitHub-Actions-Lauf [42165699118](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42165699118) meldete für diesen Commit `completed/success`, einschließlich Job `validate: completed/success`. GitHub meldete **0 eingereichte Reviews**. Dies ist eine Momentaufnahme der **vorausgehenden SHA**; ein nachfolgender Dokumentationscommit benötigt eigenen CI-Readback.

**Konkret nachgeprüfte lexikalische Bypass-Grenzen:** Der Guard in `scripts/check-verification-storage-writers.mjs` zählt wörtliche `verification/`-Präfixe und `file.delete(`/`photo.delete(`. Indirekte Aufrufe über Alias-Variablen, separate Helper und dynamisch zusammengesetzte Storage-Pfade können dadurch unentdeckt bleiben. Die vorhandenen zehn Source-Mutationstests prüfen deklarierte Muster, nicht alle erreichbaren Cloud-/Admin-SDK-Writer. Vor einem späteren Fencing-Review sind zusätzliche negative Alias-/Helper-/Dynamic-Path-Tests und eine unabhängige semantische Callgraph-/Cloud-IAM-Inventur erforderlich; **diese zusätzlichen Tests wurden in diesem Dokumentationsschritt nicht implementiert oder ausgeführt**.

Die Post-Authorization-Race zwischen Firestore-Entscheidungsänderung und GCS-`ifGenerationMatch`-Delete ist unverändert **offen**. Kein Cloud-/Staging-/TTL-/DPO-/SRE-Nachweis und keine unabhängige Abnahme wird durch diesen Dokumentationsnachtrag ersetzt. Der produktive Purge bleibt deaktiviert; `productionApproved=false`, **BLOCKED / NO-GO**. Kein Merge oder Deployment.

## 06.11.2026 – Reviewed transactional fencing source and moderation initialization

The writer inventory now also includes `src/server/platform/verificationPurgeFirestoreFence.ts`, which reads/updates `verification_events/{id}` in transactions and validates that paths begin with the event owner's `verification/{uid}/` prefix. It makes **no GCS calls**. `src/server/klarCore.ts` writes an initial per-event `photoPurgeFence` into the existing moderation transaction, and a static signature ensures this cannot disappear unnoticed. The source-only checks in `check-verification-event-writers.mjs` and `check-verification-storage-writers.mjs` were updated with the new reviewed path. The legacy purge still rejects any fenced event; no partially migrated event can be marked purged by that route.

The adapter is not yet linked to Art.17, all moderation revisions, legal hold GCS operations, or cloud scheduler deletion. The real writer/IAM inventory and post-last-check race prevention remain **P0 open**. A syntactically complete source map is not an operational Cloud identity or Storage hold attestation.
