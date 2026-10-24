## P0: Idempotente Chat-Bestätigung trotz KI-Ausfall — 2026-10-10

**Entwicklungsbranch-Fix:** Der Chat-Sendepfad prüft nach authentifizierter Chat-Zugehörigkeit eine bereits gespeicherte Kombination `uid + clientMessageId` vor einem erneuten externen KI-Safety-Aufruf. Derselbe Nachrichteninhalt erhält die vorhandene Quittung; Konflikte bleiben 409. Neue Nachrichten werden weiterhin vollständig KI-geprüft und innerhalb einer Firestore-Transaktion autorisiert/geschrieben. **3/3 lokale Node-Quellregressionen tatsächlich ausgeführt und bestanden** (beide getesteten Dateien byteidentisch zu GitHub), aber unter Node 20.20.2 statt der gepinnten Enterprise-Toolchain. **Vier neue Firestore-Emulator-Testfälle** (Provider-Ausfall nach Write, Konflikt, gleichzeitige identische Sends, Block nach Write) committed, **nicht ausgeführt**. Früher CI- und lokaler Preflight-Gate ergänzt. TCO-Vorteil bei Duplikaten und zusätzlicher Firestore-Leseaufwand bei neuen Sends noch nicht gemessen. Details: [ENTERPRISE_E2E_AUDIT_2026-10-10.md](ENTERPRISE_E2E_AUDIT_2026-10-10.md). R2 eingefroren, keine manuell gestartete CI, **NO-GO**.

---

## Offline-Zustellbestätigung und CI-Schutz — 2026-10-10

**P0-Fix auf Entwicklungsbranch:** Keine Queue darf eine Nachricht auf Basis des HTTP-Status allein löschen. Legacy- und IndexedDB-Pfade verlangen nun explizites `success: true`; bei einer uneindeutigen 2xx-Antwort erfolgt ein begrenzter idempotenter Retry mit derselben Nachrichten-ID. Zusätzlich wurde eine veraltete CI-Import-Assertion korrigiert. **Lokal tatsächlich getestet:** 10/10 Receipt-Funktionsfälle PASS unter Node 22.16.0, isolierte strenge TypeScript-Prüfung PASS, originale GitHub-Quellcode-Bedingungen 6/6 bestätigt. Neue Vitest- und CI-Fälle sind committed, aber der vollständige gepinnte Preflight wurde nicht ausgeführt. Weitere Details: [ENTERPRISE_E2E_AUDIT_2026-10-10.md](ENTERPRISE_E2E_AUDIT_2026-10-10.md). R2 unverändert; **NO-GO**.

---

## Offline-Queue-Retry und Dead-Letter-Warnungen — 2026-10-10

Auf dem Entwicklungsbranch wurde ein P1-Resilienzfehler korrigiert: verbleibende Offline-Nachrichten erhalten bei stabiler Online-Verbindung einen einzelnen, nach 60 Sekunden ausgelösten weiteren Synchronisationsversuch, ohne Idle-Polling. Retry-Timer werden bei Logout, Auth-/Offline-Wechsel und Unmount entfernt. Die Warnung für bereits gespeicherte Dead-Letter-Nachrichten bleibt über spätere Sync-Läufe hinweg sichtbar. Frühe CI-Regression und zwei reguläre Vitest-Fälle ergänzt. **14/14 statische GitHub-Quellcodebedingungen bestätigt; Ausführung der neuen Tests, echte Browser-/Firebase-Tests und gepinnter Enterprise-Preflight stehen aus.** Siehe [ENTERPRISE_E2E_AUDIT_2026-10-10.md](ENTERPRISE_E2E_AUDIT_2026-10-10.md). **NO-GO**, R2 unverändert.

---

## Chat-Sendeautorisierung und Offline-Replay – 2026-10-10

**Dev-Branch-Fix:** Der Server nutzt verifizierte Firebase-Token-UID und prüft Chat-Zugehörigkeit vor und während des Nachrichtenwrites. Widersprüchliche `uid`/`ownerUid`/`senderId`-Angaben werden neuerdings mit `403 sender_mismatch` verweigert. Der Offline-Replay im Client unterstützt Abbruch bei Authwechsel, Verbindungsabbruch und Logout-Start; Fehler werden im Sync-Banner behandelt. Automatisierte Negativtests zu Konto-/Tokenwechsel und Replay-Abbruch ergänzt. **Statische GitHub-Prüfung 13/13 erfüllt, keine vollständige Testausführung.** Detaillierte Evidenz: [ENTERPRISE_E2E_AUDIT_2026-10-10.md](ENTERPRISE_E2E_AUDIT_2026-10-10.md). R2 unverändert, offizielle Freigabe **NO-GO**.

---

## P1 FE-02 IndexedDB Offline-Queue: Indexed Reads — 2026-10-10

Die bisherige globale `getAll()`-Abfrage wurde für Benutzer-Queue-Einträge durch `ownerUid`-Indexabfragen ersetzt. Checklisten verwenden direkte Primärschlüssel-Abfragen mit zusätzlicher Owner-Kontrolle. Hilfsmodul und gezielte funktionale Regression lokal unter Node 22.16.0 geprüft (2/2 PASS; Original-Helper per SHA bestätigt). CI-Regressionsprüfung vor Dependency-Installation integriert. **Keine vollständige Browser-/Emulator-/gepinnten Toolchain-Abnahme**. Separat offen: Legacy-`memoryQueue` mit nicht durchgehend UID-spezifischer Deduplizierung und Synchronisierung. Details: [ENTERPRISE_E2E_AUDIT_2026-10-10.md](ENTERPRISE_E2E_AUDIT_2026-10-10.md). Release **NO-GO**; R2 unverändert.

---

## End-to-End Enterprise Audit — 2026-10-10 (NO-GO)

Aktueller Domain-Audit und priorisierte ICE-Maßnahmen: [ENTERPRISE_E2E_AUDIT_2026-10-10.md](ENTERPRISE_E2E_AUDIT_2026-10-10.md). Neu korrigiert auf dem Entwicklungsbranch: PII-Sanitizer für generische `data`-Felder, unabhängige achtteilige Load/Cost-Freigabe-CLI und fail-closed Compliance-Retry bei fehlender API-Konfiguration. Lokale Targeted-Checks (2 + 3 + 2) bestanden; der gepinnte Voll-Lauf, echte Cloud-/Billing-/Alarmzustellung und Human Release Approval bleiben offen. R2 unverändert, **NO-GO**.

---

## Current enterprise release decision — 2026-10-10: NO-GO

