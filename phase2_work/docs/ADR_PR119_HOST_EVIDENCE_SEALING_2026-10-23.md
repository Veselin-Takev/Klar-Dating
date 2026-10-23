# ADR: Close host logs before SHA-256 sealing; keep independent approvals outside technical gate evidence

- **Date:** 2026-10-23
- **Status:** Proposed / locally tested, NOT a production GO
- **Scope:** Audit tooling only on `audit/pr119-host-evidence-governance-2026-10-23`; no application or PR #119 modification
- **Base commit:** `7fdf29010c85f16a9b38e5c93186f32e92192f3a`

## Context and verified defect

The previously prepared host launcher starts process-substitution `tee` for host stdout/stderr, then constructs `SHA256SUMS` while these file writers may still be active. It also builds before recording `docker-run.exit-code` and may not preserve a complete, immutable evidence set after a gate failure. This creates a preventable checksum race.

The existing structural verifier required `approval-*.json` files in the host checksum manifest. However Security, Privacy/Legal, Operations/SRE and Release Owner are intended to give **independent sign-offs after** technical gates are complete. Mutating a sealed host directory to insert later sign-offs would invalidate the original manifest and destroy the clean separation of evidence and governance.

## Decision

1. Technical host evidence and human authorizations are two **different**, separately sealed objects. Host logs and exact gate exit codes are finalized first; the host evidence manifest is sealed once, without replacing or modifying any original log. Missing approval receipts do not block **technical screening**, but `release_decision` stays `NO-GO` and `approvals_identity_verified` is always false. Any supplied malformed approval receipt remains a technical integrity error.
2. A separately version-pinned sealer, `scripts/seal-host-gate-evidence.mjs`, refuses existing manifests, nonregular/symlink entries, nested paths, unsafe filenames or concurrent detected mutation. It hashes closed files twice, creates `SHA256SUMS` with an exclusive atomic link and immediately verifies the content; it never reports GO. A file changed after sealing will fail the later SHA-256 verification, but the procedure depends on the operator terminating log writers before sealing.
3. The verifier now requires exactly one occurrence of each immutable identity fact (`baseline.txt` commit/node/bun, `host-preflight.txt` target_sha); contradictory duplicate assertions fail closed. Additional nonidentity host diagnostics may remain in those files.
4. Independent organizational signatories must attest to **both** the immutable commit and the sealed technical evidence SHA-256 digest via an identity-verified external channel. They must not be able to rewrite the original host manifest.
5. Full 15-gate results, live TTL/Art.17, Security/Legal/SRE/Owner review, release governance and production release authorization are unchanged. No automatic GO, merge, deploy, pipeline trigger or fourth application-fix cycle.

## Alternative rejected

Including self-declared `APPROVED` JSON files before checksums and automatically interpreting `technical_evidence_pass` as release-ready is rejected. Checksums do not prove runner provenance or reviewer identity. Likewise deleting/replacing `SHA256SUMS` after sign-off would break audit immutability.

## Validation and limitations

The local Node test suite covers missing approvals, identity-claim conflicts, tampered logs, symlinks, unsafe paths, duplicate sealing attempts and preservation of nonzero exit codes. It does **not** validate a real authorized Docker host (not available), sign human attestations, certify scanner provenance or complete the production security/DSGVO checks. Production status remains **NO-GO / HARD STOP**.

## Rollback and migrations

No database schema or Firestore index migration. Revert only the dedicated audit-tooling commit to restore the old verifier if required; do not change PR #119 or `main`. The old unchecked host script remains disallowed pending authorized fix.
