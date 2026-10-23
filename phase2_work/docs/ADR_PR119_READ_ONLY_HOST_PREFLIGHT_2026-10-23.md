# ADR — PR #119 read-only host readiness check (2026-10-23)

**Status:** Proposed audit-tooling control; locally tested, not yet installed as an approved Enterprise host launcher.
**Target application commit:** `7fdf29010c85f16a9b38e5c93186f32e92192f3a`.
**Release decision:** **NO-GO / HARD STOP**.

## Problem and decision

The former host launcher tries to invoke Docker and network operations as soon as it is started. The prerequisites are not sufficiently visible before a chargeable run. A dedicated read-only preflight is therefore prepared as a *separately reviewed, locally tested candidate*; it must not be mistaken for an authorized or already installed program.

The preflight checks the exact 40-character commit SHA, Node.js v22.23.3, Bun 1.4.2, local Docker CLI and daemon, git/bash/sha256sum, a syntactically digest-pinned proposed image reference, a nonsecret authorization *reference*, and a private, empty or absent results directory. It invokes no Docker build/run, fetch, gate, remote write, merge or deployment. It never returns GO or identity-authenticated approval.

A digest reference is only a byte identifier, **not proof of approved provenance**. A human-entered authorization reference is **not independently verified approval**. Docker image signature, registry/network availability, browser/emulator dependency readiness, SAST binary pins, secret minimization and four signer identities remain external controls.

## Local evidence and failure policy

Candidate test suite: **17/17 PASS**. Existing evidence verifier/sealer suites: **43/43 PASS**, all under local Node.js **v22.16.0** rather than the required v22.23.3. Running the preflight on that same sandbox returned **exit 1, NO-GO**, because Bun and Docker were unavailable and the approved image/authorization references were not supplied. These results do not count as mandatory host gates or a successful authorisation.

If a required prerequisite fails, the approved host audit is not started. Only a separately authorized Security + Release Owner decision can permit a new immutable-SHA Enterprise host run, with approved pinned image provenance, fixed scanner/tool versions and budget. Preserve original results for offline sealing/verification and obtain the four independent commit-bound GO approvals separately. **0/15 qualified mandatory gates and 0/4 independent approvals remain the last evidenced release state.**

## Compatibility, rollback and restrictions

Audit-tooling-only documentation; no change to runtime APIs, product code, lockfiles, Firestore indexes, deployment settings or PR #119. Revert this ADR/status note/runbook paragraph on the isolated audit branch to roll back. Do not reopen the exhausted application correction cycles. A passing read-only environment check is never an authorization to run chargeable CI or to merge/deploy.

References:
- https://docs.docker.com/build/building/best-practices/
- https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations
