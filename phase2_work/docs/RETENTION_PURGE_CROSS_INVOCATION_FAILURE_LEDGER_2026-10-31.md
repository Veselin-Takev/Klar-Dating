# P0 #202 — Firestore-Retention-Scanner: Fehler über mehrere Aufrufe erhalten

**Stand:** 31.10.2026 · **Status:** DRAFT / BLOCKED / NO-GO
**Stack:** neuer Branch `fix/202-retention-scan-cross-run-fail-closed-20261031` auf [PR #239](https://github.com/Veselin-Takev/Klar-Dating/pull/239), weiter gestapelt auf #234, #233, #229, #203.

## Verifizierter Source-Befund

Der signierte HTTP-Endpunkt `POST /api/admin/purge-verification-storage` verarbeitet mit `scanPurgePages` höchstens 25 Einträge je Seite und 4 Seiten je Aufruf. Ein Firestore-Dokument `system/verification_photo_purge_scan_v1` bewahrt den Cursor und eine exklusive Lease auf. Der Scan-Ergebniswert `failed` wurde bislang jedoch nur **für den aktuellen HTTP-Aufruf** gezählt. Entstand auf einer früheren Seite eine nicht bereinigte Störung (z.B. Hold, fehlende Originalgeneration oder 412-Konflikt), ging sie nach dem erneuten Aufruf verloren. Der Cursor lief trotzdem weiter. Erreichte ein späterer Aufruf schließlich eine fehlerfreie letzte Seite, konnte dieser **HTTP 200 / ok:true** melden, obwohl in den vorherigen Scan-Seiten weiterhin nicht verifizierte Löschungen warteten. Das ist eine P0-relevante fehlerhafte Audit-Gesamtmeldung, **kein Beweis**, dass unberechtigt gelöscht wurde.

## Lösung

- **Dauerhaftes, datensparsames Fehlerbit:** `cycleHadFailures` wird im Firestore-Checkpoint *innerhalb derselben geleasten Transaktion wie der Cursor* mitgeschrieben. Das Flag ist die kumulierte Information aller bisher abgeschlossenen Seiten dieses Scan-Zyklus, nicht nur des aktuellen Aufrufs. Unbekannte/inkonsistente Flagwerte brechen **fail-closed mit 503** ab.
- **Vorsichtige Migration:** Ein älterer Checkpoint mit gültigem, nicht-null Cursor, aber fehlendem `cycleHadFailures`, gilt nicht als nachweisbar sauber und wird daher als `priorSweepFailures:true` fortgeführt. Ein neuer Scan ab Cursor `null` ohne Alt-Flag wird regulär gestartet.
- **Verbindliche HTTP-Gesamtsicht:** `result.failed > 0 || result.hasMore || ownership.priorSweepFailures` führt zum Status 503. Die bestehende `failedCount`-Zahl bleibt ausdrücklich die Zahl *aktueller* Fehlfälle. Das zusätzliche, rein aggregierte boolesche Response-Feld `unresolvedEarlierPages` erklärt nachvollziehbar, weshalb ein Aufruf mit `failedCount:0` trotzdem **nicht erfolgreich** ist; keine Nutzeridentitäten, Dateinamen oder Fehltexte.
- **Löschung unverändert:** Die HMAC-Authentisierung, explizite finale Entscheidung, originalgebundene GCS-Generation, Storage-Holds, generationbedingtes `ifGenerationMatch`, Firestore-Intent/Proof, Auditlease und Verifizierungsbelege bleiben unangetastet. Nie eine automatische erneute Löschung zur „Reparatur“ der Gesamtmeldung.
- **Zyklusende:** Der Scanner kann das persistierte Fehlerbit bei Rückkehr zum Anfang löschen, muss aber im **aktuellen HTTP-Response** frühere Fehler noch als 503 ausweisen. Erst ein **neuer vollständiger sauberer Sweep** ohne Fehler darf HTTP 200 liefern.

## Regressionen / Nachweis

`tests/verificationPurgeHttpEmulator.spec.ts` ergänzt Tests auf echten lokalen Firestore-Emulator-Transaktionen und signierter lokaler HTTP-Route, ausschließlich mit synthetischen Datensätzen und simuliertem GCS:

1. Wiederaufnahme hinter einem zuvor fehlgeschlagenen Event, mit `cycleHadFailures:true`: spätere saubere letzte Seite löscht zulässiges zweites Objekt, gibt dennoch **503** mit `failedCount:0` und `unresolvedEarlierPages:true` zurück.
2. Gleiches Szenario mit **Legacy-Checkpoint ohne Fehlerfeld**: ebenfalls kein falsch positives 200.
3. Nach diesem Zyklus bleibt ein noch nicht bereinigter Datensatz im nächsten Scan **503**; nur nach synthetischer Behebung der Ursache wird ein sauberer Sweep **200**.
4. Manipuliertes nichtboolesches Fehlerflag (`'false'`) wird als ungültiges Checkpoint-Dokument zurückgewiesen, nicht als saubere Scan-Historie gelesen.

Das vorhandene Enterprise-Gate `scripts/check-compliance-storage-purge.mjs` verlangt das Persistieren der übergreifenden Fehler, die konservative Migration, den Response-Status und das Aggregatfeld. Der exakte HEAD benötigt vollständige CI auf GitHub; ein PASS der Eltern-PRs ist **nicht** auf diesen Fix übertragbar.

## Rest- und Betriebsrisiken

- Dies ist eine konsistente **Scan-Zyklus**-Fehlerhistorie, keine globale Aussage, dass die Firestore-Query ein unveränderliches Snapshot aller jemals fälligen Ereignisse ist. Neue oder rückdatierte Datensätze vor dem Cursor können zwischen Aufrufen eingefügt werden. Ein 200 darf daher in einer Betriebsfreigabe nur als **vollständiger sauberer aktueller Scan-Zyklus** interpretiert werden, nie als universeller DSGVO-Nachweis. Für die produktive Abschluss-Attestierung sind zusätzliche query-/inventurgebundene Reconciliation-Prüfungen erforderlich.
- Firestore-Lease und Cursor garantieren **keine** Cross-Service-Transaktion mit GCS. Alle privilegierten Writer müssen generation-/lockgebunden abgesichert sein. Die ursprüngliche Foto-Upload-Generation muss aus einer vertrauenswürdigen Intake-Transaktion stammen; keine Übernahme der aktuellen GCS-Metadaten als Herkunftsbeleg.
- Alte Datensätze ohne belegte Provenienz bleiben zugunsten der Sicherheit ungeändert, benötigen aber dringend einen DPO-/Legal-genehmigten, fristgerechten Lösch- und Auditprozess (DSGVO und Aufbewahrungsfreigaben).
- Ein lokaler Firestore-Emulator und gemockter GCS belegen **keine** produktiven Scheduler-, IAM-/Service-Account-, Storage-Rules-, Hold- oder NTP-Einstellungen. SRE/AppSec/DPO/Release-Owner-Abnahmen und reale Staging-Race-/Crash-Tests fehlen.
- **Keine Main-Änderung, kein Merge, Deployment oder Zugriff auf produktive Foto-/Kontodaten. Gesamtstatus: BLOCKED / NO-GO.**
