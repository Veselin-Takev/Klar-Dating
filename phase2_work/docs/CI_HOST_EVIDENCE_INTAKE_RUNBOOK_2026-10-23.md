# CI host-evidence intake and release-gate reconciliation (2026-10-23)

**Status: DRAFT / BLOCKED / PRODUCTION NO-GO.** This is a preparation runbook, **not** an attestation that any check was executed or passed. The release owner must independently approve its use and the final gate mapping. It is maintained solely on the isolated `docs/ci-governance-audit-2026-10-23` branch; no production candidate, Draft PR #119, protected branch, workflow or Cloud resource is changed.

## Source of truth and scope

- Exact inspected PR #119 HEAD: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`; PR remains Draft/unmerged.
- [Release validator](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/release-go-evidence.mjs): `mandatoryGateNames` (14 exact identifiers), `mandatoryIntegrationNames` (13 identifiers), 4 role signoffs and clean Critical/High security evidence. The implementation is **structural validation**, not authentication of independent external records.
- [Release CI verifier](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/check-release-ci.mjs): requires the **latest exact-commit main push** validation run with all required steps complete and passing. A PR success alone is insufficient.
- Historical host-audit lockdown additionally demands `gates.tsv`, **15 separate gate logs including exit codes**, `SHA256SUMS`, checksum-verifiable Node v22.23.3 runtime artifacts and independent Security, DPO/Legal, SRE and Release Owner acceptance.
- **No verified host bundle has been received in this audit.** No test, Cloud lookup, release or CI retry is authorized by this document.

## A. Secure intake — fail-closed prerequisites

Before any execution or state change, an authorized operator must deliver the artifacts through an approved **non-public** channel, outside the repository, alongside an independently authenticated change-ticket / signer identity. Never attach secrets, service-account credentials, access tokens, personal data, production logs with PII, or unredacted host diagnostics to this branch.

Required properties of the evidence package:

1. Immutable Git commit SHA, repository URL, base/head identity, source archive digest (when applicable), lockfile digest, run ID and attempt, runner image/identity, host environment, UTC capture time and accountable operator.
2. `gates.tsv`: one entry per **15 required host log slots**; exact command/expected environment, log filename, exit status, start and end timestamps, repository SHA, operator, toolchain and log SHA-256. Specify whether each slot is a mandatory release gate or **supplemental** host requirement.
3. Fifteen **separate, complete** log objects; do not accept summaries in place of stdout/stderr and exit-status receipts. Missing, redacted beyond audit usability, truncated, zero-step, skipped, cancelled, indeterminate or wrong-SHA evidence is **NOT PASS**.
4. `SHA256SUMS` covering the actual submitted bytes of `gates.tsv`, all individual logs, runtime proofs and relevant exported reports. Independently verify archive integrity and hashes. Reject extra unexpected members, symlinks/path traversal, hash mismatches, untrusted unsigned manifests and modified/replaced files. **A checksum alone establishes integrity relative to the manifest, not provenance or identity**; verify signer and delivery channel independently.
5. Toolchain proof: `node -v` must correspond to the approved v22.23.3 policy; Bun 1.4.2 and actual dependency provenance/lockfile integrity must be established when used. A textual version string without authenticated binary origin is not an attestation.
6. Named independent approvers with permission evidence, review date and exact approved SHA; acceptance must reflect actual Security, Privacy/DPO, Legal, Operations/SRE and Release Owner responsibilities. A self-asserted `approved=true` flag is insufficient.

**Do not start CI, alter branch protection, update staging TTL, enable release flags or set approval variables during evidence intake.**

## B. Provisional 15-log-to-14-gate ledger

The 14 identifiers below are copied **exactly** from the inspected `mandatoryGateNames` source at the pinned PR SHA. The row-to-log assignment is **only a proposed reconciliation template**, not an assertion that a host has produced any of these logs.

| Host log slot (proposed) | Exact mandatory release-gate identifier | Evidence |
| --- | --- | --- |
| 01 | `npm run check:enterprise` | MISSING |
| 02 | `node scripts/check-secrets.mjs` | MISSING |
| 03 | `node scripts/check-auth-boundary.mjs` | MISSING |
| 04 | `node scripts/check-public-firestore-rules.mjs` | MISSING |
| 05 | `node scripts/check-ai-pii-sanitizer.mjs` | MISSING |
| 06 | `node scripts/check-art17-deletion-audit.mjs 0` | MISSING |
| 07 | `npm audit --audit-level=high` | MISSING / known Bun-only root compatibility issue |
| 08 | `npx gitleaks detect --source . --no-git` | MISSING |
| 09 | `npx semgrep --config=auto --error` | MISSING |
| 10 | `npm run typecheck` | MISSING |
| 11 | `npm run test:pure` | MISSING |
| 12 | `npm run test:rules` | MISSING |
| 13 | `npx playwright test` | MISSING |
| 14 | `npm run build` | MISSING |
| 15 | **UNMAPPED supplemental host gate: definition requires authorized audit-owner decision** | MISSING |

