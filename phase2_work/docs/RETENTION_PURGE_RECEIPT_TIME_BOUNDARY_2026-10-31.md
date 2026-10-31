# P0 #202 — Lösch-Auditbelege an realen Beobachtungszeitpunkt binden

**Stand:** 31.10.2026 · **Status:** DRAFT / BLOCKED / NO-GO · **Basis:** [Draft-PR #234](https://github.com/Veselin-Takev/Klar-Dating/pull/234), Commit `22b32491e19a26b8c6d22cc3c99ba2deb1ddf3ad`, zuvor vollständiger CI-PASS in [#41182209920](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41182209920).

## Konkreter Befund

Die bisherige Funktion `hasVerifiedPhotoPurgeReceipt(data, artifact)` prüfte bereits Status, UID/Entscheidung, ursprüngliche GCS-Generation, Lösch-Intent und SHA-256-Digests. Sie prüfte jedoch **nicht**, ob `photoPurgedAt` oder `photoPurgeProof.verifiedAt` in der **Zukunft** liegen. Ein formal konsistentes, aber auf einen späteren Zeitpunkt datiertes Lösch-Audit konnte deshalb als bereits abgeschlossene Löschung gezählt werden. Ein Audit-Digest ist eine Konsistenzprüfung und **keine Signatur** des vertrauenswürdigen Schreibers. Dieser Befund ist ein nachgewiesener Codepfad, **kein Beweis eines realen Datenschutzvorfalls**.

## Änderung

- `hasVerifiedPhotoPurgeReceipt` akzeptiert einen expliziten `observedAt`-Parameter (Standard `Date.now()`), dessen Wert ein positiver, sicherer Millisekunden-Integer sein muss.
- Beide gespeicherten Zeitpunkte müssen gültige sichere Integer sein, chronologisch `decidedAt <= photoPurgedAt <= verifiedAt <= observedAt`. Ein Beleg aus der Zukunft bleibt **fehlgeschlagen/quarantänisiert**, wird nicht als erfolgreich übersprungen und führt **nicht** zu einem erneuten Storage-DELETE.
- Der Scanner übergibt bei jeder früheren Löschmeldung seinen vorhandenen, konsistenten `now`-Zeitpunkt an die Receipt-Prüfung. Die zuvor implementierten generation-/intentgebundenen GCS-Schranken bleiben vollständig erhalten.
- Positive/negative Vitest-Tests prüfen gültige zeitliche Grenzen, einen **inhaltlich und hinsichtlich SHA-256-Digest konsistenten** zukünftigen Löschbeleg, eine Zukunftsbestätigung bei korrektem Löschdatum, gebrochene/fractional Zeitstempel und ungültige Systemzeit.
- `check:compliance-storage-purge` verlangt die Observation-Clock-Prüfungen sowie das korrekte `now`-Binding an der Scan-Schnittstelle. Ein exakter neuer CI-PASS ist vor Anerkennung des Patches nötig.

## Risiken, Betriebsgrenzen, Abnahmen

1. Diese Kontrolle prüft interne Zeitlogik, **nicht** die Echtheit, Unveränderlichkeit oder fortdauernde GCS-Abwesenheit. Eine vertrauenswürdige Original-Upload-Generation, allseitiges GCS/Firestore-Writer-Fencing, Cloud-IAM und aktive Deployment-/Storage-Regeln sind **nicht** nachgewiesen.
2. Bei Uhrzeitabweichungen zwischen produktiven Hosts wird ein künftig datierter Beleg zunächst als Fehler zählen. Dies ist **fail-closed**; SRE benötigt attestiertes NTP-/Zeitsynchronisationsmonitoring und einen auditierten Reconciliation-Weg, nicht einen großzügigen stillschweigenden Clock-Skew-Bypass.
3. Historische `verification_events` ohne Originalgeneration/Beweis dürfen nicht nachträglich durch aktuelle Storage-Metadaten als „nachgewiesen“ erklärt werden. DPO/Legal müssen eine datensparsame, fristgerechte Legacy-Löschung samt Hold-/Audit-Protokoll genehmigen.
4. Belege ohne unabhängige Admin-SDK-/Cloud-Inventur, echte 404-/412-/Hold- und Crash-Tests sowie AppSec-, Datenschutz-, SRE- und Release-Owner-Abnahmen erlauben **keinen** Production GO.

**Kein Merge, kein Deployment, kein Zugriff auf produktive Kunden- oder GCS-Daten.** Die offizielle Freigabesperre bleibt **BLOCKED / NO-GO**.
