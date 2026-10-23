# ADR — PR #119 evidence closure: signed artifacts after writers stop

**Date:** 2026-10-23  
**Status:** PROPOSED — locally verified tooling candidate, NOT deployed and NOT a release GO  
**Repository branch:** `audit/pr119-host-evidence-governance-2026-10-23`  
**Immutable PR #119 baseline:** `7fdf29010c85f16a9b38e5c93186f32e92192f3a`

## Audited problem and decision

The older authorized-host handoff launcher uses `exec > >(tee results/host.stdout.log)` and generates `SHA256SUMS` before the tee processes are guaranteed to have terminated. The resulting checksum file can omit late writes. The earlier technical verifier also required all four `approval-*.json` receipts in the sealed host manifest even though independent reviewers are intended to approve **after** seeing the complete host evidence. Modifying the sealed manifest after their review would break evidence integrity.

**Decision:** Separate the technical host evidence from subsequent, identity-authenticated release approvals. First complete all 15 gates, capture actual exit codes (including failures), stop and join every log writer, and then seal the host result directory once. Do not overwrite existing `SHA256SUMS`, re-create a failed run's manifest, or append to a hashed log. Publish the manifest digest through an independently authenticated channel with runner/build provenance. Independently signed Security, Datenschutz/Legal, Operations/SRE and Release Owner reviews must attest to the exact 40-character commit and the sealed manifest digest as a **separate immutable approval bundle**.

A missing approval receipt must not prevent **technical evidence screening**, but neither technical screening nor a JSON receipt can grant GO. The decision stays `NO-GO` until all checks, authenticity, operational controls and four human sign-offs are independently verified.

## Local implementation candidate, verification and limitations

A local, **not yet committed** candidate contains `seal-host-gate-evidence.mjs` and tests, enhanced `verify-host-gate-evidence.mjs` and tests, and revised authorized-host runbook. The proposed sealer refuses an existing manifest, symlinks, nested entries, unsafe names and detected concurrent mutation; it double-hashes original logs before publishing the manifest and verifies it after publication. The verifier rejects duplicated or contradictory commit/node/bun/target-sha assertions, permits technical screening before independent approvals, and continues to return `release_decision: NO-GO` unconditionally.

**Local results:** 35/35 narrow Node.js unit tests PASS under Node.js v22.16.0. An earlier real failed local Docker preflight was sealed on a separate diagnostic copy and correctly rejected by screening with exit code 1 and 13 reported defects. These are **not** the 15 mandatory release gates; the required Node.js v22.23.3 / Bun 1.4.2 enterprise host run has not occurred.

Do not use the previous tee-based host launcher to generate official final evidence before it has been separately corrected and tested. Do not import the uncommitted tooling as though it were part of the PR119 immutable Git tree; after independent review, its exact file blobs and hashes must be verified before a separate audit-branch commit.

## Immutable governance and rollback

PR #119 remains Draft and unmerged; do not change `main`, touch production, initiate a paid workflow run, or authorize any merge/deployment. The application correction hard-stop remains active after its three previous cycles. A new tool-only audit implementation does not lift that stop.

No database or Firestore migrations are involved. This ADR is documentation-only and may be reverted independently on the audit branch. **Release decision: NO-GO / HARD STOP.**
