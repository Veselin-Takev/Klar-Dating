# P0 #202 – Explizit ungültige GCS-Retention-Expiry vor dem Delete verweigern

**Datum:** 2026-11-02. **Status:** Draft / BLOCKED / NO-GO, productionApproved=false.

## Auditbefund
Im aktiven `verifiedDeletionGeneration`-Pfad ignorierte der bisherige Check `metadata?.retentionExpirationTime != null` ausdrücklich vorhandene `null`- oder `undefined`-Felder. Bei unvollständiger, irreführender GCS-Metadatenantwort konnte die anwendungsseitige Expiry-Prüfung deshalb nicht zwischen *fehlend* und *vorhanden aber ungültig* unterscheiden. Dies ist ein Source-/Testbefund, **kein** produktiver Incident-Nachweis.

## Eng abgegrenzte Korrektur
- `Object.hasOwn(metadata, 'retentionExpirationTime')` unterscheidet vorhandene von nicht vorhandenen Feldern. Vorhandene Werte müssen weiterhin durch `epochMillis` gültig und abgelaufen sein. `null` und `undefined` werden abgewiesen.
- Negative Vitest-Fälle für ausdrücklich vorhandene `null` und `undefined`, zusätzlich zu bestehendem GCS-Objekt-Retention-/Hold-/uint64-Schutz.
- Verpflichtender Compliance-Static-Gate prüft den aktiven Validator.
- Kein Eingriff in Cloud-IAM, Scheduler, Firestore/Storage Rules, produktive Daten oder `main`.

## Freigabegrenzen
Parent-PR #307 basiert auf `2e07dec376bbe7177862b8c0a4a3d56757fc0e89`; sein CI-Lauf #41459752045 war bei dieser Bearbeitung noch **in progress**. Das ist kein PASS für den Parent oder diesen neuen Branch. Volle neue CI samt Emulatoren, Tests, Builds, Browser und vor allem unabhängige Security-/DPO-/Legal-/SRE-/ReleaseOwner-Abnahme bleiben erforderlich.

P0 #202 und P0 #254 sind offen: autoritative Rechts-/Hold-Entscheidungen, generation-gebundene echte GCS-404/412-/Crash-Reconciliation, durable >300-Abarbeitung, Scheduler/IAM, Tenant-/Art17-/BOLA-Live-Evidenz. **Kein Merge, Deployment oder produktiver Löschvorgang.**