This list **does not** assert that the host's 15 logs are the same as these first 14 commands. Do not invent slot 15 or downgrade any gate. Resolve the command-to-gate mapping against the actual host mandate and exact executed commands; preserve the original identities, ordering and all results. If a gate is composed of multiple commands, record all its source receipts and test scopes.

### Critical compatibility / control distinction

The historical root `npm audit --audit-level=high` gate returned `ENOLOCK` because the root intentionally uses a Bun-only lockfile. **ENOLOCK is not a clean SCA pass.** Any future substitute (e.g. Bun-compatible root audit with an independently verifiable advisory report) needs an explicitly approved, tested **versioned change** to release validation, not a renamed log or a synthetic PASS. Functions dependencies must be scanned separately and all Critical/High findings addressed or formally adjudicated under the release policy. Do not generate an unapproved root npm lockfile.

## C. Additional required 13 integration receipts

All identifiers from the same pinned release-validator source:

| Exact integration evidence key | Required evidence scope | Current status |
| --- | --- | --- |
| `firestoreRules` | Genuine Rules SDK/emulator execution with negative tests | NOT VERIFIED |
| `art17CascadeTransactions` | Genuine concurrent cascade/owner-claim deletion transaction assertions | NOT VERIFIED |
| `ttlActiveStaging` | Authorized project/database identity and approved **20-group** ACTIVE staging TTL policies | NOT VERIFIED |
| `retentionLegalHolds` | Signed retention revision + inventory of lawful retention/holds | NOT VERIFIED |
| `webhookSignatureReplay` | Actual signed webhook, replay and forged buyer tests | NOT VERIFIED |
| `cspDeployedHeaders` | Deployed runtime and ingress/proxy effective CSP observations | NOT VERIFIED |
| `euAiActArticle5` | Accountable legal/product risk review | NOT VERIFIED |
| `euAiActArticle50` | Accountable transparency review | NOT VERIFIED |
| `gdprArticle9Pii` | Privacy review and actual minimization/sanitization controls | NOT VERIFIED |
| `serverIdempotency` | Real concurrent replay/write outcomes | NOT VERIFIED |
| `sastAndSecrets` | Complete CI and repository/history scan coverage | NOT VERIFIED |
| `supplyChainAndProvenance` | SBOM, vulnerability analysis, immutable image/digest and provenance | NOT VERIFIED |
| `githubRunnerAndCi` | Reproducible runner allocation, completed steps and correct exact-SHA CI | NOT VERIFIED |

The structural validator requires an exact commit, PASS and independent evidence URL for each receipt. Those fields **must be authenticated separately**, since syntactically valid URLs alone cannot prove execution.

## D. Severity, state machine and independent release approval

| State | Evidence requirement | Action |
| --- | --- | --- |
| `BLOCKED` | Artifacts missing, signature/hash/SHA invalid, unresolved missing human approvals | Maintain HOLD; no work on release candidate |
| `EVIDENCE_REVIEW` | Complete intake, hashes and signers verified, gate mapping reviewed | Owner examines source-linked receipts; still no GO |
| `P0_VERIFIED` | Every authorized P0 gate has genuine exact-SHA PASS, no skipped required steps or unresolved Critical/High | May propose P1 **only after explicit execution authorization** |
| `P1_VERIFIED` | Genuine emulator/Playwright/performance/operational outcomes complete and PASS | Request independent reviewers |
| `MERGE_AUTHORIZED` | Required protected reviews and checks all pass at candidate SHA; independent merge decision recorded | Authorized merge only; never infer production GO |
| `PRODUCTION_GO` | Exact main push CI, release artifacts, true production readiness, protected-environment approvals and release-owner signoff | Separately authorized production release |

Any `FAIL`, `SKIPPED` required test, cancelled job, incomplete log, missing origin or change of SHA -> **HOLD**. Re-evaluate approvals if the protected source SHA or security-relevant configuration changes. WARN findings require an explicit responsible reviewer disposition; do not silently mark clean.

## E. Evidence handoff and checklist for the next audit

**Required owner actions:** (1) provide private host evidence and valid independent signer chain; (2) specify/approve the 15th host gate and the precise mapping; (3) validate GitHub CODEOWNERS base-branch effective permissions and enforceable independent specialty reviews; (4) resolve known runner allocation and Bun SCA blockers; (5) separately approve any restart, CI-minute spend or changes to the release candidate.

**The user-facing repository must contain only non-sensitive audit metadata and hashes of externally retained artifacts, not the raw private contents.**

### Operation log for this report

- Audit reference: 2026-10-23; examined PR SHA `7fdf29010c85f16a9b38e5c93186f32e92192f3a`.
- Source checks: release validator, release CI verifier, PR state and release manifest read-only via GitHub connector.
- Result: **no new PASS certificates asserted**; host evidence remains not presented in this session.
- Intended modification: documentation-only file on the isolated docs branch; no changes to PR #119, `main`, workflows, CI execution, Cloud, production or TTL.
- Official release decision: **NO-GO**.
