# ADR — v0.1.1-rc1 P0 verification-photo deletion containment

- **Status:** Proposed for independent review; implemented as RC containment, NOT release-approved
- **Date:** 2026-11-08
- **Release:** `v0.1.1-rc1`
- **Branch:** `release/v0.1.1-rc1`
- **Base:** `main@96c3857c53f5ced31fe1394895185f42c75bc716`
- **Tickets:** VES-5, VES-15, related #202
- **Risk:** HIGH (irreversible data deletion, legal holds, GDPR Art.17 and retention)

## Context

Two operational deletion entrypoints must be considered together: the signed verification-photo purge route and the Art.17 account-erasure Storage helper. A Firestore decision can change after the last Firestore authorization and before a GCS generation-bound delete. The GCS generation precondition guarantees object-version consistency, not atomic legal/decision consistency across Firestore and Cloud Storage. An unrelated account-erasure pathway could bypass scheduler-only containment. A local or PR-level green test is not proof against production IAM, additional writers or this distributed race.

## Proposed decision

1. Treat any production verification-photo physical delete as **DENIED** until all real Storage/Firestore/Admin/event writers are inventoried and share a demonstrably safe, independently reviewed cross-service fence. This includes scheduler credentials with a valid signature and enabled feature flag.
2. Disallow account-erasure cleanup from silently using a legacy verification-photo delete path. Preserve explicit, auditable **pending/blocked** state when verification objects cannot lawfully or safely be removed; do not claim successful total erasure.
3. Fail closed on malformed or contradictory Firestore hold flags, GCS holds and generation metadata. The object-generation precondition and explicit project/bucket identity remain mandatory **additional** protections, never replacements for the cross-service decision fence.
4. Keep destructive paths disabled while the DPO defines appropriate Art.17 exception/hold handling, timelines, customer communication, auditable reconciliation and resumption.
5. Only test-only local emulators may exercise fault-injection deletion mechanics behind non-production, non-Cloud and explicitly authorized guards. Never introduce test doubles in production code.
6. No production schema change, backfill, feature enablement, IAM/Cloud Run/Storage action or tag is approved by this ADR.

## Alternatives rejected / deferred

- **Feature flag alone:** Cannot protect a second direct delete path or unauthorized actors.
- **GCS `ifGenerationMatch` alone:** Does not serialize GCS deletion against new Firestore holds.
- **Unconditional 30-day age-based deletion:** May violate pending moderation/legal preservation requirements.
- **Blindly merging all 159 source-branch commits:** Adds unreviewed ancestry and destroys RC scope clarity.
- **Indefinite suppression without operational procedure:** Not acceptable as final GDPR compliance; containment is temporary and must be coupled to owner-approved remediation, monitored backlog and exception handling.

## Mandatory preconditions for moving to Phase B and C

- Derive a file-by-file delta for #345/#348/#349/#350/#352/#353 against `main`, distinguishing direct changes and inherited parents. Review each runtime writer path; enumerate external and cloud writers as UNKNOWN unless evidenced.
- Commit failing negative tests first: late legal hold, decision revoked, crash/ambiguous receipts, dual deletion-path bypass, malicious cloud/test markers, malformed holds and Storage metadata, missing explicit bucket/project, duplicate/replay and partial account-erasure resume.
- Integrate only reviewed and causal fixes via conventional commits into this RC branch. Never copy a branch's entire history merely to obtain a green run.
- Run every gate defined in `docs/releases/v0.1.1-rc1/RC_MANIFEST.md` on the exact **integrated RC SHA**. Treat missing/skipped tests and unexecutable audit commands as BLOCKED, not PASS.
- Independent AppSec, DPO/Legal, SRE and Release Owner sign-off based on real staging evidence and source identity; no self-approval in place of required independent review.
- Keep state `productionApproved=false` and NO-GO until all evidence is complete. `PROMOTE` is requested **only** for a verified READY FOR PROMOTION RC, and is separate from production traffic approval.

## Implementation checkpoint — 2026-11-08

The following narrow **RC-branch-only** containment is implemented but not yet certified:
- Signed purge route denies with HTTP 503 after HMAC verification, before any Firestore/Storage operations.
- Legacy upload-age helper rejects before Storage calls; its scheduled Cloud Function now only cleans independent funnel-event TTL.
- Account-erasure helper checks the verification prefix before and after bounded profile-only cleanup, refuses existing verification objects, and validates GCS metadata holds and generation preconditions fail-closed.
- Negative Vitest, Storage Emulator and dependency-free real-module tests were added or updated test-first where applicable, together with static gates.

**Remaining unproven:** External writers and cloud Scheduler/IAM inventory; a verification-photo creation after the final inventory; cross-service post-authorization hold races; durable hold/recovery semantics; DPO-approved Art.17 exception/retry/backlog policy; actual latest integrated SHA gates. This is an intentional **temporary hard stop**, not a verified distributed fence or an authorization to suspend statutory obligations indefinitely.

## Consequences

- **Benefit:** Avoids unverified irreversible deletion and inaccurate account-erasure completion.
- **Cost/risk:** Delayed deletion/retention operations, operational reconciliation and compliance backlog. These remain explicit release blockers until independently resolved.
- **Validation required:** Exact-SHA emulator + browser CI; adversarial Firestore/GCS staging; IAM and audit-log proof; rollback/recovery runbook; release provenance.

**Decision outcome:** This ADR records the proposed RC safety posture only. No code, cloud configuration or production approval is changed by this document.
