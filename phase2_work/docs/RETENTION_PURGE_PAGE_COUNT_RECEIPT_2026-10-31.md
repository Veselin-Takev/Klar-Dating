# P0 #202 — Scheduler-Retention-Receipt: Scanner-Seitenzahlen konsistent validieren

**Datum:** 2026-10-31 · **Status:** DRAFT / BLOCKED / NO-GO · **Abhängigkeit:** [PR #243](https://github.com/Veselin-Takev/Klar-Dating/pull/243), exakt `82640fe87463e7332789b20443d31248b4a3226d`. Dieser Branch darf nicht unabhängig zu `main` gemergt werden.

## Quellnachweis / Fehler

Die HTTP-200-Erfolgsvalidierung in `functions/src/purgeCompletion.ts` verlangte `processed === purgedCount + skippedCount`, sichere Integer, `pages <= 4` und `processed <= 100`. Sie verknüpfte aber **Seiten- und Datensatzanzahl nicht**: ein syntaktisch gültiger Body mit `processed:3, purgedCount:2, skippedCount:1, pages:0` wurde trotz widersprüchlicher Scanner-Metadaten anerkannt. Ein Body mit vier vollen Seiten und 100 Elementen bei `hasMore:false` war ebenfalls syntaktisch zulässig.

`src/server/platform/verificationPurgeScan.ts` verarbeitet pro Seite höchstens 25 Elemente, zählt **nur nichtleere Seiten** und gibt bei vier vollständig gefüllten Seiten `hasMore:true` zurück. Eine *vollständige* Antwort hat deshalb entweder `pages=0, processed=0` oder bei `pages=p > 0` die Schranken `25(p-1) < processed <= 25p`, wobei `p=4, processed=100` ausdrücklich ausgeschlossen ist. Exakte volle Seiten bei `p < 4` sind legitim, wenn der nächste Fetch leer zurückkehrt.

## Gezielte Abhilfe

- `functions/src/purgeCompletion.ts`: `validPageExtent` prüft die belegbaren Scanner-Invarianten zusätzlich zur bisherigen Abschluss-/Antwortgröße-/HTTP- und JSON-Prüfung. Die Entscheidung ist **fail-closed**, ohne GCS-DELETE, IAM, Scheduler-Secrets oder produktive Payloads zu verändern.
- `tests/purgeCompletion.spec.ts`: vier positive Grenzfälle (25, 50, 51 und 99 verarbeitete Datensätze) und sechs negative, intern summenkonsistente Seiten/Datensatzwidersprüche.
- `scripts/check-compliance-storage-purge.mjs`: verpflichtender Enterprise-Quellgate prüft, dass das neue Invariant nicht versehentlich entfernt wird; bestehende Gates bleiben unverändert.
- `docs/PROJECT_STATUS.md`: Freigabe-/Testgrenzen nachvollziehbar festgehalten.

## Nachweispflicht und verbleibendes Risiko

Dies ist ein **rein quellenbasierter, deterministischer Vertragshärtungs-Fix**. Eine echte GCS-Erasure-Quittung ist weiterhin **nicht** aus einem JSON-Response beweisbar. Geprüfte Full-Stack-Tests auf dem **exakten neuen SHA**, unabhängige Security-/DPO-/SRE-Freigaben, Cloud-Functions-/Scheduler-/Service-Account-/IAM-Inventar, Original-Generation-Provenienz, All-Writer-Fencing sowie echte Staging-Race-/404-/412-/Hold-/Reconciliation-Nachweise fehlen.

Keine produktiven Bilder oder Tokens berührt; kein Merge, kein Deployment und keine `main`-Mutation. **Production Readiness: BLOCKED / NO-GO**.
