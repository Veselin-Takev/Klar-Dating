# P0 #202 – Autoritative Hold- und Purge-Marker-Typen fail-closed validieren

**Datum:** 2026-11-02  
**Verifizierte Ausgangsbasis:** Parent Draft PR #308, Commit `f02845907bc1c5a0fab6da8fec2c533bf87215f8`; vollständige GitHub Actions #41462434022 `success`. Der Parent-PASS ist **kein** Testnachweis für den neuen Commit.  
**Release-Status:** `productionApproved=false`, **BLOCKED / NO-GO**, kein Deployment, kein Merge.

## Source-verified Befund
Im produktiven Quellpfad `src/server/platform/verificationPurgeBoundary.ts` wurde ein Feld `legalHold`, `retentionHold` oder `hold` mit *eigenem Property-Key und Wert `undefined`* durch `record[flag] === undefined` wie ein **fehlendes** Hold-Feld akzeptiert, obwohl die Dokumentation einen strikt booleschen Typ für jedes **vorhandene** Feld verlangt. Zudem wurde `photoPurged` nur mit `=== true` geprüft; vorhandene Strings wie `"false"`, `null`, `0` oder `undefined` konnten den Vorab-Check passieren. Der Route-Adapter konvertiert außerdem `data.photoPurged === true` in boolesche Artifact-Zustände, sodass ungültige vorhandene Werte ohne zweite Validierung als unpurged interpretiert wurden. **Quellbefund, kein nachgewiesener Produktivschaden.**

## Eng abgegrenzter Fix
- Bei autoritativen Hold-Metadaten unterscheiden `Object.hasOwn(record, flag)` und `typeof ... === 'boolean'` **abwesend** von **vorhanden aber ungültig**; letztere sperren den Löschpfad.
- Bei `photoPurged` wird jedes vorhandene, nicht boolesche Feld vor GCS-Löschen abgelehnt; saubere `false`-Werte und tatsächlich abwesende Legacy-Felder bleiben vorläufig kompatibel. **Abwesenheit ist keine rechtswirksame positive Löschfreigabe.**
- Pure Unit-Matrix für vorhandene `undefined`-Holds und ungültige Purge-Marker; HTTP-Batch-Regression mit einem gültigen früheren und einem ungültigen späteren Datensatz: HTTP 503, **null** GCS-Metadata-Reads, **null** Deletes und **null** Receipts. HTTP-Fehler bleiben frei von UID und Storage-Pfad.
- Verbindliche `check:compliance-storage-purge`-Source-Gates für die tatsächlich aufgerufene aktive Preflight-Implementierung.
- Keine Änderung an Firestore/Storage-Regeln, IAM, Scheduler, Cloud-Konfiguration, Daten, `main` oder Produktiv-Löschjobs.

## Evidence, Release und Restrisiken
Eine neue vollständige **exakte-HEAD-CI** mit Typecheck, Security, Compliance, Vitest, nativen Firebase-Emulatoren, Build, Smoke und Browser muss für diesen neuen Commit abgeschlossen sein; Ergebnisse eines Stacked-Parent dürfen nicht geerbt werden. Produktionsfreigabe weiterhin blockiert durch P0 #202: unterschriebenes autoritatives Decision-/Legal-Hold-Schema, echte generation-bound GCS-404/412-/Timeout-/Crash-Quittungen, dauerhafte >300-Job-Abarbeitung und IAM/Scheduler-Nachweis; P0 #254: Tenant-/Art.-17-/BOLA-/Storage-Isolation sowie signierte Medienpolicy. Security, DPO, Legal, SRE und ReleaseOwner müssen unabhängig den **exakten** Release-Commit freigeben.

**NO-GO.** Kein Merge, kein Deployment, keine Produktionseingriffe.
