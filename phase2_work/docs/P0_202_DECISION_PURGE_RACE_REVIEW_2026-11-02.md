# P0 #202 – Entscheidungsbasierte GCS-Löschung: isolierte Code- und Testabnahme

**Erhebungsdatum:** 02.11.2026 · **Prüfart:** E1/E2 Source-/PR-Review, **keine** ausgeführte E3/E4 Cloud- oder Emulator-Abnahme.  
**Scope:** [Draft-PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203), geprüfter Head `09baf8910c812d664457a908f9f2d991b87aa664`, Basis `2808dc1cbb485f70b403681c108cea5a3361d950`.  
**Freigabestatus:** `productionApproved=false`, **BLOCKED / NO-GO**.

## Architektur und Reihenfolge

`#269` ist ein enger, bereits gegen `main=96c3857c53f5ced31fe1394895185f42c75bc716` synchronisierter Fail-closed-Kill-Switch für den gefährlichen *altersbasierten* Alt-Scheduler; [CI 41527555204](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41527555204) auf `895aaa3da2056d7799f887596b89c09207699925` war erfolgreich. Er ist **nicht** gemergt und nicht in der Cloud deployed. Die unabhängige Freigabe fehlt.

`#203` ist demgegenüber eine umfangreiche Neufassung des entscheidungsbasierten Löscher-APIs und Scanners mit 20 geänderten Dateien. **Beide PRs überschneiden sich** in `functions/src/deleteExpiredPhotos.ts`, `functions/src/retention.ts`, `docs/DATA_RETENTION.md`, `package.json`, `tests/photoRetention.spec.ts` und `tests/storageRules.spec.ts`. **Nicht** blind gemeinsam oder in beliebiger Reihenfolge mergen. Empfohlen wird: erst #269 reviewen, ggf. kontrolliert in den integrierten Branch übernehmen und den Alt-Worker sicher außer Betrieb nachweisen, dann #203 oder einen gezielt konsolidierten Nachfolger per neuem Review-Head integrieren.

## E1: belegbare Sicherungsmechanismen im #203-Code

In `phase2_work/src/server/routes/complianceStorage.ts` wurden folgende Mechanismen im geprüften Quelltext festgestellt:

1. HMAC-SHA256 über `timestamp.body`, formale Signaturprüfung mittels `timingSafeEqual` und ein zeitlich begrenztes Requestfenster. **Ein freies 5-Minuten-Fenster allein beweist keine eindeutige Nonce-/Replay-Abwehr.** Idempotenz und Lease müssen bei doppelten Requests eigens getestet werden.
2. Firestore-Scanner mit begrenzten Seiten (`MAX_BATCH=25`, `MAX_PAGES=4`), geordnetem `fotoLoeschenAb`-Cursor und persistiertem Lease. `scanPurgePages` führt einen Checkpoint nach vollständig behandelter Seite aus, auch wenn einzelne Datensätze im Ergebnis `failed>0` melden; das verhindert vollständiges Blockieren des Batches, verlangt aber einen nachgewiesenen Wrap-/Retry-Pfad zur Wiederaufnahme fehlgeschlagener Einträge.
3. Vor der Löschung werden Status, `decidedAt`, `fotoLoeschenAb`, `photoPurged`, identische UID und Storage-Pfad geprüft. Ein `photoPurgeIntent` bindet Generation, Status, Pfad und Entscheidungszeitpunkt an den vorgesehenen Aufruf.
4. Nach dem letzten GCS-Metadatenlesen erfolgt nochmals eine Firestore-Autorisierungsprüfung; die physische Löschung verwendet `ifGenerationMatch`. Konflikte mit Generation/Legal Hold sollen fail-closed sein.
5. Ein 404 wird nur bei zuvor persistiertem, passenden Intent als `absence_reconciled` behandelt; ein zweiter GCS-Metadatenaufruf vor dem finalen Audit-Receipt darf kein später wieder vorhandenes Objekt irrtümlich als abwesend bestätigen. Audit-Quittung und Generation werden in Firestore gebunden.

Diese Mechanismen sind **im PR-Quelltext vorhanden**, nicht durch vorliegende reale GCS-/Firestore-Laufzeitlogs belegt. Der Code kommentiert explizit die verbleibende **nicht-atomare Cross-Service-Race** zwischen letzter Firestore-Prüfung und GCS-Operation. Ein einmaliges Test-PASS belegt keine formale atomare Freigabe über beide Dienste.

## E2: vorhandene Tests und fehlende belastbare Evidenz

