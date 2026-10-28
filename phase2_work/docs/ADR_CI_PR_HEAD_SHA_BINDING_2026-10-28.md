# ADR: Bind Enterprise CI to exact PR source SHA (A-04)

Date: 2026-10-28. Status: proposed, pending CI and independent review.

## Finding
GitHub pull_request jobs default to synthetic merge refs. A green workflow run on that ref does not by itself prove that the exact PR head tree was checked out. Previous run conclusions must not be carried forward to a changed SHA.

## Decision
Explicitly check out github.event.pull_request.head.sha (or github.sha for push), then compare git rev-parse HEAD to the expected 40-character lowercase commit SHA before scope determination. Fail closed on mismatch. Include regression tests for absent, malformed and stale identities. The full suite remains subject to scope rules and independent approvals.

## Security and rollout
This verifies source identity, not merge compatibility, branch protection, security findings, staging integration, or release approval. The workflow still uses a read-only token and pinned actions. No deployment or cloud mutation is added. Rollback: revert this isolated commit; this restores prior checkout behavior but removes source-identity attestation and must not be treated as a security waiver.

## Release evidence
Base main SHA: 2808dc1cbb485f70b403681c108cea5a3361d950. New PR head and GitHub CI evidence must be recorded after the commit. All 14 mandatory gates, 13 integration proofs, TTL ACTIVE, legal holds, signed EVV and independent Security/DPO/Legal/SRE/Release approvals remain unverified. Production remains NO-GO; productionApproved=false.

## Exact-head CI evidence (verified 2026-10-28)

- PR: #170 (Draft); source commit: `d54687afc2ab75601ab8ebb5cacb8849333f4a00`.
- GitHub Actions Enterprise CI run: `40683327702`; job `122799315946`; conclusion: SUCCESS.
- Job log: `Verified exact source checkout: d54687afc2ab75601ab8ebb5cacb8849333f4a00`.
- Executed (SUCCESS): Verify exact source HEAD, Exact-head checkout regression, scope regression, Enterprise static gates, typecheck, Functions build, tests, build, production smoke, Playwright browser acceptance.
- This is evidence for the *previous* source commit only. The documentation-only evidence commit that adds this section requires a fresh exact-head CI run; do not inherit the previous PASS.
- No OSV scan was triggered by the earlier workflow-only commit; supply-chain remediation remains blocked. Full release evidence, staging proofs and independent approvals remain missing. NO-GO / productionApproved=false.