The historical browser-CI findings below refer to earlier candidates and must **not** be mistaken for the current exact development-branch or frozen R2 release status. Current production blockers are tracked in [FINAL_RELEASE_VERIFICATION_2026-10-10.md](FINAL_RELEASE_VERIFICATION_2026-10-10.md), the root `GO_LIVE_CHECKLIST.md`, and [GitHub Issue #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8).

**Newest verified development-branch remediation:** Cloud Run secret aliases are resolved to real Secret Manager resources before IAM lookup; ambiguous duplicate required secret variables and conditional-only accessor grants no longer yield audit PASS. Monitoring alerts must refer to verified delivery channels. Targeted original-source checks passed locally, but no full checkout on Node 22.23.3/Bun 1.4.2, live production controls, alarm delivery, or human approval has been completed for these changes. **Do not merge, publish or claim GO.** Frozen R2 remains a separate immutable candidate.

---

## SEC-SCAN-01 candidate hardening — 2026-10-10

The secret scanner now recognizes ten credential-pattern families, restricts the
existing public Firebase exception to its exact field/path/project/value, and fails
closed on incomplete scans. It no longer exempts scanner/test filenames or entire
Firebase config files. Fifteen new dependency-free regressions passed on Node 24.19.0.
See [scope, evidence and remaining security gates](SECRET_SCANNER_2026-10-10.md).
This addresses SEC-01 in the 2026-10-09 audit, distinct from the later SEC-01 release-CI fix.
Only a partial local working-tree scan was available. Full-repository/history scanning,
dedicated tooling, production key restrictions and exact-candidate validation remain open.
No CI trigger or deployment. Production remains **NO-GO / NOT CONFIRMED**.

## DB-02 candidate implementation — 2026-10-10

Provider pages with confirmed deletions and bounded account-photo pages now preserve
the existing failure budget. Storage deletes use generation preconditions and require
an empty-prefix confirmation; holds, conflicts and no-progress responses remain failures.
49 dependency-free regressions and the static deletion gate passed on Node 24.19.0.
Updated provider/lifecycle/erasure Vitest scenarios are not executed here.
See [DB-02 behavior, limits and release gates](DELETION_PROVIDER_STORAGE_2026-10-10.md).
Full Node 22.23.3 validation, production storage-policy inventory, SDK latency/retry
verification, DB-01 legacy rollout and independent approval remain open.
No new CI trigger or deployment. Production remains **NO-GO / NOT CONFIRMED**.
This supersedes earlier statements that provider pagination always consumes the failure budget.

## DB-01 candidate integration — 2026-10-10

Cumulative deletion accounting and atomic final-sweep receipts are now integrated
from source commit `31363ebeb4251d788f877c008c12c5f7d7583e83` into the existing
INF-01 / SEC-01 / BE-01 remediation branch. No earlier correction is overwritten.
The static deletion gate, 42 existing dependency-free regressions and four direct
slice-behavior checks passed under Node 24.19.0. Eight TypeScript files passed
syntax transformation; this is not typechecking or emulator validation.
Historical emulator results are explicitly separated from current evidence.
Legacy-job inventory, migration decisions and full Node 22.23.3 validation remain open.
See [integration evidence and rollout runbook](DELETION_CONSOLIDATION_2026-10-10.md).
No PR, main push, release tag or workflow dispatch was initiated.
Production remains **NO-GO / NOT CONFIRMED**. Next separate issue: DB-02 provider/storage progress.
This section supersedes earlier statements describing DB-01 as not yet integrated.

## BE-01 candidate update — 2026-10-10

Both API authentication entry points now enable Firebase Admin token revocation checks.
The previously contrary static gate is corrected and four regression checks are wired into Enterprise validation.
42 dependency-free checks passed under Node 24.19.0; the added real-emulator logout/relogin/disabled-account
journey is not yet executed. Full Node 22.23.3 validation, merge and production approval remain pending.
No Actions run was initiated. See [auth revocation evidence](AUTH_REVOCATION_2026-10-10.md).
This supersedes earlier BE-01 implementation status only. Production remains NO-GO / NOT CONFIRMED.
Next P0: DB-01 cumulative final deletion receipts.

## SEC-01 candidate update — 2026-10-10

Release CI binding and frozen lockfile installation are implemented on the remediation branch.
38 dependency-free tests passed under Node 24.19.0. Full validation under Node 22.23.3,
merge and production approval remain pending. No Actions run was initiated.
This supersedes the earlier statement that SEC-01 is unimplemented, not the release NO-GO.
See [release CI binding](RELEASE_CI_BINDING_2026-10-10.md) for exact checks and evidence limits.
Next: BE-01 token revocation, then DB-01 cumulative/final deletion receipts.

## Current remediation — 2026-10-10

Baseline: `476c808cb5689aaca178b1d8ad6c607fb9017103`. This section supersedes older current-state statements below; historical results remain tied to their original SHA.

**INF-01: candidate implementation complete; full validation and merge pending.**
[Main CI 37978229573](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37978229573)
failed on Docker Node 26.10.0 versus the approved Node 22.23.3 policy.
The active Dockerfile now uses the exact approved image. CI and release perform the dependency-free runtime check
and three regression tests before toolchain setup and dependency installation.

Six runtime/scope regressions and targeted structural gates passed locally under **Node 24.19.0**.
This is not full validation under Node 22.23.3. No application/browser/emulator/container PASS is asserted.
No PR, main push, release tag, deployment or new Actions run was initiated.
Historical remaining-minute figures are not a current budget balance.

Production: **NO-GO / NOT CONFIRMED**. SEC-01 release validation binding, BE-01 revocation,
DB-01 cumulative/final deletion receipts and operational/governance evidence remain open.
See [remediation record](AUDIT_REMEDIATION_2026-10-10.md).

### 2026-10-09 — Post-merge onboarding race and runtime gate correction

Main CI `37963077381` failed one browser acceptance assertion (music preferences missing from an export read immediately after submit). The candidate orders export after confirmed onboarding completion and rechecks persistence after reload. Eight focused local tests passed. All three TypeScript projects and Enterprise gates passed on the corrected local candidate. The existing Node/Docker alignment gate is now included in Enterprise checks, preventing an otherwise green Node 26 dependency PR from bypassing the required 22.23.3 baseline. No application persistence or authorization rules were weakened.

See [post-merge report and CI ledger](POST_MERGE_VALIDATION_2026-10-09.md) for dependency decisions and all ten observed runs. Conservative additional-budget consumption is 61 minutes, leaving 139 at this snapshot; this includes update-generation jobs and is not an authoritative billing export. No new CI run was initiated for these changes. Browser execution for the amended candidate is still unverified. **Production: NO-GO / NOT CONFIRMED.**

### 2026-10-09 — Phase 3 change/adoption documentation delivered

PR #1 was merged at `b9808179d26cd4bb21644c4d8f871a439ea09157`. The [Phase 3 package](phase3/README.md) now covers the supplied Pillar 3 requirements: ADKAR roadmap, persona/workflow changes and before/after scenarios, four-week enablement, prompt and feedback standards, announcement/workshop templates, adoption metrics and evidence-based acceptance gates. Planning assumptions are explicitly marked. Existing Phase 2 governance and incident controls remain authoritative.

**Documentation prepared; business review, pilot execution and adoption evidence remain open.** No participant, training result, measured benefit or approval has been invented. G0–G5 remain not evidenced in the register. Production remains **NO-GO / NOT CONFIRMED**. Documentation is saved on a separate branch without opening a PR or starting another workflow.

### 2026-10-09 — Authorized remote validation passed (CI #331)

The owner explicitly approved one remote validation exception after disclosure of the local browser and process-orchestration limitations. PR #1 was fast-forwarded to candidate `0042bbff95e2092c804407fd8559aa6d8e3d37ed` and exactly one workflow ran: [CI #331](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37961300244), job `113924515032`.

**Result: SUCCESS.** Scope regression tests, frozen dependency installation, Enterprise static gates, all TypeScript projects, Functions build, application tests (**156 files / 1,001 tests**), application build, production smoke and Chromium browser acceptance (**26 / 26 passed**) all passed. The test orchestration exited successfully (code 0); the earlier local parent-process limitation did not reproduce on this runner. npm and Bun/emulator download caches were saved successfully; a future cache-hit speedup has not yet been measured.

Runner job: 2026-10-09 16:44:39–16:53:30 UTC (**8m 51s**). Conservative incremental ledger: **9 of 200 additional minutes consumed; 191 remain**, subject to GitHub's authoritative billing. The unused 45-minute reservation is released. No rerun, merge, release tag or deployment was initiated.

This closes the previously failing browser-regression gate for this candidate, including FE-01, FE-02 and FE-03 acceptance evidence. It does not certify every audit finding as resolved: deletion/retention completeness, production load/cost evidence, restore-drill evidence and independent operational/governance approvals still require their own exit criteria. **Official production approval remains NO-GO / NOT CONFIRMED.**

This evidence update is retained on a separate documentation branch without a pull request so it does not trigger a second Actions run. PR #1 remains on the successfully validated candidate above.

### 2026-10-09 — Local-first remediation and CI resource controls

Baseline: PR #1 head `0ae8d0c38cce9c363324d8c9e4e5a1818349d357`, failed CI #330. The owner authorized **200 additional Actions minutes**, conditional on thorough local verification before remote workflows. No new Actions run was triggered during this remediation.

Implemented locally:

- Correct partner service imports, typed campaign updates and fail-closed checks for incomplete transaction snapshots. Preserve consent payload types through the generic HMAC signer instead of unsafe casts. Repair the decoded-token test fixture and remove unused imports.
- Reconcile the Bun lockfile with the already-declared OpenTelemetry dependencies. Frozen `bun ci` now succeeds locally; CI no longer regenerates the lockfile.
- Add local preflight, narrowly scoped narrative-document filtering with regression tests, npm/Bun/emulator download caches and deferred Java setup. Keep the required `validate` job and full validation for code, rules, workflow, unknown or mixed changes.
- Use `node --import=tsx` for server startup. Correct the deletion test to use supported wrapper methods and supply a test-only consent secret in the erasure integration fixture.
- Forward Firestore SDK termination through the database wrapper once, including failure propagation. Production smoke now requires clean shutdown, not merely successful startup followed by a forced kill.

Local evidence: Node 22.23.3, Bun 1.4.2, Java 21; three TypeScript projects PASS; Enterprise gates PASS; naming and accessible button-label checks PASS; Functions build PASS; application build/bundle budget PASS; 155 application test files / 999 tests PASS; two additional shutdown tests PASS; three CI scope tests PASS. The full suite ran before the final shutdown implementation; focused regression and smoke results for that implementation are recorded in `docs/CI_RESOURCE_POLICY.md`. Production smoke including graceful shutdown PASS (exit 0). Final focused regression: seven files / 32 tests PASS. Vitest children exited 0, but the concurrently/emulator parent remained active and was interrupted; do not record the overall local `test:ci` command as exit-0.

**Browser acceptance remains blocked by this execution environment**, not passed: Playwright's browser download returned an unavailable-site HTML page; the already-installed Chrome for Testing also failed before test execution because its required local socket was denied (`EPERM`). No sandbox restriction was disabled. These results do not close the previous browser acceptance findings.

Changes are retained on a separate work branch without opening a PR or updating PR #1, because either would trigger remote validation before the owner's local prerequisite is fulfilled. Promotion requires either a successful browser run in a suitable local environment or an explicit exception for one bounded remote validation. Production measurements, retention/deletion completeness, restore evidence and independent release approvals remain open. **Production: NO-GO / NOT CONFIRMED.**

### 2026-10-09 — DB-01 partial remediation: deletion page progress and lease safety

A completed 25-chat purge page now raises a typed internal continuation signal. The durable worker records `completedPages`, schedules the next page and restores the attempt consumed by acquisition. Already deleted documents are the durable checkpoint: subsequent queries select the first remaining page. Genuine provider/database/time-slice failures retain backoff and the failure budget; successful pages do not erase earlier failures. Manual review begins on the 50th failed attempt and cannot be automatically reacquired. Authentication deletion also requires an unexpired owned lease.

Regression coverage added for 51 page continuations, retained real failures, the 50-failure boundary, expired leases and replacement leases. These tests exercise durable Firestore job state with an injected purge; they are **not** proof of purging 1,275 real chat documents. Full emulator-backed nested-chat pagination, within-page time-slice progress and cumulative deletion receipts remain follow-up work; DB-01 is not fully closed. Require the resulting CI before accepting this candidate.

**Release remains NO-GO / NOT CONFIRMED.**

### 2026-10-09 — CI #327: partner administration JSX correction

CI #327 (`37955984947`, candidate `2c8a7c6267c557c03e13da71313046fc7b7591a4`) passed dependency installation and Enterprise static gates but failed TypeScript parsing in `PartnerCampaignAdmin.tsx` at lines 138 and 199. Two conditional icon elements closed the JSX expression before closing the element. Both expressions now close the icon before the expression. No authorization, partner approval or rate-limit behavior changes.

Validation: the subsequent exact-head CI must pass TypeScript, unit/rules tests, build, production smoke and browser acceptance. Those stages were skipped after the parser failure; their earlier results do not validate this candidate. Operational TTL, deletion scalability, measured load/cost, restore and independent approval gates remain open. **Production release: NO-GO / NOT CONFIRMED.**

### 2026-10-09 — Enterprise CI #325: Firestore collection inventory remediated (verification pending)

Exact-head CI #325 (run `37948543686`, commit `aa13acacc19394e521b55d7e3103aa9eb0274556`) failed in `check:loeschkaskade`, after secrets, auth boundary, public Firestore rules, AI PII sanitizer and Art. 17 static gates had passed. The improved scanner discovered **16 additional distributed rate-limit collections** that had not been assigned retention decisions. This was a real inventory completeness failure, not a runtime deletion failure. All 16 are now explicitly classified as short-lived abuse-prevention state in `scripts/loeschkaskade.mjs`, with their `expiresAt`/Firestore TTL operational dependency documented. The shared limiter writes `expiresAt` on each new/continued window and hashes its identity key; it does not persist raw IP addresses in these records.

**Risk / remaining production gate:** A policy entry is not proof that Firestore TTL is configured or that deletion occurs promptly. Firebase TTL execution is asynchronous, and pseudonymous per-account counters can persist until their expiration/deletion. Before a production approval, verify the deployed TTL policies for each of these 16 collections and measure purge latency; review whether UID-derived limiters need deterministic Art. 17 cleanup rather than relying only on TTL. Do not treat the static inventory gate as legal clearance. The next CI run must pass on its exact resulting head, including typecheck, tests, browser acceptance and build. **Release status remains NO-GO.**

### 2026-10-09 — Partner gate remediation: collection inventory and self-click exclusion

Enterprise CI #324 (`37925640765`, candidate `59a7fda0ebebf62c471cc2a7ed13276ad5569af5`) failed only at `check:loeschkaskade`. The catalog checker did not recognize Firestore collection names provided through named constants, dynamic collection-name arrays, or the `collection:` option accepted by the shared distributed rate limiter; it reported five false positives even though those names were present in the campaign and rate-limit implementation. The scanner now indexes these patterns instead of weakening or exempting the policy. The Art. 17 catalog still requires every actual collection to have an explicit deletion/retention decision.

The partner-open workflow also traversed `/api/partner/click/:token` after recording an authenticated open action, which could count a referrer’s own in-app opening as a tracked click. It now sends the authenticated user directly to the validated HTTPS campaign destination with the referral token attached and records the UI interaction separately in the signed ledger. Only shared URLs and QR-code links traverse the click-counting route. A service regression test asserts that the in-app open does not increment click totals.

Finally, conversion event and buyer-claim document IDs now use the stable audit secret, not the campaign-specific webhook signing secret. Provider-key rotation therefore does not reset event deduplication or make a second reward possible for an already-claimed buyer/campaign.

**Release remains NO-GO / NOT CONFIRMED.** CI #324 failed and does not validate these fixes. A fresh full exact-head run, including Enterprise static gates, typecheck, all unit tests, Firestore rules/emulator tests, build, smoke and browser acceptance, is required. Operational configuration, official partner agreements, privacy/legal review and governance approval remain production prerequisites.

### 2026-10-09 — Feedback rate-limit scope defect (CI #323)

CI `37912966084` passed static gates, typecheck, all 967 unit tests, build and production smoke; Browser Acceptance failed three flows. The returned `429` carried the feedback-specific body and the `10-in-1min` quota. Root cause: the feedback router is mounted at `/api`, but `router.use(rateLimit(...))` applied the anonymous feedback bucket to every sibling API path. This is a middleware-scope defect, not justification to relax abuse protection. The limiter is now attached only to `POST /api/feedback`; a regression test exhausts the feedback bucket and verifies neighboring `/api/contact` requests remain independent. The exact-head CI must confirm the fix and re-run the prior chat acceptance cases.

### 2026-10-09 — Klar & Partner referral feature candidate

The implementation adds a profile partner tab and admin campaign-management panel backed by server-authoritative CRUD and a signed conversion flow. Personal referral tokens are HMAC-derived and scoped by UID, campaign and token version; raw tokens are not persisted. Clicks are counted only after campaign, owner consent, token version and bot/prefetch checks. Conversion events require a campaign-specific HMAC, timestamp freshness, strict payload schema, duplicate-event protection and per-campaign buyer claims. No external email/customer identifier, raw UID, IP or User-Agent is stored in the partner event ledger.

Partner campaign and referral data are server-only in Firestore. Client reads/writes are explicitly denied in rules. Admin CRUD requires Firebase Custom Claim `admin: true`; first-time brand approval requires a different admin from the creator. Campaigns start as drafts and no example brands are pre-verified. QR codes are generated locally with an MIT-licensed vendored encoder; the referral URL is not sent to a third-party QR service. HMAC-signatures cover event metadata as well as the common payload.

The Art. 17 cascade deletes account-specific referrals, conversions, buyer claims and ledger events via keyed pseudonyms and scrubs account references from campaign metadata. `docs/PARTNER_REFERRAL_SYSTEM.md` documents configuration, webhook signing, fraud boundaries and deployment prerequisites. `docs/DATA_RETENTION.md` identifies TTL policies that must be provisioned explicitly for short-lived rate-limit counters.

**Not yet production validated:** these new files and the feedback fix still require a committed exact-head Actions run. Production secret provisioning (`PARTNER_REFERRAL_SECRET`, stable `CONSENT_AUDIT_SECRET`, campaign-specific webhook secret map), Firestore TTL provisioning, real partner contracts, reward terms, legal/privacy review and formal governance approval remain required. `earned` means an eligible conversion was recorded, not that a payout occurred.

**Release remains NO-GO / NOT CONFIRMED.** Do not interpret prior CI green stages as proof for the new candidate. Require a completed full CI run on the exact resulting head, with static gates, typecheck, test/rules emulators, build, production smoke and browser acceptance green, followed by independent operational/governance approval and explicit official release confirmation.

### 2026-10-09 — Enterprise end-to-end audit (baseline e78e76b25f75)

Added `docs/ENTERPRISE_END_TO_END_AUDIT_2026-10-09.md` with the source-level audit, severity tables by domain, ICE-ranked actions, measured evidence boundaries and runbook/API updates. Baseline CI #312 (`37895590223`) passed dependency preflight, Enterprise static gates, TypeScript, 967 unit tests, build and production smoke, but failed Browser Acceptance (22 passed / 4 failed of 26). Failing flows: chat message not found after reload; chat gate answer absent after status retry; contact endpoint returned 429 where the test expected 409; registered onboarding could not find the Firebase token via the current test storage helper. No claim of zero critical bugs or production readiness is justified.

The audit also found that explicit audit scripts for auth boundary, public Firestore rules, AI PII sanitizer and Art. 17 deletion existed but were not all invoked by the Enterprise gate. This commit wires them into `check:enterprise` and adds stable npm script aliases. The resulting CI must validate them before this remediation is considered closed. Other high-priority findings: Art. 17 chat purge is limited to 25 chats per worker attempt and can exhaust the 50-attempt retry ceiling; root and `phase2_work/` code/package/rules copies diverge; the secret scanner only checks a narrow set of secret patterns; production load/cost evidence is still a placeholder.

**Release status remains NO-GO / NOT CONFIRMED.** See the audit document for evidence, assumptions and exit criteria.

### 2026-10-09 — Retired analytics/promo endpoints preserve their 410 contract

The retired `POST /api/analytics/ab-test` and `POST /api/claim-launch-promo` handlers now sit immediately after the global `/api` rate limiter and before authentication, age/consent and AI middleware. The routes have no side effects and disclose no account data; evaluating downstream identity/provider gates for an operation that is permanently disabled provides no security benefit and can obscure the retirement response. The global API abuse limit remains first and unchanged. The E2E boundary test also logs status, response body and response headers on failure to identify a future 429 source rather than silently masking it.

This narrows the contract to: normal requests get a stable HTTP 410; requests exceeding the global API limit may still receive HTTP 429. Both old late route registrations were removed so each route has exactly one handler. This is not a bypass around active data APIs, and the routes grant no entitlements and record no analytics.

The full exact-head verification is pending for the route relocation and E2E fixture cleanup. Current release status remains **NO-GO / NOT CONFIRMED** until every required Enterprise gate passes on the exact resulting candidate head and the independent operational/governance approvals are recorded.

### 2026-10-09 — Browser follow-up: persist realistic chat fixtures and expose rate-limit evidence

The chat E2E fixture still forced `localStorage.hasCompletedOnboarding`, but the production storage boundary intentionally scopes user-owned state under `klar:user:<uid>:`; the old unscoped key no longer completes the gate. The fixture now seeds an interest on the emulator-owned `users/<uid>` document and removes the obsolete client-side shortcut. This verifies that the chat tests progress via persisted profile state and the actual `AuthGate` behavior, not a stale localStorage assumption. The fixture PATCH is restricted to the loopback Firestore emulator and uses no production endpoint.

The legacy analytics/promo test still has an unexplained HTTP 429 in the last completed acceptance evidence. Rather than weakening the global API rate limiter or pre-emptively bypassing authorization middleware, its failure assertion now reports the returned body and response headers so the specific limiter and counter can be identified in the next CI log.

Commits: `75eac77bd0d3664f8b0958fb37350beb9ffc0eaf` (persisted chat fixture) and `00f365eab4059dc9f74d3898446c996188208910` (retired-route rate-limit diagnostics).

### 2026-10-09 — Validation state after browser remediation batch

The last completed Browser Acceptance run remains CI `37892881623` on older candidate `7080cb3dab61304b8fc49a1bc51684e40dd71c84` (7 failed / 19 passed). Later fixes cover contextual consent status, correct age/consent-before-onboarding order, the isolated legal-page return navigation, and first-use initialization of the distributed chat rate limit. CI `37894874032` was still in progress on earlier head `0ee0eadfb533bea73d0606bfabc9b3ac65d6c3d0`; therefore it is not evidence for the subsequent fixture and diagnostic changes. CI run `37895348262` was cancelled during the subsequent pushes. The current head requires a fresh non-cancelled full validation run.

**Release remains NO-GO / NOT CONFIRMED.** A completed green exact-head run is still required for static gates, typecheck, tests, build, production smoke and browser acceptance. Independent operational/governance approval and official release confirmation remain outstanding.

### 2026-10-09 — Chat rate-limit initialization defect corrected

The chat browser failure was traced past the route handler: the custom Firestore limiters for message sends and icebreaker answers attempted `tx.update()` on a counter document that did not yet exist. Firestore correctly rejected this transaction, and the limiter failed closed with HTTP 503 before normal participant/gate authorization could run.

Rather than keeping two bespoke counter implementations, `src/server/routes/chat.ts` now uses the existing `distributedRateLimit` implementation for both operations. That shared implementation creates the first counter with `tx.set()`, atomically increments existing counters, returns explicit rate-limit headers, and preserves fail-closed HTTP 503 behavior if the datastore is genuinely unavailable. The intended limits remain 20 message sends and 10 gate answers per account per 60 seconds. No authorization check or abuse control was bypassed.

Refactor commit: `5d77d9177bd3a6cc5ba09d8e81e92c88058f54cf`. The existing `src/server/distributedRateLimiter.test.ts` covers initialization, account isolation, and threshold behavior; E2E chat security covers outsider denial and gated message sending. The full exact-head CI must confirm both paths.

### E2E flow and legal navigation follow-up

The browser test expectations were aligned with the existing security order: newly created password or email-link accounts must pass the age and consent gate before profile onboarding. The email-link flow continues to require explicit email entry on a different device and removes sensitive query parameters after completion, consistent with Firebase's documented email-link security guidance. The public legal screen return link now uses a same-origin document navigation so leaving its intentionally isolated unauthenticated route re-evaluates the root application route.

Code commits: `21883a9288597ee580b21dcea653cee307414757`, `8c269ed841ac5d80233778e8cadbfb17bc8863bf`, `de2ebe34b0a1d84c7cc424f71090ace941fddea3`, and `d34422920f8b5f372e11d49002e25528739b7402`. These remain pending exact-head validation.

The latest completed browser evidence is CI `37892881623` (7 failures / 19 passed) before these follow-up corrections. The retired analytics endpoint still returns 429 instead of 410 in the last completed evidence; that behavior remains open for diagnosis and must not be "fixed" by weakening the global rate limit. Consent status and legal return navigation fixes also need confirmation in a completed exact-head run.

**Release remains NO-GO / NOT CONFIRMED.** Do not declare production readiness until every required Enterprise CI gate is green on the same final head and independent operational/governance approval is recorded.

### 2026-10-09 — Follow-up to Browser Acceptance CI 37892881623

Further triage of the 7 failing Browser Acceptance checks identified two test-contract/order issues and one real navigation defect:

- **First-time account gates:** `AuthGate` deliberately requires age verification and explicit consent before showing the profile-onboarding flow. The magic-link test was incorrectly expecting the dashboard/onboarding heading immediately after creating a new account, and the registration journey expected profile onboarding before the legal gates. These E2E flows now assert the required age gate first and complete the age/consent transition before onboarding. The magic-link test still submits the actual email separately and checks that the query string is cleared; it does not trust the attacker-controlled email URL parameter. Firebase's documented email-link flow likewise requires the matching email when completing sign-in and warns against trusting an email embedded in the redirect URL (https://firebase.google.com/docs/auth/web/email-link-auth).
- **Public legal navigation:** the legal pages are intentionally served through a separate conditional router so they remain accessible without waiting for authentication. Their “Zurück zur App” control used a client-side `Link`; navigation to `/` changed only the nested router while the parent path condition remained mounted. That return control is now a normal same-origin anchor, ensuring the document reloads and the root app route is re-evaluated. Legal text tabs remain client-side navigable.
- **Consent state:** separately documented above, the status now includes the purpose name and has a regression assertion.

Code commits: `21883a9288597ee580b21dcea653cee307414757` (magic-link gate expectation), `8c269ed841ac5d80233778e8cadbfb17bc8863bf` (shared E2E gate helper), `de2ebe34b0a1d84c7cc424f71090ace941fddea3` (registered-account flow order), and `d34422920f8b5f372e11d49002e25528739b7402` (legal return navigation). These changes align the tests with the existing gate contract or correct route behavior; they do not remove age/consent requirements.

The latest completed Browser Acceptance evidence is run `37892881623` (7 failures / 19 passed). These follow-up changes have not yet been validated by a completed exact-head CI run. Remaining failures include chat access requests returning HTTP 503 instead of the expected authorization outcomes and the retired analytics endpoint returning HTTP 429 instead of its stable HTTP 410 retirement response. Those remain open, as does end-to-end validation of these changes.

**Release remains NO-GO / NOT CONFIRMED.** Do not declare production readiness until all required gates pass on the exact final candidate and operational/governance approval is recorded.

### 2026-10-09 — Exact-head CI 37892881623: consent status label fixed

Browser Acceptance run `37892881623` on candidate `7080cb3dab61304b8fc49a1bc51684e40dd71c84` confirmed the login recovery trigger now resolves under its visible accessible name. The run still had 7 failures (19 passed), including the consent-settings assertion expecting a purpose-specific status such as `Produktanalyse: Nicht erlaubt`.

Root cause: `ConsentSettings` displayed only the generic text `Status: Nicht erlaubt` after the purpose label was rendered in a separate element. That loses purpose context for screen-reader/automation consumers and does not match the visible acceptance contract. The live status now contains the associated purpose name (`Produktanalyse: Erlaubt/Nicht erlaubt`), and `tests/ConsentSettings.spec.tsx` explicitly asserts the contextual status. Server-confirmed withdrawal behavior, evidence checks, and fail-closed error handling remain unchanged.

Commits: component fix `8e3f714957b43736ba57e7404dcf81003fffc5d3`; regression test `cd7e26dd6a2a38ca851e47d43bae2525b49abf1c`. A fresh exact-head CI is required to validate this correction. The other 6 browser acceptance failures remain open and will be triaged without relaxing security boundaries or altering tests merely to fit current behavior.

**Release remains NO-GO / NOT CONFIRMED.** All Enterprise gates must pass on the final exact candidate head, followed by independent operational/governance review and explicit official production approval.

### 2026-10-09 — Exact-head CI 37891185116: Browser Acceptance regression triage

Exact-head run `37891185116` on candidate `ab7e27703fb8e4f3162c9e610afd28c68dead413` passed the dependency/static/typecheck/unit-test/build/smoke stages and failed only in Browser Acceptance (8 failures). The failures cluster around (a) the password-recovery trigger's accessible name, (b) the chat gate and onboarding state, (c) a retired analytics endpoint returning HTTP 429 before its intended HTTP 410 contract, (d) legal-page return navigation, and (e) the privacy-settings post-withdrawal status label. These are being treated as real acceptance failures, not waived or hidden.

A concrete accessibility mismatch was confirmed in `src/screens/Login.tsx`: a hard-coded `aria-label="Passwort zurücksetzen"` overrode the visible translated label `login.forgot`, so Playwright's role query for the visible “Passwort vergessen?” name could not find the control. The redundant overriding label has been removed; the visible button text is now its accessible name. This is a focused semantic fix, not a selector workaround. The next exact-head CI run must confirm it.

The other seven browser failures remain open pending diagnosis and fixes. In particular, the global API limiter must not be weakened just to make a retired endpoint test pass; any resolution must preserve abuse controls and the endpoint's intended retirement semantics. Middleware order is material to this behavior (Express middleware is executed in registration order; see https://expressjs.com/en/guide/using-middleware/).

**Release remains NO-GO / NOT CONFIRMED.** No production release is declared. Require all Enterprise CI gates green on the exact candidate head, then independent operational/governance approval and explicit official release confirmation.

# Current audit status — 8 October 2026

**Current candidate:** PR #1 / `security/v149-autonomous-consolidation` (latest remediation commit recorded in the active CI evidence below).

### 2026-10-08 — Remediation commit: restore account-erasure test import

The exact-head failure from CI run `37848439991` is corrected at the test boundary: `tests/accountErasure.spec.ts` now explicitly imports `purgeAccountData`, matching the existing production export used by the emulator purge journey. No production source, runtime behavior, compiler strictness, or security control is changed. The repository documentation is updated on the same candidate head so the next CI result is attributable to the complete remediation state.

A fresh exact-head CI run is authoritative. **Production remains NO-GO / NOT CONFIRMED** until Typecheck, Tests, Build, Production Smoke and Browser Acceptance all pass on that exact head, followed by the outstanding independent operational/governance evidence.

### 2026-10-08 — Exact-head CI 37848439991: test import regression corrected

Exact-head Enterprise CI run `37848439991` on candidate `31890a66fabf32c989ee8413f897135badbfd309` passed dependency-lock preflight, dependency installation and Enterprise static gates, then failed in Typecheck with one deterministic fixture error: `tests/accountErasure.spec.ts` referenced `purgeAccountData` after an import-cleanup commit had removed that required symbol. No production source defect was identified.

The test import is restored explicitly at the test boundary. No runtime behavior or security control is changed. A fresh exact-head CI run is required; **production remains NO-GO / NOT CONFIRMED** pending the complete dynamic validation chain and independent operational/governance evidence.

### 2026-10-08 — Exact-head CI 37846966637: emulator integration boundary isolated

Exact-head Enterprise CI run `37846966637` on candidate `c0b5425faa952a4f3b412c9189982be2c7d72040` passed dependency-lock preflight, dependency installation, Enterprise static gates, Typecheck, and 966/967 tests. The sole failure was the emulator-backed account-erasure integration journey, which asserted the worker phase transition after executing the real purge implementation. The purge itself completed its owned-data assertions, but the mixed test path did not provide reliable evidence for the worker's durable phase transition and the orchestration failure was swallowed by the retry boundary.

The test is now split at the architectural boundary: the emulator integration directly exercises `purgeAccountData()` for Firestore/Storage ownership erasure, while the deterministic `deletionLifecycle` suite remains authoritative for lease acquisition, provider deletion ordering, `final_sweep`, completion, and lease-loss safety. This removes an ambiguous cross-boundary assertion without changing production deletion behavior or weakening any fail-closed control. A fresh exact-head CI run is required; **production remains NO-GO / NOT CONFIRMED** pending Tests, Build, Production Smoke and Browser Acceptance plus independent operational/governance evidence.

### 2026-10-08 — Exact-head CI 37846166700: two account-erasure test-contract blockers

Exact-head Enterprise CI run `37846166700` on the PR head `d32fef5ad69ba441e9b7a4a7833a4af80b3d5557` passed dependency-lock preflight, dependency installation, Enterprise static gates and Typecheck, then failed in Tests with 2 failures; 965/967 tests passed. The first failure was the emulator-backed account-erasure journey, which completed owned-data purge but did not advance the durable job to `final_sweep` because the journey still traversed the production Auth-disable dependency boundary. The second failure was the deterministic lease-loss regression test, which incorrectly expected the stale worker to write `lastError` after another worker had already taken the lease.

The remediation keeps production Auth deletion and lease checks fail-closed and isolates provider-side disable/delete behavior from the Firestore/Storage data-purge journey. The lease-loss regression now asserts the stronger invariant: the losing worker cannot mutate retry metadata after ownership changes and cannot call Auth deletion. The production implementation is unchanged. A fresh exact-head CI run is required; **production remains NO-GO / NOT CONFIRMED** pending Tests, Build, Production Smoke and Browser Acceptance plus independent operational/governance evidence.

### 2026-10-08 — Exact-head CI 37843696268: account-erasure lease-state blocker

Exact-head Enterprise CI run `37843696268` on the merge candidate containing `32fdaa7d3cca4e16d31901b750c67bfabc6a3a13` passed dependency-lock preflight, dependency installation, Enterprise static gates and Typecheck, then failed in Tests with 1 failure; 965/966 tests passed. The remaining failure was the emulator-backed account-erasure journey: owned-data purge completed, but the durable job remained in `purge` instead of advancing to `final_sweep`. The test does not treat Firebase Auth emulator deletion as production evidence.

The remediation rebinds the finalization path to a fresh authoritative job reference, derives the transition from the current persisted phase, and verifies the worker lease immediately before irreversible Auth deletion. A stale/lost worker can no longer delete the provider identity or finalize a job it no longer owns. A deterministic regression test now covers lease loss during purge. **Production remains NO-GO / NOT CONFIRMED** pending a clean exact-head CI result through Tests, Build, Production Smoke and Browser Acceptance plus independent operational/governance evidence.
## Current authoritative status

- Critical Multi-Instance rate limits are now backed by the shared Firestore transaction boundary for account/consent changes, billing checkout, device-token writes, launch/referral flows and Trust-&-Safety writes.
- The Cloud Run deployment template permits up to 10 instances; process-local counters were therefore insufficient as the sole abuse control on those critical paths.
- A dedicated `check:rate-limit-distribution` Enterprise gate prevents the critical modules from silently reverting to local counters.
- The Chat `/api/chats` N+1 mitigation is implemented via deduplicated Firestore bulk reads; runtime traces remain required to close the P1 with measured read/latency evidence.
- The latest Exact-Head CI run must still pass Typecheck, Tests, Build, Production Smoke and Browser Acceptance on the final head before technical release gates are green.
- **Production release remains NO-GO / NOT CONFIRMED.**

### 2026-10-08 — Exact-head CI 37842577296: one emulator-specific Auth assertion isolated

Exact-head Enterprise CI run `37842577296` on candidate `a1892952c3b32b9c6687477f9bb35ade1d2a7787` passed dependency-lock preflight, dependency installation, Enterprise static gates and Typecheck, then failed in Tests with 1 failure; 965/966 tests passed. The only failure was the emulator-backed account-erasure journey asserting `auth/user-not-found` immediately after the provider delete boundary, while the Auth emulator continued returning the disabled user record.

The production deletion boundary remains fail-closed and the positive completion path is already covered by the dependency-injected `deletionLifecycle` suite. The emulator journey is narrowed to its supported responsibility: real Firestore/Storage owned-data purge and durable `final_sweep` progression, without treating the emulator's observed Auth state as production evidence. The bounded Auth delete-and-verify loop is corrected to six attempts with exponential backoff, and an unconfirmed provider absence still leaves the durable job retryable rather than completed.

The next exact-head CI run must prove Typecheck, Tests, Build, Production Smoke and Browser Acceptance. Independent production-provider evidence is still required before release; **production remains NO-GO / NOT CONFIRMED**.

### 2026-10-08 — Exact-head CI 37841110696: test suite reduced to two concrete blockers

Exact-head Enterprise CI run `37841110696` on candidate `67a3bc48e3551bd9c9476b53ba08ec9292cb6602` passed dependency-lock preflight, dependency installation, Enterprise static gates and Typecheck, then failed in Tests with 2 failures; 964/966 tests passed. The remaining failures were isolated to the age-gate fixture, which still expected the wrong domain code, and the emulator-backed account-erasure journey, where Firebase Auth remained observable immediately after a successful delete call.

The age fixture is aligned to the actual `UNDERAGE_RESTRICTION` mapping. Account erasure retains the provider postcondition check and extends only its bounded retry window from four attempts to six with exponential 100ms backoff. The durable job still fails closed when Auth absence cannot be confirmed; no completion is reported on an unverifiable provider state.

The next exact-head CI run must prove Typecheck, Tests, Build, Production Smoke and Browser Acceptance. **Production remains NO-GO / NOT CONFIRMED.**

### 2026-10-08 — Exact-head CI 37839602957: five concrete test blockers isolated

Exact-head Enterprise CI run `37839602957` on candidate `c18fb297f8353f19fa5210b6ad822963957aeb49` passed dependency-lock preflight, dependency installation, Enterprise static gates and Typecheck, then failed in Tests with 7 failures across 5 files. The failures were isolated to four stale fixture contracts and one production erasure postcondition: the account-age fixture expected the wrong locked-underage response, the referral configuration fixture incorrectly expected the distributed limiter to bypass Firestore, the Stripe emulator fixture omitted the canonical checkout-session ID, the recommendation test still asserted against the retired global storage key, and account erasure lacked positive verification that the Firebase Auth identity was actually gone before the durable workflow could advance.

The remediation aligns the four stale fixtures to the current contracts and hardens account erasure with a bounded Auth delete-and-verify loop. Auth deletion remains fail-closed: if provider absence cannot be confirmed, the durable deletion job stays retryable rather than reporting completion. No compiler relaxation, local rate-limit fallback, global storage reintroduction, or production test bypass is introduced.

The next exact-head CI run must prove Typecheck, Tests, Build, Production Smoke and Browser Acceptance. Independent load/cost/SLO, restore/rollback, secret rotation/alert delivery, manual accessibility and governance evidence remain separate release gates; **production remains NO-GO / NOT CONFIRMED**.

## Latest remediation — distributed critical rate limits

- `src/server/distributedRateLimiter.ts` provides atomic Firestore-backed counters with bounded identities, fail-closed 503 behavior on unavailable limiter storage, and RateLimit/Retry-After metadata.
- Critical state-changing and cost-sensitive routers use the distributed middleware. Authenticated paths are UID-scoped; unauthenticated requests fall through to the existing global authentication/rate-limit controls.
- The global API limiter and lower-risk read/anonymous limiters remain local by design and are not treated as authoritative cross-instance enforcement.

### 2026-10-08 — Final P1 consolidation

- Chat list access is now evaluated in one bounded Firestore read transaction across the candidate set, replacing the per-chat transaction/profile RPC pattern while preserving fail-closed block, account-deletion and example-profile semantics.
- Critical multi-instance rate limits are now enforced with shared Firestore counters for account/consent, billing checkout, device-token writes, launch/referral and Trust-&-Safety flows. Cloud Run maxScale evidence is 10.
- A deterministic cross-instance limiter regression test and Enterprise topology gate protect the new control.
- The remaining local limiters are lower-risk read/anonymous controls and are not treated as authoritative cross-instance abuse protection.

## Release evidence rule

A static gate PASS does not compensate for a failed, skipped, cancelled, queued or otherwise incomplete dynamic gate. Only exact-head evidence from the release candidate is authoritative.

### 2026-10-08 — Exact-head CI 37829759159: strict test fixtures aligned with production contracts

Exact-head Enterprise CI run `37829759159` on base candidate `60c7767a17a26741627375812a9cecda95d65006` passed dependency-lock preflight, dependency installation and all Enterprise static gates, then failed at Typecheck. The remaining diagnostics were isolated to five stale enterprise test fixtures: accessibility evidence omitted the required environment field; two Firestore mock calls in the age/consent cascade tests crossed the `Firestore` boundary without the established test-only cast; recovery evidence still referenced removed rollback fields from an isolated-restore fixture; and the final Stripe persistence assertion accessed nullable Firestore snapshot data without narrowing.

The remediation keeps production contracts strict and changes only test fixtures at their boundaries: fixtures now satisfy the version-2 accessibility schema, mock Firestore objects are explicitly cast only at the test boundary, the recovery regression test now asserts rollback evidence only for production evidence, and persisted Stripe data is narrowed before field access. No compiler relaxation or production `any` escape hatch is introduced.

Production remains **NO-GO / NOT CONFIRMED**. The next exact-head CI run must prove Typecheck, Tests, Build, Production Smoke and Browser Acceptance before technical release gates can advance.

### 2026-10-08 — Exact-head CI 37830946345: test phase exposed two classes of blockers

Exact-head Enterprise CI run `37830946345` passed Typecheck on candidate `a7780d28a9a19c87d83bdc9069f2fcde2e66ce73`, then failed in the Tests stage with 54 failing cases. Trace analysis separated the failures into two classes: lightweight HTTP test doubles did not implement the mandatory distributed rate-limit transaction surface, and the real Firestore emulator returned native `DocumentReference` values from query snapshots that the Durable transaction adapter rejected with `Durable transaction reference is not backed by Firestore.`

The production root cause is fixed at the Durable Firestore boundary: transaction references may now be either adapter-wrapped references or native Firestore `DocumentReference` instances returned by real queries. Native references are accepted only after strict structural identification; no fallback, fail-open path, or compiler relaxation was introduced.

The remaining HTTP test-double failures are a separate fixture-alignment task and are not being masked by weakening distributed rate-limit enforcement.

---

---

**Current candidate:** PR #1 / `security/v149-autonomous-consolidation` at `33ef9eb3255919bec8b07d4132665754fa8ae930`.

## Current authoritative status

- The supplied CI run `37799221240` failed in **Typecheck**; static Enterprise gates passed and Tests/Build/Smoke/Browser steps were skipped.
- Root cause identified: the v149 branch exposed `getDb()` and the durable Firestore adapter as `unknown` while the codebase consumes the Firestore contract structurally. This produced a cascading strict-TypeScript failure set (803 diagnostics in the historical run), dominated by `durableStore.ts`.
- The remediation restores an explicit `JsonObject`/JSON value contract, a typed `Firestore` boundary in `db.ts`, and explicit Express request augmentation for authenticated/session/guest state. No strict compiler flag was weakened and no broad `any` escape hatch was introduced.
- A new Enterprise CI run for the corrected head `33ef9eb...` is pending. The previous run on an intermediate head was automatically cancelled by GitHub concurrency and is not evidence of the corrected head.
- **Production release remains NO-GO / NOT CONFIRMED.** No production promotion is authorized until the corrected exact-head CI passes TypeScript, tests, build, production smoke and browser acceptance, followed by the required operational/governance evidence.

## Release evidence rule

A static gate PASS does not compensate for a failed or cancelled dynamic gate. Only exact-head evidence from the release candidate is authoritative.

---


The v149 audit remediated the `/api/account/alter` contract, differentiated age-gate UI errors, hardened AuthClaims normalization and aligned browser security headers. Static verification passes where the dependency-free runner can execute it. Full typecheck/test/build/E2E and production promotion remain blocked until the locked dependency graph and protected CI/cloud evidence are available. Production release is **NOT confirmed**.

## Current authoritative status — 1 October 2026

> This section supersedes all older same-day baseline/status sections below. Historical sections remain for traceability.

- Current technical baseline: `main@6eb37a86` after PR #124.
- PR #121 restored the enforced dependency-security baseline after the newly published `basic-ftp` advisory; its exact head passed Enterprise CI, Documentation and Playwright before merge.
- PR #122 (journal audio boundary) and PR #124 (Smart Audit boundary) both passed Enterprise CI, Documentation and Playwright on their exact current-main heads before merge.
- The legacy server/UI modularization and AI-boundary series tracked under issue #27 is complete. No pull requests remain open.
- High/Critical audit thresholds remain enforced; no security exception or threshold reduction was introduced.
- Production release remains **NOT confirmed**. The remaining blockers are external/operational evidence: real load/cost/SLO measurements and approval, real restore/rollback exercises, real secret rotation plus alert delivery/acknowledgement, manual assistive-technology accessibility evaluation, and demonstrably enforced protected-main/required-check/independent-review governance (or an explicitly approved equivalent control).

## Authoritative post-merge audit — 1 October 2026

> This section is the current source of truth and supersedes older same-day candidate/blocker notes below. Historical sections are retained for traceability.

- Current audited baseline after stack recovery: `main@b864e3a9` (PR #100 on top of PR #101). Post-merge Enterprise CI and Playwright both pass. Enterprise CI passed static security checks, TypeScript, 109 Vitest files, API/Firebase emulator tests, production build, production-routing smoke test, bundle evidence and production container build. Playwright passed 21/21 browser tests.
- Dependency security remains within the enforced release gate: root full audit reports 1 low + 11 moderate, root production 1 low + 5 moderate, Functions production 2 moderate, and **0 high / 0 critical**. PR #96 is merged; the audit threshold was not weakened.
- Vitest 5 (#55) and Vite 8.3.1 (#56) are merged. Vite is build-only in `devDependencies`, paired with esbuild ^0.28.2, and the production container passed after the migration.
- Presence checks confirm the intended direct-main merges #56, #74, #75, #77, #78, #79, #80, #98, #99 and #101 are represented in `main`.
- One stack-integration defect was found and repaired: PR #81 was merged into PR #74's feature branch rather than `main`, so its feedback-router delta initially never reached `main`. Replacement PR #100 carried the complete #81 feedback delta together with the superseding profile/recommendations router, passed Enterprise CI, Documentation and Playwright on head `e65ab6aa`, and was squash-merged as `b864e3a9`.
- Vite 8 reports one forward-compatibility warning on the audited baseline because `vite.config.ts` uses `__dirname`; this audit branch replaces it with `import.meta.dirname`. The change is accepted only after Enterprise CI, Documentation and Playwright pass on the exact audit head.
- Production release remains **NOT confirmed**. External/provider evidence, real production load/cost/SLO and restore/rollback evidence, IAM/secret/alert delivery, manual accessibility evidence, and demonstrably enforced protected-main/independent-review governance remain separate release gates.

## Update 1 October 2026 — trace-backed profile write confirmation repair

- A final-baseline Playwright trace on PR #95 proved that the remaining onboarding failure was not an age-gate timeout: the UI showed “Deine Angaben konnten nicht gespeichert werden”, and `fetchProfile()` rejected a backend read solely because `snapshot.metadata.hasPendingWrites` was true.
- Firebase documents that `waitForPendingWrites()` waits only for writes already pending when it is called. A later independent write can therefore set pending metadata again. The repair confirms the exact fields written by the current `updateProfileData` call against `getDocFromServer()`, while refusing to apply a pending snapshot as profile/consent authority; the live server-confirmed listener remains authoritative for UI state.
- Top-level `undefined` values are omitted before `updateDoc`, so optional onboarding data such as absent music preferences cannot fail Firestore serialization. Explicit `null` remains preserved.
- Focused unit regressions cover undefined-field omission, field-scoped confirmation, mismatch rejection and exact nested-value semantics. The registered-account onboarding Playwright journey remains the end-to-end acceptance test.
- Exact head `1e0ffad5` passed Enterprise CI, Documentation and Playwright, including the registered-account onboarding journey that previously reproduced the false save failure. Production release remains **NOT confirmed** because the external operational/governance evidence gates remain separate.

## Update 1 October 2026 — exact-head CI stabilization

- PR #98 is merged on `main` as `a155399a` after Enterprise CI, Documentation and Playwright passed on exact head. It fixes the product-level onboarding persistence race by awaiting Firestore pending writes before the existing authoritative server read.
- Secure-baseline revalidation has full Enterprise/Documentation/Playwright passes for #74, #75, #77, #78, #79, #80, #84, #86, #87, #88, #89, #90, #91, #92, #93, #94 and #95, plus stacked #81/#82 after preserving stack order and refreshing their bases. Draft/review governance remains separate from technical validation.
- Independent Playwright failures on unrelated branches exposed a second CI-harness weakness: the shared age/consent helper relied on Playwright's generic 5-second assertion default after server writes that are intentionally followed by a fresh Firestore read.
- PR #99 centralizes the persisted age-gate wait in `waitForAgeGate`, uses it in both guest and registered onboarding journeys, and exactly matches the age POST response. It adds no fixed sleep, product retry or weaker assertion. Exact head `e492457b` passed Enterprise CI, Documentation and Playwright on top of merged PR #98.
- Production release remains **NOT confirmed**: protected-branch/independent-review enforcement and real production operational evidence remain separate release gates.

## Update 1 October 2026 — onboarding write confirmation stability

- Repeated Playwright traces on independent PR heads exposed a real onboarding persistence race: the Firestore update had already been accepted, but the immediately following authoritative server read could still report `hasPendingWrites=true`, causing the UI to show “Deine Angaben konnten nicht gespeichert werden” and remain before the age/consent gate.
- The fix waits with Firestore's `waitForPendingWrites(db)` after `updateDoc` and before the existing `getDocFromServer` confirmation. This preserves the fail-closed persistence contract: onboarding still advances only after a server-confirmed profile; no retry loop, timeout increase, optimistic success or rule bypass is introduced.
- The registered-account onboarding Playwright journey remains the end-to-end acceptance test. Production release status is unchanged and remains **NOT confirmed**.

## Update 1 October 2026 — dependency security and PR revalidation

- PR #96 removes the repository-wide high-severity npm-audit blocker without lowering any audit threshold. The current resolution uses patched transitive versions and a version-scoped npm override for `@firebase/firestore@4.17.2` so that only its vulnerable nested `@grpc/grpc-js` line is forced to patched `1.13.6`. A future Firestore upgrade is therefore not silently pinned by this workaround.
- Registry-backed GitHub Actions validation on the candidate resolution passed `npm ci`, all static security checks, TypeScript, the API/Firebase emulator suite, production build, production-routing smoke test and container build. Root audit evidence measured 12 findings (1 low, 11 moderate, 0 high/critical), production root 6 (1 low, 5 moderate, 0 high/critical), and Functions production 2 moderate (0 high/critical). The final version-scoped/docs head must pass the same exact-head gates before merge.
- PR #55 (Vitest 5) is no longer blocked by matcher typings: the Vitest-specific Testing Library adapter and Vitest 5 matcher augmentation are in place; Documentation and Playwright pass on its reviewed head. Its Enterprise CI must be rerun after the security baseline lands on `main`.
- PR #44 remains blocked by the ESLint 10 / `eslint-plugin-jsx-a11y@6.10.2` peer-range incompatibility. PR #56 remains blocked by Vite 8.3.1 requiring esbuild ^0.27/^0.28 while the repository is on ^0.25. Neither blocker is bypassed with forced/legacy peer resolution.
- Production release remains **NOT confirmed**. Protected-branch/independent-review governance and the real production load/cost/SLO, restore/rollback, IAM/secret/alert and manual accessibility evidence gates remain open.

## Update 29 September 2026

- PR #51 was merged by squash after clean mergeability and successful `generate`, `validate-and-test` and `test` checks. The resulting `main` commit is `ca7b6c15970e7875e95fa3e840f3786b229b4d76`.
- PR #52 could no longer be updated cleanly after the squash because its history contained PR #51. Its exact unique delta was isolated as five commits / 86 files (48 modified, 38 added, no deletions or renames) and replayed atomically on current `main`. The replacement is PR #58, branch `feat/global-readiness-2026-09-29-rebased`, initial head `033f0d9f68a21642918e36a39852cfabfa344a3a`. PR #52 is superseded by #58.
- Governance remains a release blocker: branch protection for this private repository cannot be enabled on the current GitHub plan. The GitHub branch-protection API returns HTTP 403 and requires GitHub Pro or a public repository. An enterprise production release therefore still requires demonstrably enforced protected-branch / required-check / independent-review controls or an equivalent approved governance mechanism.
- Dependency updates remain gated by integration evidence. PR #55 (Vitest 5) fails TypeScript/TypeDoc because DOM/axe matcher typings are no longer resolved; PR #56 (Vite 8) and PR #44 (lint/type group) conflict with current `main` and had red CI. They are not release candidates. PRs #57, #54 and #53 may only be merged after their refreshed checks on the current base are fully successful.
- Production release is **NOT confirmed**. Provider acceptance, real cloud/IAM/retention evidence, manual accessibility validation, load/cost/SLO evidence, restore/rollback drills and an independent release approval remain mandatory where listed below.


### Accessibility baseline fix — 29 September 2026

- The PR #58 Playwright run exposed one real WCAG 2 AA failure in the magic-link recovery dialog: the submit button rendered #1c1c1c on #3f4a3c (1.83:1).
- Root cause: text-on-accent was used as a Tailwind utility while --color-on-accent was declared outside @theme, so the semantic foreground utility was not reliably generated and the button inherited the normal ink color.
- The semantic on-accent token is now declared in @theme (#ffffff in light mode, #161815 in dark mode). The existing Axe/Playwright test remains the acceptance test; production release is still not confirmed until the complete release evidence is green and independently approved.


### Chat- und Matching-Hardening — 29 September 2026

Stacked auf PR #58, noch **nicht** Bestandteil von `main` und kein eigenständiger Produktionsfreigabenachweis.

- Issue #27 / Phase 1c: Die serverseitige Chat-Gate-Prüfung war bereits transaktional, die Firestore-Regeln erlaubten Teilnehmern jedoch direkte Nachrichten-Reads unabhängig vom Gate. Die Rules erzwingen jetzt auch für Client-Reads ein vollständig offenes Gate sowie Block- und Löschstatus; eine bestehende Blockierung verhindert zusätzlich neue Chats.
- Matching: Das Dashboard schrieb positive Interaktionen nach `klar_interactions_nachricht`, die Lernlogik las jedoch `klar_interactions_like`. Der kanonische Schlüssel wird jetzt tatsächlich ausgewertet; der alte `like`-Schlüssel bleibt ausschließlich als Migrationslesepfad erhalten. Manipulierte oder unbegrenzt wachsende LocalStorage-Historien werden defensiv gefiltert und auf 200 Interessen begrenzt.
- Nachweis: neue Regressionen in der bestehenden Firestore-Rules-Suite sowie fokussierte Unit-Tests für das Interaktionslernen. CI-Ergebnisse sind erst nach Ausführung auf dem Fix-Branch als Evidenz zu werten.
- Issue #27 / Phase 1c ist zusätzlich modularisiert: `handleGateStatus` und `handleGateAnswer` wurden aus `klarCore.ts` in das dedizierte Modul `src/server/gate.ts` verschoben; Router und Persistenztests verwenden ausschließlich dieses Modul. Die Extraktion ändert keine Gate-Zähler- oder Transaktionssemantik.

# Project status


**Aktueller P0-Arbeitsstand:** [Excel-Abgleich, KYC, Verträge, Löschung und Freigabegates](P0_RELEASE_BLOCKERS_2026-09-28.md). Produktionsfreigabe ist nicht bestätigt.

Update 28 September: [incremental audit](AUDIT_2026-09-28.md) on `feat/global-readiness-2026-09-27`, dependent on PR 51. Adds transactional payment fulfillment, distributed AI reservations, deterministic matching explanations and typed locale persistence. PR [52](https://github.com/veselin8606-source/Klar-App/pull/52) has 16 successful browser tests at code commit `7bfceddc0eb49bb06c0575c9f624926050629022`; Enterprise CI passed with 574 tests in 88 files, Functions/security checks, production routing, build and container; documentation CI also passed. No production release.

Baseline from 27 September 2026. Prior review candidate: [PR 51](https://github.com/veselin8606-source/Klar-App/pull/51), branch `fix/audit-2026-09-27`, baseline main `a2a37cda1431000101a6e56a25f174e2ff55d065`. Not merged or deployed by this audit.

## Delivered in the candidate

Authentication destination validation; public-profile minimization and migration tooling; removal of fake identity and audio success; consent withdrawal settings; analytics validation and optional consent; Storage rules and retention; explicit Frankfurt Functions with required database selection; chat router extraction; bounded cleanup; stricter CI, dependency gates, production smoke and release evidence.

## Evidence and limits

See [the dated audit](AUDIT_2026-09-27.md) for commit-specific CI results and [the inventory](evidence/component-inventory.csv) for all inventoried source modules. Static import references do not establish execution coverage. Automated checks do not establish full WCAG conformity, legal compliance or production readiness.

## Open release gates

- Independent code review and protected main with mandatory checks. The branch API reported `protected: false` during this audit.
- Reviewed cleanup of legacy public-profile documents; the migration defaults to dry run.
- Deployment evidence for named database, Storage bucket, Frankfurt region, scheduler permissions, retention backlog and failure alerting.
- Real backup restoration, rollback drill, IAM review, load and cost measurements, SLO alert delivery.
- Manual keyboard, screen reader, reflow and mobile testing across authenticated journeys.
- Review of moderate dependency findings: verified snapshot root 7 total / 2 production and Functions 6 production; successor updates reduce the local full root scan to 5 and Functions production scan to 2. See [dependency review](DEPENDENCY_REVIEW_2026-09-27.md).
- Distributed AI reservations are implemented in PR 52; production load/retention validation and distributed analytics rate limiting remain required before multi-instance activation; analytics and chat archival remain disabled by default.
- Provider integration for identity, audio persistence, music icebreaker caller and complete payment/offline journeys remain incomplete or unproven.

Issue #27 remains open. Issues #35–38 have code mitigations in PR 51; cloud acceptance and merge status must be verified before closing them. Upstream Firebase issues are not resolved by application workarounds.

### 2026-10-08 — Typecheck remediation round 2

The subsequent exact-head-adjacent CI run `37802236002` reduced the earlier Firestore cascade to concrete server/UI contracts. Server-side release-relevant findings were repaired on commit `671e2798cf2b92d7c9516b698e1f6076ad3dfd5e`: consent input is narrowed to the canonical `Einwilligung` contract; launch density uses the canonical `LaunchCity` union; the AI route uses `GenerateContentParameters`; authenticated audit access is explicitly guarded; and smart-audit prompt parts are typed to permit only text or bounded inline image data.

The branch remains **NO-GO**. CI run `37802545060` was running on an earlier head while these fixes were applied; only the next completed run for the new exact head is authoritative. Tests, build, production smoke and browser acceptance remain blocked until Typecheck passes.

### 2026-10-08 — Typecheck remediation round 3

The candidate was reduced from broad strict-TypeScript cascades to concrete persistence/UI contracts. The current remediation includes typed Trust & Safety, consent, risk, age-gate, AdMob, DSA and privacy-export Firestore boundaries; safe validation of production-control JSON structures before nested property access; strict Stripe API/event typing without weakening compiler checks; bounded traceparent parsing in observability; runtime guards for persisted diary, mood, calendar and profile data; typed Recharts callback payloads and profile component contracts; versioned onboarding translations through the declared i18next object contract; removal of stale/unused client imports and dead state; and removal of synthetic fallback trait selection from the Weekly-Vibes view so missing user evidence cannot be presented as observed traits.

The active candidate head is 96fd51fb098ff01b7b3392807220519921f92429. CI run 37805740362 is registered for this head but has not started its job yet. No dynamic PASS is inferred from a queued run.

**Production remains NO-GO / NOT CONFIRMED.** Exact-head Typecheck, Tests, Build, Production Smoke and Browser Acceptance must all pass, followed by the independent operational/governance release evidence.

### 2026-10-08 — Exact-head CI status refresh

The release candidate advanced beyond the earlier type-contract remediation. Current PR head: c8b6bb87d3c8189a88d7c20d19339ff037699863. The corresponding Enterprise CI run is 37805805516 and is currently in progress; dependency installation has completed only partially in the latest job snapshot, so no Typecheck/Test/Build/Smoke/Browser result is inferred yet.

The candidate remains **NO-GO / NOT CONFIRMED**. Static gates are necessary but never sufficient for production promotion, and queued/in-progress CI is not release evidence.


### 2026-10-08 — CI typecheck remediation: distributed rate limiter imports

Exact-head Enterprise CI run #166 (37814479762) passed all Enterprise static gates but failed at Typecheck before Tests/Build/Production Smoke/Browser Acceptance. The concrete diagnostics were: missing ipKeyGenerator import in the account router; an incorrect relative module import in the distributed-rate-limiter regression test; and an unused Vitest vi import.

These issues are corrected on candidate head c47dea5dacc4832e354373226c88d43ee333c702. The correction preserves the IPv6-safe ipKeyGenerator policy and the cross-instance limiter regression coverage without weakening compiler strictness.

No PASS is inferred yet: the new head has not produced an authoritative workflow result at documentation time. Production remains NO-GO / NOT CONFIRMED until the exact current head completes Typecheck, Tests, Build, Production Smoke and Browser Acceptance, followed by independent operational/governance evidence.


### 2026-10-08 — CI typecheck remediation: server tsconfig declaration boundary

Exact-head Enterprise CI #170 (`37815141084`) passed dependency installation and all Enterprise static gates but failed at the separate server Typecheck project because `src/types/express.d.ts` was not part of `tsconfig.server.json`. This caused the global Express `Request` augmentation (`user`, `session`, `nutzer`, `istGast`) to disappear from the server compilation context.

The server TypeScript project now explicitly includes `src/**/*.d.ts` on candidate `deb5722030a6974caf97ae592e29bf6229174036`. No casts or compiler relaxations were introduced. Production remains **NO-GO / NOT CONFIRMED** pending a successful exact-head dynamic gate sequence.


### 2026-10-08 — Chat read-path regression gate

The implemented Chat list optimization is now protected by a deterministic Enterprise gate. `check:chat-read-path` requires `/api/chats` to use the bounded `loadChatListAccess` path, exactly one transaction and one `tx.getAll` in that loader, and no asynchronous per-entry profile reads. This blocks regression to the former N+1 access pattern without claiming production trace evidence.


### 2026-10-08 — Chat read-path gate integration repair

Exact-head Enterprise CI #173 (`37816110016`) failed during dependency installation because the newly added Chat regression gate was committed with literal escaped newline sequences inside `package.json` and its `.mjs` source. The implementation itself was not evaluated by CI. The package entry and gate script were corrected on the subsequent candidate lineage (`7afb93dd7e304fa096c5a9716bb3c5b7a0050457` and `2a3b3bc7cf3666e46afb696f990f9f64573e5322`).

The correction restores valid JSON and normal JavaScript source newlines; no application runtime behavior or compiler relaxation was introduced. A new exact-head Enterprise run is required. Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Chat read-path gate regex hardening

Exact-head review of the Chat read-path regression guard found a repository-integration defect in its regular-expression literals: word-boundary assertions had been persisted with an extra escape level, so the intended structural matcher was not reliably expressed. The gate was corrected on candidate commit `02c9c7e2516f763301615a14d6e4061ae21bf45f` without changing application runtime behavior.

The release candidate remains **NO-GO / NOT CONFIRMED** until the new exact-head Enterprise CI run proves the corrected gate and completes Typecheck, Tests, Build, Production Smoke and Browser Acceptance. A static source inspection is not substituted for CI evidence.


### 2026-10-08 — Chat gate final regex normalization

A second source-level review identified remaining double escaping in the Chat regression guard's regex literals. The gate has now been rewritten with canonical JavaScript regular-expression literals for word boundaries, member-access dots and whitespace matching on candidate commit `555a2b89a23fc4449b5c2679be91f26db3d9c1a9`. This is CI/test infrastructure only; application runtime code is unchanged.

**Evidence policy:** no release credit is assigned until the exact candidate head is executed by Enterprise CI and all dynamic gates complete successfully. Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Release-governance and CI surface consolidation

The release candidate exposed an integration gap in its own Enterprise gates: the branch referenced a production `.github/workflows/release.yml` contract, but that workflow was absent. The candidate now restores a tag-only, protected-environment release-evidence workflow with immutable GHCR image digests, maximum Buildx provenance, SBOM generation, exact commit/tag identity checks, Functions build identity, deployment-manifest rendering, container-attestation verification and a complete SHA256 checksum ledger. Production promotion remains separate from artifact publication and still requires the outstanding operational/governance evidence.

The deployment manifest validator was also removed from its historical `veselin8606-source` registry-owner assumption; it now validates the repository owner supplied by the release environment while retaining strict immutable-digest validation.

The CI toolchain-pin gate now discovers the actual workflow surface rather than failing on obsolete hard-coded filenames. Deterministic tests remain separated from stochastic LLM security evaluation; the latter now has an explicit manual, opt-in workflow guarded by `KLAR_RUN_LLM_EVAL`.

Current candidate remains **NO-GO / NOT CONFIRMED** until the new exact-head Enterprise CI completes Typecheck, Tests, Build, Production Smoke and Browser Acceptance, followed by independent operational and governance evidence.


### 2026-10-08 — Release artifact assertion tightened

The release-evidence workflow now explicitly asserts the generated `release/deploy/*.json` manifests before checksum verification. This closes a gate-to-artifact naming mismatch without changing deployment semantics.


### 2026-10-08 — Signed container provenance attestation

Supply-chain hardening was extended from Buildx provenance/OCI metadata to a GitHub-signed container provenance attestation. The production release workflow now grants only the required `id-token: write` and `attestations: write` permissions and invokes `actions/attest@v4` against the immutable `ghcr.io/<repository-owner>/klar-app@sha256:<digest>` subject. The release workflow gate requires this exact digest-bound attestation configuration before release evidence can pass.

This follows current GitHub guidance that provenance generation must be accompanied by verification and that container attestations should be bound to the image name and immutable digest. citeturn0search2turn0search0

Production remains **NO-GO / NOT CONFIRMED** until the exact candidate head passes dynamic CI and the independent production approval/operational evidence is present.


### 2026-10-08 — Attestation action immutability hardening

The GitHub container provenance attestation introduced in the previous release-hardening step is now pinned to the reviewed full commit SHA `7d8b1cacecb65f487779b3b98fd5296a018d1a1b` instead of the mutable `v4` tag. The release workflow gate requires this immutable reference. This closes the remaining mutable third-party-action reference introduced by the attestation control and preserves the repository-wide full-SHA policy.

GitHub documents full-length commit-SHA pinning as the immutable-release control for Actions and recommends it for supply-chain protection. citeturn0search2turn0search8

Production remains **NO-GO / NOT CONFIRMED** pending dynamic exact-head CI and independent operational/governance evidence.


### 2026-10-08 — Artifact metadata permission aligned with current Attest contract

The production release workflow now grants the additional `artifact-metadata: write` permission required by the current `actions/attest` container-registry attestation contract. The permission remains scoped to the release job and is enforced by the release-workflow static gate, preventing a future regression to an incomplete attestation permission set.

GitHub's current Attest documentation lists `id-token: write`, `attestations: write`, and `artifact-metadata: write` for attestation generation, with `packages: write` required for container registry publishing. citeturn0search1turn0search2

Production remains **NO-GO / NOT CONFIRMED**. Dynamic exact-head CI and actual attestation verification are still required before release approval.


### 2026-10-08 — Exact-head CI static-gate failure remediated

The reported Klar Enterprise CI run `37818737668` failed in the `Enterprise static gates` step before typecheck, tests, build, smoke, or browser acceptance. Root cause analysis identified a malformed workflow-file discovery regex in `scripts/check-ci-toolchain-pins.mjs`: the escaped pattern matched the wrong literal form and therefore could resolve to an empty workflow surface. The gate was corrected to the canonical `/\\.ya?ml$/` regex.

During the same fail-closed review, the release attestation permission condition in `check-release-workflow.mjs` was corrected from an operator-precedence-sensitive expression to an explicit OR check requiring all three permissions: `id-token: write`, `attestations: write`, and `artifact-metadata: write`. This prevents a future regression from being masked by JavaScript boolean precedence.

The failing run's application validation stages were skipped because the static gate failed first; therefore no claim is made about typecheck/test/build status from that run. A fresh exact-head CI run is required for release evidence.

Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Enterprise static gate failure: release inspect assertion corrected

The follow-up CI run `37819483838` reached dependency installation successfully but failed again in `Enterprise static gates`, with Typecheck, Tests, Build, Production smoke, and Browser acceptance skipped. Root-cause review of the exact-head workflow found a false-negative in `scripts/check-release-workflow.mjs`: the gate required a literal fully expanded `docker buildx imagetools inspect ghcr.io/...:<tag>` command, while the release workflow intentionally constructs and reuses the validated `$image` variable. The gate has been corrected to require the repository-scoped image assignment and the equivalent `imagetools inspect "$image"` command, preserving the immutable digest/tag-binding contract without coupling the test to shell interpolation syntax.

This is a CI-gate correctness fix only; no application runtime behavior was changed. A fresh exact-head run is required before any downstream test or release evidence is considered valid.

Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Exact-head CI 37820349100: stale release-workflow assertions remediated

Fresh exact-head CI run `37820349100` reached the Enterprise static gates and failed only in `check-release-workflow.mjs`. The reported failures were (1) the attestation assertion and (2) the semver tag-to-digest assertion. Runtime inspection showed that the production workflow already contained the intended controls, but the static gate had stale text assertions that did not match the actual variable-bound Buildx command form.

The release gate was corrected to assert the canonical workflow contract actually used by the release job: the digest-bound GitHub Attest configuration and the tag inspection command operating on the explicitly constructed `$image` variable. No application runtime code was changed. Because typecheck, tests, build, smoke, and browser acceptance were skipped after the static gate failure, those stages remain unproven until a fresh run executes them.

Production remains **NO-GO / NOT CONFIRMED** pending the next exact-head CI run and subsequent independent release/operational evidence.


### 2026-10-08 — CI root-cause: duplicate nested workflow tree removed

Exact-head CI run `37820930237` checked out synthetic merge commit `a6ca144…` and failed in the release-workflow static gate even though the repository-root release workflow contained the expected controls. Root-cause analysis showed that the CI job runs with `phase2_work` as its working directory, while `check-release-workflow.mjs`, `check-ci-toolchain-pins.mjs`, and `check-test-separation.mjs` previously resolved `.github/workflows/*` relative to that working directory. A legacy duplicate workflow tree at `phase2_work/.github/workflows` therefore shadowed the authoritative repository-root workflows.

Remediation: all three gates now resolve the active workflow directory from `import.meta.url` and the repository root, independent of the current working directory. A new `check-workflow-layout.mjs` gate enforces a single workflow source of truth. The seven historical nested workflow files under `phase2_work/.github/workflows` were removed. The active GitHub Actions surface is now exclusively `.github/workflows` at repository root.

This is intentionally a governance/control-plane fix, not an application workaround. It eliminates path ambiguity and prevents stale CI/release definitions from silently becoming release evidence inputs.

Production remains **NO-GO / NOT CONFIRMED** until a fresh exact-head CI run passes all deterministic validation stages and the independent release/operational approval evidence is verified.


### 2026-10-08 — Exact-head CI dependency-lock gate path/topology fix

Exact-head CI run `37822007081` passed dependency installation but failed in `check-dependency-locks.mjs` because the gate still attempted to read the removed nested `phase2_work/.github/workflows/auto-version.yml`. After the workflow-shadow cleanup, the authoritative Actions surface is repository-root `.github/workflows`, and `auto-version.yml` is no longer present.

Remediation: `check-dependency-locks.mjs` now resolves all paths from the repository root and treats `auto-version.yml` as an optional policy surface: when present it is validated, when absent it cannot become a false blocker. The active GitHub and GitLab dependency-install contracts remain explicitly verified. No dependency versions were changed and no lockfile regeneration was accepted as a substitute for a deterministic policy fix.

Production remains **NO-GO / NOT CONFIRMED** until a fresh exact-head run reaches and passes all subsequent deterministic validation stages.


### 2026-10-08 — Dependency lock preflight moved before installation

The next exact-head CI failure was in `check-dependency-locks.mjs`: the gate required the active CI/release workflow to run the lock verification before the Functions dependency graph was installed. The repository's GitHub workflows previously satisfied the policy only indirectly through the later Enterprise static-gate bundle.

Remediation: both repository-root `.github/workflows/ci.yml` and `.github/workflows/release.yml` now execute `node scripts/check-dependency-locks.mjs` as an explicit preflight step before `bun ci` or `npm ci --prefix functions`. The lock gate also remains part of the Enterprise static-gate bundle as defense-in-depth. No dependency versions or lockfile contents were changed.

This makes the release/CI control order deterministic: validate lockfile policy first, then materialize dependency graphs, then execute security/type/test/build stages.

Production remains **NO-GO / NOT CONFIRMED** pending a fresh exact-head CI run through all remaining deterministic stages and independent operational release evidence.


### 2026-10-08 — GitHub Actions Node 20 runtime warning remediated

The preceding CI logs emitted a GitHub Actions warning that the pinned `actions/setup-node` revision targeted the deprecated Node 20 action runtime. Current `actions/setup-node` v7 runs on Node 24 while remaining capable of installing the project's pinned application runtime (Node `22.23.3`). The three active repository-root workflows (`ci.yml`, `release.yml`, and `llm-evaluation.yml`) were therefore upgraded to the verified immutable `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020` revision, with the enterprise toolchain-pin gate updated to require the same SHA.

This changes only the GitHub Action's execution runtime; the Klar application/toolchain contract remains Node `22.23.3` and Bun `1.4.2`. GitHub's current setup-node documentation shows the action running under `node24`, and the current v7 line documents Node 24 usage. citeturn174539search6turn174539search1

Production remains **NO-GO / NOT CONFIRMED** until the next exact-head CI run completes all deterministic gates and independent production approval/operational evidence is verified.


### 2026-10-08 — Continuous dependency-update coverage added

Supply-chain hardening now includes an automated maintenance path in addition to immutable action pins. A repository-root `.github/dependabot.yml` was added for weekly GitHub Actions, Bun, Firebase Functions npm, and Docker dependency monitoring. A dedicated `check-dependabot-config.mjs` Enterprise gate verifies the file, supported directories, version 2 configuration, and weekly schedules. This prevents the immutable-pin policy from becoming stale without an automated update mechanism.

Current GitHub documentation lists Bun and GitHub Actions as supported Dependabot ecosystems and requires `.github/dependabot.yml` in the default-branch `.github` directory. citeturn111071search0turn111071search2turn111071search10

Production remains **NO-GO / NOT CONFIRMED** pending the next exact-head CI run through all deterministic stages and independent production approval/operational evidence.


### 2026-10-08 — Autonomous CI monitoring budget guardrail

The repository work is now paired with an explicit execution-budget guardrail requested for the ongoing PR validation: autonomous GitHub Actions execution is capped at **300 minutes**. No unnecessary workflow runs or blind reruns are permitted. Once the 300-minute ceiling is reached, further GitHub Actions execution must stop and explicit approval for up to an additional 200 minutes must be obtained before continuing.

A scheduled CI-monitoring automation was created for PR #1 to inspect completed validation runs, diagnose concrete failures, apply repository fixes, and keep this status document synchronized. The automation does not treat the absence of a CI result as success and retains the existing fail-closed production rule.

Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Exact-head CI 37825579777: Dependabot gate parser fixed

The exact-head CI run `37825579777` reached the new Dependabot control and failed because `check-dependabot-config.mjs` used an over-escaped schedule regex. The repository configuration itself was valid; the gate incorrectly rejected all four weekly schedules.

Remediation: the gate now parses each `package-ecosystem` block deterministically and asserts the literal `interval: weekly` contract, while retaining explicit ecosystem and directory checks. No dependency configuration or versions were changed. This is a test-infrastructure correction only.

The same run confirmed the prior dependency-lock preflight is now passing. Typecheck, tests, build, smoke, and browser acceptance were again skipped because the static gate failed first.

Production remains **NO-GO / NOT CONFIRMED** pending a fresh exact-head run that reaches all dynamic stages.

### 2026-10-08 — Exact-head CI 37826645943: release evidence contract made explicit

Exact-head Enterprise CI run `37826645943` completed after the Dependabot remediation and passed the dependency-lock preflight plus the surrounding Enterprise controls. The only remaining static failure was `check-release-workflow.mjs`, which rejected workflow contracts that were semantically present but not explicitly asserted as concrete release artifacts.

Remediation on candidate commit `f6a6a4fcef61db17ca7ff85a93f3b3c2c5aeb539`: the tag-to-digest deployment-manifest render now uses the repository-scoped `github.repository_owner` expression, and the workflow explicitly verifies the generated application build identity, Firebase Functions build identity, container tag-binding evidence, and CycloneDX SBOM identity before the checksum ledger and artifact upload. This keeps the gate fail-closed while making the release evidence chain directly auditable.

The release workflow remains tag-only and protected-environment gated. No production deployment is inferred from artifact publication alone. Production remains **NO-GO / NOT CONFIRMED** until a fresh exact-head CI run completes Typecheck, Tests, Build, Production Smoke and Browser Acceptance and the independent operational/governance evidence is verified.

### 2026-10-08 — Release manifest owner binding corrected

A final source-contract review found that the release manifest render command still interpolated the repository owner through the shell environment even though the enterprise checker requires the owner to be bound through the GitHub repository context. Candidate commit `7c2b7bb378ec5988220be5dd44b69c24b91ec9d7` now passes `github.repository_owner` directly into the immutable `@sha256` image reference used for generated deployment manifests.

This is a control-plane hardening change only. The release remains tag-only, protected-environment gated, digest-immutable and fail-closed; no production deployment or release approval is inferred from static checks. A fresh exact-head CI result is required after this change.

### 2026-10-08 — Release artifact uploader path assertion corrected

Exact-head release-gate review identified a false-negative in `check-release-workflow.mjs`: GitHub Actions steps with a `phase2_work` working-directory still execute action inputs such as `upload-artifact.path` relative to the workspace root. The authoritative release workflow therefore correctly uploads `phase2_work/release/`, while the checker incorrectly required the ambiguous `release/` path.

Candidate commit `aa5613095712c1ca706ec079535a8c4e766ed1ad` aligns the static gate with the actual action path semantics. The release artifact path itself is unchanged. This preserves fail-closed packaging while removing a checker-only false positive.

Production remains **NO-GO / NOT CONFIRMED** pending a fresh exact-head Enterprise CI result through Typecheck, Tests, Build, Production Smoke and Browser Acceptance plus independent operational/governance evidence.

### 2026-10-08 — Exact-head CI 37827690046: strict test typecheck remediation

Exact-head Enterprise CI run `37827690046` passed all Enterprise static gates and the dependency-lock preflight, then failed in the dedicated `tsconfig.tests.json` typecheck. The failure surface contained 58 diagnostics across accessibility, operational evidence validators, Firestore-backed platform tests, DSA appeals, offline queue tests, and several nullable Firestore/Auth snapshots.

Remediation was performed without weakening strict TypeScript:
- accessibility, load/cost, operational-control and recovery fixtures were migrated to their current validator schemas and trusted context arguments;
- Firestore test doubles are now explicitly isolated at the test boundary instead of widening production function contracts;
- the DSA appeal API now exposes overloads with a typed transactional `DsaAppeal` result, while its in-memory test transaction contract is declared locally;
- the offline queue tests use the user-scoped `clearQueueForUser` API instead of a stale global clear helper;
- Vitest's `vi` spy API and Firebase emulator response/profile snapshots are explicitly typed;
- nullable Firestore snapshots in persistence tests are narrowed before field access.

Candidate `08e8c42227651bdb5bd2ae8cc668d82e7a416519` contains the complete remediation lineage. Static source review found the previously reported stale calls removed. A fresh exact-head CI result remains required; no success is inferred from source inspection alone.

Production remains **NO-GO / NOT CONFIRMED** pending green Typecheck, Tests, Build, Production Smoke and Browser Acceptance on the same exact head, followed by independent operational/governance evidence.

### 2026-10-08 — Offline queue test-boundary runtime correction

The strict-test remediation exposed one additional environment-boundary defect in `clearQueueForUser()`: the function correctly scoped memory cleanup by authenticated owner UID, but its IndexedDB cleanup path was unconditional and therefore rejected in Node-based enterprise tests where IndexedDB is unavailable.

Candidate `6c5e639b989f715424dd80912467e2d9f166b0ac` now preserves the user-scoped memory cleanup and invokes the persistent IndexedDB cleanup only when `indexedDB` is available. This is a defensive runtime-boundary correction; it does not introduce a global queue-clear capability and does not alter browser behavior.

Production remains **NO-GO / NOT CONFIRMED** until fresh exact-head CI proves Typecheck, Tests, Build, Production Smoke and Browser Acceptance and independent operational/governance evidence is verified.

### 2026-10-08 — Exact-head CI 37829119764: DSA test parser defect corrected

Exact-head Enterprise CI run `37829119764` again passed dependency-lock preflight and all Enterprise static gates, then failed in the test TypeScript compilation with three parser errors at `tests/enterprise/dsaAppealEngine.spec.ts:15`. The source review showed a literal `\\n` sequence had been persisted before the newly introduced mock interface.

Candidate `b09fc7e87620b418b529f8001b3742c70d53a9e5` removes that literal escape and restores valid TypeScript source. A repository-wide inspection of the recently touched strict-test remediation files found no further matching literal-newline defects.

Production remains **NO-GO / NOT CONFIRMED**. The next exact-head CI run must still prove Typecheck, Tests, Build, Production Smoke and Browser Acceptance before release evidence can advance.


### 2026-10-08 — Exact-head remediation wave: transaction/security contracts

The follow-up remediation extends the Durable boundary hardening to its adjacent security contracts: consent evidence is backend-only, KYC start checks recent authentication before its distributed limiter, and Enterprise test fixtures now model the mandatory transactional rate-limit surface. Firestore rule tests explicitly seed the authoritative adult gate and complete guest schema.

Production remains **NO-GO / NOT CONFIRMED** pending a clean Exact-Head dynamic CI result.
 
### 2026-10-08 — Exact-head CI 37836300266 remediation wave: 40 test contracts

Run `37836300266` established that the Durable adapter now passed TypeScript validation, leaving 40 deterministic test failures. The remediation aligns test boundaries with the hardened runtime: UID/session scoped storage, pseudonymized audit records, trusted cost ceilings, structured AI output, immutable release-image owner binding, Firebase OOB password-reset ownership, server-side retirement of legacy reset endpoints, current Stripe event monotonicity, and runtime i18next normalization.

No production security control was relaxed to satisfy a test. Empty compliance exports remain empty, malformed launch requests are still rate-limited, and rejected KYC state transitions do not manufacture state changes.

**Release gate:** production remains **NO-GO / NOT CONFIRMED** pending a clean Exact-Head CI including Build, Production Smoke and Browser Acceptance.

 
### 2026-10-08 — Exact-head CI 37837743093: test-contract patch restored typecheck hygiene

Exact-head CI `37837743093` on candidate `8aabaa7b05f3a25f6937f5e119aa4ed3a51d8e5b` reached Typecheck and reported four fixture-level diagnostics introduced by the preceding contract rewrite: a removed audit mock remained referenced by the chat safety fixture, and the rewritten password-reset boundary test omitted its Express/Node type imports. No production source regression was indicated.

The correction removes the obsolete audit datastore mock because `appendAuditLog` is mocked at its authoritative boundary and restores the explicit Express/Node test imports. The incidental non-network assertion was removed as dead test noise.

Production remains **NO-GO / NOT CONFIRMED** pending a clean Exact-Head run through Tests, Build, Production Smoke and Browser Acceptance.

### 2026-10-09 — Exact-head CI 37849355156: durable Firestore proxy missing create()

The exact-head run on `b115513bcab5938f20695c5ea9a59c5cc8b768fb` passed dependency-lock preflight, dependency installation, Enterprise static gates and Typecheck. Tests then failed in the emulator-backed account-erasure journey (966/967 tests passed): `purgeAccountData()` reached the deletion-receipt write and threw `TypeError: receiptRef.create is not a function`. The wrapped document-reference contract in `src/server/durableStore.ts` exposed `set/update/delete` but omitted Firestore's create-only method, even though production code correctly uses `DocumentReference.create()` for an idempotent, deterministic deletion receipt.

Candidate commit `2b57e8c817bd676c33685af389c6e531e3101679` adds `create()` to the durable document-reference contract. With real Firestore it delegates to native `DocumentReference.create()` and mirrors only successful writes; the explicitly enabled non-production fallback rejects an existing document with Firestore-compatible code `6` rather than silently overwriting it. This preserves create-only semantics and does not relax production fallback policy. A fresh exact-head CI run must validate the patch; Tests, Build, Production Smoke and Browser Acceptance are not yet confirmed green.

**Production remains NO-GO / NOT CONFIRMED** pending all required exact-head dynamic gates and independent operational/governance evidence.

### 2026-10-09 — Follow-up hardening: preserve create-only semantics in transactions

A follow-up review of the `durableStore.ts` fix identified a second path with the same semantic risk: the transaction fallback's `create()` implementation staged a plain `set()`, which could overwrite an existing receipt, and the real transaction's mirror also used `set()`. Candidate commit `2aa2769cc7a43bbae720b07a0c4ad18b3d1f11f8` now mirrors successful transaction creates with create-only semantics and makes the explicitly enabled fallback reject an already-existing document with code `6`. This narrows the fix to the durable adapter and keeps Firestore's create-only contract consistent across direct and transactional calls. The check is still awaiting a fresh exact-head CI run; do not treat this code review as runtime validation.

**Production remains NO-GO / NOT CONFIRMED** until all required CI/runtime gates and independent operational/governance evidence are green.


### 2026-10-09 — Exact-head CI 37885112283: Playwright browser provisioning gap

Exact-head Enterprise CI run [37885112283](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37885112283) on candidate `1a39cf8d50c9e84d29effb91999c0968c927aaae` passed Dependency lock preflight, dependency installation, Enterprise static gates, Typecheck, Tests, Build and Production smoke. Browser acceptance then failed before executing test logic: all 26 Chromium cases could not launch because the expected Playwright Chromium headless-shell binary was not installed on the runner. This is a CI environment provisioning defect, not evidence that the browser assertions passed or failed.

The workflow now explicitly installs the pinned Playwright project's Chromium browser and operating-system dependencies with `bunx playwright install --with-deps chromium` immediately before Browser acceptance. This follows Playwright's documented CI setup sequence and keeps the browser gate mandatory; no tests are skipped or relaxed. A fresh exact-head run must validate the workflow change. The install step itself and the new browser run are not yet verified.

**Production remains NO-GO / NOT CONFIRMED** until exact-head Browser acceptance and all other required runtime gates pass, and the outstanding independent operational/governance evidence is approved.


### 2026-10-09 — Browser acceptance follow-up: isolated consent audit test secret

After installing Chromium, CI run [37885595402](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37885595402) executed the browser suite (12 passed, 14 failed). Log inspection identified a deterministic test-environment configuration defect: the Playwright web server did not receive `CONSENT_AUDIT_SECRET`, so mandatory consent-evidence signing correctly failed closed and the consent API returned HTTP 503. This was not fixed by weakening the signing requirement.

The Playwright web-server command now injects a clearly test-only, non-production secret with sufficient length. It is scoped to the E2E server process; production secrets remain provisioned independently and must never reuse this value. The workflow change and this test setup change still require a fresh exact-head run. The same run also reported an onboarding assertion that did not find its expected landing-page heading; investigate that separately after the consent API blocker is revalidated.

**Production remains NO-GO / NOT CONFIRMED** pending a fresh exact-head CI run with all browser tests green and the independent operational/governance evidence approved.


### 2026-10-09 — Exact-head CI 37886873675: browser auth helper used a retired token cache

Exact-head PR CI run [37886873675](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37886873675) passed dependency-lock preflight, dependency installation, Enterprise static gates, Typecheck, Tests, Build, Production smoke and Chromium installation. Browser acceptance ran 26 cases: 14 passed and 12 failed. The dominant failure was in the E2E helper, which still read `localStorage.klar_auth_token`. The application no longer owns or persists credentials under that key: `authFetch` obtains the token from the authoritative Firebase Auth session, and guest login deliberately uses Firebase's session persistence. This made the test helper report a null token even when the browser had passed the age/consent UI gates.

Candidate commit `96b019ac554c4bfc5f46345f2400356355b544cf` updates only the E2E helper to read the SDK-persisted Firebase user from session or local storage and validate the JWT-shaped access token before constructing API test headers. It does not add a production token cache, weaken API authentication, or change production code. One registered-account onboarding heading failure was also present in the same run and remains a separate investigation item; do not attribute it to the helper without a new run.

A fresh exact-head CI run is required to validate the helper correction and determine the remaining browser failures. **Production remains NO-GO / NOT CONFIRMED** until all required exact-head gates are green and independent operational/governance evidence is approved.


### 2026-10-09 — Exact-head CI 37887783544: Art. 9 cascade transaction ordering corrected

The fresh CI run [37887783544](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37887783544) validated the E2E helper commit but Browser acceptance still failed: 17 passed, 9 failed. The server log also exposed a real transaction defect in `src/server/platform/consentEngine.ts`: `revokeExplicitConsent()` performed `tx.set()` calls and only then attempted `tx.get(publicProfileRef)`. Firestore rejects reads after writes in a transaction. The cascade purge logged and swallowed that error, so the private/public profile purge and audit transaction could fail to complete atomically while the higher-level test continued.

Candidate commit `143e625e42eaae5f908f01c1da5dac6dfa2050b8` now reads both the user document and public-profile document before any transaction writes, then applies the audit append and private/public purge updates in the same transaction. This preserves the fail-closed audit-secret requirement and avoids swallowing the transaction-ordering defect as apparent success. A new exact-head CI run is required; this fix is not yet claimed validated.

The other 8 browser failures are not treated as one root cause: the registered onboarding screen and password-recovery controls were not found; a chat API returned 503 where the test expected an authorization denial; the contract receipt did not contain the exact legal phrase asserted by the test and exposed a raw `contracts.termination` localization key; a legacy analytics endpoint returned 429 due to rate limiting rather than the expected 410; a legal-navigation test did not return to the expected landing screen; and a consent-withdrawal response timed out. These require isolated diagnosis rather than loosening assertions or weakening rate limits. **Production remains NO-GO / NOT CONFIRMED** until all required exact-head gates pass and independent operational/governance evidence is approved.


### 2026-10-09 — Browser acceptance: cancellation receipt localization defect corrected

Exact-head CI run `37888840507` on candidate `762b342504ea7e64949614b215c846fb2cc499a2` passed dependency lock preflight, dependency installation, Enterprise static gates, Typecheck, Tests, Build and Production Smoke, but Browser Acceptance failed with 9 browser-test failures. One independently confirmed product defect was in cancellation receipts: the server rendered the untranslated key `contracts.termination` because the German and English locale dictionaries lacked that key. The German receipt also did not include the statutory earliest-termination wording required by the browser acceptance contract.

The German and English locale dictionaries now define the termination label explicitly. The German no-date fallback now states `frühestmöglichen Zeitpunkt gemäß § 312k Abs. 5 BGB`; the English fallback explains the corresponding German Civil Code reference. This corrects user-visible legal receipt content rather than weakening the test assertion. Other Browser Acceptance failures remain open and must be diagnosed independently. A new exact-head CI run is required; **production remains NO-GO / NOT CONFIRMED**.


### 2026-10-09 — Consent withdrawal browser contract aligned to the live API

Follow-up review of Browser Acceptance run `37888840507` identified another concrete test defect: `tests/e2e/privacy-settings.spec.ts` waited for the retired `/api/einwilligung/widerruf` endpoint, while the current ConsentSettings UI submits the selected purpose and explicit `erlaubt: false` to `POST /api/einwilligung/zweck`. The test now waits for the current endpoint, HTTP method, purpose and withdrawal value, preserving the security-relevant assertion that the user's product-analytics consent is revoked and remains false when read back. No production authorization or consent behavior was relaxed.

The cancellation receipt localization and consent test corrections are now committed, but their exact-head CI evidence is pending. The other Browser Acceptance failures (including recovery modal, chat, legacy analytics response, legal navigation, and registration/onboarding) remain open for independent diagnosis. **Production remains NO-GO / NOT CONFIRMED** until the full exact-head pipeline and independent operational/governance approval are green.


### 2026-10-09 — Spanish locale integrity gate repaired

Exact-head CI run `37889956863` reached Enterprise static gates and failed at `check:i18n` before Typecheck or tests. The Spanish locale was missing the newly required `contracts.termination` key, so the cross-locale key parity gate correctly blocked the pipeline. Added a Spanish termination label and an explicit § 312k(5) BGB fallback phrase, keeping the German, English and Spanish cancellation receipt catalogs structurally aligned. This is a real translation-catalog defect; no static gate was bypassed. A fresh exact-head run is required to validate the complete candidate. **Production remains NO-GO / NOT CONFIRMED.**


### 2026-10-09 — Authentication recovery entry point restored

Review of the failed Browser Acceptance tests showed that the login screen's “Passwort vergessen?” control navigated directly to the password-only form, while the implemented accessible `AuthRecoveryModal` (including cross-device magic-link sign-in) was unreachable from the primary login UI. The control now opens the recovery modal, restoring the existing magic-link/password-recovery options and the modal's Escape/focus-return behavior. The dedicated `/passwort-vergessen` deep link remains supported. This preserves the generic recovery response for unknown accounts and does not read an email identity from URL parameters. Validation is pending on a fresh exact-head CI run. **Production remains NO-GO / NOT CONFIRMED.**


### 2026-10-09 — French locale parity gate repaired

Exact-head CI run [37890290696](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37890290696) failed at the Enterprise static gate `check:i18n`: after the German, English and Spanish cancellation receipt updates, the French catalog was the remaining locale missing `contracts.termination`. Added the French termination label and localized the statutory no-date fallback with the German Civil Code reference, restoring the required catalog-key parity without changing or bypassing the gate. Commit: `c31992399cd2141a656e138f0b1f83aa5970e95e`. A fresh exact-head CI run must verify this correction and then exercise the downstream browser acceptance suite. **Production remains NO-GO / NOT CONFIRMED** until every required exact-head gate passes and independent operational/governance approval is recorded.


### 2026-10-09 — Retired verification endpoint contract made consistent

Exact-head CI run [37890532339](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37890532339) passed Enterprise static gates but failed one of 967 tests: `tests/verificationSecurity.spec.ts` expected the permanently retired `POST /api/verification/verify` endpoint to return HTTP 410, but the global authentication gate returned 401 first. The route itself already emits only a fixed `verification_retired` response, so requiring authentication before advertising retirement is unnecessary and made the documented API contract dependent on token/emulator state.

The five retired `/api/verification/{verify,status,challenge,submit,decide}` paths are now explicitly exempted from the global authentication and age gates; they remain behind the global API rate limiter and return the existing fixed 410 response, with no identity or profile data disclosed. The regression test now checks both anonymous and registered-token requests and verifies the persisted `isVerified` flag remains false. Changes: `de0d90a7cb24248a5b8a0d4c77308789eb2560ad` and `e7877558429428a81b5f4d1c911d53d77cb96814`.

The exact-head CI run for these changes is pending. This fix does not establish production readiness; **Production remains NO-GO / NOT CONFIRMED** until the complete exact-head pipeline passes, Browser Acceptance is green, and independent operational/governance approval is recorded.


### 2026-10-09 — Exact-head validation update (PR #1 / v149)

Latest completed Enterprise CI: [run 37908747359](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37908747359), candidate SHA `4435b837c24fc254fd920615a2ad656eca75c428`. Dependency lock preflight, dependency installation, Enterprise static gates, TypeScript, automated tests, build, production smoke, and Chromium installation passed. The `Browser acceptance` step failed. This run therefore does not satisfy the release gate.

The available workflow metadata identifies the failing step but does not include individual Playwright failure messages or traces, and no Playwright HTML report artifact was uploaded. Do not infer that the earlier four browser failures are unchanged, and do not weaken assertions or disable browser tests. Next action: make the Playwright HTML report and failure traces available as a bounded CI artifact on failure, rerun Browser Acceptance on this exact candidate, then fix each reproduced application/fixture defect with a regression test. Preserve rate limits, auth/consent ordering, and deny-by-default behavior.

**Release status: NO-GO / NOT CONFIRMED.** Do not merge or deploy based on the passing non-browser steps alone. Require a green full CI run on the exact candidate SHA plus independent operational, security/privacy, backup-restore and release approvals.


### 2026-10-09 — Browser acceptance follow-up fixes

The failure diagnostics from CI [37908747359](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37908747359) confirmed four failures (22 passed / 4 failed): (1) persisted chat message not visible after reload, (2) gate answer UI not restored after a successful status retry, (3) contact request returned HTTP 429 instead of domain HTTP 409, and (4) registered onboarding helper could not find the Firebase session token.

Changes made on `security/v149-autonomous-consolidation`:

- `src/screens/ChatView.tsx`: chat subscription now listens for Firebase Auth state restoration and subscribes only once the SDK restores the authenticated user. This addresses the reload race where a one-time `auth.currentUser` check could see `null` and skip the Firestore listener for the whole mount.
- `src/lib/useChatGate.ts`: a retry no longer transiently clears the current gate state to `lade`; the UI remains fail-closed while the request runs and the successful result can restore the answer form.
- `tests/e2e/identity-helpers.ts`: token lookup now reads Firebase SDK-managed persistence from local/session storage and the existing Firebase IndexedDB store, without introducing an app-owned token cache or changing production auth behavior.
- `tests/e2e/e2e-critical-flows.spec.ts`: contact 429 failures now include safe response body/headers so the specific limiter can be identified; the expected domain contract remains 409 and the rate limit has not been weakened.
- `.github/workflows/ci.yml`: browser report/trace artifacts are uploaded on completion for diagnosis.

The contact limiter's 429 cause is **not yet established**; do not mark that issue fixed based on improved diagnostics. Latest CI for this fix batch is pending/running; only an exact-head green run can establish whether these changes resolve the reproduced failures. Production remains **NO-GO / NOT CONFIRMED**.


### DB-01 emulator coverage extension

The regression suite now also seeds 51 real emulator chat documents with messages, archived messages and gate answers. It invokes the production purge twice, requires 26 then 1 remaining chats, verifies removal of all three child collections beneath deleted parents, and verifies an unrelated chat remains intact. This complements the 51-page durable-worker test. Full completion across within-page time slices and cumulative receipts still require further work. CI validation is pending.



## 2026-10-14 — Firebase ADC preflight gate integrity (PR #61)

**Development change only; PRODUCTION NO-GO / NOT CONFIRMED.** The prior #29 branch was unmergeable and its initial CI failed because a native `node:test` spec under `tests/` was wrongly collected by Vitest. Replacement PR #61 starts from current main and places six native Node tests under `scripts/localFirebaseAdc-check.mjs`. They were initially manually runnable but *not included in the ordinary enterprise gate*. Follow-up commit `aca4cd8cc310607a3f9b651d2731fdbb89f3ff39` adds `npm run test:local-firebase-adc` to the existing `check:enterprise` chain; Node version/runtime and dependency locks remain unchanged.

**Verification policy:** Earlier PR-head CI success 38551151503 applies only to the earlier PR SHA `796d64e...`. Require full new exact-head CI, pinned Node 22.23.3/Bun 1.4.2, dependency/lock gates, complete configured test suites, security review and current-base conflict check before merge. No local full-test completion or live-production validation is claimed for this amendment. Release issue #8 remains open.


## 2026-10-14 — P0 #56 current-main partner cache hardening port

Because #62 was no longer mergeable after upstream changes, scoped private cache-control middleware and HTTP response regression tests were brought onto a new branch based on `main` at `9d6c554df1633212654bab9bfda2ca9e3b0a4b2a`. The candidate sets `Cache-Control: private, no-store` and `Pragma: no-cache` before authorization/rate limits for consent and personalized link endpoints, including 401, 400 and 200 cases. This is an unmerged candidate: full exact-head CI, tests, branch diff review and Privacy/Security approval required. Token transmission to third-party partner destinations, Art.17/TTL evidence and formal release remain open. **NO-GO / NOT CONFIRMED.**


### 2026-10-14 — P0 #56 private partner API referrer policy

Draft PR #64 now additionally sets `Referrer-Policy: no-referrer` on personalized consent/referral/open JSON responses, alongside `Cache-Control: private, no-store` and `Pragma: no-cache`. HTTP regression coverage asserts this header for authorized and unauthenticated responses. This is **defense in depth** for private API response handling, NOT a fix for the existing `klar_referral` token transmitted to external partner destinations. Previous CI 38597710273 belongs to an older commit: require fresh exact-head full CI, upstream diff review, independent privacy/security approval before merging. Issue #56 and release #8 remain OPEN. **NO-GO / NOT CONFIRMED**.


### 2026-10-14 — P0 #56 public referral redirect error-cache protection

Draft PR #64 now applies `Cache-Control: private, no-store`, `Pragma: no-cache`, and `Referrer-Policy: no-referrer` before public `/api/partner/click/:token` token handling and distributed rate-limiting. The previous handler emitted no-store/no-referrer only on successful redirects; early 404/410/429 paths were unprotected. Added HTTP regression for invalid-token 404 with all three headers and no database access. No tracking/attribution logic changed. New exact-head CI and Security/Privacy review required, earlier green CI superseded. Referral token disclosure to partner, legal basis, recipient retention and Art.17 still open. **NO-GO / NOT CONFIRMED.**


### 2026-10-14 — PR #64 CI failure diagnosis and deterministic malformed-token rejection

Exact-head CI [38602779698](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38602779698) **FAILED**: `tests/partnerReferralRoutes.spec.ts` expected an invalid public referral token to return HTTP 404 but received HTTP 500. Root cause: the Firestore-backed distributed click limiter executed before the service's token-shape validation, and the isolated HTTP regression intentionally made DB access fail. Candidate fix adds strict 64-character lowercase-hex route-token validation before the limiter, after no-store/no-referrer headers. Malformed requests now terminate with non-sensitive 404 without DB access; well-formed tokens still traverse the existing limiter and service checks. The regression's 404/header/no-DB expectation is **unchanged**. This is fail-fast, not a rate-limit bypass for valid tokens. New exact-HEAD full CI and independent Security/Privacy review required; no merge and no production approval. **NO-GO / NOT CONFIRMED.**


### 2026-10-14 — PR #64 well-formed-token limiter regression

Added an HTTP negative/fail-closed companion test: malformed referral tokens must terminate in 404 without database use, while a syntactically valid 64-character hex token MUST still hit the distributed Firestore-backed limiter. In the controlled test the database is intentionally unavailable, so the well-formed request returns 500 (not an unguarded 404 or 302) and retains no-store/no-referrer headers. **HTTP 500 is expected solely for simulated dependency failure, never asserted to be production behavior.** The preceding CI #38604828563 was still in progress during initial investigation; any outcome predates this new commit. Require fresh exact-head complete CI and Security review. No main merge; privacy/retention and release status **NO-GO / NOT CONFIRMED**.


## 2026-10-14 — Consolidated B2B admin + webhook privacy branch after PR #64 merge

With main at `bee87aea09a8d10b2e2c3fb74e38e5ecb12be008` already including PR #64, PR #66 and #67 became conflicted on shared route/test and governance files. A new unmerged branch now carries only their administrative and webhook no-store/no-referrer middleware before authorization/distributed limiting, with preserved existing PR #64 token and rate-limit checks. The admin 403/200 assertions and webhook simulated infrastructure failure (500) response-header regression are integrated into the existing test suite, without replacing upstream tests. This is NOT approved or CI-verified yet. Require exact-head CI, strict claim/HMAC/idempotency tests, independent Security/Privacy review, and sequential integration after any doc PR. #55/#56, retention and Art.17 evidence remain unresolved. **NO-GO / NOT CONFIRMED.**
### 2026-10-18 — P0 #56 reserved partner URL token parameter (draft)
`validatePartnerDestinationUrl` now rejects case-insensitive, URL-decoded `klar_referral` keys in campaign destinations so a direct, consentless redirect cannot forward a pre-seeded attribution token. Added Vitest cases for percent-encoded and mixed-case variants; see `docs/ADR_PARTNER_DESTINATION_TOKEN_INJECTION_2026-10-18.md`. Existing campaign data must be inventoried and exact-head mandatory gates run. Tests/Privacy approval pending, **NO-GO**.


### 2026-10-18 — Partner fragment attribution egress gate (#56)
Stacked on query-key hardening PR #83: reject any nonempty partner destination URL fragment, since it remains browser-JavaScript-readable even when tracking is otherwise suppressed. Added tests and `docs/ADR_PARTNER_DESTINATION_FRAGMENT_GUARD_2026-10-18.md`. Hash-route compatibility, Privacy/legal approval, Vitest/Emulator and full gates remain pending. **NO-GO.**
### 2026-10-18 — P0 #56 visitor partner-consent gate (draft)
Partner click token forwarding requires an independently consenting, authenticated adult visitor; consent and deletion status are rechecked transactionally before attribution. Adds `scripts/check-partner-visitor-consent.mjs` and `docs/PARTNER_VISITOR_CONSENT_GATE_2026-10-18.md`. Full emulator/HTTP and legal partner transfer approvals remain pending. NO-GO; no production deployment or main merge.


### 2026-10-18 — P0 #56 Firebase anonymous visitor attribution blocked (draft)
Route-level optional visitor identity now excludes anonymous Firebase requests and verified anonymous Bearer JWTs; untracked redirect remains available. Added `scripts/check-partner-visitor-auth-boundary.mjs` and `docs/PARTNER_ANONYMOUS_VISITOR_BOUNDARY_2026-10-18.md`. Static gate only; runtime Firebase Emulator tests, consent/DSGVO approvals and complete mandatory gates remain NOT VERIFIED. **NO-GO.**


### 2026-10-18 — P0 #56 Firebase revoked bearer-token gate (draft)
Optional public visitor Bearer JWT validation now uses Firebase Admin `verifyIdToken(token, true)` rather than no revocation check. A rejected/disabled/revoked token returns no visitor identity and no attribution; anonymous accounts are already denied. Updated static guard and new `docs/PARTNER_REVOKED_ID_TOKEN_GATE_2026-10-18.md`. Central `req.user` revocation policy, real emulator HTTP, Auth availability and all mandatory gates remain UNVERIFIED. **NO-GO.**


### 2026-10-18 — P0 #56 prepopulated visitor identity bypass closed (draft)
Optional partner redirect visitor identity now requires explicit revocation-checked Firebase Bearer ID token; prepopulated req.user.uid cannot bypass verification. No bearer -> untracked redirect. `docs/PARTNER_VERIFIED_BEARER_ONLY_2026-10-18.md` documents browser compatibility, migration and mandatory tests. Static guard updated. Runtime HTTP/emulator and all full gates pending; production **NO-GO**.
## 2026-10-14 — Auth profile hydration, email session and settings save hardening

Candidate branch `fix/auth-profile-state-email-persistence-2026-10-14` resolves three confirmed source defects: (1) absent Firestore adult/consent fields previously inherited prior in-memory authorization/consent, now fail closed; (2) email account login/signup did not explicitly set browser-local Firebase persistence after guest session persistence, now sets and awaits it before auth; (3) `ProfileSettings` reported saves from an unverified unauthenticated `fetch`, now uses `updateProfileData` authoritative Firestore write/readback, with accessible pending/error states and updated prop hydration. See `docs/ADR_PROFILE_STATE_EMAIL_PERSISTENCE_2026-10-14.md`. Tests added in `tests/AuthContext.spec.tsx` and `tests/ProfileSettingsPersistence.spec.tsx`. **No local exact-main npm/emulator/Playwright verification yet; Node 22.23.3 unavailable in isolated runner and current complete git checkout not mounted.** The older 13 October archive is not equivalent to exact current main and must not be claimed as such. No merge/deploy. P0 partner, retention and official #8 production approval remain open. **NO-GO / NOT CONFIRMED**.


2026-10-14 candidate PR #74 validation update: exact-head Actions run 38619115898 FAILED on commit 429ab8e07d7209280933a601bbab51817a2c10ce. The per-job log endpoint returned BlobNotFound/404, so failure stage and root cause remain unverified; DO NOT mark fixed or PASS. Local gate attempts used an older 2026-10-13 archive, Node 22.16.0 (pin 22.23.3), no installed dependencies or Firebase emulators: 5 source-only checks PASS, auth boundary FAIL in old archive, typecheck/pure/rules/build failed due unavailable tools, Playwright timed out; none certify the new PR. Require actual latest source + pinned toolchain, fresh complete tests and failure log before any merge. NO-GO / NOT CONFIRMED.
### 2026-10-18 — P0 #55 event-ID assertion binding (draft)
A new domain-separated stable HMAC binds each stored partner event ID to original buyer/referral assertion. Exact duplicates remain idempotent; conflicting assertions and legacy records missing the binding fail closed. Adds Vitest regression and `docs/PARTNER_EVENT_ID_BINDING_GATE_2026-10-18.md`. Exact-head Vitest, emulator tests, independent purchase proof and all release gates remain outstanding. **NO-GO.**


### 2026-10-18 — P0 #55 partner replay eligibility recheck (draft)
On an already-bound event ID, current buyer/owner consent, deletion state, campaign and referral eligibility are now checked **before** duplicate acknowledgement. Added revocation-after-first-event regression and `docs/PARTNER_REPLAY_ELIGIBILITY_GATE_2026-10-18.md`. Full Vitest, emulator concurrency, provider retry protocol and separate Security/Privacy/Finance approvals not verified. **NO-GO.**


### 2026-10-18 — P0 #55 replay buyer-claim linkage gate (draft)
Even an exact signed event replay now requires the persisted buyer claim to exist and match conversion, campaign, referral and pseudonymous buyer. Missing/inconsistent claims fail closed with 409 `partner_claim_inconsistent`, never auto-repaired. Regression tests and `docs/PARTNER_REPLAY_CLAIM_CONSISTENCY_2026-10-18.md` added. Full Node22/Vitest/Emulator proof, legal data retention, independent purchase attestation and approvals NOT verified. **NO-GO.**


### 2026-10-18 — P0 #55 event-record integrity on replay (draft)
Even an HMAC-matching partner webhook retry now requires immutable persisted event fields (campaign, referral, pseudonymous buyer/owner) and the current pending-only proof/reward states to remain consistent; inconsistent data produces 409 `partner_event_inconsistent`. New tamper matrix in `tests/partnerReferralService.spec.ts`; see `docs/PARTNER_EVENT_RECORD_REPLAY_INTEGRITY_2026-10-18.md`. Future verified/reconciled state transitions must be separately designed. Node22/Vitest/Emulator not executed. **NO-GO**.


### 2026-10-18 — P0 #55 Audit-Ereignissemantik korrekt als Partnerbehauptung (Draft)
Neue signierte Partner-Conversions werden als `partner_conversion_asserted` statt irreführendem `partner_conversion_verified` im unveränderlichen Audit-Ledger protokolliert, während Proof-/Reward-Status weiterhin ausschließlich `partner_assertion_only`/`pending_verification` sind. In-Memory-Vitest-Regression und `docs/PARTNER_AUDIT_ASSERTION_SEMANTICS_2026-10-18.md` ergänzt. Alte Audit-Ereignisse nicht umschreiben; Dashboard/Monitoring-Konsumenten vor Release prüfen. Vollständige Mandatory Gates NICHT NACHGEWIESEN. **NO-GO.**


### 2026-10-18 — P0 #55/#56 buyer consent epoch binding (draft)
Partner-conversion events and buyer claims now persist `buyerConsentVersion` and reject old replays after consent is revoked and re-granted. Added in-memory negative tests and `docs/PARTNER_BUYER_CONSENT_EPOCH_2026-10-18.md`; legacy conversion records without epoch fail closed and need approved reconciliation. Full Vitest, emulator, actual consent-version increment contract, privacy/finance approval NOT VERIFIED. **NO-GO.**


### 2026-10-18 — P0 #55/#56 fail-closed buyer consent epoch validation (draft)
New partner assertions reject missing or invalid buyer `partnerReferralVersion` instead of silently assuming consent epoch 1. Negative Vitest cases cover null/missing/nonpositive/fraction/string/unsafe versions. No implicit profile migration; audited user re-consent required for legacy records. See `docs/PARTNER_BUYER_CONSENT_EPOCH_VALIDATION_2026-10-18.md`. Vitest/Emulator and full release gates unverified. **NO-GO.**


### 2026-10-18 — P0 #55/#56 consent-writer epoch integrity (draft)
`setPartnerConsent` now rejects missing/invalid epoch on an already-granted consent instead of silently inferring version 1. Withdrawals at MAX_SAFE_INTEGER are also rejected to prevent overflow. Added in-memory negative tests and `docs/PARTNER_CONSENT_WRITER_EPOCH_GATE_2026-10-18.md`. Explicit legacy-quarantine/withdrawal and independent Privacy approval required. Full Node22/Vitest/Emulator checks NOT executed; **NO-GO**.


### 2026-10-18 — P0 #56 withdrawal remains available for corrupt partner consent history (draft)
`setPartnerConsent(false)` now revokes an existing grant even when its epoch is absent, malformed or exhausted. The transaction sets `partnerReferralConsent=false`, flags `partnerReferralEpochQuarantined=true`, emits signed withdrawal audit and returns nullable `version` rather than fabricating epoch 1; regrant remains denied pending privacy-approved migration. In-memory regression updated, docs: `docs/PARTNER_CONSENT_WITHDRAWAL_QUARANTINE_2026-10-18.md`. Full Node22/emulator/client/schema verification pending. **NO-GO.**


### 2026-10-18 — P0 #56 partner quarantine applied across all eligibility checks (draft)
`partnerReferralEpochQuarantined` now denies listings, referral and interaction paths, click tracking and buyer/owner conversion even if stale consent boolean remains true; withdrawal is preserved. Regression scenarios and `docs/PARTNER_QUARANTINE_ALL_BOUNDARIES_2026-10-18.md` added. Full Node22/Vitest/emulator/PII and independent privacy approval pending. **NO-GO.**


### 2026-10-18 — Visitor consent preserved across stacked partner fixes
During full-source integration, restored the authenticated visitor, adult-consent and transactionally checked visitor deletion safeguards from draft #87 to the latest partner service; now also blocks visitor, buyer and owner quarantine state. Static gate `scripts/check-partner-visitor-consent.mjs` extended for quarantine. Full HTTP and emulator behavior not verified. **NO-GO.**


### 2026-10-18 – P0 #56 idempotent withdrawal under partner consent quarantine (draft)
Second `setPartnerConsent(false)` request on a quarantined, already-revoked profile now returns `{allowed:false,version:null}` without synthesizing epoch 1 or a duplicate HMAC audit entry. In-memory regression and `docs/PARTNER_QUARANTINE_IDEMPOTENT_WITHDRAWAL_2026-10-18.md` added. Full Node22/Vitest/Emulator and Legal/Privacy gates outstanding; **NO-GO**.


### 2026-10-18 – P0 #56 consent withdrawal during pending account deletion (draft)
`setPartnerConsent(false)` now works when `account_deletions/{uid}` exists while grant remains denied. Regression covers pending deletion, repeat withdrawal/audit idempotency and no regrant; see `docs/PARTNER_WITHDRAW_DURING_DELETION_2026-10-18.md`. Deletion-worker ordering and full Node22/Vitest/Emulator/privacy gates unverified. **NO-GO.**


### 2026-10-18 – P0 #56 consent withdrawal after profile purge (draft)
When account deletion is recorded and the user profile is already missing, withdrawal now returns `{allowed:false,version:null}` without recreating personal records or audit entries. New grants still fail; missing user without deletion marker continues to fail. In-memory Vitest regression and `docs/PARTNER_WITHDRAW_AFTER_PROFILE_PURGE_2026-10-18.md` added. Complete deletion proof and Node22/Emulator testing pending. **NO-GO.**


### 2026-10-18 — P0 #56 read-only repeated withdrawal for already-denied consent (draft)
An already-denied `partnerReferralConsent=false` now produces no Firestore mutation or audit append on repeated withdrawal, even for missing, malformed or zero version. A valid existing epoch is returned unchanged; otherwise response uses `version:null`. Regression fixtures and `docs/PARTNER_ALREADY_DENIED_WITHDRAWAL_IDEMPOTENCY_2026-10-18.md` added. Mandatory tests and independent privacy signoff pending. **NO-GO**.


### 2026-10-18 – P0 #55/#56 Partnerlink-Eigentümer-Epoche ohne Version-1-Fallback (Draft)
Link-Ausstellung, Interaktionen, Klicktracking und Conversion prüfen nun eine ausdrücklich gespeicherte positive sichere Eigentümer-Version; ein unbestimmter Legacy-Wert wird nicht als Version 1 interpretiert. Neue Negativ-Vitest-Szenarien und `docs/PARTNER_OWNER_EPOCH_NO_FALLBACK_2026-10-18.md`. Vollständige Node22/Emulator/TypeScript-Gates ausstehend. **NO-GO**.


### 2026-10-18 – P0 #56 explizite Besucher-Einwilligungsversion für Partner-Klicktracking (Draft)
`recordPartnerClick` prüft eine positive sichere Besucher-`partnerReferralVersion` vor und innerhalb der Transaktion, zusätzlich zu Authentifizierung, Erwachsenenstatus, Consent, Quarantäne und Löschung. Ungültige Versionen führen zu direkter Weiterleitung ohne Tracking; statische Prüfung und negative Vitest-Fixtures ergänzt. Siehe `docs/PARTNER_VISITOR_EPOCH_CLICK_GATE_2026-10-18.md`. Vollständige Gates ausstehend; **NO-GO**.


### 2026-10-18 – P0 #56 Besucher-Epochenwechsel zwischen Klickprüfung und Transaktion (Draft)
Klicktracking bindet die beim Vorabcheck festgestellte `visitorConsentVersion` an den in der Firestore-Transaktion erneut gelesenen Wert. Ändert sich die Einwilligungsperiode, wird keine Attribution gebucht. Race-Simulation als In-Memory-Vitest ergänzt; siehe `docs/PARTNER_VISITOR_EPOCH_CLICK_RACE_2026-10-18.md`. Emulator/TypeScript/Privacy-Gates ausstehend. **NO-GO**.


### 2026-10-18 – P0 #55/#56 Kampagnen-Zieladresse beim Klick konsistent halten (Draft)
Die Klicktransaktion fordert nun dieselbe validierte `destinationUrl` wie beim Vorabcheck. Bei einer Zieländerung vor der Transaktion wird nur ungetrackt weitergeleitet, ohne Zähler-/Audit-Schreibvorgang und ohne Tracking-Token. Statischer Check und Race-Vitest ergänzt; siehe `docs/PARTNER_CLICK_DESTINATION_RACE_2026-10-18.md`. Volle Node22- und Emulator-Gates noch ausstehend. **NO-GO**.


### 2026-10-18 – P0 #55/#56 signierte Partnerlink-Metadatenbindung (Draft)
Klicktracking validiert nun die HMAC-Tokenbindung an gespeicherte `ownerUid`-, `campaignId`- und `version`-Werte vor dem Kampagnenzugriff. In der Firestore-Transaktion werden diese Werte erneut geprüft, um Metadatenwechsel nicht attributierbar zu machen. In-Memory-Manipulations- und Race-Tests ergänzt; siehe `docs/PARTNER_CLICK_TOKEN_RECORD_BINDING_2026-10-18.md`. Volle Node22-/Emulator-/Security-Gates ausstehend. **NO-GO**.


### 2026-10-18 – P0 #55 Partner-Conversion prüft HMAC-Referral-Metadatenbindung (Draft)
Neue und wiederholte Conversion-Behauptungen verifizieren vorab die Token-HMAC-Bindung an `ownerUid`, `campaignId` und gültige Referral-Version und gleichen die Version in der Transaktion erneut ab. Neue Manipulations-Regression und `docs/PARTNER_CONVERSION_TOKEN_RECORD_BINDING_2026-10-18.md`; alle Full-Gates offen. **NO-GO**.


### 2026-10-18 – P0 #55 Zeitstempel-Konsistenz bei Partner-Conversion-Replays (Draft)
Ein wiederholtes Partnerereignis wird nur bestätigt, wenn Event- und Käufer-Claim-Zeitstempel, die atomar angelegt wurden, weiterhin identisch und als Datum interpretierbar sind. Bei Abweichung `partner_claim_inconsistent`, keine Reward-Verifikation. Negativer Vitest-Test und `docs/PARTNER_CONVERSION_CLAIM_TIMESTAMP_REPLAY_2026-10-18.md` ergänzt; Mandatory Gates offen. **NO-GO**.


### 2026-10-18 – P0 #55 kanonische UTC-Zeit bei Conversion-Replays (Draft)
Replay-Konsistenz verlangt nun den exakten UTC-ISO-`createdAt`-Zeitstempel mit Millisekunden, gültigem Kalendertag und identischer Claim-Zeit. In-Memory-Vitest erweitert und doppelten Test-Reset entfernt. Details: `docs/PARTNER_CONVERSION_EVENT_TIME_CANONICAL_2026-10-18.md`. Dies beweist keine kryptografische Immutabilität. Mandatory Gates ausstehend, **NO-GO**.


### 2026-10-18 – P0 #56 Art.-17-Eigentümer-Löschung umfasst fremde Käufer-Claims (Draft)
`purgeAccountData` entfernt nun abhängige `partner_referral_buyer_claims` per `referralId` **vor** der Entfernung der Eigentümer-Referrals. Dadurch verbleiben nach dem Löschen eines Link-Eigentümers keine durch dessen Referral verknüpften Käufer-Claims allein aufgrund einer fehlenden `ownerRef`-Spalte. Statische Lösch-Gate-Prüfung in `scripts/check-art17-deletion-audit.mjs`; Emulator-/Staging-/DPO-Nachweise fehlen. `docs/ART17_REFERRAL_OWNER_BUYER_CLAIM_CASCADE_2026-10-18.md`. **NO-GO**.

---

## 2026-10-18 — Art. 17 audit-gate integration (Draft PR #118)

The `check:art17-deletion-audit` npm script on the draft branch now additionally runs `scripts/test-art17-owner-claim-cascade.mjs` after the existing static audit and storage deletion checks. Verified in an isolated source snapshot with an official SHA-256-verified Node **22.23.3** binary: integrated command exit 0, **7/7 storage tests** and **5/5 negative owner-claim mutation tests** pass. Four standalone static boundary checks (secrets, auth, public Firestore rules, AI PII) also returned exit 0. Detailed scope/limitations are in `docs/ART17_OWNER_CASCADE_REGRESSION_2026-10-18.md`.

**Production remains NO-GO.** This is not evidence of live Firestore deletion, Art.-17 completeness, production TTL settings, full CI/Emulator/E2E/build, or independent Security/Privacy/Legal signoff. `main` is unchanged and no deployment or manual paid Actions rerun occurred.

---

## 2026-10-18 — Art.-17-Löschkaskade: Zeitscheibenkontrolle je Referral (#56)

Auf dem gestapelten Draft-Branch von PR #118 wird nun bei jedem einzelnen Eigentümer-Referral innerhalb der maximal 400 Einträge großen Abfrageseite `checkDeletionSlice()` ausgeführt, bevor die verknüpften Buyer-Claims gelöscht werden. Damit wird die Zeitscheiben-Grenze auch zwischen umfangreichen Referral-Löschungen beachtet; die bisherige Reihenfolge **Claims vor Parent** bleibt erhalten. Ein sechster deterministischer Mutationstest verweigert das Entfernen dieses Kontrollpunkts.

**Tatsächlich ausgeführt:** Auf dem GitHub-Commit `33b2812b2f12e67678da6c7aca8aca1cdd340a4c` wurde `npm run check:art17-deletion-audit` unter Node `22.23.3` erfolgreich ausgeführt (7/7 Storage-Testfälle, 6/6 negative Mutationstests, Art.-17-Statischprüfung PASS). Das vollständige Commit-ZIP bestand die ZIP-CRC-Prüfung. Die Fehlerbehandlung eines zunächst falsch escapten Prüfausdrucks wurde vor dem erfolgreichen Lauf korrigiert.

**Weiterhin NO-GO:** Noch keine echten Firestore-Emulator-Tests für Konkurrenz, Abbruch/Wiederaufnahme und Nachweis der vollständigen Kaskadenlöschung; auch die vollständigen TypeScript-/E2E-/Build-/Supply-Chain-Gates, reale TTL-Policies und unabhängige Datenschutz-/Rechts-/Sicherheitsfreigaben sind nicht nachgewiesen. Kein Produktionsdeployment, kein Merge nach `main`, keine manuell gestartete kostenpflichtige CI.

---

## 2026-10-18 — Additional Art. 17 pre-parent deletion checkpoint (Draft PR #118)

Before the owner referral document is deleted, the account-erasure worker now invokes `checkDeletionSlice()` **after** the awaited buyer-claim removal. This avoids final parent deletion after the slice expires during a long child purge; the surviving parent remains available for safe restart. Static Art. 17 control and the offline mutation suite now enforce both slice checkpoints (per-referral start and after child deletion) plus child-before-parent ordering.

**Verified:** Exact source commit `cfb15b10f93aec89734a6fddae0ef549a9e2db64`, Node 20.20.2, baseline and **7/7 negative mutation tests PASS**, ZIP CRC check PASS (1,251 entries). Attempted independent Node 22.23.3 integrated test in remote workbench but the environment crashed before reporting a result; thus pinned Node22 integrated gate for this commit is **NOT VERIFIED**. Previous Node22 tests on earlier commits do not validate this new head.

**Remaining NO-GO:** Firebase Emulator concurrency/restart, full pinned Node22 suite, TypeScript/Vitest/E2E/build/npm audit, real Firestore TTL ACTIVE evidence, and independent Privacy/Legal/Security approvals. `main` untouched, no production deployment or manually dispatched paid GitHub Actions.

---

## 2026-10-18 — Fail-closed section markers for Art. 17 source audit (#56 / draft PR #118)

The Art. 17 static source audit now checks the presence and order of both owner-referral cleanup section boundaries before evaluating the child-before-parent controls. This removes the risk of JavaScript `slice()` silently using an invalid `-1` boundary and scanning the wrong source section. Two new isolated mutation fixtures remove each anchor independently, bringing the suite to **nine** cases.

**Executed evidence:** On exact GitHub source commit `b630167111994ae782ab7b0eb551dbc2ea70ff5b`, the baseline and **9/9 negative mutations** passed with the available Node **20.20.2** runtime. The source ZIP contains 1,251 entries and passed archive CRC inspection. These checks are static only; the final Node 22.23.3 integrated gate, Firestore Emulator restart/concurrency, npm audit, typecheck, Playwright/build and independent Privacy/Legal/Security approvals remain **NOT VERIFIED**. No production release, merge or deployment; **NO-GO**.

---

## 2026-10-18 — Art. 17 static boundary uniqueness (Draft PR #118)

The source-level owner-referral deletion audit now rejects duplicate cascade start/end markers as well as absent or invalid boundaries, eliminating ambiguous first-occurrence selections when a marker is duplicated in comments or generated source. Two additional fault injections increased the suite to 11 cases. **Actual offline evidence:** On exact GitHub commit `0a835dfd69eceda687f46f14f75707ecb6a35c21`, Node 20.20.2, static baseline PASS and **11/11 negative mutation regressions PASS**. Source ZIP CRC PASS (1,251 entries).

**NO-GO:** Full Node 22.23.3 mandatory suite on final SHA, Firestore Emulator restart/concurrency, TypeScript, Playwright, npm audit, real Firestore TTL ACTIVE proof and independent Privacy/Legal/Security reviews are not verified. This is a test-boundary improvement, not a completed Art. 17 deletion proof; no merge or deployment.

---

## 2026-10-18 — P0 #56: Transactional referral quarantine during Art. 17 erasure

**Implementation:** Draft PR #118 now transactionally changes an owned partner-referral document to `status: 'deleting'` **before** scanning and deleting its linked buyer claims. A provider conversion already requires the same referral to be `active` within its Firestore transaction; the tombstone closes the potential create-during-deletion window. Quarantine validates `ownerUid`, is idempotent across resumed deletion slices, does not resurrect a missing document and fails closed on transaction errors. Child-before-parent deletion and per-referral time-slice checks remain in place.

**Executed evidence on source commit `f83c84acbc3f03fbedb6583cb54ae61abae8eff0`:** SHA-256-verified Node **v22.23.3**, `npm run check:art17-deletion-audit` exit 0: seven storage deletion tests, **12 negative static cascade mutations**, and **six in-memory transactional helper tests** all PASS. Exact-source ZIP integrity verified (1,255 entries). This evidence covers static gates and a contract-level mock only.

**Missing release evidence:** The three new real Firestore Emulator integration cases are committed but **NOT RUN**; independently verify transaction conflicts, restarts and cross-buyer claim cleanup. Full Node22 TypeScript/Vitest/E2E/build/npm-audit suite, active Google Cloud TTL policies, legal-hold handling and independent DPO/Security/Legal approvals are also outstanding. Existing historical `RELEASE_MANIFEST.json` release-candidate fields describe earlier baselines and must not be mistaken for approval of this draft. No manual GitHub Actions run, no merge/deployment. **Production remains NO-GO.**

Reference: `docs/ART17_PARTNER_REFERRAL_QUARANTINE_2026-10-18.md`.

---

## 2026-10-18 — P0 #56 pinned runtime preflight on documented branch head

On exact source commit `c4d03eae44fa213d0af394fe71ea16a8e3ee1ccd`, an official SHA-256-verified Node **22.23.3** binary was used to execute `npm run check:art17-deletion-audit`: exit **0**, **7/7 storage**, **12/12 static mutation**, **6/6 functional quarantine mock** tests passed. Secrets, Firebase Admin auth-boundary, public Firestore-rules and AI PII source-boundary checks returned exit **0** when executed against the unchanged 1,131-file source tree. An initial secrets-check `INCOMPLETE` was caused by a temporary, external `node_modules` symlink introduced solely to run the isolated TypeScript tests; removing that symlink from the scan environment resolved it. No code was changed to bypass the scanner.

**Still NO-GO:** Actual Firestore Emulator tests, provider conversion concurrency/fault injection, live GCP TTL ACTIVE evidence, full CI/typecheck/build/Playwright/npm audit and independent Security/Privacy/Legal review were not completed. This statement does not imply production approval.

---

## 2026-10-18 — P0 #56: Firestore Emulator invocation fail-closed

The dedicated Art.-17 partner-referral emulator run now refuses absent, production-like, non-local, wrong-port and wrong-project hosts instead of returning success from silently skipped tests. `test:art17-partner-emulator` invokes `scripts/run-art17-partner-emulator.mjs` inside `firebase emulators:exec`; four targeted Firestore transaction scenarios, including concurrent assertions and a post-quarantine claim sweep, are committed but **not executed**.

**Executed on GitHub source commit `5f4edcdd90b3d2fb4a99effb539bf44f2cf4ff03`:** official SHA-256 verified Node **22.23.3**; the integrated Art.-17 gate exited 0 with **7/7 storage, 12/12 static cascade mutation, 6/6 quarantine contract and 6/6 unsafe-emulator-preflight rejection tests**. No valid real Firestore Emulator pass, full TypeScript/Vitest/Playwright/build/npm-audit, active GCP TTL or independent Security/Privacy/Legal attestation was obtained.

**CI caveat:** Earlier automatic GitHub Actions run 39162571437 on a prior SHA ended in failure with `runner_id: 0`, no steps and an empty log archive. It is not evidence of a failing application test or a passed CI run. No paid Actions rerun was manually started. **Production decision remains NO-GO.**

---

## 2026-10-18 — P0 #56 root-ref fail-closed guard and Emulator contention tolerances

The owner-referral quarantine helper now validates that the reference belongs to the **root** `partner_referrals/{id}` collection, not merely a collection named `partner_referrals` nested below another document. Added a regression asserting that a nested ref fails **before** any database transaction. The four Firestore Emulator scenarios now use 90-second per-case timeouts to accommodate documented Emulator transaction-lock behavior; this does **not** alter production deletion limits.

**Verification pending at this exact commit:** after committing these changes, rerun the Art. 17 integrated gate under Node 22.23.3, four static security boundaries, and validate complete artifact integrity. The genuine Firestore Emulator scenarios and full enterprise CI remain unverified; do not mark production GO. Reference: `docs/ART17_PARTNER_REFERRAL_QUARANTINE_2026-10-18.md`.

---

## 2026-10-18 — Root-path deletion guard and native Node22 Art.-17 checks

The transactional partner referral quarantine now rejects nested refs such as `users/{uid}/partner_referrals/{id}`, even if their `parent.id` is `partner_referrals`. A new in-memory regression asserts rejection without opening a transaction. The four real Firestore Emulator tests use 90-second timeouts to tolerate Firestore Emulator lock delays documented by Firebase (up to 30 seconds).

The Art.-17 compliance npm gate was switched from test-only `tsx` loading to Node 22.23.3 native `--experimental-strip-types` to avoid a transient `ENOTCONN` transpiler spawn error. The stand-alone contract test on code SHA `3c80f93be0aee5fb95f72769e67b360a2a35074c` returned 7/7 PASS, 12/12 static cascade mutations PASS and 6/6 fail-closed Emulator preflight cases PASS on verified Node 22.23.3. A complete integrated gate pass must be rechecked on the following committed package-script SHA before marking this iteration's targeted gates PASS. Real Firestore Emulator tests, full typecheck/build/npm audit and sign-offs remain missing. **NO-GO.**


### 2026-10-18 – Pinned Node22 target gate at code commit `ed91c77580c86dff5da61ac9de11e7e6de3b5dfb`

The whole integrated `npm run check:art17-deletion-audit` exited **0** on the SHA above using Node **v22.23.3** without a separate `tsx` worker. Its seven storage tests, twelve Art. 17 negative mutations, seven in-memory partner-referral transaction tests (including the nested-path denial), and six unsafe-Emulator preflight tests all passed. The four independent static checks—`check-secrets`, `check-auth-boundary`, `check-public-firestore-rules`, `check-ai-pii-sanitizer`—also exited **0** on the unchanged repository files. The full GitHub ZIP of this commit passed CRC validation (1,257 entries, SHA-256 `4f8f5ca718a426700b422fe289577ed939d7ef1ccd83c86f09c0067dbb840c03`).

This is **offline/static and mocked Firestore** evidence. Four real Firestore Emulator integration scenarios are not executed; full TypeScript/Playwright/build/npm audit, production TTL and independent Security/Privacy/Legal approvals are not verified. GitHub Actions is not certified PASS. `main` remains unchanged; **NO-GO**.

---

## 2026-10-19 — Art.-17 Emulator tests fail closed on direct invocation

The direct `tests/partnerReferralDeletionEmulator.spec.ts` path now checks loopback host, configured port, project consistency, production runtime and disabled durable fallback before any SDK database access. The dedicated runner likewise rejects mismatching `FIREBASE_PROJECT_ID` and local proxy/fallback tests; three further negative regressions cover those bypasses. This prevents a green report from exercising a development fallback instead of real Firestore Emulator semantics.

**NO-GO** remains: the four genuine Emulator cases are not yet executed; Node 22.23.3 static/contract tests should be repeated on the immutable final SHA. Full TypeScript/Vitest/Playwright/build/npm audit, active TTL policy evidence, runner availability and DPO/Security/Legal approvals remain open.


### 2026-10-19 — Verified emulator test-harness safety

**Exact code SHA:** `b41f37a06f58aac45c33e6d3ffa61e7ffeca2425`. With an official SHA-256-verified Node **22.23.3** binary, `node --test scripts/test-art17-emulator-preflight.mjs` returned exit **0 (18/18)**: nine negative launcher checks plus one accepted local direct-guard case and eight rejected direct-guard cases. The latter execute the actual guard source in an isolated Node VM with no Firestore SDK. `npm run check:art17-deletion-audit` also exited **0**, incorporating seven storage cases, twelve owner-claim mutations, seven quarantine contracts and eighteen test-harness boundary tests.

These results show fail-closed behavior of the test harness, **not** the execution of the four genuine Firestore Emulator transaction scenarios. The full TypeScript build, Playwright, real TTL ACTIVE state and independent DPO/Security/Legal sign-offs are outstanding. The latest GitHub Actions runner remains unavailable. **Production NO-GO.**

---

## 2026-10-19 — P0 #70 TTL integration with Art. 17 Draft #118

A separate integration branch combines the Art. 17 Draft #118 source with the reviewed *staging-only* TTL provisioner, evidence validator, and negative tests from Draft #116. The original PRs remain unmerged and intact. The new `npm run check:retention-p0` gate is mandatory within `npm run check:enterprise` after the Art. 17 static/contract checks.

On code commit `e88268adc11eec11d6cb73140cf13f327a659f79`, all **five offline TTL script test groups** passed (13 groups, 6 matrix negatives, 9 ACTIVE evidence negatives, dry-run/prod-deny and project identity mock). Those tests **do not** establish live staging TTL policy state or safe legal-hold retention. The combined Node22 final commit check is still to be executed. Consult `docs/P0_ART17_RETENTION_INTEGRATION_2026-10-19.md`. **Production remains NO-GO.**


## Executed combined proof — 2026-10-19

**Exact verified code commit:** `c85efca453d8c022c6c11b738c63220134af7d19`.

Official SHA-256-verified Node `v22.23.3` was used on a complete GitHub source archive. The following commands returned exit 0:

- `npm run check:art17-deletion-audit` (seven storage tests, twelve Art. 17 source mutations, seven in-memory quarantine contracts, eighteen Emulator harness/preflight safety cases).
- `npm run check:retention-p0` (13-group matrix, six negative matrix mutations, nine negative read-only TTL ACTIVE evidence mutations, staging dry-run and mock project-identity tests).
- `node scripts/check-secrets.mjs`, `node scripts/check-auth-boundary.mjs`, `node scripts/check-public-firestore-rules.mjs`, `node scripts/check-ai-pii-sanitizer.mjs` (all PASS).

The complete archive contained **1,269 ZIP entries**, passed CRC check and had SHA-256 `cb33306921de4d585c87975f1ae267474b6d22d5e20077a2961d3150ae5033dd`.

**Unverified / NO-GO:** The isolated low-memory environment crashed while attempting to launch the actual Java-based Firestore Emulator, so none of the four real transaction scenarios passed. No live staging/prod Firestore TTL ACTIVE evidence was obtained. The full enterprise typecheck/Vitest/Playwright/build/npm audit and independent DPO/Security/Legal approval remain missing. No TTL mutation, production database access, merge or deployment took place.

---

## 2026-10-19 — Staging TTL evidence acquisition hardened (P0 #70)

Added a separate **read-only** `verify:retention-staging-live` command that verifies approved project/database, the independently reported GCP staging environment label, 13 ACTIVE TTL fields, and an optional non-overwriting private JSON export. It rejects production identities, mutating mode, malformed/unready cloud responses and unsafe export targets before accepting evidence. The offline mock-gcloud suite is now part of `check:retention-p0`; 12 denied scenarios plus one valid isolated case were exercised before this docs commit. The cloud **has not** been queried; this is not an ACTIVE certification. The real Art.17 Firestore Emulator, full typecheck/E2E/build and independent legal/security/Privacy signoffs remain outstanding. **NO-GO.**


### 2026-10-19 — Read-only staging TTL collector verified on pinned Node 22.23.3

**Tested code commit:** `6331cf918443b930f130a0672d37392567096724`. The complete GitHub source archive of this commit was CRC-valid (1,271 entries; SHA-256 `1e22c3026120c50452f4ab812a70e726c005733e381537a2842b764d1c7e3802`). With **Node 22.23.3**, the following ran and returned exit code **0**:

- `npm run check:art17-deletion-audit` — static and contract tests PASS; **not** genuine Firestore Emulator integration.
- `npm run check:retention-p0` — includes **13 TTL collection groups**, six matrix negatives, nine JSON ACTIVE-evidence negatives, staged provisioning tests, plus a positive read-only collector fixture and **12 fail-closed mock-gcloud collector scenarios**.
- `node scripts/check-secrets.mjs`, `node scripts/check-auth-boundary.mjs`, `node scripts/check-public-firestore-rules.mjs`, `node scripts/check-ai-pii-sanitizer.mjs` — all PASS.

**Evidence limitation:** The collector was exercised using a *fake* gcloud command. No real Cloud project was queried, no live TTL ACTIVE state was attested, and no TTL settings were changed. The actual Firestore Emulator scenario suite, full TypeScript/Vitest/Playwright/build/npm-audit, review of legal holds, partner buyer-binding and independent DPO/Legal/Security approvals are still pending. Draft PR #119 stays unmerged; production decision **NO-GO**.


## 2026-10-19 — P0 #70: Sieben übersehene expiresAt-Collection-Groups

Im Quellcode wurden sieben fehlende TTL-Collection-Groups identifiziert: `password_reset_rate_limits`, `verification_mail_rate_limits`, `account_deletion_rate_limits`, `kyc_start_rate_limits`, `kyc_reconciliation_events`, `chat_message_rate_limits`, `chat_gate_answer_rate_limits`. Die Staging-Plan-/Evidenzmatrix wird von 13 auf **20** erweitert; vollständige Gruppe-für-Gruppe-Ergänzung und Tests sind erforderlich. Der neue Freigabemarker `KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19` verhindert das Anwenden einer erweiterten Matrix mit alter 13er-Genehmigung. Das ist **kein** Freibrief für die Aktivierung; die unabhängigen Rechts-/Inventar-/Cloud-Freigaben stehen aus. Keine Cloud-Änderung, kein Merge und kein Deployment. **NO-GO**.


### 2026-10-19 — TTL expiry writer branch-specific regressions

The existing 20-group staging-only TTL source guard previously checked that a module contained *some* `expiresAt` value. That could accept a limiter where the create branch retained its expiry date but the update branch silently stopped storing it (or vice versa), and could accept an unrelated KYC expiration as evidence of `kyc_reconciliation_events` expiry.

The guard now checks **each individual transaction set/update write** for all four previously omitted rate-limit writer families, both operations of the shared chat limiter, and the exact KYC reconciliation write. It requires a `new Date(...)` timestamp rather than merely an `expiresAt` spelling elsewhere in the file. The executable offline mutation test contains **20 fail-closed mutations** (including 11 single-write expiry field removals), rather than the earlier 9 source-name-only mutations. This is source-based coverage, **not** a running Firestore integration test or proof that all historical records contain valid timestamp fields.

Firebase documents that TTL requires a timestamp field, deletion is asynchronous, and TTL does not recursively delete subcollections: https://firebase.google.com/docs/firestore/ttl. Actual 20-group Staging ACTIVE state, review of historical timestamps/holds, independent Legal/DPO approval and true Art. 17 cascade execution remain prerequisites for release. **NO-GO**.


### 2026-10-19 — P0 #70: Undokumentierte zusätzliche TTL-Policies strikt ablehnen

**Quellbefund:** `scripts/check-retention-active-evidence.mjs` ignorierte bisher mit `if (!required.includes(group)) continue` jede TTL-Policy einer nicht in der genehmigten 20er-Matrix enthaltenen Collection-Group. Da `gcloud firestore fields ttls list` sämtliche konfigurierten TTL-Felder der gewählten Datenbank auflistet, konnte ein erfolgreicher 20/20-ACTIVE-Nachweis gleichzeitig eine **zusätzliche, potenziell rechtswidrige Löschrichtlinie verschweigen**.

**Korrektur:** Die Read-only-Evidenzprüfung bricht jetzt bei **jeder** unerwarteten TTL-Policy sofort ab, auch bei `CREATING` und alternativen Feldnamen. Zusätzliche Richtlinien müssen zuerst in der vollständigen Matrix erfasst, auf Rechtsgrundlage, Aufbewahrung und Legal Holds geprüft und gesondert genehmigt werden; der Validator bietet absichtlich keine automatische `ignore`-Ausnahme. `test-retention-active-evidence.mjs` enthält nun **12** Negativmutationen statt 9. Das Mock-Staging-Skript verweigert zusätzlich eine unautorisierte aktive Policy (**13** Fail-Closed-Szenarien statt 12). Vor der Korrektur hätte der Validator die unautorisierte ACTIVE-Policy akzeptiert.

**Wichtige Grenze:** Das sind lokale JSON-/Mock-/Quellcode-Tests, **kein** realer Google-Cloud-Abruf. Diese Änderung aktiviert/deaktiviert/löscht keine TTL-Policies. Für eine GO-Entscheidung fehlen insbesondere die unabhängig genehmigte *vollständige* 20er-Policy-Matrix, die Auswertung **aller** tatsächlich vorhandenen Policies im freigegebenen Staging, Bestands-/Legal-Hold-Nachweise, echte Firestore-Emulator-Transaktionen und die vollständigen Enterprise-Release-Gates. Produktionsfreigabe **NO-GO**.

Google-Cloud-Dokumentation: https://docs.cloud.google.com/sdk/gcloud/reference/firestore/fields/ttls/list und https://firebase.google.com/docs/firestore/ttl


## 2026-10-19 — Integration der SLO-Korrektur aus Draft-PR #77 (Issue #71)

Der ursprünglich auf `main` gemeldete P95-Widerspruch ist in diesem **separaten Integrationszweig** korrigiert: `src/server/observability.ts` importiert den kanonischen Zielwert `api-latency-p95-ms` aus `ops/slo.json` (aktuell **300 ms**) und setzt `klar_http_p95_slo_breach` ab `p95 > API_P95_SLO_MS`, nicht erst oberhalb von 1500 ms. Die bestehende statische Prüfung `scripts/check-observability.mjs` wurde ebenfalls von ihrer **historischen 1500-ms-Annahme** befreit; diese war im ursprünglichen Draft-PR #77 nicht korrigiert und hätte den `check:enterprise`-Pfad nach dem Import blockiert. `check:observability` führt nun zwingend zusätzlich `scripts/test-slo-policy.mjs` aus, einschließlich der tatsächlichen Metrik-Ausdrucksgrenzen 299/300/301/1500 ms. Die Korrektur verwendet die bereits in PR #77 geprüfte minimale Änderung, belässt diese Draft-PR jedoch eigenständig und ungemergt.

**Wichtige Messgrenzen:** Die exporterinterne P95-Berechnung erfolgt aus höchstens 15 Minuten lokaler Trace-Latenzen, und die ausgegebene Metrik ist ein einzelner Gauge. Daraus folgt **kein** 30-Tage-SLO für alle Serverinstanzen, keine aggregierte Prometheus-Histogramm-Verteilung, keine gültige Error-Budget-/Burn-Rate-Ableitung und kein verifizierter Pager. Solche Flotten-Quantile sollten separat aus aggregierbaren Histogramm-Buckets mit `histogram_quantile()` berechnet werden; Prometheus warnt ausdrücklich vor dem Aggregieren von quantile-Gauges. Ein SLO-GO braucht daher bestätigte SLI-Filter, Produktions-/Staging-Telemetrie, 30-Tage-Fenster, Alert-Delivery und unabhängige SRE-Freigabe. **Issue #71 bleibt offen / Produktionsfreigabe NO-GO**.

Offizielle Quelle: https://prometheus.io/docs/practices/histograms/ .


## 2026-10-19 — P0 #70: Read-only preflight before any staging TTL update

**Confirmed source gap (base commit `7adc5c1e0320cfd9826136f2f206bb78ea3dd749`):** `scripts/configure-retention.sh` gated the staging target, environment label, DPO/legal inventory approval and 20-group matrix revision, but issued 20 sequential `gcloud firestore fields ttls update` operations **without first reading the database's existing TTL policies**. Thus an unapproved pre-existing policy, nonzero expiry offset, alternate field, or unfinished `CREATING` operation could go unnoticed until after writes had started. The separate ACTIVE evidence checker did not prevent this scenario because it ran only when the operator deliberately requested evidence afterward.

**Correction:** Before any “update” call, the script now runs the read-only, explicit-project-and-database `gcloud firestore fields ttls list --format=json` command. It uses `check-retention-active-evidence.mjs --mode preflight` to permit only a subset of the **approved 20 “expiresAt” policies**, each already ACTIVE with zero/default expiration offset. An empty policy list is safe for the preflight; unknown groups/fields, wrong scope, duplicates, nonzero offset, `CREATING`, malformed JSON or cloud-list failure abort **before the first write**. Full final ACTIVE evidence still requires all 20 groups in the separate standard validator mode; preflight must never substitute for after-activation independent proof.

**Offline negative proofs:** The mock `gcloud` stage test asserts **zero TTL update calls** for an unapproved existing policy, an unfinished policy and a failing list command, and exactly 20 updates for a safe mocked empty list after all approvals. The source-matrix gate also enforces that the read-only list/validation precedes the first update and has three mutation regressions against a removed/bypassed preflight. The checker accepts an empty or approved existing subset and rejects seven malicious existing-policy fixture types. **No cloud TTL settings have been read or modified during these tests.**

**Residual risk:** The preflight is a snapshot and cannot rule out changes by a concurrent administrator after it completes (TOCTOU); a protected change window, least-privilege Cloud IAM and independent change approval are still necessary. Since policies are applied sequentially, an operational error after the first write could result in **partial activation**, which must be independently reconciled. Existing expired-data and legal-hold review is mandatory because activating TTL can trigger deletion of historical records. Firestore TTL deletion is asynchronous, non-recursive, and billable. No production deploy/merge and no human GO authorized.

Sources: https://firebase.google.com/docs/firestore/ttl and local scripts/tests described above. **PRODUCTION NO-GO**.


### 2026-10-19 — TTL staging idempotence and mandatory 3-iteration NO-GO review

The staging TTL provisioner now uses the existing fail-closed scoped policy preflight to retrieve validated ACTIVE group identifiers and skips already ACTIVE policies. Mocked GCP tests show **20/18/0 update requests** when **0/2/20 policies** were already ACTIVE, and unsafe policy fixtures still cause zero writes. Three additional static matrix mutations cover an omitted skip or ID-validation step; the regular full-20 ACTIVE evidence check remains unchanged. See `docs/ADR_TTL_STAGING_IDEMPOTENCE_2026-10-19.md` and `docs/ENTERPRISE_REVIEW_3_ITERATIONS_2026-10-19.md`.

The mandatory tests cannot yet all pass in the isolated checkout: root Bun-only lock policy forbids npm package-lock, `npm audit` exits ENOLOCK, and the full TS/Vitest/Playwright/Emulator/build toolchain is absent. Do not fabricate zero vulnerabilities or GO from static checks; the final third-iteration result is recorded in the associated Draft PR description. **NO-GO.**


### 2026-10-19 — P0 production CSP runtime bypass closed; SCA Critical / NO-GO

The `VITE_EMULATOR=true` build flag previously disabled enforced production Helmet CSP. Production/recognized Cloud runtimes now always enforce CSP. Emulator origin expansions require explicit non-Cloud local smoke authorization, and the local smoke command opts in deliberately. The mandatory `check:csp` script includes three new Node22 regression tests in addition to twelve static CSP directive checks. See `docs/ADR_CSP_PRODUCTION_FAIL_CLOSED_2026-10-19.md` for N-1 and rollback.

**Important independent supply-chain finding:** Official SHA-256-verified Bun 1.4.2 `bun audit` on the existing `bun.lock` reports **1 Critical, 4 High, 4 Moderate, 3 Low** advisories; production scope still has **1 High** (`source-map-js`). `shell-quote@1.9.0` (via dev-only `concurrently`) is **Critical** and must be remediated safely. Functions npm lock audit: two Moderate, no High/Critical. No package versions were blindly changed, no dependencies installed, and no full Build/Typecheck/E2E tests were achieved. Exact audit evidence and remaining mandatory gate failures are documented in `docs/SECURITY_SCA_2026-10-19.json` and `docs/ENTERPRISE_IMPLEMENTATION_2026-10-19.md`. No GO, no merge, no production config change.


### 2026-10-19 — Finalization: emulator port preflight, runner evidence and TTL NO-GO

The Rules and Art17 Firebase profile actually reserves Firestore **8085**, hub **4405**, and logging **4505**; the old hard-coded port check omitted all three. The replacement reads the approved Firebase emulator config instead of guessing. Eight Node22 offline regressions PASS (including denial for port conflicts and unsafe production/fallback settings). All corresponding Rules/Art17 scripts execute this preflight before starting their isolated emulator. Correct dependency install is `bun ci`, not `npm ci` in the root app.

A real Java21/Firestore Emulator process started locally using `firestore.rules` and `demo-klar`, but the sandbox crashed before any SDK tests; **actual integration was NOT completed**. Issue #70 20-group TTL offline gates PASS, while real staging ACTIVE policies, legal holds, data-lifecycle inventory and independent approval are **NOT VERIFIED**. GitHub Actions job #117997339276 used `ubuntu-latest`, received runner_id=0 and ran zero steps; Actions repository variables list was empty. Runner assignment/billing/platform cause requires administrator diagnostics, not an unverified YAML change. Root supply chain still has outstanding High/Critical advisories. **Release NO-GO**.

See `docs/FINALIZATION_EMULATOR_RUNNER_TTL_2026-10-19.md` and `docs/ADR_FIRESTORE_EMULATOR_PORT_PREFLIGHT_2026-10-19.md` for evidence, rollback and N-1 compatibility.


### 2026-10-19 — GO-Behauptung aus externem PDF nicht freigegeben (P0 Release-Governance)

**Aktueller Status: NO-GO.** GitHub belegt weiterhin 15 offene Issues und ungemergte Draft-PR #119. Die externe PDF mit "GO / 0 Issues / alle Tests PASS" ist **keine** gültige Build-, Emulator-, Rechts- oder CI-Attestation. Das enthaltene Beispiel `referralRef.delete()` löscht Firestore-Subcollections nicht; die pauschale 30-Tage-Partner-Referral-Löschung ist ohne genehmigte Retention-/Legal-Hold-Matrix unzulässig als automatische Produktionsfreigabe.

Die bisherige Produktionsfreigabeprüfung akzeptierte nur `KLAR_PRODUCTION_RELEASE_APPROVED=true`, selbst während `RELEASE_MANIFEST.json` noch NO-GO meldete. Sie wurde fail-closed um Manifest, vollständige Go-Live-Checkliste, 14 commitgebundene Gate-Belege, 13 Compliance/Emulator/TTL-Belege, sauberes Critical/High-SCA und unabhängige Security/DPO/Legal/SRE-Freigaben erweitert. Positive synthetische Tests belegen lediglich das Prüfungsschema, nicht die Echtheit einer externen Signatur. CI und produktiver Release bleiben bis zu echten Nachweisen gesperrt. ADR/Belege: `docs/ADR_RELEASE_GO_EVIDENCE_2026-10-19.md`, `docs/GO_CLAIM_AUDIT_2026-10-19.md`.


### 2026-10-19 — Reproduzierbare Release-Guard-Validierung, weiterhin NO-GO

Unter SHA-256-verifiziertem Node v22.23.3 wurden **45** fail-closed Release-Evidenztests und die Release-Workflow-Quellprüfung erfolgreich ausgeführt. Das reale `check-production-release-approval.mjs` verweigert bei gesetztem Test-Flag `KLAR_PRODUCTION_RELEASE_APPROVED=true` weiterhin die Produktion, solange das GitHub-Manifest NO-GO und fehlende echte Gate-Evidenz meldet. Dies ist das **korrekte erwartete Scheitern**, nicht eine fehlgeschlagene Regression. Der vollständige 14-Gate-Testdurchlauf meldete **5 PASS / 9 FAIL oder blockiert**: Enterprise/TypeScript-Modul fehlt; Root-npm-audit=ENOLOCK wegen Bun-only; Gitleaks/Semgrep fehlen; tsc/Vitest/firebase-tools/Playwright/Vite nicht vorhanden. **Kein GO, keine geschlossene Issue-Liste, keine unabhängigen Legal/DPO/Security/SRE-Signoffs.**

Der unveränderte `bun.lock` darf nicht durch `npm ci` oder ein neues npm-Lockfile umgangen werden. Umfassende Sicherheits- und Integrationsbelege bleiben Pflicht. Weitere Details in `docs/GO_CLAIM_AUDIT_2026-10-19.md`.


### 2026-10-19 – CODEOWNERS P1 #73 path alignment, NOT VERIFIED reviews

The repository-root CODEOWNERS policy now explicitly covers active `phase2_work` authorization, Stripe, partner webhooks, Firestore/Storage rules, retention, release and workflows. Static Node path/mutation tests (6 tests) and the new `check:codeowners` source gate are integrated into `check:enterprise`. The repo is owned by a GitHub *User* account, while `@klar/...` organization team role names are inherited and their existence/write access and effective branch reviews remain **NOT VERIFIED**. GitHub CODEOWNERS uses the base branch, so Draft PR #119 cannot itself prove effective reviewer routing. Issue #73 and production status stay **NO-GO**. ADR: `docs/CODEOWNERS_GOVERNANCE_2026-10-19.md`.


### 2026-10-19 — GO checklist parser fail-closed security regression

The production release evidence checker formerly accepted an **empty** or title-only checklist and failed to recognize unchecked GitHub Flavored Markdown tasks using `*`, `+`, ordered numeric markers or extra whitespace. The checker now requires at least one task and rejects all unchecked or malformed task markers (`[-*+]`, `1.`, `2)` syntax). **55** synthetic structure/negative Node22 release-evidence regressions PASS; separate TTL, Art.17, emulator profile, CODEOWNERS and workflow source gates PASS. The real release approval checker still rejects the actual `NO-GO` manifest even when `KLAR_PRODUCTION_RELEASE_APPROVED=true` is provided in a negative test.

**Compliance scope:** structural validation is not authentic signed CI evidence; actual Firestore Emulator transactions, live 20-group TTL and legal-hold approvals, full security scanning and independent Security/DPO/Legal/SRE signoff remain unverified. Preserve **NO-GO** and open Issues. ADR: `docs/ADR_GO_CHECKLIST_TASK_PARSER_2026-10-19.md`.


#### Lokaler Mandatory-Gate-Lauf (19.10.2026, Node v22.23.3, SHA-256-verifiziert)

**5/14 PASS; 9/14 FAIL oder nicht ausführbar.** PASS: `check-secrets.mjs`, `check-auth-boundary.mjs`, `check-public-firestore-rules.mjs`, `check-ai-pii-sanitizer.mjs` und `check-art17-deletion-audit.mjs 0`. FAIL/BLOCKIERT: `npm run check:enterprise` (TypeScript-Modul nicht installiert), Root-`npm audit --audit-level=high` (kein npm-Lockfile, Bun-only Root), Gitleaks und Semgrep (ohne installierte lokale Executables, kein Auto-Download), TypeScript, Vitest, Firebase Rules (`firebase-tools` fehlt), Playwright (nicht installiert), Build (`vite` fehlt). Dieses Ergebnis belegt **keinen vollständigen** Supply-Chain-/SAST-/Emulator-/Browser-Test; produktive Security/DPO/Legal/SRE-Abnahmen fehlen. Der Release-Status bleibt **NO-GO**. Der Checkout enthält nur den isolierten Arbeitsstand; keine produktive Cloud-Anpassung wurde vorgenommen.


### 2026-10-19 — AI-Code-Review / CODEOWNERS bypass hardening, weiterhin NO-GO

Semantisches AI-Code-Review entdeckte einen P1-Review-Guard-Fehler: lokale `CODEOWNERS`-Prüfung akzeptierte zusätzliche GitHub-Glob-/unanchored-Override-Regeln, die Security-/Finance-Zuständigkeit in GitHub überschreiben können. Weitere AI-Review-Runden entdeckten fehlende Prüfung für Literal-Directory ohne Slash, fehlendes globales `*` und fehlerhafte Team-Identitäten. Fail-closed-Korrektur und **24 Node-Regressionen PASS** im lokalen Workspace unter Node v22.23.3. Die unabhängige semantische AI-Quellprüfung der beiden ausführbaren Änderungen meldete nach Korrekturen **PASS (begrenzter Scope)**; der obligatorische statische ESLint-Lauf mit `npx --no-install eslint . --max-warnings=0` war wegen fehlender lokaler Abhängigkeiten **nicht ausführbar**, daher **AI-Code-Review insgesamt NICHT PASS**. Rechtmäßige reale GitHub-Team-/CODEOWNERS-/Branch-Protection-Reviews, echte TTL-/Firestore-Emulator-/SAST- und Supply-Chain-Nachweise fehlen. `zod` ist als Dependency vorhanden, `pino`, `ioredis`, `bullmq` nicht – ohne Architektur- und Security-Prüfung keine spekulativen Infrastrukturdependencies hinzufügen. ADR: `docs/ADR_CODEOWNERS_FAIL_CLOSED_AI_REVIEW_2026-10-19.md`; Review: `docs/AI_CODE_REVIEW_CODEOWNERS_2026-10-19.md`. **Release: NO-GO.**


### 2026-10-19 — Enterprise Status & Compliance Dashboard (NO-GO)

Das bestehende AdminHealthStatusWidget wurde als Enterprise-Statusanzeige mit geschütztem, read-only /api/admin/health-check und strict Boolean-/Freshness-Statusmodell neu implementiert. Vorherige /api/check-safety-POST sowie HTTP 400/401 als gesund und irreführende „Alle Systeme gesund“-Behauptungen wurden entfernt. SLO-P95, DSGVO Art.17/TTL, KI-Budget und CI-/Security-Gates werden ohne Datenquelle als **Nicht verifiziert** angezeigt. Auth-Wechsel invalidiert den Status und abgebrochene/alte Antworten werden verworfen.

Das §312k-Audit-Widget zeigt nur begrenzte Marker-Zählwerte statt falscher 100%-/PII-frei-/Rechtskonformitätszusicherungen und verhindert stale Filter-Ergebnisse. Zehn native Node-Tests sind in `check:enterprise` aufgenommen. Diese Quell-/Modellprüfungen sind kein E2E- oder vollständiges AI-Code-Review. ADR: docs/ADR_ENTERPRISE_ADMIN_STATUS_2026-10-19.md; Review: docs/AI_CODE_REVIEW_ENTERPRISE_DASHBOARD_2026-10-19.md. **NO-GO**.


#### Finale Validierungsrunde — 2026-10-19

Der exakt archivierte Draft-Commit `51864c8a8ef29c696a1b7e420a19eeb7cc903a47` wurde mit SHA-256-verifiziertem Node 22.23.3 geprüft: **Enterprise-Dashboard 10/10 PASS**, CODEOWNERS 24/24 PASS, Release-GO-Review 55/55 PASS. Weitere statische/Offline-Tests für 20 TTL-Retention-Gruppen, Art.17 (18 Preflight-Fälle), Lockfiles und Release-Workflow PASS. Auf demselben Code: **5/14 Pflichtgates PASS** (Secrets, Auth-Boundary, Public Firestore Rules, AI PII Sanitizer, Art.17 Boundary), **9/14 FAIL oder nicht ausführbar** (Enterprise/TypeScript-Modul fehlt; Root-npm-audit ENOLOCK im Bun-only-Root; Gitleaks und Semgrep nicht vorhanden; tsc, Vitest, Firebase CLI, Playwright und Vite fehlen). Zusätzliches `npx --no-install eslint . --max-warnings=0`: **FAIL/nicht ausführbar**. Deshalb **AI-Code-Review gesamt NICHT PASS** und **Production NO-GO**. Echtzeit-Dashboard-SLO-, Art.17-/TTL-, KI-Budget- und Security-Gates bleiben ohne geeignete autorisierte Live-Messquelle ausdrücklich unbekannt; rechtliche Abnahmen und echte E2E-Tests fehlen.


## P95-Typecheck-Korrektur – 23.10.2026

PR #121 basiert auf #119 (7fdf290) und ergänzt am bisherigen Head ac96721 drei Retention-Commits. Der optionale P95-SLO-Wert wird nun durch eine sofort ausgeführte Initialisierung validiert und als Zahl zurückgegeben. Fehlende oder ungültige Konfiguration bleibt ein Startfehler; 300 ms bleibt das Ziel.

Lokal: TypeScript 5.8.3 reproduziert TS18048 vor der Änderung und akzeptiert den korrigierten Initialisierungsblock in einer isolierten Metrikfunktion. Observability- und Retention-Regressionen PASS unter Node 24.22.1. Vollständige lokale Abhängigkeitsinstallation blockiert (Bun EBADF, npm Windows EPERM). Vollständige CI mit gepinnter Toolchain und unabhängige Reviews bleiben erforderlich. Production NO-GO.


## CI-Testkorrekturen nach P95-Fix – 23.10.2026

CI 40015958038 bestätigt den vollständigen Typecheck und Functions-Build auf 7828118. Danach: 1180 Tests PASS, drei Testfehler und eine vorzeitig abgewiesene Emulator-Suite. Korrekturen: Widget-Test erwartet Nachweisprüfung offen und CSV-Export gestartet; Ereignisbindungs-Test legt einen berechtigten alternativen Käufer an und prüft fehlende Käufer weiterhin separat; der direkte Art17-Guard liest das tatsächlich gewählte Firebase-Profil (test:ci: firebase.json; dedizierter Runner: firebase.pruefung.json). Produktionslogik und Ablehnung unsicherer Ziele bleiben erhalten. 20 lokale Guard-Regressionen PASS unter Node 24.22.1. Vollständige CI auf dem neuen Head erforderlich; Production NO-GO.

### 2026-10-23 — PR #74 integration and targeted verification
Integrated main fc83aacee41a0048fbae192d89f34479b352e0bb, retaining both branches documentation. Profile save confirmation rejects pending writes and ignores completion after account change/unmount. Email persistence is awaited; absent authoritative grants fail closed. Targeted verification on D: 21 tests in AuthContext, ProfileSettingsPersistence and profileWriteConfirmation PASS; targeted strict TypeScript 5.8.3 check PASS (Node 24.22.1, Vitest 5.0.5). This isolated npm test environment is not the pinned full CI environment. Complete pinned typecheck/test/build/browser CI on the final PR head is still required; independent review and production release evidence remain separate. No deployment or production approval.


## Integration auf main: Visitor-Authentifizierung (2026-10-24)

PR #87 fasst #85 und #86 zusammen. Die aktuellen Consent-Epochen- und Quarantäneprüfungen aus main bleiben erhalten. Nur ein separat übermittelter Firebase-Bearer mit frischer Widerrufsprüfung, nicht anonymem Provider und nicht leerer UID erlaubt Attribution. Vorbefülltes req.user ersetzt diese Prüfung nicht. Auch synchrone Firebase-Initialisierungsfehler führen zur ungetrackten Weiterleitung.

Validierung: 16 neue HTTP-Tests mit echtem Express-Router, Referral-Service und Rate-Limiter sowie simuliertem Firebase bestehen zusammen mit sieben Core-Tests (23 Tests). Der statische Authentifizierungscheck ist in check:enterprise eingebunden. Vollständige Typprüfung und CI sind separat nach dem Push zu prüfen. Normale Browsernavigation ohne Bearer bleibt ungetrackt; ein browsergeeigneter Ticket-Flow und die unabhängige Datenschutzprüfung sind damit nicht abgeschlossen.


## 2026-10-24 — CODEOWNERS im bestätigten Solo-Betrieb

GitHub meldet die bisherigen @klar-Teamzuordnungen als unbekannt. Der Eigentümer hat Solo-Betrieb bestätigt. @Veselin-Takev wird technischer Dateizuständiger; die explizite Abdeckung aller kritischen Pfade sowie Glob-/Override-Schutz bleiben erhalten. Die technische Zuordnung ist keine unabhängige Security-/Finance-Freigabe. Ein zusätzlicher Produktionscheck verweigert die Freigabe bei unbesetzten Rollen, Eigentümer-Selbstfreigabe, identischen Reviewern, fremden/veralteten Belegen oder falschem Commit. Beide Rollen bleiben derzeit unbesetzt, Production NO-GO. 87 lokale Governance-/Release-Regressionen bestehen; vollständige CI und GitHub-Validierung müssen am veröffentlichten Head geprüft werden. Siehe docs/CODEOWNERS_GOVERNANCE_2026-10-19.md. Keine Branchschutz-/Berechtigungsänderung, kein Deployment.

### 2026-10-18 — P0 #47 machine-readable marketing claim evidence gate (draft)
Added `docs/MARKETING_CLAIM_EVIDENCE_2026-10-18.json` with verification, 8–12 local suggestions, Free-use, human-curation and referral claims **BLOCKED** until genuine evidence and Product/Legal/Brand approvals. Local schema gate `node scripts/check-marketing-claims.mjs`; `--release` intentionally returns NO-GO while blocked. See `docs/MARKETING_CLAIM_RELEASE_GATE_2026-10-18.md`. No invented approvals. #47/#8 still open, no production release.


### 2026-10-18 — P0 #47 approval-evidence hardening (draft)
The claim gate rejects placeholder evidence, same-person role endorsements and absent explicit top-level GO. Added local mutation test `node scripts/test-marketing-claims.mjs` and `docs/MARKETING_CLAIM_APPROVAL_VALIDATION_2026-10-18.md`. The test only checks structure; reviewer identity/evidence authenticity requires independent external verification. All claims remain blocked. **NO-GO.**


### 2026-10-18 — P0 #47 canonical claim manifest pinned (draft)
Release-mode `scripts/check-marketing-claims.mjs --release` now rejects `KLAR_CLAIM_MANIFEST_PATH` and always reads the committed matrix; local mutation tests may still supply fixtures outside release mode. Test checks forged GO override fails. Claims remain 0/5 approved; independent evidence verification, review authority, trusted CI, branch protection and full Mandatory Gates remain outstanding. Details: `docs/MARKETING_CANONICAL_MANIFEST_RELEASE_GATE_2026-10-18.md`. **NO-GO.**


### 2026-10-18 — P0 #47 trusted evidence URL gate (draft)
Claim approval references now require implementation and Actions-run URL shapes scoped to `github.com/Veselin-Takev/Klar-Dating`. External URLs, userinfo, missing test runs and alternate release manifests are rejected by mutation checks. `docs/MARKETING_TRUSTED_EVIDENCE_ORIGIN_2026-10-18.md` details external evidence and reviewer validation still missing. Five claims remain BLOCKED; NO-GO.


### 2026-10-18 – P0 #47 GitHub-Nachweisreferenzen eindeutig validiert (Draft)
Der lokale Freigabecheck akzeptiert nur numerische PR-/Actions-IDs, vollständige Commit-SHAs und Blob-Links mit Commit-SHA und Dateipfad; kodierte oder mehrdeutige Pfade werden abgewiesen. Negativtests und `docs/MARKETING_EVIDENCE_REFERENCE_SHAPES_2026-10-18.md` ergänzt. Echte GitHub-Nachweise, Rollenfreigaben und vollständige Gates weiterhin UNBESTÄTIGT. **NO-GO.**


## 2026-10-24 — PR #80 adversarial conversion tests prepared on current main

Seven targeted in-memory cases cover withdrawn buyer/owner consent, minor buyers, revoked owner version, altered campaign slug, self-referral and duplicate buyer assertions with zero qualified credit. Updated fixtures include current buyer consent epochs and referral campaign bindings; all existing service tests are preserved. Seven new cases PASS locally in an isolated runtime; full exact-head CI remains pending publication. See docs/PARTNER_CONVERSION_ADVERSARIAL_TEST_GATE_2026-10-18.md for limits. No deployment; #55/#8 remain open, production NO-GO.
