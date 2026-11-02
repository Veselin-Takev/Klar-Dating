# P0 #202 — Stale Terminal Markers in Pre-Deletion Retention Work

**Stand:** 2026-11-02 | **Status:** Draft; keine Produktionsfreigabe | **Branch:** `security/p0-202-predelete-terminal-marker-fence-20261102`

## Gesicherter Quellbefund

Der absichtlich **inerte** Retention-Zustandsautomat `verificationPurgeWorkState.ts` prüfte bei `assertValidState` zuvor nur Schema, Schlüssel, Zähler und Zeitpunkt, aber nicht die Beziehung zwischen Zustand und verbliebenen irreversiblen Lösch-/Quittungsmarkern. Eine synthetisch beschädigte Firestore-Zeile im Zustand `ready` mit einem historischen `receiptDigest` oder `completedAt`, aber ohne `intent` oder `observed`, konnte über `claimPurgeWork` zu einem frischen Lease gelangen. Der Firestore-Adapter prüft zwar Generation-/Beobachtungsidentitäten, aber nicht jede mögliche Altmarkerkombination. Das ist eine nachgewiesene *Validierungslücke in einem nicht angeschlossenen Prototyp*, kein Beleg für tatsächliche Löschungen oder korrupte Kundendaten.

## Implementierung (fail-closed)

- Vor jeder reinen Zustandstransition wird ein Datensatz mit `status: ready` oder `status: leased` abgewiesen, falls **irgendeiner** dieser Marker existiert: `intent`, `observed`, `completedAt`, `receiptDigest` oder `quarantineReason`. Fehler: `purge_work_invalid_state`.
- Bereits freigegebene, aber nie gelöschte Datensätze in `ready` dürfen den bisherigen `lease`-Epoch-Marker behalten. Dadurch bleiben ordnungsgemäße idempotente Retries möglich; nur widersprüchliche irreversible oder Quarantäne-Belege sperren die Wiederaufnahme.
- Die bestehende Firestore-Transaktion ruft die reine validierte Transition vor `tx.update` auf. Ungültige Zeilen bleiben unverändert. **Kein** neuer GCS-/Storage-Aufruf, kein freigeschalteter Löschworker, kein Cloud-Scheduler/IAM-/Rules-Change.
- Neue reine Vitest-Tests injizieren alle fünf Marker in `ready` und `leased`; ein gültiger Undeleted-Release mit erhaltenem Lease-Epoch muss weiter funktionieren.
- Neue native `demo-klar`-Firestore-Tests prüfen fünf beschädigte `ready`-Zeilen sowie einen `leased`-Datensatz mit altem Quittungs-Digest und verifizieren nach abgewiesener Aktion **unveränderte Dokumente und Zähler**.
- Der verpflichtende statische `check:purge-work-inert`-Gate erkennt, wenn die Status-/Marker-Schranke entfernt wird. Vier Negativmutationen prüfen das Auslassen des Status-Schutzes sowie einzelner Markergruppen.

## Verifikation und Restrisiken

Der Basiscommit von [Draft #299](https://github.com/Veselin-Takev/Klar-Dating/pull/299) `453e40cf0037e9bd0a5484fa56e24d98a47918ce` bestand [CI #41360832251](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41360832251) vollständig: 1.499 Vitest-Tests, 10 native Retention-Firestore-Fälle und 26 Browser-Tests. **Dieser bestandene SHA ist nicht der neue Sicherheitsfix.** Erneuter, vollständiger CI-PASS ist für den finalen SHA dieses Drafts erforderlich. Erwartet: bisherige P0-Emulator-/Negative-Gates, Didit, P95, Typecheck, Functions Build, Vitest, Production Smoke und 26 Browser-Tests.

**Die produktiven P0-Blockaden bleiben vollständig offen.** P0 #202 benötigt ein freigegebenes Decision/Legal-Hold-Modell, generation-gebundene echte GCS-Löschbelege (404/412/Crash/Timeout), eine langlebige >300-Job-Queue, unabhängig attestierte IAM/Scheduler-Konfiguration und DPO/AppSec/SRE-Genehmigungen. P0 #254 benötigt echte Tenant-/Admin-SDK-/Firestore-/Storage-BOLA-Isolation, Art.-17-Migration, signierte Gast-/Alters-/Medien-Policy sowie Security-/DPO-/Legal-/SRE-/ReleaseOwner-Release-Unterschriften.

**`productionApproved=false` – Production BLOCKED / NO-GO.** Keine Commits auf `main`, kein Merge, Deployment, Cloud- oder Kundendatenzugriff.
