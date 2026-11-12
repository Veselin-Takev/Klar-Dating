# P0 remediation for PR #360 — 2026-11-08

**Production remains NO-GO; productionApproved=false.** This change prepares a candidate for independent re-audit. It grants no legal, production, deployment or merge approval.

## Implemented containment

Both repository-root and active `phase2_work/storage.rules` enforce a registered default-tenant principal and server-owned adult eligibility. Readers and profile owners must have `isAdult:true` and `mediaAccessState:active` in `tenants/default/users/{uid}`. Guest, minor, missing, unmigrated and erasing identities fail closed; token `isAdult` claims cannot replace those records. Every direct verification/profile upload additionally checks that no canonical account-deletion job exists, regardless of job status. Client verification reads/deletes remain denied.

Storage Rules allow only two Firestore document lookups per request. Profile reads therefore consume the reader and owner user records. The trusted media fence is not a client claim: the existing Firestore user-update allowlist prevents clients from setting it. Age verification activates it only in a transaction that reads and excludes a deletion job. Rejection sets it to blocked. Account-deletion acceptance atomically commits the erasing fence with its durable deletion job; repeated requests also repair the fence for legacy jobs. The native concurrency regression proves age reauthorization cannot reopen this fence after deletion acceptance.

The API adds a second authoritative check for profile recommendations/publication, chat profile endpoints, date-planner connections and the media namespace. It denies anonymous/missing-provider identities, checks adult/fence/job state in a scoped repository transaction, and returns no-store responses. Existing authentication still verifies revocation and the supported Firebase namespace. Account recovery/export and erasure rights are not gated by this media guard.

## Erasure guarantees and limits

Firestore, GCS and Firebase Auth cannot participate in a single distributed ACID transaction. This implementation does **not** claim otherwise. Only the Firestore fence/job commit and the eventual receipt/job-completion commit are atomic within Firestore.

The existing durable, leased, paginated deletion worker remains in use. A new native-emulator regression exercises real profile-object deletion, Firestore removal, Auth-user removal, the mandatory delayed final sweep, receipt publication and idempotent retry. A separate race test covers concurrent age reauthorization and erasure acceptance. These are synthetic proofs of supported paths, not live-cloud or external-provider attestations.

Physical verification-photo purges remain hard-disabled. Existing verification objects keep erasure explicitly pending; containment is not permission to re-enable destructive cleanup. External/Admin SDK writers, already in-flight requests and cross-service hold races still require the existing independent all-writer/cloud proof. No live mutation, provider operation or data migration was executed.

## Dependency remediation

The active app pins `re2js:2.8.7` through a reviewed Bun override and lockfile integrity change. This is the fixed version for the audited production advisory GHSA-gg6h-894w-4m9c. No other package version was changed. CI and production-release workflows now run `bun audit --production --audit-level=high` so a future High/Critical production advisory blocks them.

The focused post-patch production query passed at the High threshold; the complete production response still contains four moderate and one low advisory entries. Existing development-only and Functions findings remain separate review work. No general “all dependencies vulnerability-free” assertion is made.

## Reproducible verification

Run from `phase2_work/` using Node 22.23.3, Bun 1.4.4, npm 10.9.2, Java 21 and locked dependencies. Synthetic CI requires the three existing `KLAR_TENANT_*_MIGRATION_READY=true` flags, `METADATA_SERVER_DETECTION=none` and isolated `demo-klar` emulator endpoints; none enables production migration.

Required gates are typecheck, all Enterprise static gates, repository Semgrep plus complete first-party-runtime coverage, Functions/App builds, full native Vitest, Enterprise Node, dedicated Rules, Playwright and built-server production smoke. Count repeated Rules/launch suites separately. The **current [PR #360 description](https://github.com/Veselin-Takev/Klar-Dating/pull/360) is the SHA-bound execution record** with actual results, counts, local log hashes and exact-head CI URL. This design document does not certify a future revision or inherit an ancestor's green checks.

The [current adversarial proof](audit-2026-11-08/storage-access-repro.mjs) asserts repaired denials and a successful active-adult owner read. Original vulnerable evidence remains pinned in the historical audit commit, not overwritten as a claim that the original source was safe.

The pinned Firebase CLI ignores NO_PROXY when it creates a ProxyAgent for local Storage-to-Firestore rule lookups. A narrowly scoped preload corrects **only HTTP loopback transport for demo-project emulators:exec**; outbound proxy settings remain intact. It neither mocks documents nor changes rule evaluation. Native positive controls prove legitimate access as well as rejection cases. No production Firebase CLI path is patched.

The full native HTTP suite now waits for the actual local API readiness endpoint (bounded to 45 seconds) before starting. This removes a reproduced cold-start ECONNREFUSED race without retrying assertions or suppressing test failures.

## Rollout and remaining gates

No automatic backfill exists. Accounts without the new trusted fence are deliberately denied media access until a reviewed eligibility migration or authoritative age check establishes it. Review active jobs and authoritative age data before any migration; never blindly mark all accounts active. Rules use the supported default Firestore database; named-database rollout requires separate compatibility work.

Before deployment, independently review server/Rules rollout order, required cross-service lookup permissions, deployed IAM, actual database/project identities, retained bearer download URLs, and cached/CDN/browser media. Storage Rules cannot revoke a previously issued bearer download token; token inventory/revocation remains a separately scoped production operation and was not performed. Do not weaken the guard or restore permissive Rules as a rollback shortcut.

Re-audit readiness is a code-review state only and requires every reported required gate to be green. Effective production IAM/TTL, legacy-data cutover, all-writer fencing, provider deletion, independent AppSec/DPO/SRE/legal signoffs and release governance remain NO-GO gates. Features stay frozen.

