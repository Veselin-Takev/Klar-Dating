# P0 #56: Transactional partner-referral quarantine before Art. 17 erasure

**Date:** 2026-10-18  
**Status:** Draft / **NO-GO**, no merge or production deployment.

## Risk and fix

Before this change, the account-erasure worker deleted buyer claims by `referralId`, then deleted their parent referral. A partner conversion could create a claim concurrently because it checks an `active` referral inside its Firestore transaction. Consequently a claim could appear after the deletion query had finished, but before the parent was deleted.

`quarantineOwnedPartnerReferral` now runs a Firestore transaction that reads the parent, verifies `ownerUid` has not changed, and atomically switches the referral to `status: 'deleting'` before any buyer-claim purge. The production conversion transaction requires `status === 'active'` and reads the same document. A concurrent transaction reading the parent must be reconciled against its transition. The deletion worker keeps the existing child-before-parent deletion ordering and per-referral cancellation checkpoints.

The quarantine operation returns `updated`, `already_deleting`, or `missing`. The first result records a real mutation; a repeated invocation is read-only and restart-safe. Any changed owner or unavailable Firestore transaction fails closed.

## Tests

- `node --import=tsx --test scripts/test-partner-referral-quarantine.mjs` — six local in-memory functional cases for update, idempotent restart, missing document, changed owner, invalid target and transaction failure.
- `firebase emulators:exec --project demo-klar --only firestore --config firebase.pruefung.json "vitest run tests/partnerReferralDeletionEmulator.spec.ts"` — targeted actual Firestore emulator cases for concurrent quarantine, restart without new conversion eligibility and fail-closed changed owner.

**Evidence requirement:** Do not count emulator test cases as passed without an executed emulator job. An isolated mock test validates the helper contract but not Firestore's distributed locking, transaction retry behavior, recovery, completeness, or legal holds.

The static Art. 17 gate continues to enforce the quarantine-before-child-delete order; the negative mutation suite must reject removal of the quarantine call. Full Node 22.23.3, TypeScript, Firebase Rules/Emulator, Playwright/build, real TTL policy evidence and independently approved DPO/Security/Legal review remain mandatory. **NO-GO**.

## Verified local check (2026-10-18)

The integrated `npm run check:art17-deletion-audit` command returned exit code 0 under an officially checksum-verified Node 22.23.3 binary for source commit `f83c84acbc3f03fbedb6583cb54ae61abae8eff0`. The **7 storage checks**, **12 static deletion mutation checks** and **6 in-memory quarantine contract tests** passed. The Firestore Emulator scenarios have not been executed. Repeat all gates on the final integration SHA; **NO-GO**.

## Exact-source test evidence — 2026-10-18

- GitHub source commit: `c4d03eae44fa213d0af394fe71ea16a8e3ee1ccd`.
- Official checksum-verified Node v22.23.3: `npm run check:art17-deletion-audit` exit 0, **7 storage tests, 12 negative mutations, 6 transactional helper contract tests**.
- `check-secrets`, `check-auth-boundary`, `check-public-firestore-rules`, `check-ai-pii-sanitizer`: each exit 0 against the source tree. A temporary test-only dependency symlink was excluded from the secrets scanner's scope; the scan was not suppressed.
- The Firebase Emulator integration cases are **committed but NOT RUN**. This evidence does not establish Firestore transaction serializability or safe concurrency in production. **NO-GO**.

## 2026-10-18 — Fail-closed Firestore Emulator execution

The dedicated `npm run test:art17-partner-emulator` command starts the Firestore Emulator with project `demo-klar`, then invokes `node scripts/run-art17-partner-emulator.mjs`. That runner refuses missing/non-loopback endpoints, wrong port (from `firebase.pruefung.json`), and mismatched GCP project IDs before launching Vitest. It marks `KLAR_REQUIRE_FIRESTORE_EMULATOR=1` so the target test file cannot silently skip if emulator configuration is missing.

The real Emulator test file now contains **four** scenarios, including a concurrent status-checked conversion writer racing transactional quarantine followed by a child-before-parent sweep and an assertion that no orphan claims remain. These tests are **committed but NOT RUN** in this iteration: the remote execution sandbox has no Java runtime and insufficient memory for the full Emulator toolchain. A passing preflight is **not** a passing Firestore integration test.

**Executed on code commit `5f4edcdd90b3d2fb4a99effb539bf44f2cf4ff03` with official checksum-verified Node 22.23.3:** dedicated preflight safety regressions **6/6 PASS** (missing host, remote endpoint, production-like endpoint, wrong port, wrong project in either environment variable). Integrated `npm run check:art17-deletion-audit` exit 0: 7 storage tests, 12 static mutations, 6 contract tests, and 6 emulator preflight tests. Emulator evidence, full project typecheck/build, security/legal approvals and production TTL remain missing. **NO-GO**.
