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

Full changed-candidate verification is pending. The last complete baseline before
this wave is **1,561 PASS** on `bd3c9f7095b4b76b48daf29fb44192e077f9bc74`,
[CI 42486611334](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42486611334).

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
