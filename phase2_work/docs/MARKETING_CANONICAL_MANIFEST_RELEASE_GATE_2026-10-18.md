# P0 #47 — Canonical claim manifest pin for release (2026-10-18)

**Status: DRAFT / NO-GO.** Stacked on PR #89 (which contains #88).

## Finding
The existing claim checker reads `KLAR_CLAIM_MANIFEST_PATH` even when invoked with `--release`. A caller that controls the environment could substitute a syntactically complete but unauthorized `GO` manifest rather than the committed, five-claims-blocked evidence matrix.

## Fail-closed correction
In `--release`, an explicit `KLAR_CLAIM_MANIFEST_PATH` override is denied, and the checker always reads `docs/MARKETING_CLAIM_EVIDENCE_2026-10-18.json` relative to its own module path. In non-release mode, an override remains available for isolated, disposable mutation tests. The test now verifies a forged GO override fails, and independently exercises invalid evidence and shared reviewer assertions without accidentally relying on the override rejection.

This is only file-source integrity against environment override: someone able to modify the canonical manifest in their workspace could still falsify it. Immutable trusted CI inputs, signed independent Product/Legal/Brand approvals, real evidence verification and protected branch settings remain required. Claim gate success alone must never grant production GO.

## Validation
`node scripts/test-marketing-claims.mjs`: mutation suite must PASS.
`node scripts/check-marketing-claims.mjs`: canonical schema must PASS with zero approvals.
`node scripts/check-marketing-claims.mjs --release`: must exit 1 / NO-GO.
`KLAR_CLAIM_MANIFEST_PATH=/tmp/malicious.json node scripts/check-marketing-claims.mjs --release`: must exit 1.
Run full Node 22.23.3 mandatory gates, Product/Legal/Brand review and verified CI branch protections before release. No deployment or paid CI reruns.
