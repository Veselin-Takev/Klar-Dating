# P1 #73 — Explizite technische Ownership für KYC, Retention und Bearer-Link-Pfade

**Stand:** 2026-10-31 · **Status:** Draft / BLOCKED / NO-GO · **Branch:** `fix/73-codeowners-sensitive-retention-kyc-paths-20261031` (unabhängig auf unverändertem `main` `2808dc1cbb485f70b403681c108cea5a3361d950`).

## Quellcodebefund

`CODEOWNERS` und `scripts/check-codeowners.mjs` schützten 21 explizite Pfade, darunter `authorization.ts`, Stripe, Firestore-Regeln, CI und die allgemeine `/phase2_work/`-Zuordnung. In der derzeitigen P0-Draft-Kette werden jedoch neue sicherheitskritische Funktionen für Didit, die generationgebundene Löschung biometrischer Fotos und Audit-Receipts bearbeitet. Für diese konkreten Dateien existierten **keine expliziten Dateiregeln**; lediglich das generische technische Ownership-Muster griff. Gleiches gilt für die Export-/Upload-Pfade der langlebigen Firebase-Bildlinks aus [P1 #206](https://github.com/Veselin-Takev/Klar-Dating/issues/206).

**Das ist eine Reviewer-Routing- und Änderungs-Governance-Lücke, kein Beweis, dass ein unabhängiger Review tatsächlich stattgefunden hat oder ein Datenvorfall eingetreten ist.**

## Änderung und lokale Kontrolllogik

- `CODEOWNERS` enthält 13 zusätzliche **wörtliche, repository-root-bezogene** Pfade: Compliance-Foto-Löschroute, Aufbewahrungsengine, Cursor-Scanner, Didit-KYC, Scheduler und dessen Antwortvalidator, Legacy-Crons, `src/lib/klar.ts` und `src/lib/api.ts`, die betreffenden Pflichtgates sowie das Root-`GO_LIVE_CHECKLIST.md`. Das spätere Eigentums-Muster gewinnt nach GitHub-CODEOWNERS-Semantik; jedes neue Muster steht deshalb hinter dem generischen `/phase2_work/`-Eintrag.
- `scripts/check-codeowners.mjs` verlangt diese zusätzlichen exakten Regeln, statt sich auf generische Fallbacks zu verlassen; die geschützte Pfadliste umfasst nun **34** Einträge. Die neue Funktion `functions/src/purgeCompletion.ts` erhält schon vor einer eventuellen Integration der P0-PR-Kette ein ausdrückliches Ownership-Muster.
- `scripts/test-codeowners.mjs` enthält die konsistente Anzahl sowie Mutations-/Negativtests: Entfernt man eine kritische Dateiregel oder hängt man ein späteres generisches Muster an, muss das Enterprise-Gate **fail-closed** auslösen.
- Der bestehende `check:codeowners`-Check ist bereits Teil der verpflichtenden `check:enterprise`-Pipeline. Keine Produktionskonfiguration und kein CI-Workflow wurden manuell ausgelöst.

## Wichtig: ausdrücklich **keine** unabhängige Fachfreigabe

Das einzige hier nachgewiesene GitHub-Ownerkonto ist `@Veselin-Takev`, also **technische Zuordnung**, nicht „Vier-Augen-Prinzip“. Die bestehende `codeowners-review-policy.mjs` hält `Security` und `Finance` als nicht zugewiesene unabhängige Rollen fest und sperrt die reale Release-Freigabe ohne individuelle exakte Commit-Abnahme. Diese PR fügt **keine erfundenen Reviewer, Teams oder Unterschriften** hinzu. Nicht unabhängig belegt sind insbesondere:

1. Tatsächlich konfigurierte Branch Protection samt verpflichtenden Code-Owner-Reviews und vorhandenen Team-/Kontoberechtigungen.
2. AppSec-/Security-Review der Didit-/KYC-/Storage-/IAM-/GCS-Writer-Grenzen und des unveränderlichen Audit-Ledgers.
3. DPO-/Legal-Freigabe für Löschfristen, Art.-17-Legacy-Fälle, Referrer-/Token-Rotation und sensible Bildleseberechtigungen.
4. SRE-Abnahme realer Cloud-Scheduler, Berechtigungslimits, Storage-Holds, Staging-404/412-/Crash-Recovery, Alarmzustellung und Rollback.
5. Unabhängiger Security-/Finance-Reviewer und formelle Release-Owner-Abnahme mit dem **exakt** deploybaren Commit.

## Tests und Evidenzgrenze

Ein vollständiger GitHub-CI-PASS ist **für den exakten Head dieser neuen Draft-PR** erforderlich; die erfolgreichen Eltern-PR-Läufe aus der biometrischen P0-Kette oder die separate P1-Privacy-Kette sind dafür kein Ersatz. Die Source- und Mutationstests sind **keine** echte Live-Bestätigung von GitHub Branch Protection oder erfolgtem menschlichem Review. Solche Nachweise dürfen nur aus verifizierten GitHub-Einstellungen, Review-Identitäten und den unveränderlichen Release-Artefakten übernommen werden.

**Kein Merge, kein Deploy, kein Produktionszugriff oder `main`-Commit. Freigabe: BLOCKED / NO-GO.**