GitHub `validate` für `#203`-SHA `09baf8910c812d664457a908f9f2d991b87aa664` meldete `completed/success`. Sichtbare Tests in `tests/complianceStoragePurge.spec.ts` prüfen GCS-Generation, Holds, ungültige Generationen, HTTP-404-/412-/503-Reaktionen und finales Callback-Ordering. Die isolierten Scan-Tests in `scripts/test-verification-purge-scan.mjs` prüfen unter anderem Cursor-Paging/Wrap, falsche Cursor, fehlerhafte Seiten/Counts, Fehler und Crash ohne Checkpoint. **Nicht** nachgewiesen sind hier reale Emulatortest-/GCS-Operationen oder die Wirksamkeit der aufrufenden IAM-/Cloud-Scheduler-Konfiguration. #203 ist Draft, ohne unabhängige Reviews, und liegt noch auf älterer `main`-Basis.

## Zwingende Negativtestmatrix vor Integrations- oder Deploy-GO

| Fall | Erwartetes Ergebnis | Nachweisartefakt |
|---|---|---|
| 31 Tage altes **pending**-Foto | **Nie** allein wegen `timeCreated` löschen; weder Intent noch `photoPurged=true` | Emulator-/Staging-Log mit UID-gebundenem Fixture |
| Genehmigt/abgelehnt, `decidedAt` noch nicht abgelaufen | Keine Löschung, keine falsche Quittung | deterministischer Zeitgeber-Test |
| Vorhandener GCS-Generation-Wechsel zwischen Lese- und Löschaufruf | `412`, kein falscher Success/Audit-Receipt | Fake-GCS mit Precondition-Fehler + echter Staging-Check |
| `temporaryHold` / `eventBasedHold` oder dokumentierter Legal Hold | Kein Delete und keine Erfolgquittung | Storage-Hold + Firestore-Hold-Evidence nach vereinbartem Schema |
| Firestore-Entscheidung oder UID/Pfad nach Intent geändert | Kein physischer Delete nach finaler Validierung; bei Zwischenzeitänderung Failure/Quarantäne statt GO | Race-Injection-Test, nachvollziehbare Timeline |
| Physischer Delete erfolgreich, Firestore-Audit-Commit fehlgeschlagen | Reconciliation nur aus passenden Intent+Generation; kein doppelt behaupteter Delete | Worker-Crash-/Retry-Test |
| GCS 404 **ohne** persistierten Intent | Kein `absence_reconciled`-Receipt | Negativtest |
| 404 **mit** Intent, Objekt vor zweiter Prüfung neu erschienen | Keine Abwesenheitsquittung | Negativtest |
| Replay derselben gültigen HMAC-Nachricht innerhalb 5 min | Keine zweite unautorisierte Löschung; idempotenter/bounded Job, Lease und Audit-Einmaligkeit | Replay-/Concurrency-Test |
| Mehr als 100 fällige Events, einzelne Fehler und kontinuierlicher Neuzufluss | Recovery/Wrap und endliche Retry-Latenz je fehlgeschlagenem Event; kein Starvation und kein verdeckter `200 OK` | Mehrfach-Invocation-/Load-Test |
| Lease-Verfall zwischen Freigabe und GCS-Delete sowie parallele Worker | Stale Worker darf kein bestätigtes Erfolgsreceipt setzen; Inkonsistenzen offen melden | Race-/Chaos-Test |
| Art.17-Kaskade parallel zum Verification-Purge | Keine IDOR-/Tenant-übergreifenden Zugriffe, kein verwaistes Intent/Receipt | Multi-Tenant-Emulator plus E4-Schema-Review |

**Unabhängig zu verifizieren:** Zuordnung des rechtlich freigegebenen Retention-Clocks und gesetzlicher/legal-hold-Felder durch DPO/Legal; „30 Tage“ ist eine interne Produktpolicy und ohne Rechtsprüfung kein pauschal gesetzlicher Mindest- oder Höchstzeitraum.

## Fail-closed Abnahme

- [ ] #269: unabhängig reviewter Kill-Switch, Tests auf integriertem SHA, autorisierter SRE-Rollout inklusive vorher/nachher Scheduler- und Funktionsrevision.
- [ ] #203: neu gegen **aktuellen** `main` und genehmigte #269-Basis synchronisieren; sechs Dateikollisionen und rebase-/merge-spezifische Tests explizit abarbeiten.
- [ ] #203: Negativtestmatrix E2/E3 mit IDs, Exit-Codes und unveränderlichen SHA-/Konfigurationsnachweisen.
- [ ] E4: IAM, Scheduler, Firestore-Index/TTL, GCS Holds, Objektgenerationen, Workload-Identität und echte Delete-Receipts in zugelassener Staging-Umgebung.
- [ ] E5: unabhängige Security-, DPO/Legal-, SRE- und Release-Owner-Abnahme. Keine GO-Simulation oder freigabeersetzende AI-Review.

**Entscheidung:** `#203=technisch interessanter Folgekandidat, nicht produktionsreif nachgewiesen`. Keine Löschungen oder Deployments aus dieser Prüfung. `productionApproved=false`.
