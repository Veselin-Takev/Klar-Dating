# P0 #202 — Cloud-Scheduler darf HTTP 200 nicht mit vollständiger Löschung verwechseln

**Datum:** 31.10.2026 · **Status:** DRAFT / BLOCKED / NO-GO · **Stack-Basis:** [Draft #242](https://github.com/Veselin-Takev/Klar-Dating/pull/242), HEAD `5270c74137cebf94daf042887ce3731e0715abd9`, vollständige [CI #41189671443 PASS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41189671443).

## Source-verifizierter Befund

Die signierte Firebase-Funktion `functions/src/purgeVerificationStorage.ts` löste die tägliche Foto-Löschung über `POST /api/admin/purge-verification-storage` aus. Bisher war die **einzige** Erfolgskontrolle `if (!response.ok) throw ...`. Damit konnte auch eine HTTP-200-Antwort ohne JSON, mit Proxymeldung oder mit logisch widersprüchlicher Löschzusammenfassung als „durchgeführt“ gelten. Der API-Endpunkt besitzt zwar eigene Cursor-/Fehlerkontrollen (einschließlich `cycleHadFailures`), doch ein Netzwerk-/Proxy-/Integrationsfehler darf sie nicht durch einen formal erfolgreichen HTTP-Status verdecken.

Es gibt **keinen Nachweis eines produktiven Vorfalls**. Der Befund ist ein klarer Erfolgskontrollfehler in der Quellimplementierung.

## Fix, Abgrenzung und Betriebsverhalten

- **Strenge Abschlussbestätigung:** `functions/src/purgeCompletion.ts` akzeptiert nur **HTTP 200** mit `application/json` und dem erwarteten Erfolgsschema. `ok === true`, `hasMore === false`, `unresolvedEarlierPages === false` und `failedCount === 0` sind Pflicht. `processed`, `purgedCount`, `skippedCount` und `pages` müssen nichtnegative sichere Integer sein. Die Zählersumme muss `processed === purgedCount + skippedCount` erfüllen; maximal 100 Datensätze und vier Seiten entsprechen den bestehenden API-Scanlimits.
- **Gegen unbeschränkte Antwortdaten:** Der Worker liest die HTTP-Body-Bytes per Stream maximal bis zu **2.048 Byte**. `Content-Length` wird nur als frühzeitiger Ablehnungs-Hinweis verwendet, nicht als Vertrauensbeweis. Ein zu großer Stream wird abgebrochen, ungültiges UTF-8/JSON wird zurückgewiesen; es wird kein unlimitierter `response.text()`/`response.json()`-Read durchgeführt.
- **Verlässliche Fehlerbehandlung:** Der Scheduler ruft `await assertPurgeSchedulerResponse(response)` auf. HTTP 202/204/206, 401/503, Proxymeldungen oder `ok:false` trotz 200 führen zu einer Exception und damit zum bestehenden Scheduler-Fehler-/Retry-Pfad. Es wird kein erfolgreicher Löschungsbericht erfunden.
- **Bestehende Grenzen unverändert:** HMAC-Secret, Zeitstempel, TLS-Only-Origin, Redirect-Verbot, Request-Timeout, Firestore-Lease, Decision-Fencing, Original-GCS-Generation, Holds, Generation-Predicate, Audit-Intent und konkrete GCS-DELETE-Logik bleiben unverändert. Der Fix nimmt keine Änderungen an Retention-Fristen, IAM oder produktiven Daten vor.

## Test- und Review-Evidenz

`tests/purgeCompletion.spec.ts` umfasst gültige Abschluss-/Leerlauf-Sweeps und systematische Negativtests für falschen HTTP-Status, fehlende/falsche Content-Types, HTML/ungültiges JSON, Body-Limits einschließlich gelogener falscher Content-Length, unechte `ok`-/`hasMore`-/Prior-Fehler-Flags, fehlende Quittungsfelder, fehlerhafte Zählersummen, negative/gebrochene Zahlen sowie übergroße Seitenkontingente.

`scripts/check-compliance-storage-purge.mjs` fordert den konkreten Scheduler-Aufruf sowie den begrenzten Lese- und Abschlussvertrag verbindlich als Bestandteil von `check:enterprise`.

Für diesen neuen Branch muss die **vollständige CI auf dem exakten Head** einschließlich TypeScript, Functions-Build, Vitest/Emulator, Anwendungs-Build und Browser-Acceptance eigenständig PASS ergeben. Der Parent-CI-PASS gilt **nicht** für diese Änderung.

## Offene P0-Produktionsfreigabe

Ein korrekt bestätigter Scheduler-Aufruf ist **keine kryptografische Attestierung** der tatsächlichen GCS-Abwesenheit. Firestore-/GCS-Konsistenz über alle Writer, Original-Uploadgenerationen, Cloud-Scheduler-/IAM-/Service-Account-Inventur, TTL-Aktivierungsstatus, unabhängige Data-Protection-/Legal-Altbestandsbereinigung und authentische Staging-Race-/404-/412-/Hold-/Recovery-Tests bleiben verbindlich. AppSec, DPO/Legal, SRE und Release Owner haben nicht unabhängig freigegeben.

**Keine Änderungen an `main`, keine Deployments/Merges, keine produktiven Datenabfragen oder Löschungen. Formale Freigabe: BLOCKED / NO-GO.**
