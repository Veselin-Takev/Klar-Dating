# P0 #202 — Native Firebase-Emulator-Evidenz für 350 Datensätze (nur lesende Retention-Inventur)

**Datum:** 2026-11-02 · **Branch:** `test/p0-202-native-census-over300-readonly-20261102`  
**Basis:** [Draft #301](https://github.com/Veselin-Takev/Klar-Dating/pull/301), SHA `4df133e2c0cf03e01dd2d726979adeee8f4615ed`, [CI #41415425785](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41415425785) **SUCCESS**.

## Nachweisbedarf und korrekte Interpretation

Die bestehende reine `censusVerificationRetentionBacklog`-Test-Suite verarbeitet synthetische 1.101 Records über gemockte Seitenleser. Das bestätigt die reine Zählfunktion, nicht jedoch das tatsächliche Firestore-Snapshot-/Cursor-Verhalten über die aus P0 #202 bekannte Grenze von 300 Zeilen. **Es beweist auch keinerlei tatsächlich ausgeführte oder autorisierte GCS-Löschung.**

Ein zusätzlicher nativer Test im bereits verpflichtenden, bei fehlendem Firestore-Emulator **fail-closed** ausführenden `verificationPurgeWorkFirestore.emulator.spec.ts` nutzt die echte Firestore Admin SDK, jedoch ausschließlich `demo-klar` und den Loopback-Emulator.

## Prüfszenario mit synthetischen Testdaten

- In einer isolierten, zufällig benannten Emulator-Collection werden **350 synthetische Einträge** per Batch als Fixture erstellt. Es sind keine echten Verifizierungsprofile, Bilder, Cloud-Buckets oder Kundendaten betroffen.
- 310 Datensätze sind nach dem Marker fällig, 40 liegen in der Zukunft und haben die Entscheidung `pending`. Genau 10 Datensätze tragen ein `legalHold`, und ein Objektpfad erscheint zweimal auf zwei verschiedenen Zeilen.
- Der echte `orderBy(FieldPath.documentId())`-Firestore-Cursor wird über `startAfter(snapshot)`, `limit(100)` an die unveränderte `censusVerificationRetentionBacklog`-Funktion angeschlossen.
- Bei `maxPages=3` müssen exakt 300 gescannte Zeilen als **`complete:false, truncated:true`** gemeldet werden, nie als vollständig.
- Bei `maxPages=4` müssen 350 Datensätze als **`complete:true`** gelten und die aggregierten Zähler (310 fällig, 40 künftig/ungeprüft, 10 Holds, 1 doppelter Pfad) stimmen.
- Der ausgegebene Bericht darf weder UID noch Storage-Pfad, IDs oder Cursor enthalten. Nach dem Read-only-Census müssen **alle 350 Datensätze weiterhin vorhanden** sein. Die Fixture wird im Test-`finally` ausschließlich im Emulator aufgeräumt.
- Das bereits verpflichtende `check:p0-native-emulator-ci` verlangt nun ausdrücklich das 350-Zeilen-Test-Szenario sowie dessen Vollständigkeits- und Nicht-Mutations-Prüfung. Zwei Mutationstests verhindern ein stilles Entfernen des Szenarios oder seiner Zählerbedingung.

## Verpflichtende Validierung

**Nur ein vollständiger CI-SUCCESS auf dem neu erstellten, exakten Draft-HEAD zählt als Testnachweis.** Neben dem neuen Test müssen alle bestehenden Gates (P0 Source/Mutation, Typecheck, 5 native Storage, 6 Tenant-Firestore, die bisherigen 16 Retention-Firestore-Fälle, echter Negativtest ohne Emulator, 1.507+ Vitest, Builds, Smoke und 26 Browser) erneut bestanden werden. Erfolg eines Eltern-Commits wird nicht übernommen.

## Bleibende Freigabesperre

Ein 350-Zeilen-**Inventurtest** ist **keine** belastbare 350-Aufträge-Löschqueue, kein Lasttest, kein realer GCS-Delete und kein rechtswirksamer Audit-Receipt. P0 #202 verlangt weiterhin ein freigegebenes Decision-/Legal-Hold-Modell, generation-fenced GCS-404/412-/Crash-/Timeout-Reconciliation, dauerhafte Queue/Retry/Backpressure für **mehr als 300 tatsächlich fällige Aufträge**, Scheduler-/IAM-Freigaben und SRE/AppSec/DPO-Abnahmen. P0 #254 benötigt reale Mandantentrennung, Art.-17-Migration, unterschriebene Medien-Policy sowie die unabhängigen Security-/Legal-/Release-Owner-Freigaben.

**`productionApproved=false`. Production BLOCKED / NO-GO.** Kein Merge nach `main`, kein Deployment und keine Aktion auf produktiven Cloud- oder Kundendaten.
