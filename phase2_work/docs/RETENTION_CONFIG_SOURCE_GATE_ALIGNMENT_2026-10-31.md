# P0 #202 – Retention-Quellprüfung an tatsächlichen Foto-Löschpfad angepasst

**Stand:** 31.10.2026 · **Status:** DRAFT / BLOCKED / NO-GO · **Parent:** [Draft PR #240](https://github.com/Veselin-Takev/Klar-Dating/pull/240), voll CI-verifiziert mit [#41186538071](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41186538071).

## Befund

In `scripts/check-retention-config.mjs` verblieb ein älteres Kontrollmodell mit zwei überholten Annahmen:

- Ein Firestore-TTL-Provisionierungsskript wurde über die nicht mehr vorhandene Shell-Schleife `for collection_group in ...` ausgewertet. Aktuell nutzt `scripts/configure-retention.sh` ein explizites `groups=(...)`-Array aus **20** freigegebenen Collection-Groups und eine schreibgeschützte Standardausführung, mit gesonderten Staging-, Projekt-, Datenschutz- und Inventurfreigaben.
- Der Prüfcode verlangte `verification_events` und `fotoLoeschenAb` weiterhin im **Legacy-Cron** `functions/src/deleteExpiredPhotos.ts`. Seit P0 #202 führt dieser Cron aus Kompatibilitäts-/Migrationsgründen nur noch die `funnel_events`-TTL-Bereinigung aus; die biometrischen Fotos dürfen **nicht** mehr nach `timeCreated` gelöscht werden. Die einzig vorgesehene Entscheidungs-/Fristautorität ist die separate signierte `purgeVerificationStorageCron` → `/api/admin/purge-verification-storage` → `verification_events.fotoLoeschenAb` → `storageRetentionEngine.ts`.

Das Alt-Skript war nicht mehr an die Enterprise-Pflichtkette angeschlossen und hätte als eigenständiger Check bei einem korrekt stillgelegten Foto-Löschpfad falsche Fehler geliefert. Das ist eine **Governance-/Testabdeckungslücke**, nicht der Nachweis einer tatsächlich fehlgesteuerten produktiven Löschung.

## Begrenzte Korrektur

1. `scripts/check-retention-config.mjs` liest nur Repository-Quelltext und prüft das aktuelle Shell-Matrixformat (20 eindeutige, dokumentierte Gruppen), das staging-/approvalgebundene, standardmäßig nicht-schreibende Provisionierungsskript sowie 90-Tage-Nachrichten-, Archivierungs- und 30-Tage-KYC-Event-Expires-Writers.
2. Der Legacy-Cron muss exportiert bleiben, darf aber nur `funnel_events` bereinigen und darf keinerlei GCS-Bucket, Storage-Scan oder upload-alter-basiertes Delete wieder einführen.
3. Der **separate** signierte KYC-Foto-Löschpfad muss in `functions/src/index.ts` registriert bleiben und über HMAC, `fotoLoeschenAb`, `scanPurgePages`, GCS `ifGenerationMatch`, ausdrückliche finale Moderationsentscheidung und `decidedAt`-basierte Ablaufzeit verfügen.
4. Der korrigierte Source-Gate ist nun zusammen mit `scripts/test-retention-config.mjs` im bestehenden `check:retention-p0`-Skript (und damit in `check:enterprise`) obligatorisch. Die neuen **12 Mutationstests** simulieren u.a. Rückfall auf Legacy-GCS-DELETE, Wegfall des HMAC/Schedulers, falsche Ablaufquelle, Verzicht auf Status-/Generationsschutz und Retention-/TTL-Genehmigung.

## 31.10.2026 – erster CI-Lauf und korrigierte Mutationstests

Die erste exakte [CI #41187346684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41187346684) auf `fa5d963654ce686c81403323fc6b53761950599b` endete in **Enterprise static gates mit FAILURE**: Das eigentliche neue Retention-Konfigurationsgate meldete **PASS**, aber zwei Mutationstests wiesen eine `Missing expected exception` auf. Typecheck, Functions-Build, Tests, Build und Browser-Acceptance wurden folgerichtig nicht ausgeführt.

- **Generation-DELETE-Mutation:** Der Negativtest ersetzte nur das *erste* Vorkommen von `ifGenerationMatch` (in einer Typdeklaration). Das echte `await file.delete({ ifGenerationMatch: generation })` blieb unverändert. Jetzt ersetzt der Test gezielt den tatsächlichen DELETE-Aufruf. Zusätzlich verlangt das Gate ausdrücklich genau die generationbedingte DELETE-Operation, statt eine unverbindliche Erwähnung von `ifGenerationMatch` irgendwo in der Datei.
- **KYC-TTL-Mutation:** Die Didit-Quelle besitzt zwei getrennte 30-Tage-`expiresAt`-Schreibstellen: `kyc_events` und `kyc_reconciliation_events`. Der vorherige Gate-Check genügte schon, wenn eine der beiden den Zeitwert enthielt. Jetzt verankert die Kontrolle die TTL an die konkrete `tx.create(eventRef, ...)`-Operation für Didit-Ereignisse. Die Negativmutation entfernt genau diesen TTL-Nachweis und muss daher sicher fehlschlagen.

Das sind **Verbesserungen der Erkennungsstärke des Pflichtgates**; an produktiven TTL-/Storage-/KYC-Laufzeitpfaden wurde nichts geändert. Das ursprüngliche rote Ergebnis bleibt Teil der Audit-Historie. Ein vollständiger neuer CI-PASS auf dem **letzten** Commit ist weiterhin nötig; AppSec, DPO/Legal, SRE und Release Owner haben noch nicht freigegeben.

## Explizite Evidenzgrenzen

- Das neue Gate überprüft Quelltextkonsistenz, **keine aktiven Cloud-Funktionen, IAM/Service-Accounts, Scheduler-Trigger, Storage Rules, GCS-Holds oder realen TTL-Policy-ACTIVE-Status**. Die vorhandene umfangreiche 20-Gruppen-Matrixprüfung bleibt eigenständig aktiv; die neue Prüfung ergänzt die Writer-/Scheduler-Zuordnung.
- Firestore TTL und biometrische GCS-Löschung dürfen nicht gleichgesetzt werden. Nach Ablauf der maßgeblichen Aufbewahrungsfrist bedarf es nachvollziehbarer, von DPO/Legal freigegebener Lösch-/Hold-/Auditprozesse. Für Legacy-Bestände fehlen weiterhin vertrauenswürdige Originalgenerationen und der genehmigte Reconciliation-Pfad.
- Cross-Service-Löschrennen, privileged Writer-Fencing, reale Staging-GCS-404/412-/Hold-Szenarien sowie unabhängige AppSec/DPO/Legal/SRE/Release-Owner-Signoffs bleiben P0-Blocker.
- Der eigene exakte GitHub-Commit benötigt einen **vollständigen** CI-PASS einschließlich Enterprise-Static, TypeScript, Functions, Emulator-/Unit-Tests, Build und Browser-Acceptance. Ein PASS des Parents gilt nicht automatisch.

**Keine Änderung an `main`, kein Merge, Deployment, produktiver Firebase-/GCS-Zugriff oder Löschoperation. Formelle Produktionsfreigabe weiterhin: BLOCKED / NO-GO.**
