# P0 #374 Package 4 — Offline Storage Cutover Readiness & Rollback Evidence Gate

**Base:** \`main@d0f766dce8dd907a59398ccbdfd081415601db18\` (PR #407 merged; tree \`6721fc10b5b8990734749c55712a90aefc0a2099\`).
**Branch:** \`security/p0-374-package4-offline-cutover-readiness-20261123\`; Draft PR number and final HEAD are held in GitHub metadata.
**Status:** Strictly offline evidence validator and synthetic tests. No operational cutover is performed.
**Release invariant:** P0 #254 and P0 #374 remain **OPEN**; \`productionApproved=false\`; production **NO-GO**.

## Package chain and trust boundaries

| Package | Artifact / guarantee | What it does not prove |
|---|---|---|
| 1 | \`profileMediaDeliveryContract.ts\`: strict \`enabled === true\`; disabled response 503 before downstream dependencies; isolated and not mounted | No production route activation, live tenant mapping or live Storage state |
| 2 | \`profileMediaTokenDryRun.ts\`: deterministic offline inventory/plan digest; \`storageMutations=0\`, \`databaseWrites=0\` | No live bucket inventory, token revocation, or actual legacy URL census |
| 3 | \`storage.p0-374-candidate.rules\`: isolated candidate with direct client deny-all | Not active; no Firebase Rules emulator or production Rules deployment proof |
| 4 | This validator: exact source/artifact identity, evidence digest, risk/rollback completeness and independent approval binding | Never performs cutover, migration, revocation, deployment or production approval |

Package 4 consumes a locally prepared JSON evidence manifest and separately materialized evidence files. It verifies SHA-256 and Git blob SHA-1 for every referenced artifact, binds the manifest to the exact verified main SHA/tree and source blobs for Packages 1–3, parses the Package 2 plan and active Firebase configuration, and rejects candidate Rules if referenced as active. The CLI has no network, Firebase SDK, Cloud SDK, database, or write adapter.

## Validator contract

Run from \`phase2_work/\`:

\`\`\`bash
npm run profile-media:cutover-readiness -- --manifest /absolute/path/to/offline-evidence/manifest.json --expected-main-sha d0f766dce8dd907a59398ccbdfd081415601db18 --expected-main-tree-sha 6721fc10b5b8990734749c55712a90aefc0a2099
\`\`\`

The manifest directory is the evidence root. Every artifact path must be relative, canonical, non-symlink, contained beneath that root, a regular file, and at most 10 MiB. Every artifact carries both SHA-256 and Git blob SHA-1. Missing, duplicated, mismatched, malformed, oversized, traversing or symlinked references block.

The highest possible verdict is **\`ELIGIBLE_FOR_INDEPENDENT_REVIEW\`**. Any gap returns **\`BLOCKED\`** and a non-zero CLI exit. There is no \`PRODUCTION_APPROVED\` state and no \`productionApproved=true\` output.

### Required fail-closed evidence

1. **Package 1:** exact source Git blob identity; strict-true-only enablement; disabled 503; zero downstream calls; route remains unmounted.
2. **Package 2:** exact planner source identity; parseable dry-run plan; SHA-256 manifest/plan digests; explicit non-negative integer counts; all conflict counters explicit zero; mutation counters exactly zero; plan digest recalculated using the Package 2 canonical plan formula.
3. **Package 3:** candidate and active Rules are distinct; candidate content retains deny-all and recursive catch-all; active Rules path remains \`storage.rules\`; \`firebase.json\` references only active \`storage.rules\`.
4. **Persistent token URLs:** offline risk assessment must be complete and separately gated; unresolved offline findings block. Live state remains explicitly unverified and no revocation is claimed. Any real token inventory/revocation requires separate authorization and review.
5. **Legacy \`photoURL\`:** synthetic/offline inventory evidence, privacy assessment, explicit unresolved count, no live data access and no migration. Any real inventory/migration is a separate authorized operation.
6. **Rollback:** exact baseline-bound Default-OFF proof; active Rules and runtime baseline unchanged; at least two explicit stop triggers with owners/actions; incident, AppSec, DPO/Legal, SRE and Release Owner responsibilities; recovery rehearsal evidence.
7. **Integrity and approvals:** every artifact SHA-256 + Git blob SHA-1; canonical safe paths; manifest evidence digest; four distinct APPSEC, DPO_LEGAL, SRE and RELEASE_OWNER approvals, each signed, timestamped and bound to the exact evidence digest by distinct signer reference.

Approvals are modeled evidence only. This offline validator cannot authenticate reviewer identity, validate legal authority, or replace independent human review.

## Default-OFF rollback plan

**Invariant:** Package 1 remains disabled unless a separately authorized future release changes the control. Package 3 candidate Rules remain inactive. No Package 4 action changes either state.

### Stop triggers

- Any evidence digest, source SHA, Git blob SHA, active Rules identity or Firebase config mismatch: stop review, preserve Default-OFF, retain evidence and investigate.
- Any direct client Storage read path, candidate Rules activation, token URL exposure, unresolved legacy URL risk or authorization regression: stop review; do not cut over; escalate to AppSec and SRE.
- Any missing/expired/duplicate approval, DPO/Legal objection, retention/Art. 17 uncertainty or unclear ownership: stop review; preserve current active Rules/runtime baseline.
- Any rollback rehearsal failure or inability to restore the documented OFF configuration: stop and block all operational work.

### Responsibilities

- **Incident Commander:** coordinates stop decision, evidence preservation and incident record.
- **AppSec:** validates authorization boundary, candidate isolation, token URL threat and integrity.
- **DPO/Legal:** validates lawful purpose, minimization, retention, Art. 17 and legacy photoURL handling.
- **SRE:** owns rollback rehearsal evidence, runtime baseline, observability and recovery runbook.
- **Release Owner:** owns the exact-scope authorization decision; no approval is inferred from CI.

### Recovery sequence

1. Keep Package 1 Default-OFF; do not mount or activate the route.
2. Keep candidate Storage Rules unreferenced; preserve active \`storage.rules\`, \`firestore.rules\`, \`firebase.json\` and runtime sources unchanged.
3. Stop all inventory, migration, revocation or deployment operations; none are part of this package.
4. Restore only from the documented immutable baseline through a separately approved change if a future authorized operation ever alters it.
5. Preserve checksums, run IDs, reviewer dispositions and incident evidence; invalidate approvals whenever any bound digest or source identity changes.

This package performs no recovery mutation; it only validates that the rollback plan and synthetic rehearsal evidence are present.

## Test strategy

\`node --test scripts/check-profile-media-cutover-readiness.test.mjs\` runs hermetic Node built-in tests, matching the existing \`check-tenant-cutover-readiness\` pattern. Vitest is not invoked and no \`node:test\` import enters a Vitest suite.

The synthetic matrix covers the positive maximum verdict and missing/mismatched Package 1–3 source SHAs, Package 1 Default-OFF proof, Package 2 counts/digests/zero-mutation counters, candidate Rules activation in \`firebase.json\`, active/candidate Rules confusion, persistent token URL and legacy \`photoURL\` risks, rollback baseline/triggers/owners/recovery, SHA-256/Git blob tampering, path traversal, symlink rejection, and missing/duplicate/mismatched independent approvals.

All fixtures use synthetic strings and temporary local files. No real PII, UID, token, URL, bucket metadata, credential or live evidence is used.

## Explicit exclusions

- No modification of root or \`phase2_work/\` active \`storage.rules\`, \`firestore.rules\`, or \`firebase.json\`.
- No modification of \`phase2_work/server.ts\`, global middleware, production route mounts, or \`src/server/routes/complianceStorage.ts\` (503 interlock).
- No candidate Rules activation or Firebase deployment.
- No live download-token revocation, bucket inventory, \`photoURL\` inventory against live data, or migration.
- No Cloud, IAM, Firestore, Storage, bucket or deployment mutation.
- No \`.github/workflows/\`, Vitest configuration, dependency, or lockfile changes.
- No real PII, UID, token, URL, secret or credential.
- Only the \`scripts\` object of \`phase2_work/package.json\` is modified.

P0 #254 remains **OPEN** with status \`AWAITING_INDEPENDENT_APPSEC_DPO_SRE_REVIEW\`; P0 #374 remains **OPEN**. \`productionApproved=false\`; production remains **NO-GO**.
