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
