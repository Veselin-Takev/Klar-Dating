# P0 #202 — Widersprüchliche Moderationsfelder dürfen keine biometrische Löschung autorisieren

**Datum:** 31.10.2026 · **Freigabe:** BLOCKED / NO-GO · **Stack-Basis:** [Draft PR #241](https://github.com/Veselin-Takev/Klar-Dating/pull/241), SHA `c375db0789fbb8de2192531f6f1de28664eb2bad`, vollständige [CI #41187509107 PASS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41187509107).

## Verifizierter Codebefund

Im Entscheidungspfad der signierten Verification-Photo-Purge-API wurden historisch zwei Felder toleriert: `entscheidung` mit deutschen Endzuständen `bestaetigt/abgelehnt` und `status` mit englischen `approved/rejected/pending`. Die bisherige Leselogik `data.entscheidung ?? data.status` **bevorzugte ein Feld vollständig**. Enthielt ein Firestore-Event beispielsweise `entscheidung:'bestaetigt'` und gleichzeitig `status:'pending'` oder `status:'rejected'`, wurde die erste Eigenschaft als *final approved* behandelt. Ebenso hätte `entscheidung:'abgelehnt'` ein widersprüchliches `status:'approved'` übergehen können.

Die finale Firestore-Prüfung prüfte nur dieselbe bevorzugte Entscheidung erneut; solange die widersprüchlichen Felder persistierten, konnte deshalb der eigentlich inkonsistente Datensatz eine generation-gebundene GCS-Löschung autorisieren. Eine frühere Receipt-Prüfung betrachtete außerdem einen `photoPurged:true`-Beleg ohne expliziten Widerspruchsabgleich. **Das ist eine nachgewiesene source-level Autoritätskollision, keine Behauptung eines echten Datenschutzvorfalls.**

## Eng abgegrenzte Korrektur

- Neue pure, exportierte `reconciledVerificationDecision(data)` normalisiert die deutschen und englischen Endzustände. Ist nur ein Feld vorhanden (oder das andere `null`), bleibt die bisherige Legacy-Kompatibilität erhalten. Stimmen zwei **vorhandene** Felder semantisch überein (z.B. `bestaetigt/approved`), wird der finale Status weiterhin anerkannt.
- Sobald zwei vorhandene Felder semantisch **nicht übereinstimmen** (approved/rejected, approved/pending, final/unknown), gibt die Funktion nur `pending` zurück. Ein nicht bestätigter oder widersprüchlicher Moderationsstatus darf keinerlei physische Foto-Löschung auslösen.
- Die identische Funktion gilt beim initialen Firestore-Scan, bei `assertStillEligibleForPurge` (Initialprüfung, DELETE-Preflight, 404-Abgleich, Audit-Finalisierung) sowie bei `hasVerifiedPhotoPurgeReceipt`. Bereits als gelöscht markierte Belege mit widersprüchlichem Status werden nicht stillschweigend als abgeschlossen gezählt, sondern aggregiert als Fehler gemeldet.
- Die vorhandenen HMAC-, Lease-, Hold-, Originalgeneration-, GCS-`ifGenerationMatch`-, Firestore-Intent-/Proof- und datensparsamen HTTP-Schranken bleiben unverändert.

## Tests / CI-Evidenz

- `tests/complianceStoragePurge.spec.ts`: Positivtests für konsistente deutsche/englische Aliasse sowie allein vorhandene Felder; Negativtests für Widersprüche im ursprünglichen Löschstatus, während mehrfacher Eligibility-Rechecks und in ansonsten gültigen generation-/digest-gebundenen Abschlussbelegen.
- `tests/verificationPurgeHttpEmulator.spec.ts`: signierter lokaler HTTP-Pfad + Firestore-Emulator und gemockter GCS. Drei widersprüchliche Kombinationen müssen mit 503 und `failedCount:1` scheitern, **ohne** Storage-Metadatenabfrage, GCS-DELETE, Intent oder Lösch-Auditbeleg.
- `scripts/check-compliance-storage-purge.mjs`: bereits Teil von `check:enterprise`; erzwingt die neue Entscheidungs-Reconciliation für Scanner, Eligibility und vorhandene Löschbelege.

Vor einer technischen Abnahme ist ein **vollständiger CI-PASS auf dem exakten neuen Head-Commit** erforderlich; der PASS des gestapelten Eltern-PRs wird ausdrücklich nicht übertragen.

## Weitere P0-Blocker

Originale Upload-Generation und die autoritative Identitätsentscheidung müssen von vertrauenswürdigen Prozessen stammen. Alle privilegierten IAM/Admin-SDK-/GCS-Schreiber und realen Cloud-Deployments/Scheduler sind erst nach unabhängigem Inventar und Staging-Race-Tests ausreichend abgesichert. Historische Fotos ohne belegbare Provenienz dürfen nicht aus aktuellen GCS-Metadaten als „ursprünglich verifiziert“ rekonstruiert werden; hierfür fehlen DPO-/Legal-/SRE-genehmigte, fristgerechte Reconciliation-/Erasure-Prozesse. Unabhängige AppSec-, Datenschutz/Legal-, Operations/SRE- und Release-Owner-Freigaben stehen aus.

**Kein Merge oder Deployment, kein Zugriff auf produktive Kundendaten, keine direkte `main`-Änderung. Formale Produktionsfreigabe: BLOCKED / NO-GO.**
