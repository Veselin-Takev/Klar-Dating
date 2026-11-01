# P0 #202 — Kanonische GCS-Generation und Write-ahead-Intent-Fencing

**Datum:** 2026-11-01 · **Scope:** Offline-Source-Hardening, ausdrücklich KEINE aktive Löschpipeline.  
**Ausgangsbasis:** [Draft #297](https://github.com/Veselin-Takev/Klar-Dating/pull/297), SHA `7b059d0b28b38ca0e0d12bfc93d070ae63bb07f7`.  
**Freigabestatus:** `productionApproved=false`, **BLOCKED / NO-GO**.

## Reproduzierbarer Source-Befund

Die bislang in `verificationPurgeWorkState.ts` und `verificationPurgeWorkFirestore.ts` mehrfach verwendete Validierung `/^[1-9][0-9]*$/` akzeptierte positive, aber **unbegrenzt lange** Dezimalzahlen als GCS-Objektgeneration. Auch `18446744073709551616`, eine Zahl außerhalb der 64-Bit-Grenze, und tausende Dezimalzeichen konnten in Pre-Delete-Command-/Intent-Pfade gelangen. Das ist eine nachweisbare ungebundene Eingabevalidierung **im inerten, noch nicht produktiv angeschlossenen Prototyp**, keine tatsächliche Cloud-Löschung und kein Produktions-Exploit-Nachweis.

## Implementierte Schutzschicht

- Der rein funktionale `isCanonicalGcsGeneration(value: unknown): value is string` akzeptiert nur kanonische positive Dezimalzeichenketten im Bereich **1 bis 18.446.744.073.709.551.615** (unsigned 64 bit). Führende Nullen, wissenschaftliche Notation, numerische JavaScript-Typen, Unicode, Negativwerte, NULL, 21+ Zeichen und Überläufe sind unzulässig.
- Keine Konversion zu JavaScript-`number`: Generationsnummern oberhalb `Number.MAX_SAFE_INTEGER` bleiben als **verlustfreie Strings** erhalten. Die 20-stellige obere Grenze wird deterministisch und ohne potenziell speicher- oder rechenintensive BigInt-Umwandlung geprüft.
- Derselbe Helfer wird sowohl in der reinen `markDeletionIntent`-Transition, bei `assessDeletionIntentRecovery` (persistierter Intent und beobachtete Generation), beim Firestore-Command-Snapshot **vor der Transaktion** als auch bei der CAS-Transition verwendet.
- Keine zusätzliche Berechtigung, keine Freigabe für `delete_intent`-Reclaims, keine Wiederholung eines physischen Deletes nach Crash/Timeout und keine Aktivierung eines Jobs, Cloud-Schedulers oder GCS-Zugriffs.

## Sicherheits-/Negativtests

- Pure Vitest: positive Grenze `1` und maximale 64-Bit-Generation; negative Werte `0`, führende Nullen, Überlauf +1, zwanzig Neunen, 21+ Zeichen, 4.096-stellige Generationswerte, Nicht-Strings und Notation; Recovery für ungültigen gespeicherten Intent **fail-closed** und für ungültige GCS-Beobachtung ausschließlich `manual_reconcile`, `physicalDeleteAuthorized:false`.
- Native `demo-klar`-Firestore-Emulator-Suite: vier neue Fälle weisen Überlauf, ungültige 20 Stellen, führende Nullen und stark überlange Generationen **vor einem Datenbank-Intent-Write** zurück; der ursprüngliche Job bleibt `ready`, `revision:0`, `attempt:0`.
- Der verpflichtende `check:purge-work-inert`-Quellcheck verlangt nun die kanonische Validierung in State, Firestore-Command und CAS. Mutations-Negativtests schlagen bei Entfernung/Umgehung dieser Schranken fehl. Die gesamte P0/ReleaseOwner/Emulator/Didit-Sicherheitskette bleibt unverändert eingebunden.
- Ein **vollständiger PASS auf der neuen exakten HEAD-SHA** ist erforderlich. Grüne Eltern-PR-CIs sind kein Beleg dieser Änderung.

## Bleibende P0-Sperren (keine Produktionsfreigabe)

Das Queue-Modell bleibt absichtlich **inert**. Es fehlen ein rechtlich autorisierter GCS-Arbeiter, frische Entscheidung-/Legal-Hold-Prüfung, unveränderliche Generation-bound GCS-Löschquittungen (HTTP 404/412/Timeout/Crash), Wiederanlauf, tatsächlicher dauerhafter Durchsatz über **mehr als 300** fällige Aufträge, Scheduler-/IAM-/Cloud-Provenienz und signierte DPO/AppSec/SRE-Abnahme. P0 #254 erfordert unabhängig reale Firestore/Storage/Admin-SDK-Tenant-Isolation, Art.-17-Migration, Cloud-IAM und eine von Product/DPO/Legal signierte Gast-/Alter-/Medien-Policy. Formale Freigaben aller Rollen einschließlich Release Owner sind ausstehend.

**Kein Merge nach `main`, kein Deploy, kein produktiver Datenzugriff oder GCS-Delete. Production BLOCKED / NO-GO.**
