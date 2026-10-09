# Enterprise End-to-End Audit — Klar v149

**Audit date:** 2026-10-09  
**Repository:** \`Veselin-Takev/Klar-Dating\`  
**Branch:** \`security/v149-autonomous-consolidation\`  
**Baseline HEAD audited:** \`e78e76b25f75f3b906b73d734c931114d7b91466\`  
**Evidence:** [Enterprise CI #312](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37895590223)  
**Audit mode:** source review + CI evidence; not a production penetration test or cost reconciliation.

### 2026-10-09 — Authorized remote validation passed (CI #331)

The owner explicitly approved one remote validation exception after disclosure of the local browser and process-orchestration limitations. PR #1 was fast-forwarded to candidate `0042bbff95e2092c804407fd8559aa6d8e3d37ed` and exactly one workflow ran: [CI #331](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37961300244), job `113924515032`.

**Result: SUCCESS.** Scope regression tests, frozen dependency installation, Enterprise static gates, all TypeScript projects, Functions build, application tests (**156 files / 1,001 tests**), application build, production smoke and Chromium browser acceptance (**26 / 26 passed**) all passed. The test orchestration exited successfully (code 0); the earlier local parent-process limitation did not reproduce on this runner. npm and Bun/emulator download caches were saved successfully; a future cache-hit speedup has not yet been measured.

Runner job: 2026-10-09 16:44:39–16:53:30 UTC (**8m 51s**). Conservative incremental ledger: **9 of 200 additional minutes consumed; 191 remain**, subject to GitHub's authoritative billing. The unused 45-minute reservation is released. No rerun, merge, release tag or deployment was initiated.

This closes the previously failing browser-regression gate for this candidate, including FE-01, FE-02 and FE-03 acceptance evidence. It does not certify every audit finding as resolved: deletion/retention completeness, production load/cost evidence, restore-drill evidence and independent operational/governance approvals still require their own exit criteria. **Official production approval remains NO-GO / NOT CONFIRMED.**

This evidence update is retained on a separate documentation branch without a pull request so it does not trigger a second Actions run. PR #1 remains on the successfully validated candidate above.

## Post-merge update — unresolved browser stability

Main CI `37963077381` failed the registered-account music export assertion after the successful PR run. The immediate export lacked synchronization with async persistence. A locally checked correction is prepared, but its browser execution remains pending. Refer to the [post-merge report](POST_MERGE_VALIDATION_2026-10-09.md). Earlier FE-03 acceptance evidence applies only to its recorded run; stable post-merge acceptance is not established. Production remains NO-GO.

## 1. Executive Summary

### Baseline assessment (superseded CI status; other findings remain open): **RED for production release**

This is not a claim that the whole application is insecure. It means release readiness has not been established: the latest completed CI on the audited baseline has four failing Browser Acceptance tests. Enterprise static gates, TypeScript, all 967 unit tests, build, and production smoke passed, but Browser Acceptance ended **22 passed / 4 failed of 26**. “Zero Critical Bugs” therefore cannot be certified.

**Verified strengths:** CI pins Node/Bun and GitHub Actions by immutable action SHA; release workflow requires a production environment/approval check and produces an image digest, CycloneDX SBOM, and provenance attestation. Firebase Admin token verification, deny-by-default Firestore rules, emulator Rules tests, server-side AI budget reservation, prompt/PII sanitization, HMAC-SHA256 audit helpers, and a durable leased account-deletion job all exist in the reviewed source.

**Highest risks:** (1) four end-to-end regressions still block normal user journeys; (2) several security/compliance audit scripts existed but were not invoked by the CI enterprise-gate chain; (3) Art. 17 cleanup processes only 25 chats per deletion attempt before scheduling a retry and can exhaust the durable worker's 50-attempt policy; (4) two competing source roots are materially different; and (5) there is no populated production load/cost evidence in the checked-in cost-evidence template.

### TCO estimate — bounded and conditional

No production billing export, real traffic distribution, model invoice, or load-test result was available in the reviewed repository. **Total infrastructure savings cannot honestly be stated as a verified percentage.** The code shows a narrower candidate: live translation considers up to 30 incoming messages and uses concurrent individual \`POST /api/translate\` calls (up to three workers). Under the explicit assumption that only 6–10 messages are initially visible, viewport-triggered translation could reduce *initial-load translation calls* by approximately **67–80%** (20–24 avoided calls per 30 candidates). This is not a prediction of total infrastructure or total AI-bill savings until production traces confirm visibility and user scrolling behavior. Firestore savings should be measured independently because the AI tokens, not only HTTP request count, drive model spend.

## Audit scope and evidence boundaries

- **Production code path:** \`phase2_work\` is the working directory used by \`.github/workflows/ci.yml\` and \`.github/workflows/release.yml\`.
- **Source duplication:** top-level \`server.ts\`, \`package.json\`, and \`firestore.rules\` are not byte-identical to their \`phase2_work/\` counterparts. \`firebase.json\` is identical. The release workflow builds with the \`phase2_work\` context, so edits made only to the root copies will not affect the currently configured release artifact.
- **Latest completed baseline CI:** dependency lock preflight, dependency installation, Enterprise static gates, TypeScript, tests, build, and production smoke passed. Browser Acceptance failed four tests. This result applies to the baseline SHA above, not to future commits.
- GitHub's open-issue search returned no open Issues at audit time; failing CI checks remain valid work items even when they are not represented as Issues.
- No production shell, live user data, GCP billing export, Firebase console, externally collected telemetry, independent penetration test, or restore-drill evidence was available. Items requiring those are explicitly listed as unverified.

## 2. Detailed findings by domain

Severity uses **High / Medium / Low** for impact. Confidence indicates how directly the checked-in code/CI supports the statement. “TCO impact” is directional unless explicitly labelled as an assumption.

### Frontend

| ID | Component / module | Finding / risk | Impact | Action | TCO impact |
|---|---|---|---|---|---|
| FE-01 | \`tests/e2e/chat-security.spec.ts\`, \`src/screens/ChatView.tsx\` | CI #312 could send a message successfully, but after reload the message text was not found. A second chat test failed to expose the gate answer field after retrying a failed status request. | High | Inspect and retain Playwright trace/context; prove server write, Firestore rehydration, auth state, and gate-state transitions independently. Do not rewrite selectors or weaken assertions until the intended behavior is verified. | Reliability and support-cost reduction; direct dollars unmeasured. |
| FE-02 | \`tests/e2e/e2e-critical-flows.spec.ts\`, contact endpoint | First unverified-contact assertion expected domain response \`409\` but received \`429\`. Root cause is not proven by current logs; rate-limit ordering/keying or accumulated limiter state must be identified. | High | Include limiter name/key source, \`Retry-After\`, rate-limit headers, and request identity in safe diagnostics; test one fresh account and a second request to establish the contract. Keep abuse controls active. | Fewer false user-facing throttles and less test flakiness; do not relax the limit without threat-model review. |
| FE-03 | \`tests/e2e/onboarding.spec.ts\`, \`tests/e2e/identity-helpers.ts\` | Registered-account journey could not find the Firebase token in the helper's searched \`sessionStorage\`/\`localStorage\` locations. This confirms an auth-persistence/test-contract mismatch; it does not by itself prove production credentials are lost. | High | Assert the real Firebase SDK session/persistence contract rather than assuming a specific storage key; preserve production auth boundaries and avoid introducing a second application-owned token cache. | Lower test maintenance; prevents accidental insecure test workarounds. |
| FE-04 | \`src/screens/ChatView.tsx\` | Live translation examines up to 30 incoming messages and uses multiple separate API requests. It is deduplicated per mounted view/language, but can still issue a burst after a load or language change. | Medium/High | Translate visible messages first; lazy-translate on viewport entry; retain abort/version checks and original text as source of truth. Batch multiple visible messages only if the privacy boundary and model policy continue to hold. | Under the stated viewport assumption, potential 67–80% reduction in initial-load translation calls; not an observed total-bill reduction. |

### Backend / API

| ID | Component / module | Finding / risk | Impact | Action | TCO impact |
|---|---|---|---|---|---|
| BE-01 | \`phase2_work/server.ts\` | Server composition remains a 2,000+ line central module with many route/middleware responsibilities. It works today but increases change coupling and makes ordering errors easy to reintroduce. | Medium/High | Continue extracting bounded routers with explicit dependency types; add route inventory checks and middleware-order integration tests for auth, rate limit, age/consent and error translation. | Lower incident and review cost; no direct runtime savings promised. |
| BE-02 | Auth middleware | Main server calls Firebase Admin \`verifyIdToken(idToken, false)\`, which verifies token integrity/expiry but does not ask the SDK to check revocation. The server also checks deletion state and invokes \`validateServerAuthSession\`, so coverage must be assessed as a whole. | High | Document the revocation/session threat model. Ensure administrative, billing, deletion and other high-impact operations use a durable server-side session/version check or explicit revocation checking where needed. Measure the additional latency/cost before enabling it globally. | Targeted checks limit extra authentication overhead while reducing stale-session risk. |
| BE-03 | \`src/server/observability.ts\`, \`src/server/routes/health.ts\` | Prometheus/trace-derived counters are primarily process memory, bounded and useful locally, but restart/replica-local counters are not a central source of truth. OTLP export is conditional on configuration. | Medium | Verify production OTLP endpoint, collector retention, dashboards, alerts, sampling and cardinality controls. Keep \`/api/metrics\` behind \`METRICS_TOKEN\` and confirm the secret is provisioned. | Prevents costly debugging; centralization has modest exporter/ingestion cost. |
| BE-04 | \`src/server/routes/launch.ts\`, release scope | The checked-in code has a generic user-to-user launch/referral capability; the audited HEAD does **not** contain the requested brand-campaign \`Klar & Partner\` administration/API/QR feature. | Medium (scope/roadmap) | Treat cross-brand partner campaigns, separate consent, conversion proof, fraud/idempotency, admin CRUD and their rules/tests as a separate release scope unless product explicitly removes the requirement. | Revenue potential unproven until partner contracts, qualified conversion data and payout liability are validated. |

### Database / privacy / compliance

| ID | Component / module | Finding / risk | Impact | Action | TCO impact |
|---|---|---|---|---|---|
| DB-01 | \`src/server/trustAndSafety.ts\`, \`src/server/accountDeletion.ts\` | \`purgeAccountData\` fetches at most 25 chats in one call and throws \`deletion_more_pages\` whenever the page contains 25. The durable worker retries with backoff but moves to \`manual_review\` after 50 attempts. Thus a heavy account can require one attempt per 25 chats and may reach manual review at/above roughly 1,250 chat documents, before accounting for any other transient failures. | High | Make deletion progress explicitly cursor-/page-based and observable; process bounded pages per lease/deadline and persist progress/checkpoints so a retry resumes without consuming one attempt per page. Add an emulator test with more than 25 chats and a multi-page deletion test. | Avoids long-running repeated retry overhead and manual support work; protects Art. 17 fulfilment. |
| DB-02 | \`server.ts\` auth + age/consent middleware | Authenticated requests check the account-deletion barrier; downstream age/consent middleware also reads user data. Additional route handlers may then load the same profile again. This can make security-gate reads a recurring cost component. | Medium | Measure Firestore reads/request in the existing load-SLO path; safely hydrate request-scoped auth/profile context once when the same authoritative snapshot can satisfy all relevant gates. Do not persistently cache deletion barriers or consent state without an invalidation design. | Opportunity to reduce duplicate reads, but percentage depends on route distribution. |
| DB-03 | \`firestore.rules\`, \`tests/rules.spec.ts\` | Default-deny Firestore rules and emulator rule tests are present; user-controlled updates are field-bounded and sensitive fields (verification/age/consent) are server-controlled. | Strength / monitor | Keep rules tests in CI and validate every new collection with owner/admin/service-only access rules. New server-side collections must not be considered protected merely because the client currently has no UI for them. | Prevents data exposure and expensive incident response. |
| DB-04 | \`docs/load-cost-evidence.template.json\`, \`docs/finops/BUDGET_AND_TELEMETRY.md\` | Cost evidence template still contains placeholder source links and zero-valued cost/request fields. This is not real measured production cost evidence. | Medium/High | Fill from dated billing exports and a load report tied to the exact build SHA. Compare provider token telemetry, successful task counts, Firestore reads/writes and budget decisions. | Makes optimization targets evidence-based and avoids false savings claims. |

### Cloud / infrastructure / release

| ID | Component / module | Finding / risk | Impact | Action | TCO impact |
|---|---|---|---|---|---|
| INF-01 | Root vs \`phase2_work/\` source roots | Root \`server.ts\`, \`package.json\`, and \`firestore.rules\` diverge from the release source counterparts. CI and tagged release run/build inside \`phase2_work\`; the root Dockerfile builds a different tree when invoked from the root. | High | Declare \`phase2_work\` as the sole production source-of-truth or add a CI invariant that fails on unintentional dual-source divergence. Remove obsolete duplicate launch/deploy paths only after confirming consumers. | Fewer wrong-directory fixes and release drift; minimal direct cloud cost impact. |
| INF-02 | \`.github/workflows/release.yml\`, \`docs/PRODUCTION_RUNBOOK.md\` | Release workflow uses a protected \`production\` environment, approval check, immutable image digest, SBOM, checksums and provenance attestation. This is a strong control. | Strength | Continue requiring explicit tag, approved production environment, exact build SHA, canary observation and restore/rollback evidence. Baseline CI failure means no release readiness yet. | Avoids expensive wrong-build deployments. |
| INF-03 | \`docs/PRODUCTION_RUNBOOK.md\`, \`docs/BACKUP_RESTORE.md\` | Runbooks describe backups, isolated restore drills and rollback. This audit had no completed production restore-drill record or populated measured RPO/RTO proof in the available repository state. | High until evidence supplied | Record latest drill, backup URI, checksum parity, RPO/RTO measurements, approver and exact build. Schedule quarterly restore tests as documented. | Prevents long outage/data-recovery costs; no quality trade-off. |
| INF-04 | Current workflow inventory | Workflows include CI, LLM evaluation and release, while Dependabot covers GitHub Actions, Bun, Functions NPM and Docker. No dedicated CodeQL/Semgrep/Gitleaks workflow was found in the workflow inventory. Custom guard scripts and tests exist, but they are not a substitute for broad SAST/secret coverage. | Medium/High | Add a separately configured, centrally triaged SAST and comprehensive secret scan; baseline existing findings rather than suppressing whole directories. | Cheap early detection avoids remediation after deployment. |

### Security / governance

| ID | Component / module | Finding / risk | Impact | Action | TCO impact |
|---|---|---|---|---|---|
| SEC-01 | \`scripts/check-secrets.mjs\` | The custom scanner only detects a small number of patterns (Google API-key shape and PEM private-key marker) and skips \`firebase-applet-config.json\`. It does not provide broad detection for Stripe, SendGrid, OAuth or arbitrary high-entropy credentials. | High | Add a broad secret scanner and secret push protection where available; narrowly allowlist known public Firebase web configuration with a reviewed rule instead of skipping a whole file. Rotate any confirmed exposed server secret. | Low scan overhead; reduces expensive credential abuse and incident response. |
| SEC-02 | \`scripts/check-auth-boundary.mjs\`, \`scripts/check-public-firestore-rules.mjs\`, \`scripts/check-ai-pii-sanitizer.mjs\`, \`scripts/check-art17-deletion-audit.mjs\` | These explicit audit scripts exist, but the pre-audit \`check:enterprise\` chain did not invoke all four. A script that is present but not run is not a release gate. | High | This audit adds npm scripts for all four and wires them into \`check:enterprise\`; validate their PASS results in the new exact-head CI before treating the gate coverage as closed. | Reduces manual audit/release labor; small CI-runtime increase. |
| SEC-03 | \`src/server/platform/aiPiiSanitizer.ts\`, \`src/server/aiBudget.ts\` | Server-side PII sanitization, prompt/output policy boundaries, request timeouts and transactional per-user/global daily budget reservation exist. CI’s browser environment emitted “API key should be set when using the Gemini API” warnings; production configuration/alerting must be checked independently. | Strength / operational check | Use a non-production fake provider or explicit disabled-provider mode in tests, and make production readiness fail if a required model credential is absent. Never add production credentials to CI logs. | Avoids wasted provider calls and confusing test environment state. |

## 3. Prioritized Action Plan (ICE)

ICE = Impact × Confidence × Ease; each factor is 1–10, maximum score 1,000. Ease means ease of safe delivery, not urgency.

| Rank | Priority / ID | Action | I | C | E | ICE | Exit criteria |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | P0 / FE-01–03 | Fix the four failing Browser Acceptance tests without weakening expected security/business outcomes; diagnose all four failure causes using trace evidence and targeted assertions. | 10 | 10 | 6 | 600 | Full Playwright suite passes on the exact candidate SHA; repeat once to check flakiness. |
| 2 | P0 / SEC-02 | CI now explicitly executes the auth-boundary, public Firestore-rule, AI PII-sanitizer and Art. 17 deletion audit checks. | 9 | 10 | 9 | 810 | New Enterprise CI shows each named command as PASS; no skip/allowlist bypass. |
| 3 | P1 / DB-01 | Replace chat deletion’s one-page/throw/retry loop with checkpointed page progress and add >25 chat emulator test coverage. | 10 | 9 | 6 | 540 | >25 and >50-page test cases complete, no orphaned messages/gate answers, idempotent retry proven. |
| 4 | P1 / SEC-01 | Adopt comprehensive secret scanning and scoped public-config exception rules. | 9 | 9 | 8 | 648 | Secret fixtures for Stripe/SendGrid/OAuth/private keys fail the scanner; known public Firebase config remains explicitly reviewed. |
| 5 | P1 / INF-01 | Eliminate or mechanically validate drift between root copies and \`phase2_work/\`. | 9 | 10 | 7 | 630 | CI proves one source of truth, or intentional mirror parity check passes. |
| 6 | P1 / BE-02 | Define and enforce privileged-operation session revocation policy. | 9 | 8 | 6 | 432 | Admin/billing/deletion stale-token tests pass; latency overhead measured and documented. |
| 7 | P1 / DB-04, INF-03 | Publish measured load/cost evidence and the latest backup/restore drill. | 8 | 9 | 5 | 360 | Evidence names exact SHA, billing source, request volume, p95/p99, cost per 1,000 requests, RPO/RTO, approver. |
| 8 | P1 / FE-04 | Introduce viewport-based translation, cancellation and cost telemetry. | 8 | 9 | 6 | 432 | Translation requests per conversation, tokens and latency fall without missing visible translations or persisting plaintext. |
| 9 | P2 / BE-01, INF-04 | Continue bounded route extraction; add dedicated SAST and secret-scan workflows with triage ownership. | 7 | 9 | 6 | 378 | Route/middleware inventory, security tooling results and CODEOWNERS triage are enforced in CI. |
| 10 | P2 / BE-03, DB-02 | Centralize observability and measure reads/request before safely removing redundant Firestore reads. | 6 | 8 | 5 | 240 | Cross-replica dashboards and baseline/after measurements are recorded; no gate consistency regression. |

### Release decision

**NO-GO / NOT CONFIRMED.** Do not declare production readiness until the browser failures are corrected, newly wired gates pass on the same exact HEAD, all remaining P0/P1 exits are reviewed, production cost/load/backup evidence is complete, and approved operational/governance sign-off exists.

## 4. Living Documentation Updates (ready to paste)

### Source of truth and CI

> The deployed application source of truth is \`phase2_work/\`, as configured by the CI and production release workflows. Top-level server, package and Firestore-rule copies currently differ and must not be edited as though they automatically affect production. Changes that affect authentication, authorization, data deletion, external providers or Firestore rules require the exact-head Enterprise CI evidence URL to be attached to the change.

### API and privacy gates

> Authentication checks identity using Firebase Admin token verification. The main request path also checks the account-deletion barrier and validates the server session. The token verification call currently uses the non-revocation-checking mode; privileged-operation risk and compensating controls must be explicitly validated. Security-critical operations fail closed when required Firestore/AI/provider state is unavailable.

### Art. 17 deletion runbook update

> Account deletion is a durable leased workflow with provider cleanup, Firestore purge, authentication removal, delayed final sweep and a bounded retry policy. The current chat purge page is limited to 25 chats and raises a retry condition at a full page; this must be treated as a known scalability/compliance limitation until checkpointed pagination is implemented. Operators must monitor \`account_deletions.status=manual_review\`, record remediation, and verify no remaining user-owned documents, nested collections, messages or storage objects. Never mark a deletion complete merely because the authentication principal was removed.

### Cost/performance evidence

> Report both cost per successful business task and cost per 1,000 API requests. Include provider input/output tokens, Firestore document reads/writes/deletes, cache hit rate where implemented, p95/p99 latency, 5xx/429 rate, build SHA, traffic profile, region and billing-export reference. Use a production or production-equivalent traffic sample; do not populate observed fields with planning assumptions or zero placeholders. Optimizations must be validated against correctness, consent, retention and abuse-control tests.

### Release evidence checklist

- Exact release commit SHA and successful enterprise static gates.
- Typecheck, unit/Rules tests, build, production smoke and all Playwright acceptance tests green on that same SHA.
- SBOM, immutable image digest, container provenance attestation and checksums.
- Production provider/secret readiness, centralized telemetry and alert test.
- Current backup/restore-drill record including measured RPO/RTO.
- Operations/security/privacy approvals, canary observation, and explicit production release confirmation.


## Validation addendum — 2026-10-09, PR #1 candidate

The latest completed run inspected after this audit was [Enterprise CI #313](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37908747359), on candidate `4435b837c24fc254fd920615a2ad656eca75c428`. Dependency preflight/install, Enterprise static gates, typecheck, tests, build, production smoke, and Chromium installation passed; **Browser acceptance failed**. The run metadata exposed only the failed step, not individual test output or traces, and no report artifact was available. Therefore, the previous four-test failure list is historical baseline evidence and must not be assumed to be the same current failure set.

### Diagnostic remediation

The CI workflow now uploads `phase2_work/playwright-report/` and `phase2_work/test-results/` after the Browser acceptance step using an `always()` condition, with a seven-day retention period. This change preserves HTML reports and failure traces where Playwright generated them. It does not fix the failing browser journey and must itself be validated by a new CI run.

### Current decision

**NO-GO / NOT CONFIRMED.** Next, inspect the report artifact from the first run containing this diagnostic step, reproduce each failing test, and fix the actual behavior or isolated fixture without weakening security assertions. Then require a complete green CI run on the exact release candidate, followed by production-equivalent load/cost evidence, a verified backup/restore drill, and independent operational/security/privacy approval. Do not infer production safety from successful static gates or unit tests alone.


## Follow-up remediation log — 2026-10-09

The failure output from CI [37908747359](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37908747359) identified the four current baseline browser failures (22/26 passed): chat message not visible after reload, chat answer UI not restored after status retry, contact flow receiving 429 instead of 409, and onboarding token helper returning null.

Remediations committed to the audit branch:

1. **Chat reload race:** `ChatView.tsx` now subscribes to Firebase Auth state changes before establishing the Firestore message listener. This removes the one-shot `auth.currentUser` initialization race on reload; message reads remain governed by Firestore rules.
2. **Gate retry state:** `useChatGate.ts` preserves the same chat's existing gate state during a status refresh while still withholding the composer unless the gate is open. A successful retry updates the state from the server response.
3. **Firebase test session:** the Playwright helper reads the SDK-managed persisted token from local/session storage or the existing Firebase IndexedDB store. It does not create an app-owned credential cache and does not alter production authentication.
4. **Contact 429:** the assertion now emits response body and headers while retaining the expected 409 domain contract. Root cause remains unconfirmed; the limiter must not be loosened until the source is identified.
5. **CI diagnostics:** HTML report and test-result/trace paths are uploaded on job completion with seven-day retention.

### Validation status

A new Enterprise CI run is required on the resulting exact head. These changes are hypotheses tied to observed failures, not yet proven fixes until the corresponding browser tests pass. If the contact case still returns 429, use the response headers/body to identify whether the global API limiter, contact limiter, or an upstream middleware is responsible; then add a targeted regression test and make the smallest safe correction. Do not suppress the browser test or relax abuse controls.

**Release remains NO-GO / NOT CONFIRMED.** No verified production traffic/billing evidence, restore-drill result, independent penetration test, or formal operational/security/privacy approval is present in the reviewed repository evidence.


### 2026-10-09 — DB-01 partial remediation: deletion page progress and lease safety

A completed 25-chat purge page now raises a typed internal continuation signal. The durable worker records `completedPages`, schedules the next page and restores the attempt consumed by acquisition. Already deleted documents are the durable checkpoint: subsequent queries select the first remaining page. Genuine provider/database/time-slice failures retain backoff and the failure budget; successful pages do not erase earlier failures. Manual review begins on the 50th failed attempt and cannot be automatically reacquired. Authentication deletion also requires an unexpired owned lease.

Regression coverage added for 51 page continuations, retained real failures, the 50-failure boundary, expired leases and replacement leases. These tests exercise durable Firestore job state with an injected purge; they are **not** proof of purging 1,275 real chat documents. Full emulator-backed nested-chat pagination, within-page time-slice progress and cumulative deletion receipts remain follow-up work; DB-01 is not fully closed. Require the resulting CI before accepting this candidate.

**Release remains NO-GO / NOT CONFIRMED.**



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
