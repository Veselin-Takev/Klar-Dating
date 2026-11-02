# P0 #202 — Active GCS deletion boundary: canonical uint64 generation fence

**Datum:** 2026-11-02 | **Umfang:** Quellcode-Sicherheitsfix auf isoliertem Draft-Branch; kein Produktiv-Deploy | **Freigabe:** BLOCKED / NO-GO.

## Verifizierter Quellbefund

Der tatsächlich in `src/server/routes/complianceStorage.ts` **vor** dem konditionalen GCS-Delete aufgerufene `verifiedDeletionGeneration`-Validator in `src/server/platform/verificationPurgeBoundary.ts` verwendete bisher `/^[1-9][0-9]*$/`. Damit galten beliebig lange positive Dezimalzeichenketten, insbesondere `18446744073709551616` (maximales uint64 + 1) und 4096-stellige Werte, als syntaktisch valide GCS-Generation. Der **inerte** Prototyp der Purge-Work-State-Machine hatte bereits eine separate unsigned-64-bit-Schranke; der aktive Quellpfad noch nicht. Das ist ein **Source-Defekt in der Eingabevalidierung**, kein nachgewiesener GCS-Delete, Exploit oder aktueller Cloud-Deployment-Zustand.

## Minimale, fail-closed-Korrektur

- Die neue rein funktionale `isCanonicalDeletionGeneration(value: unknown)` verlangt einen positiven **kanonischen unsigned-64-bit-Dezimalstring** im geschlossenen Bereich `1…18446744073709551615`: maximal 20 Ziffern, keine führenden Nullen, Vorzeichen, Notation oder Leerzeichen. Prüfung und Vergleiche erfolgen auf begrenzten Strings, ohne `BigInt`-/`Number`-Umwandlung und ohne Präzisionsverlust bei großen GCS-Versionen.
- `verifiedDeletionGeneration` wendet diese Schranke nach der bereits vorhandenen, nur für **sichere** JavaScript-Integer zulässigen numerischen Metadaten-Konvertierung an. Die GCS-Generation bleibt als **exakter String** erhalten und wird unverändert in `file.delete({ ifGenerationMatch: generation })` übergeben.
- Bestehende rechtliche Entscheidungs-/Legal-Hold-Fences, GCS temporary/event-based Holds, `retentionExpirationTime`, der Eigentümer-Check, HMAC-gebundene Scheduler-Anfrage sowie Fehler-/Audit-Behandlung werden **nicht** abgeschwächt.
- Reine Grenzwert-/Negativtests verlangen gültige Werte `1`, `9007199254740993`, `18446744073709551614`, `18446744073709551615`, und verweigern u.a. `0`, `01`, `18446744073709551616`, 20 Neunen, 21+/4096 Zeichen, Notation, negative Zahlen, BigInts und unsichere JS-Zahlen. Der bestehende verpflichtende `check:compliance-storage-purge`-Gate verlangt nun die uint64-Grenze im aktiven Löschschutz.
- **Keine** produktive Cloud-/Firestore-/GCS-/IAM-/Scheduler-/Rules-Änderung, kein Delete und kein direkter Commit auf `main`.

## Verifikation und offene Freigabegates

Der Eltern-Draft [#305](https://github.com/Veselin-Takev/Klar-Dating/pull/305) auf `eb40e5eaebaeb02e4a5c42f175d8f8c46fe71666` hat [CI #41422714192](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41422714192) vollständig **bestanden**. Dieser PASS ist SHA-spezifisch und darf **nicht** als Nachweis des neuen Drafts dienen. Obligatorisch ist erneut die vollständige exact-HEAD Enterprise-CI (Compliance-/Mutation-/Typecheck-Gates, 5 native Storage + 6 Tenant Firestore + 17 Retention Firestore, fehlender-Emulator-Negativfall, Vitest, Build, Smoke, 26 Browser).

Vor einem tatsächlichen GO fehlen weiterhin: DPO/Legal/Security-abgenommene **autoritative** Decision-/Legal-Hold-Schemata (fehlende Hold-Felder sind keine Freigabe), generation-bound 404/412-/Timeout-/Crash-Reconciliation und auditierbare Quittungen, echte dauerhafte Löschqueue >300 autorisierte Aufträge mit Live-Scheduler-/IAM-/SRE-Evidenz sowie P0 #254 Tenant-/Art.-17-/Admin-SDK-/Rules-Isolation und Product/DPO/Legal signierte Profilmedien-Policy. Unabhängig attestiertes Security/DPO/Legal/SRE/ReleaseOwner GO fehlt.

**`productionApproved=false`; Production BLOCKED / NO-GO.**
