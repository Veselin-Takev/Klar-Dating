# P0 #254 – Verbindliches Firebase-Rules-Emulator-Gate in Enterprise-CI

**Stand:** 31.10.2026 · **Parent:** [Draft #266](https://github.com/Veselin-Takev/Klar-Dating/pull/266), SHA `b218bc7a4f2f55161197c3def3d432339b1876f7`, zuletzt [Enterprise-CI #41242366372](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41242366372) `completed/success`. **Isolierter Korrektur-Branch:** `security/254-firestore-rules-scope-emulator-evidence-20261031` (vor neuer CI ohne Emulator-PASS). **Production BLOCKED / NO-GO**.

## Anlass und technische Entscheidung

Im Multi-Tenant-/Rules-Hardening wurden zwei lokale Deployment-Bereiche mit je eigenem `firebase.json`/`firestore.rules`, eine tatsächlich falsch gebundene `validUserMutableUpdate(userId)`-Scope-Funktion und fehlende dedizierte Tenant-Negativtests festgestellt. Der bestehende `test:ci`-Befehl startet mehrere Emulatoren und eine `concurrently -k -s first`-Prozessgruppe, deren erfolgreicher Abschluss **keinen eigenen eindeutig benannten Rules-Compiler-/Emulator-Testschritt** in der GitHub-Workflow-Job-Evidenz belegt. Der Repository-Befehl `test:rules` wurde deshalb als separate Pflichtabnahme in der CI ergänzt. Ein bloßer grüner `check:public-firestore-rules`-Regex-Gate bleibt ausdrücklich unzureichend.

## Implementierung

- `.github/workflows/ci.yml` enthält jetzt im vollständigen Validierungsjob nach Installation der fixierten Node.js-22.23.3-/Java-21-Toolchain und vor dem Build einen **separaten** `Firestore rules emulator`-Schritt: `npm run test:rules`. Der Schritt ist für Full-Validation-PRs obligatorisch und lässt bei Compiler-, Emulator-, Vitest-, Port- oder anderen Fehlern den Job scheitern.
- `npm run test:rules` führt mit `firebase.pruefung.json` den isolierten `demo-klar`-Firestore-Emulator aus und testet `tests/rules.spec.ts`. Das zuvor vorbereitete Rules-Scope-Fix und die Tenant-Negativtests (echte CREATE-, GET-, UPDATE-, DELETE- und LIST-Operationen) sind darin integriert. Es gibt keine Live-Project-ID oder produktive Firebase-Credentials.
- `scripts/check-release-ci.mjs` fordert `Firestore rules emulator` nun zusätzlich als **verifizierbaren und erfolgreich abgeschlossenen** `REQUIRED_STEPS`-Eintrag auf exakt dem freizugebenden Main-Commit. Der Release-Check darf eine fehlende, übersprungene oder fehlerhafte Rules-Abnahme nicht als GO werten.
- `scripts/release-ci-check.mjs` enthält einen Regressionstest, der das Vorhandensein und die Reihenfolge des Schrittes im Workflow, das zugehörige `test:rules`-Skript und die Einbindung in die Release-Pflichtschritte kontrolliert. Die bestehenden Release-Governance-Negativtests prüfen über die zentralen `REQUIRED_STEPS` außerdem das fail-closed Verhalten bei fehlgeschlagenen/skipped CI-Schritten.

## Aktuelle Budget- und Release-Governance

Der Repository-Owner hat am **31.10.2026 die bisherige 100-Minuten-Grenze für GitHub Actions ausdrücklich aufgehoben**. Das Audit dokumentiert die frühere Vorsichtsgrenze weiterhin historisch, sie ist **keine aktuelle Ausführungssperre**. Die neuen Prüfungen dürfen deshalb in einem isolierten, nicht gemergten Draft-PR automatisch anlaufen; die Freigabe für zusätzliche CI-Minuten ist **keine** Freigabe für Main-Merges, Firebase-Produktionsberechtigungen, Cloud-IAM, Deployments oder einen produktiven Migrations-Cutover.

Bei einem fehlschlagenden `Firestore rules emulator`-Schritt sind die konkreten Rules-Compiler-/Testfehler über SHA-gebundene Job-Logs nachzuweisen und ausschließlich im dedizierten Branch zu korrigieren. **Keinen PASS vor tatsächlich abgeschlossenem Workflow erfinden.** Für alle zukünftigen Pflichtprüfungen gelten exakte SHA-, Toolchain-, Exit-Code- und Reviewer-Belege.

## Noch offene Freigabevoraussetzungen

Nach einem erfolgreichen Emulatorlauf bleiben insbesondere die **fehlenden Tenant-Live-Client-Rules**, die realen serverseitigen Admin-SDK-/BOLA-/IDOR-Grenzen, Storage-Privatsphäre/Blockierungsbehandlung, DSGVO-Art.-17-Löschkaskade, Original-Firestore-Provenienz, unabhängige Signer- und Snapshot-Freshness-Abnahme, fehlende externe Gitleaks/Semgrep/npm audit/ESLint-Nachweise aus Issue #8 sowie unabhängige Security-/DPO-/Operations-/Release-Owner-Freigaben bestehen. Ein Rules-Suite-PASS für die vorübergehend **default-denied** Tenant-Collection beweist weder einen Live-Cutover noch die komplette Multi-Tenant-Produktreife.

**Kein Merge, keine produktive Daten-/Cloud-Regel-/IAM-Änderung, kein Deployment. Production BLOCKED / NO-GO.**
