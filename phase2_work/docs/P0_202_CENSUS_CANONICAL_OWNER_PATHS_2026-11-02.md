# P0 #202 — Kanonische Owner-/Storage-Pfade in der lesenden Retention-Inventur

**Datum:** 2026-11-02 · **Status:** isolierter Draft, neue exakte CI ausstehend · **Production:** BLOCKED/NO-GO

## Reproduzierbarer Quellbefund

Die reine Inventurfunktion `censusVerificationRetentionBacklog` zählte einen Datensatz bisher nur dann als `invalidOwnerOrPath`, wenn `uid` leer oder der Pfad ohne das Präfix `verification/{uid}/` war. Eine formal präfixgleiche Zeichenfolge wie `verification/uid/../other.jpg`, `verification/uid//photo.jpg`, `verification/uid/./photo.jpg` oder ein Owner mit Slash wurde als valide gezählt. Das ist eine **source-belegte Fehlklassifikation im read-only Bericht**, kein Nachweis von GCS-Pfadtraversal, produktiver Löschung oder einer realen Exposition; GCS-Objektnamen sind nicht automatisch Dateisystempfade.

## Abgegrenzte, fail-closed-Korrektur

- Neue rein funktionale `isCanonicalVerificationOwnerPath(uid, path)`-Prüfung in `src/server/platform/verificationBacklogCensus.ts`. Sie akzeptiert gültige untergeordnete Objektnamen einschließlich verschachtelter Pfade und prüft die exakte `verification/{uid}/`-Bindung. Sie verwirft leere Owner, Owner mit Slash/Backslash/Steuerzeichen oder Punkt-Sonderwerten und Objektnamen mit leeren, `.`-/`..`-Segmenten, Backslash oder Steuerzeichen.
- Die Prüfung **klassifiziert nur** die lokale Inventurstatistik. Sie erteilt keinerlei GCS-, Storage-, Firebase-, Admin-SDK- oder Löschrechte, verarbeitet keine echten Kundendaten und beeinflusst den produktiven Löschpfad ausdrücklich nicht.
- Der reine Vitest-Test prüft zehn ungültige Beispiele und zwei legitime Pfade (inklusive verschachteltem Pfad und Provider-UID), zählt zehn Anomalien ohne IDs/Pfade im Ergebnis.
- Der seit [Draft #302](https://github.com/Veselin-Takev/Klar-Dating/pull/302) verpflichtende **reale** 350-Datensatz-Firestore-Emulator-Test enthält jetzt vier unterschiedliche nichtkanonische Objektnamen. Die bestehende Statistik bleibt bei **310 nach Marker fälligen, 40 ausstehenden, 10 legal gehaltenen und einem duplizierten Objektpfad**; zusätzlich werden exakt **vier** ungültige Owner-/Storage-Pfade erfasst. Nach der Inventur müssen alle 350 synthetischen Datensätze weiterhin existieren.
- Der `check:p0-native-emulator-ci`-Source-Guard verlangt diese native Anomalieprüfung; ein zusätzlicher negativer Mutationstest verhindert das stille Ersetzen durch `invalidOwnerOrPath:0`.

## Rest-Risiken und verpflichtende Freigabe

Der produktive `src/server/routes/complianceStorage.ts`-Pfad besitzt derzeit ebenfalls eine Präfixprüfung und muss vor einem echten Lösch-Cutover separat im Security-/DPO-Review behandelt werden. **Diese Änderung ändert ihn bewusst nicht**, weil damit ein aktuiver produktiver Löschpfad betroffen wäre und seine Daten-/Migrationssemantik zunächst unabhängig freigegeben werden muss. Ein grüner Inventurtest ist keine genehmigte neue Löschberechtigung.

Der neue exakte Commit muss die vollständige CI auf seinem eigenen HEAD bestehen: Pure-Vitest, Native 5 Storage / 6 Tenant Firestore / 17 Retention Firestore, No-Emulator-Negativfall, Source-/Mutation-Guard, ReleaseOwner und sechs P0-Evidenzfelder, Didit-/P95-Tests, Typecheck, Build, Smoke, 26 Browser. Eltern-CI darf nicht übernommen werden.

**Offen:** P0 #202 tatsächliche GCS-Löschung mit Moderationsentscheidung, Legal Hold, Generation-Fencing, 404/412-/Crash-Quittungen und dauerhaft nachgewiesener >300 Löschqueue, IAM-/Scheduler-Abnahme; P0 #254 reale Tenant-/Art.-17-/Admin-SDK-/Rules-Migration und signierte Product-/DPO-/Legal-Medienpolicy, Security-/SRE-/ReleaseOwner-Signaturen. `productionApproved=false`; **Production BLOCKED/NO-GO**. Kein Merge, Deployment oder Zugriff auf produktive Daten.
