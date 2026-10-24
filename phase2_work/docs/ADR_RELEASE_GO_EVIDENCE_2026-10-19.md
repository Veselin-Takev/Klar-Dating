# ADR — GO requires exact-commit, independently reviewed release evidence (2026-10-19)

**Status:** Security-hardening proposal on unmerged feature branch. **Operational decision: NO-GO.**

## Verified issue and threat

The protected `release.yml` workflow invokes `scripts/check-production-release-approval.mjs` before container publication, but that checker previously only compared `KLAR_PRODUCTION_RELEASE_APPROVED` to `true`. A mistakenly set or compromised release variable could therefore pass this first release authorization gate **while the repository's `RELEASE_MANIFEST.json` still explicitly recorded NO-GO**, 15 GitHub issues remained open and genuine Art.17/Rules Emulator, live TTL ACTIVE and critical supply-chain evidence were missing.

An externally supplied six-page `Klar Enterprise – Production Readiness GO` PDF claims GO, zero open issues and all tests passing but is not signed CI evidence. Its suggested Art.17 test calls `referralRef.delete()` and assumes children under `/matches/` are also erased; **Firestore explicitly states that deleting a document does NOT delete subcollections**. The PDF also suggests an unapproved blanket daily deletion of `partner_referrals` after 30 days, without legal-hold handling. None of those example snippets is imported into production.

Official Firebase references: https://firebase.google.com/docs/firestore/manage-data/delete-data and https://firebase.google.com/docs/firestore/ttl .

## Decision (fail closed)

- Keep existing GitHub protected environment and `KLAR_PRODUCTION_RELEASE_APPROVED=true` requirement. In addition, `check-production-release-approval.mjs` **must** load `RELEASE_MANIFEST.json` and `GO_LIVE_CHECKLIST.md` from the checked-out source and run the pure `release-go-evidence.mjs` validator. Missing/invalid files, malformed approvals or exceptions are denied.
- Require `releaseGovernance.decision=GO`, `productionApproved=true`, zero governance blockers, `releaseEvidence.status=VERIFIED`, integrated evidence GO and a `goLiveAttestation.approvedCommit` matching `GITHUB_SHA`.
- Require 14 exact-commit PASS gate receipts (including npm audit, Gitleaks and Semgrep), 13 integration/compliance receipts (genuine Firestore Rules, Art.17 transaction tests, live TTL/holds, deployed CSP, AI Act 5/50, Art.9 PII, webhooks, idempotency, independent CI and SAST), zero Critical/High vulnerability counts and exact-commit approvals by **Security, DPO, Legal and SRE**, each with an external evidence link. Unchecked checklist items also deny GO.
- `check:enterprise` now includes the source-only regression `check:release-go-evidence` (45+ tests); `check-release-workflow.mjs` rejects regression back to env-only approval. **The positive fixture is synthetic and tests structure only**: a link string is not evidence of authenticity, a reviewer identity or successful remote execution. Separate `check-release-ci.mjs`, protected environments, actual signed build provenance and human verification remain mandatory.

## Migration and N-1 / rollback

No Firestore schema, index, security rule, collection field, session, API payload or production data was changed. N-1 database/app data remains compatible. The **release-control schema** is intentionally stricter: older manifests without signed, independently verified `goLiveAttestation` receipts will be denied instead of treated as authorized. Prepare the new evidence shape on a separately reviewed feature branch and approve the protected environment only after all actual gates pass. Rollback of this gate to env-only approval would reintroduce the security bypass and requires an extraordinary independent release-security review; it is **not** a recommended production recovery method.

## Evidence boundary

At review time: GitHub open issues **15**, Draft PR #119 unmerged, live staging TTL not verified, actual Art.17 Emulator assertions never completed, previous 14 mandatory checks **5 PASS/9 FAILED or BLOCKED**, root `bun.lock` advisory scan previously **1 Critical/4 High**; no SRE/DPO/Legal/Security GO. A local test and PDF claim cannot convert these observations into production PASS. **NO-GO.**
