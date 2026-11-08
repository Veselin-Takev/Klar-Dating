# Wave 2 migration — closure verified

Current source progress: **43/50**, seven remaining. C/D/E source migration **COMPLETED** on `7e61fadb2614593f2a725a8c3072043e2b0e3305`; [full CI SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42500036161). Strict repository Semgrep **0 findings / 0 diagnostics**. **1617 main-suite PASS** (1505 Vitest + 86 Enterprise Node + 26 Playwright), 118 dedicated Rules repeated, not added.

`baselineFixed=false`, `productionApproved=false`; PR #358 DRAFT. No live cutover. See [current closure evidence](MIGRATION_WAVE2_CLOSURE.md) and [batch register](MIGRATION_BATCHES.json).

## Historical partial checkpoint (superseded)

The following 10/50 checkpoint is retained for provenance. Its open code paths and 35/41 SAST results were addressed by the current closure; operational gates remain open.

# Wave 2 migration evidence — v0.1.1-rc1

Source progress: **10/50 migrated candidates, 40 remaining**. `baselineFixed=false`,
`productionApproved=false`. PR #358 remains DRAFT. C, D and E are **IN_PROGRESS**;
this checkpoint does not satisfy the requested complete C/D certification.

## Implemented scope

- C: Didit KYC session creation, distributed cost/rate limits, signed webhook and
  provider reconciliation use the closed, schema-validating tenant repository.
  Session ownership, erasure markers, deduplication and transitions remain checked.
  A persisted revision prevents delayed reconciliation responses from overriding
  newer signed decisions. Recovery skips missing/deleting users before provider calls.
- D: contract requests, cancellation leases, subscription events, withdrawal
  tombstones and refund-review queue are scoped. Cancellation requires matching
  provider customer and `metadata.klarTenantId=default`. Authenticated subscription
  reads/cancel/withdraw paths in the mixed `klarCore.ts` use the same repository;
  the file is **not** counted as fully migrated. Public declarations stay independent
  of account lookup; they never automatically mutate an unauthenticated contract.
- E: reminders no longer use collectionGroup. Bounded tenant user/plan scans use
  durable cursors and transaction claims. Pending erasure blocks dispatch. Ambiguous
  provider dispatch stays claimed for reconciliation; only permanently invalid
  registration tokens are removed, not transient failures. Token document IDs may
  contain `:` without allowing path separators, traversal or a tenant-prefix escape.
- E: expired funnel events are deleted through a bounded scoped transaction that
  rechecks expiry. Verification Storage deletion remains hard-disabled.
- E: compliance receipts, cancellation retries and worker leases are scoped.
  Signed API job envelopes cover `tenantId` and reject missing/foreign context before
  opening storage. Scheduler identity comes exclusively from deployer configuration.
  KYC reconciliation now uses the correct raw Buffer parser for HMAC verification.

## Deployment and unresolved dependencies

All Auth/Payments/maintenance cutovers remain OFF in production. No data move,
charge, refund, user deletion, IAM apply or deployment was executed. Enabling a
flag without its coordinated producers/readers/tombstones migration is unsafe.

The legacy account-deletion orchestrator still uses root collections. The scoped
compliance worker MUST NOT pass scoped queue IDs into it: a due scoped deletion
returns 503 `tenant_deletion_worker_not_migrated` and preserves the queue. This is
an explicit blocking dependency, not functional completion of deletion processing.
Root deletion work must be reconciled during cutover; no root fallback is permitted.

Primary profiles, age/Auth gates, reset/mail, consent, audit/export readers, billing
rate-limit storage, date-plan/device-token writers and remaining utilities are still
legacy. Wave 3 therefore includes substantive dependent services, not just cosmetic
utility cleanup. External FCM/Stripe/Auth/Storage operations cannot be fenced atomically
with Firestore; cross-service erasure/dispatch reconciliation remains unverified.
No test suite can prove that all cross-tenant access is mathematically impossible.

## Verification

A TypeScript AST inspection found zero explicit `any` nodes in the migrated KYC,
contract/compliance, reminder/expiry and canonical repository modules on the tested
source. This is a scoped result; repository-wide Zero-any/runtime-schema certification
remains open.

Full [CI 42490475690](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42490475690) SUCCESS on
`fff55a978c6184e46b687ba80cefd184cd341900`: **1,574 PASS** = 1,462 Vitest
in 201 files + 86 Enterprise Node + 26 Playwright. Dedicated Rules: 92 repeated
PASS, not double-counted. Six IAM checks and two collection-inventory checks PASS
as additional static regressions. Typecheck, Functions/App builds and production
smoke PASS. No tests were skipped in those main suites.

Initial CI attempts exposed a deletion-catalog parser that missed closed-repository
collection arguments, and a body-parser inventory that missed an imported `raw()`.
Both source guards were corrected without removing their invariants. The collection
catalog retains negative coverage, and all 14 active parser sites still require
`inflate:false`. The successful complete run above includes both fixes.

The new native tests cover root/foreign namespace preservation, retention-extension
races, concurrent reminder claims, erasure denial, ambiguous dispatch, KYC decision
revision races, provider tenant mismatch and once-only withdrawal/refund recording.
HTTP tests reject signed foreign/missing tenant envelopes before repository creation.
Native concurrent transaction tests retain concurrency and allow 60s for emulator
pessimistic-lock retry cycles; they do not replace native transactions with mocks.

Pinned Semgrep `check-auth-boundary` fixtures and production scan: PASS, zero findings
on 119 production targets. The additional official Semgrep 1.184.0 repository-wide
`scan --config auto --error` completed on `6dd7f87e5f178db7e11c7fddf13bd5985c5dc897`
with **35 blocking findings**, exit 1, 615 rules / 1,144 targets. It also reports
**41 diagnostic warnings** (2 syntax errors on retained patch artifacts and 39
partial-parsing diagnostics, including embedded languages). This prevents a claim
of complete SAST coverage. Auto requires metrics enabled; the npm package name was
not substituted for the official Python CLI. The original server-only scan found
17 findings; the broader scan is the authoritative Wave 2 auto result.

The 35 findings are retained without code/payload snippets in
[SEMGREP_AUTO_WAVE2.json](SEMGREP_AUTO_WAVE2.json). They include HTML interpolation,
logging, dependency cooldown policy, dynamic regex, sanitization, shell execution,
HTTP/WebSocket use and Express diagnostics/response rules. They are OPEN, not
suppressed or certified false positives. The green pinned constructor-boundary
rule does not make the auto scan green.

## Gate decision

**WAVE 2 PARTIALLY IMPLEMENTED; NOT CERTIFIED.** C/D/E remain IN_PROGRESS despite
all executed CI checks passing. Forty source candidates, dependent producers/readers,
legacy erasure/mail, effective IAM and 35 auto-SAST findings remain open. Production
flags stay OFF; `baselineFixed=false`, `productionApproved=false`. PR #358 remains
DRAFT. Stop for the Wave 3 review instruction; no feature or production approval.
The final documentation commit records this immutable tested code SHA; its automatic
CI is a separate run and is not represented as the same tested HEAD.
