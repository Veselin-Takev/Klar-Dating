# P0 #202 – Laufzeit-Fail-Closed für biometrische Entscheidungen und Fehlerdiagnostik

**Stand 2026-10-30 | Isolierter, auf PR #203 aufbauender Draft-Kandidat | Eigene CI noch ausstehend | PRODUCTION BLOCKED / NO-GO**

## Verifizierter Ausgangspunkt
[Draft #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203), exakter HEAD `09baf8910c812d664457a908f9f2d991b87aa664`, hat einen [automatischen CI-Lauf #41009288244](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41009288244) mit `completed / success`. Er entfernt den gefährlichen upload-altersbasierten Verifizierungsfoto-Löschpfad aus dem Legacy-Cron und führt einen entscheidungsbasierten, begrenzten und wiederaufnehmbaren Löschscanner ein. Das ist **keine Bestätigung des aktuellen Produktions-Schedulers oder einer erfolgreichen Stage-Migration**.

## Nachgewiesene Quellgrenzen
Der direkte Helfer `purgeSingleVerificationArtifact` in `src/server/platform/storageRetentionEngine.ts` hatte zwei defensiv relevante Lücken:

1. Er prüfte nur `status === 'pending'`. Weil der TypeScript-Uniontyp zur Laufzeit nicht existiert, konnte ein altes Adapterobjekt mit unbekanntem, leerem oder fehlendem Entscheidungsstatus (bei über 30 Tagen altem `decidedAt`) trotzdem die Storage-Löschung durchlaufen. Die übergeordnete HTTP-Route normalisiert und prüft zusätzliche Werte bereits; die Fehlerschranke muss aber **auch ohne diese Route** gelten.
2. Im Fehlerfall wurde ein beliebiger `Error.message` oder `String(err)` direkt als `PurgeArtifactResult.error` zurückgegeben. Provider-/Firestore-Fehlertexte können Benutzer-UID, Storage-Pfad oder Diagnosedaten enthalten. Die HTTP-Route aggregiert die Fehler zwar nur nach Typen, aber der wiederverwendbare Helfer selbst soll keine rohen externen Fehler in zukünftige Aufrufer oder Logs weiterreichen.

**Keine tatsächliche Kundendaten-Offenlegung oder vorzeitige Löschung ist damit nachgewiesen; dies ist ein quellenbasierter Abwehr-Fix.**

## Korrektur
- Nur die **expliziten Finalzustände** `approved` und `rejected` können den 30-Tage-nach-Entscheidungsdatum-Löschpfad erreichen. Jeder andere Status erhält die bisherige nichtlöschende Antwort `reason:'pending_decision'`. Bestätigte und abgelehnte Altzustände bleiben funktional unverändert.
- Unerwartete Fehler von Storage und Firestore werden weiterhin als `reason:'error'` und `purged:false` gezählt, aber die `error`-Eigenschaft enthält nur den konstanten Text `verification_photo_purge_failed`. Dieser Fix ändert **nicht** das bestehende `uid`/`challengeId`/`storagePath`-Resultatformat; diese Identifikatoren dürfen auch weiterhin nicht ungefiltert protokolliert werden.
- `tests/verificationRetentionRuntimeBoundary.spec.ts` prüft synthetisch: pending/fehlender/leerer/fremder/falsch geschriebener Status löst weder Storage-Delete noch Audit-Write aus; explizite `approved` und `rejected` Entscheidungen löschen fristgerecht; sowohl `Error` als auch beliebige geworfene Objekte und DB-Fehlertexte werden nicht im Fehlerfeld gespiegelt; der Batch zählt nicht genehmigte Zustände als nicht gelöscht.

## Eigenständige Prüfkriterien
Eigener SHA-gebundener Enterprise-CI-Lauf mit **PASS** für Typecheck, Static/Security/Art.17, Storage- und Firestore-Emulator-Regeln, neue und bestehende Retention-Tests, Functions-Build, Browser-Abnahme. Originalprotokoll muss den neuen `verificationRetentionRuntimeBoundary.spec.ts`-Test **ausgeführt (nicht übersprungen)** nachweisen. Ein vorheriges Grün von #203 gilt nicht automatisch für den neuen HEAD.

## Verbleibende P0-Freigabegrenzen
Die externe Cloud-Functions-/Scheduler-Revision, IAM und Legacy-Job-Zustand wurden nicht live geprüft. Die tatsächliche Umsetzung der 20-Gruppe-TTL-Matrix (#70), Migrations-/Rollback-Plan, rechtliche Zweckbindungs-/Aufbewahrungsentscheidung, echte 404/412- und Legal-Hold-Daten sowie unabhängige DPO/Legal-, Security-, Operations/SRE-, Product- und Release-Owner-Freigaben stehen aus.

**Kein Zugriff auf echte Verifizierungsbilder, keine Cloud-Secrets, keine manuell ausgelöste CI, keine Merges/Deployments, keine Commits auf `main`, keine Änderungen an PR #119 oder RC R2. PRODUCTION BLOCKED / NO-GO.**
