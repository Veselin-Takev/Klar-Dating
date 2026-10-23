# P0 #47 — Marketing claim approval evidence validation (2026-10-18)

**Current release status: NO-GO.** This stacks on Draft PR #88 and does not grant real Product, Legal or Brand authorization.

## Risk addressed
Previously a claim could be marked approved with one arbitrary evidence string and the same person or informal free text for each review role. In addition, the --release mode did not independently check the top-level releaseStatus, creating a path where claims could be marked 'approved' while the manifest still declared NO-GO.

## Implemented fail-closed *structural* gate
Each approved claim requires at least two distinct non-placeholder HTTPS references (product behavior and test evidence), three syntactically valid and different GitHub reviewer handles (Product, Legal, Brand), and explicit releaseStatus=GO for --release. Unapproved claims remain blocked. Tests mutate the matrix to verify rejection of missing release approval, placeholders, duplicate reviewers and default NO-GO.

This script cannot authenticate reviewer identity, authority, link contents, real signed approval, evidence freshness, or code correctness. A structurally passing matrix is **not** permission to publish. Product/Legal/Brand must inspect the linked artifacts and sign the release decision independently; branch protection and trusted CI must enforce this separately. The sample syntactic positive test deliberately uses non-authoritative links and must never be used as approval evidence.

Run locally from phase2_work: `node scripts/test-marketing-claims.mjs`, `node scripts/check-marketing-claims.mjs`, and `node scripts/check-marketing-claims.mjs --release` (expected exit 1 until approved). Full Node 22.23.3, security, i18n, accessibility, emulator and build gates remain mandatory. Do not alter blocked states solely to obtain a green CI result.

No production deployment, merge or GitHub Actions reruns. Release remains NO-GO. Issues #47 and #8 remain OPEN.
