# ADR: Streamed large-log verification without weakening metadata boundaries

- **Date:** 2026-10-23
- **Status:** Accepted for isolated audit tooling; unqualified for production release
- **Scope:** `audit/pr119-host-evidence-governance-2026-10-23` only
- **Target application commit:** `7fdf29010c85f16a9b38e5c93186f32e92192f3a`
- **Release status:** **NO-GO / HARD STOP**

## Context

The verifier streamed the SHA-256 of all host artifact files but also parsed seven infrastructure stdout/stderr and build/install logs using `readSmall` (2,000,000-byte maximum). Full authentic CI output may exceed 2 MB. Even when the log's manifest hash was correct and every gate passed, the second, semantically unnecessary read caused `technical_evidence_pass=false`. This was an availability/correctness defect of the evidence verifier, not proof that application gates passed.

## Decision

1. Keep full-file streamed SHA-256 validation for every manifest-listed artifact, including multi-megabyte gate and host logs. For the seven infrastructure log paths, require manifest inclusion but do not load their bytes for semantic parsing.
2. Keep the strict 2 MB limit for semantically parsed, small bounded metadata: `baseline.txt`, `host-preflight.txt`, `container-toolchain.log`, all `.exit-code` files, `gates.tsv` and any `approval-*.json` receipts. Verify a hash of the **exact interpreted metadata bytes** against the manifest.
3. Require all 15 gate log entries and reject an empty gate log using the known SHA-256 digest of the zero-length string. A blank stderr log is allowed, but the stderr file still must be manifested and hash-verified.
4. Preserve symlink/hardlink protections, before/after file stat checks, parse boundaries and all fail-closed nonzero/unknown/missing evidence handling. Never change the hardcoded `release_decision=NO-GO` behavior.

## Alternatives rejected

- Increasing the metadata bound to arbitrary sizes or decoding all logs: unnecessary memory and parsing exposure.
- Truncating the host logs before hashing: corrupts original audit evidence and breaks provenance.
- Skipping checksum validation on large logs: would silently accept tampering.

## Tests and audit trace

`node --test scripts/verify-host-gate-evidence.test.mjs scripts/seal-host-gate-evidence.test.mjs`: **43/43 PASS** locally with Node.js v22.16.0. Negative fixtures include a >2 MB gate log modified after sealing, plus absent auxiliary log and oversized identity metadata. Positive fixtures include >2 MB valid gate and runner output. These are tooling tests, not the 15 mandatory application gates and not an attestation of the authorized runner's v22.23.3 / Bun 1.4.2 runtime. No CI or production action is implied.

## Residual risk and operation

An internally consistent manifest cannot authenticate its publisher, host provenance or four separate human signoffs. An auditor must verify an independently signed host attestation and exact commit identity before treating evidence as qualified. A real host run and final GO remain blocked without explicit separate authorization. Rollback consists of reverting only this atomic audit-tooling commit on its dedicated branch; no database, Firestore rules, release workflows or application source are changed.
