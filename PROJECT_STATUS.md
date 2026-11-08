# Klar project status

Canonical current status: [phase2_work/docs/PROJECT_STATUS.md](phase2_work/docs/PROJECT_STATUS.md).

Gate 0 v0.1.1-rc1: **BLOCKED**, baselineFixed=false, productionApproved=false.
See [audit](phase2_work/docs/releases/v0.1.1-rc1/GATE0_AUDIT.md) and RELEASE_MANIFEST.json gate0. Historical releaseGovernance fields describe earlier candidates.

Latest scoped verification: 1,527 PASS on 4dc39cd5; full tenant certification remains open. See canonical status and gate0.isolationClosure in both manifests.

Finalizing evidence: 1,536 PASS on f8f6fa59; lead PR #358 supersedes #356/#357. baselineFixed=false, productionApproved=false. Full Admin SDK/IAM certification remains open.

Admin repository: implemented and under verification; 50 legacy consumer files still require coordinated migration. IAM documented, effective deployed privileges unverified. baselineFixed=false.

Verified Admin wrapper checkpoint: 1,549 PASS on b0dca22c plus 1 static negative test. Fifty legacy consumer files and unverified effective IAM prevent certification; baselineFixed=false.

Legacy migration: 50/50 not complete. SDK factory confinement and Semgrep implemented; missing IAM identities/bindings prevent conformity verification. baselineFixed=false.
