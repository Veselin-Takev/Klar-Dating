# P0 #202 – GCS Object Retention und Hold-Metadaten vor Löschung prüfen

**Datum:** 2026-11-02  
**Status:** Draft / BLOCKED / NO-GO; kein Deployment und keine produktive GCS-Aktion.  
**Basis:** PR #306, `3dc3c5ab8243ada7bd9e32bfb58e032118d99d9d` (CI #41424416076: SUCCESS, nur für Basis-SHA).

## Quellbefund

Der aktive Schutz `src/server/platform/verificationPurgeBoundary.ts` validierte `retentionExpirationTime`, nicht jedoch die separate GCS-Objektaufbewahrung `retention.retainUntilTime`. Zudem wurden `temporaryHold`, `eventBasedHold` und `hold` nur bei strikt `true` abgewiesen. Mehrdeutige vorhandene Felder (z. B. String `"false"` oder `null`) erreichten damit den nachgelagerten konditionalen GCS-Delete. Dies ist ein quellbasierter potenzieller Schutzmangel, kein Nachweis einer erfolgten Löschung. Der GCS-Dienst kann zusätzlich eigene Aufbewahrungsvorschriften erzwingen; darauf wird für die anwendungsseitige Freigaberegel nicht vertraut.

## Isolierte Korrektur

- Vor der Rückgabe der GCS-Generation alle **vorhandenen** Hold-Felder strikt auf boolesche Werte prüfen; abweichende Typen fail-closed abweisen.
- Wenn `retention` vorhanden ist, Struktur und `retainUntilTime` prüfen. Ungültige, fehlende oder zukünftige Ablaufzeit verhindert Freigabe; bereits abgelaufene Retention ist nicht allein eine rechtliche Löschfreigabe.
- Existing `retentionExpirationTime`, Generation-uint64, Eigentümer-/Entscheidungs-/Firestore-Preflight und GCS-`ifGenerationMatch` unverändert beibehalten.
- Vitest-Regressionsfälle für aktive, fehlende, malformed Retention und mehrdeutige Hold-Typen; verpflichtende statische Compliance-Prüfung erweitert.
- Keine Scheduler-, IAM-, Rules-, Deployment- oder Produktivdatenänderung.

## Verifikations- und Release-Grenzen

Der Fix braucht eine **neue vollständig grüne CI auf dem exakten neuen Commit** einschließlich aller Enterprise-Gates und native Firebase Emulator Tests. Bis zur Bestätigung gilt der Zustand als **nicht verifiziert**. Ein erfolgreicher Parent-Lauf gilt nicht für die neue SHA. CI beweist keine reale GCS-404/412-/Timeout-/Crash-Reconciliation, keine dauerhafte >300-Job-Abarbeitung, keine wirksame Storage-/Scheduler-IAM-Konfiguration und keine Freigabe autoritativer Legal-Hold-/Retention-Schemata. P0 #254 fordert gesondert Live-Tenant-/Art.-17-/Storage-BOLA-Nachweise. Security/DPO/Legal/SRE/ReleaseOwner müssen unabhängig den exakten Release-Stand freigeben.

**Unverändert verbindlich:** `productionApproved=false`; Production BLOCKED / NO-GO. Draft nicht ungeprüft mergen.
