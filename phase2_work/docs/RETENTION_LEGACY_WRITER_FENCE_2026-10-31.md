# P0 #202 — Legacy-Verifizierungs-Writer-Fence (Quellstand)
**Stand:** 31.10.2026 · **Branch:** `fix/202-retired-legacy-writer-fence-20261031` · **Parent:** Draft [#234](https://github.com/Veselin-Takev/Klar-Dating/pull/234) (gestapelt auf #233/#229/#203)
**Entscheidung:** BLOCKED / NO-GO; keine Main-/Produktionsänderung.

## Anlass / tatsächlich verifizierter Stand

Der frühere manuelle Biometrieprozess in `src/server/klarCore.ts` besitzt weiterhin alte Upload-/Moderationsfunktionen, darunter `handleVerificationSubmit` mit GCS `save()` auf `verification/{uid}/...`. Die aktuelle HTTP-Komposition in `server.ts` referenziert diesen Legacy-Handler **nicht**. Stattdessen bindet sie den `verificationRouter` ein. Dieser beantwortet die fünf alten Endpunkte `/verify`, `/status`, `/challenge`, `/submit` und `/decide` für alle HTTP-Methoden mit `410 verification_retired`.

In der gestapelten Kandidatenbasis sind die `storage.rules` aus der strengeren Client-Boundary enthalten: `match /verification/{uid}/{datei}` verweigert `read`, `create/update` und `delete` vollständig. Die KYC-Identitätsautorität ist die separate Didit-V3-Webhookschnittstelle. Diese **Quelltextfeststellungen sind keine Aussage über deployed Cloud Storage Rules, IAM oder aktive Cloud Functions**.

## Nachprüfbare Korrektur

- `scripts/check-legacy-verification-writer-fence.mjs` ist ein zusätzlicher, rein lesender **Source-Gate**. Er prüft den exakten Legacy-Routensatz, die `router.all`-Methodensperre, den festen 410-Response, die tatsächliche Router-Einbindung in `server.ts`, die Nichtverwendung der alten mutierenden Handler in der HTTP-Komposition und die ausdrückliche Client-Zugriffssperre in `storage.rules`.
- `scripts/test-legacy-verification-writer-fence.mjs` verifiziert den Istzustand und führt **acht Mutationstests** aus: entfernte Legacy-Route, nur noch POST statt aller Methoden, 200 statt 410, fehlendes Mount, reaktivierter Legacy-Handler und freigeschaltete Storage-Client-`read/create/update/delete`-Rechte. Die Tests arbeiten nur mit lokal gelesenen Quelltexten.
- `tests/legacyVerificationRetiredHttp.spec.ts` prüft das tatsächliche Express-`verificationRouter`-Verhalten über einen lokalen ephemeral Port: fünf ehemalige Endpunkte × fünf Methoden = **25 HTTP-410-Fälle**. Kein Firebase SDK, keine Kundenidentität, kein GCS-DELETE.
- Das vorhandene CI-Pflichtskript `check:compliance-storage-purge` ruft jetzt zusätzlich den Source-Gate und die Mutationstests auf. Der Rest der Enterprise-Gates und der Retention-Scanner bleiben unverändert.

## 31.10.2026 — CI-Regressionstest-Wiederherstellung

Der erste [PR-#235-CI-Lauf #41183013253](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41183013253) endete mit **FAIL** in `Enterprise static gates`, nicht in der Produktionslogik. Der neue Source-Gate meldete bereits `Legacy verification writer/client boundary: PASS (source only)`; beim separaten Mutationstest `reactivate legacy manual upload handler` meldete Node `Missing expected exception`. Ursache: Das Test-Fixture hängte die **wörtlichen** Zeichen `\\n` vor `handleVerificationSubmit` an `server.ts` an. Dadurch stand unmittelbar vor dem Handler-Identifier ein `n` (Wortzeichen), und die `\\b`-Identifierprüfung konnte nicht treffen. Die Mutation wurde auf einen **tatsächlichen Zeilenumbruch** umgestellt.

**Änderungsumfang:** ausschließlich die synthetische Testmutation. Kein Legacy-Endpunkt wurde aktiviert und keine Client-Storage-Regel oder Produktivfunktion aufgeweicht. Ein erneuter vollständiger PASS ist für den **exakten neuen HEAD-Commit** erforderlich; der ursprüngliche fehlgeschlagene CI-Lauf bleibt als negative Evidenz bestehen. Unabhängiges Review und reale Cloud-Freigabegates sind weiterhin offen.

## Release-/Security-Grenzen

1. **Admin SDK umgeht Firebase Storage Rules.** Der neue Source-Gate belegt keine Absicherung von Cloud-IAM, produktiv konfigurierten Storage-Sperren, bereits ausgegebenen Service-Account-Rechten oder alten deployten Funktionsversionen. Ein aktiver privilegierter Writer könnte `verification/` weiterhin überschreiben, wenn keine separate Writer-Allowlist und generationgebundene Claim-/Fence-Transaktion greift.
2. Eine archivierte `klarCore.ts`-Funktion ist weiterhin im Repository vorhanden; die Tests beweisen nur, dass `server.ts` sie nicht erneut montiert. Eine Sicherheitsfreigabe darf die aktive, **deployed** Route, Cloud Scheduler/Functions und alle direkten Admin-Storage-Schreibpfade erst nach echter Inventur als stillgelegt betrachten.
3. Das Setzen von `photoUploadGeneration` aus einem zum Löschzeitpunkt beobachteten GCS-Objekt ist **kein** Nachweis des ursprünglichen Uploads. Für Altobjekte ohne Provenienz bleibt die DPO-/Legal-genehmigte datensparsame Reconciliation unter Beachtung der 30-Tage-Frist notwendig.
4. Strikte Firestore-/Storage-Rules-Emulatortests und Staging-Race-Tests sind eigenständige Freigabegates. Ein statisches Gate und 25 lokale HTTP-Tests ersetzen diese nicht.
5. Die exakte CI-SHA dieses neuen Draft-PR ist separat zu prüfen; PASS-Ergebnisse der gestapelten Eltern-PRs sind nicht übertragbar.

**Sicherheitsprinzip:** Legacy-Client- und HTTP-Writer-Fence erhalten, keine automatische Bereinigung ohne ursprünglichen vertrauenswürdigen Upload-/Entscheidungs-Beleg, unabhängig überprüfte Produktionsfreigabe erst nach AppSec-/DPO-/SRE-/Release-Owner-Abnahmen. Kein Merge, Deployment oder produktiver Datenzugriff.
