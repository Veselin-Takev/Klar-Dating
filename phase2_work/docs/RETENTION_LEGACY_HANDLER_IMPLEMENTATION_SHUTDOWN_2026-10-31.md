# P0 #202 – stillgelegte manuelle Biometrie-Handler auch intern inaktiv

**Datum:** 31.10.2026 · **Status:** DRAFT / BLOCKED / NO-GO · **Stack-Basis:** [PR #235](https://github.com/Veselin-Takev/Klar-Dating/pull/235) → #234 → #233 → #229 → #203

## Ausgangsbefund

Auf dem geprüften vorherigen Commit `03180776003eac4ef2d3268cfd217228eccf508e` hat [Enterprise-CI #41183124372](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41183124372) vollständig **PASS** ergeben. Die aktive Server-Komposition nutzt nur den `verificationRouter` mit festen HTTP-410-Handlern, und die gestapelten `storage.rules` sperren alle **Client**-Zugriffe auf biometrische Altpfade. **Trotzdem** enthielt `src/server/klarCore.ts` weiterhin die exportierten, alten Implementierungen `handleVerificationChallenge`, `handleVerificationSubmit`, `handleVerificationDecide` und `handleVerificationStatus` mit Firestore-Änderungen und einem GCS-`save()`-Aufruf. Ein versehentlicher direkter Aufruf oder eine andere spätere Router-Einbindung hätte diese hinterlegte Schreiblogik wieder ausführen können.

## Umgesetzte Korrektur im isolierten Feature-Branch

- **Implementierungsgrenze:** Alle vier Legacy-Exports verbleiben für Code-Kompatibilität, antworten aber ausnahmslos mit dem gemeinsamen `retiredManualVerification(res)`, HTTP **410** und festem `verification_retired`-Code. Sie lesen weder Nutzer- noch Firestore-/Storage-Daten und besitzen keinen biometrischen Write-Pfad mehr.
- **Angriffsfläche reduziert:** Entfernt wurden der frühere `getAppBucket().file(...).save(...)`-Upload, die von diesem Legacy-Modul geschriebene `verification_requests`-Queue, der Moderator-Entscheidungs-Write in `verification_events` und die Legacy-Verifizierungsstatus-Änderungen an `users`/`public_profiles`. Nicht-verifizierungsbezogene Kontakt-/Abonnement-Funktionen bleiben erhalten; der Didit-V3-Webhook-Workflow ist unberührt.
- **Pflichtgate:** `scripts/check-legacy-verification-writer-fence.mjs`, bereits Teil von `check:compliance-storage-purge` bzw. `check:enterprise`, verifiziert jetzt zusätzlich alle vier direkten Handler-Stubs und dass dieses Modul keinen `getAppBucket`-/`verification_requests`-/`verification_events`-Write-Pfad mehr besitzt.
- **Negativtests:** Vier zusätzliche Mutationsfälle erkennen die direkte Wiedereinführung eines GCS-Upload-Writers, eines Firestore-Verification-Events-Writers, eines nicht-retired Submit-Handlers sowie die Änderung von 410 auf 200 im internen Legacy-Handler.
- **Verhaltensprüfung:** `tests/legacyCoreRetired.spec.ts` ruft alle vier Compatibility-Handler ohne authentifizierten Nutzer auf und erwartet den festen 410-Response. Die bestehenden 25 lokalen HTTP-Routen-Checks im Parent-Branch testen ergänzend das externe Router-Verhalten.

## Evidenzgrenzen / Freigabesicherung

- Der [vorherige #235 CI-PASS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41183124372) **gilt nur für den alten Commit**. Für den jetzt geänderten Feature-Branch ist die eigene vollständige CI einschließlich Typecheck, Unit-/Emulator-Tests, Build und Browser-Acceptance nachzuweisen; nicht ausgeführte Schritte bleiben offen.
- Quellcode-/Unit-Sicherheit belegt **keine** tatsächliche Deaktivierung einer alten produktiven Cloud-Function oder laufender Container mit einem früheren Deployment. Für diese muss der Release Owner eine schreibgeschützte, attestierte Inventur von Deployments, Service-Accounts und Berechtigungen bereitstellen.
- Firebase Storage Rules schützen **nicht** gegen Admin SDK/IAM-Writes. Eine organisationsweite Writer-Allowlist, unveränderlicher Blob-Identitätsnachweis, Firestore/GCS-Fencing und echte Staging-Race-Tests fehlen weiterhin.
- Die Löschung historischer Verifizierungsbilder ohne originalen Generation-Provenienzbeleg ist weiterhin **nicht automatisch zulässig**, aber datenschutzrechtlich fristgerecht zu lösen. Ein DPO-/Legal-/SRE-genehmigter Legacy-Erasure-Prozess muss gesondert auditiert werden; die Quellbereinigung ist keine DSGVO-Art.-17-Freigabe.
- Unabhängige AppSec-, Datenschutz-, Operations/SRE- und Release-Owner-Signoffs fehlen.

**Nichts gemergt/deployed; keine produktiven Konto-/Foto-/IAM-Daten ausgelesen oder verändert. Produktionsstatus: BLOCKED / NO-GO.**
