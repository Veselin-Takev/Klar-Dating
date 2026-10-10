# Go-Live Evidence Register — Klar Enterprise
Date: 2026-10-10. Release decision: **NO-GO**. Tracking: [GitHub #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8).

This register is an operational acceptance artifact. **PENDING means no verifiable production evidence is present**, not that a control has been tested and failed. Never substitute green emulator CI, static source inspection, or an offline profiler for evidence collected on the exact production release candidate.

| Gate | Evidence required | Owner / approver | Status |
| --- | --- | --- | --- |
| Exact artifact provenance | Immutable build SHA, matching successful CI run, signed/attested image digest, deployed revision | Release engineer / release approver | PENDING |
| Cloud Run IAM / identity | `audit:production-controls` output with real project, region, service, workload service account, prohibited-role review | Cloud security / security approver | PENDING |
| Secret governance | Rotation ticket, version metadata without values, post-rotation functional smoke and revocation check | Secret custodian / security approver | PENDING |
| Monitoring / P95 SLO | Enabled policy for P95 > 1500 ms, service dashboard, verified notification channel and timestamped alert delivery and acknowledgement | SRE / on-call owner | PENDING |
| Observability / privacy | Protected metrics endpoint, collector ingest/export, Sentry opt-in/PII filter check and trace correlation | SRE and privacy owner | PENDING |
| GDPR / account erasure | Real integration evidence for Art. 17 cascading deletion, retention and audit immutability; restore/error behavior | Privacy / DPO | PENDING |
| KYC / payment / cancellation | Signed Didit webhook replay/abort guards, Stripe failure path, §312k cancellation and notification receipts | Security / product/legal | PENDING |
| Canary and rollback | Deployment checklist, rehearsal timestamp, automatic stop conditions, rollback to prior revision and ownership | Release engineer / incident commander | PENDING |
| Final signoff | Explicit security, privacy, operations and business signoffs tied to one release SHA | Authorized release approvers | PENDING |

## Release acceptance rules

1. Resolve one exact candidate SHA and deployment artifact digest. Associate every evidence artifact with the same commit and environment. Any candidate source change invalidates the prior signoff for the changed artifact.
2. Run `npm run audit:production-controls` in an authorized real-cloud environment using the required `KLAR_*` variables specified in `docs/PRODUCTION_CONTROLS_AUDIT.md`; store evidence in an access-controlled location outside Git. Verify the live Cloud Run service account, secret bindings, IAM and notification policies.
3. Run the operational evidence validator with the **exact SHA**, and independently witness alert notification delivery, on-call acknowledgement, secret rotation and smoke tests. Record who reviewed each gate, when, source revision and evidence URI. Do not commit secrets, raw PII, or cloud access tokens.
4. Reconcile the incremental GitHub Actions allowance of **100 minutes** against billed usage before scheduling a remote run. Do not start remote workflows simply to complete this register.
5. **STOP/NO-GO** on missing evidence, wrong SHA, unverified IAM boundary, failed live alert delivery, incomplete privacy flow, absent rollback proof, or unsigned required approver. Production approval must be explicit, never inferred from green CI.

## Current evidence boundary

The last known main CI run `38036361126` passed on SHA `3f0fc4b70551e1d580040e9dd7722931fe87e83d` (2026-10-10); this is **development validation only**. The unmerged candidate branch `ci/optimize-llm-evaluation-frozen-install-2026-10-10` has narrower isolated Node-based component tests; it has **not** passed exact candidate full frozen-toolchain validation. There is no verified evidence of deployed production controls, alert delivery, on-call acknowledgement, rotation or live rollback in the inspected issue. All listed gates remain PENDING and release remains NO-GO.

This register is updated as proof becomes available. The final approval is a deliberate release-management decision, not an automated interpretation of this Markdown file.


## 2026-10-10 — Operational evidence validator CLI contract corrected

**Defect confirmed by source inspection:** `scripts/validate-operational-control-evidence.ts` previously supplied only `(evidence, buildSha)` to `validateOperationalControlEvidence`, which requires `(evidence, buildSha, expectedEnvironment, approvedEvidenceHosts, evidenceNotBefore)`. With the missing host list, the validator attempted `.map()` on `undefined`. This rendered the published operational evidence command unusable.

**Candidate fix committed:** the CLI now requires an explicitly supplied exact lowercase 40-character SHA (no ambiguous CI/environment fallback), explicit `KLAR_EVIDENCE_ENVIRONMENT` (`production` or `staging`), a comma-separated DNS-only `KLAR_APPROVED_EVIDENCE_HOSTS` allowlist, and `KLAR_EVIDENCE_NOT_BEFORE`. All five parameters are passed to the existing domain validator. Missing/malformed parameters reject the command instead of implicitly widening trust.

Example (illustrative only; substitute authentic private host policy and candidate SHA):
```sh
cd phase2_work
KLAR_EVIDENCE_ENVIRONMENT=production \
KLAR_APPROVED_EVIDENCE_HOSTS=records.example.org \
KLAR_EVIDENCE_NOT_BEFORE=2026-10-10T00:00:00Z \
npx tsx scripts/validate-operational-control-evidence.ts /private/controls.json <exact-40-character-commit-sha>
```

**Current validation boundary:** source-level correction; no real production evidence was retrieved, no cloud-side secret rotation or alert drill was executed, and the full local pinned-toolchain test suite remains unrun. A schema PASS alone is not release authorization; the security and SRE owners must still attest evidence authenticity and provenance. The release remains NO-GO; no new GitHub Actions minutes were used.


## 2026-10-10 — Strict timestamp and evidence URL safety

The domain validator `src/server/platform/operationalControlEvidence.ts` has been tightened: exercise timestamps and the `evidenceNotBefore` threshold must use complete ISO-8601 datetimes with an explicit `Z` or offset, rather than relying on permissive `Date.parse()` coercion of date-only or natural-language input. Evidence URLs now reject embedded usernames, passwords, URL fragments, or empty hosts; approved-host allowlisting and exact build-SHA checks remain mandatory. Added two Vitest regression cases in `tests/operationalControlEvidence.spec.ts` to verify these rules.

**Status:** Source changes and regression tests have been committed on the isolated candidate branch. A full local test execution under Node 22.23.3 / Bun 1.4.2 and an actual production evidence review remain PENDING. This is no claim of a passed test suite or operational approval. No new Actions workflows or deployments were initiated. Release remains **NO-GO** and the incremental 100-minute Actions limit remains binding.


## 2026-10-10 — Malformed evidence types fail closed

Review found that `operationalControlEvidence.ts` used optional calls such as `secretName?.trim()` and `recipient?.trim()`. If the operational evidence JSON supplies a number, object, or boolean instead of a string, these operations could throw instead of returning the structured validation errors expected by the release gate. A malformed host allowlist could likewise throw during `.map()`. The candidate now explicitly checks string types and safely rejects invalid host-list inputs. A Vitest regression covers malformed JSON fields and absent host allowlists.

**Verification:** committed source-level correction and new regression fixture only; the complete pinned local tests have not been executed. The operational evidence itself has not been collected or independently verified. Do not construe this hardening as operational signoff; the release decision remains **NO-GO**. No GitHub Actions runs, merges or deployments were initiated and the incremental 100-minute budget limit continues.


## 2026-10-10 — Evidence-link exfiltration guard

The operational evidence validator now explicitly requires URL entries to be nonempty strings and refuses query strings and nondefault/custom ports in addition to previously rejected embedded credentials and fragments. This reduces the risk of storing token-bearing signed URLs in audit records or sending operators to alternative services on an otherwise approved hostname. Added targeted Vitest regression cases covering query parameters, port overrides, null, numeric and object URL values.

**Trade-off:** signed evidence links using query parameters intentionally fail validation. Store durable records in an approved private evidence system and reference stable access-controlled HTTPS/GS object identifiers without query secrets. Never weaken the host allowlist to make a temporary signed URL pass.

**Verification status:** source and regression fixtures committed, but full pinned Node 22.23.3 / Bun 1.4.2 and real-cloud evidence checks remain pending. No GitHub Actions minutes spent in this change. All production gates remain NO-GO until independently verified.


## 2026-10-10 — Require object-specific evidence references

Source audit found that `links()` accepted a bare allowlisted hostname (e.g. `https://evidence.invalid/`) as supporting evidence. A trusted portal's homepage does not identify a concrete proof item and cannot support an auditable release decision. The candidate now rejects URLs lacking an object-specific path for both HTTPS and Google Storage `gs://` references. Added a regression that rejects HTTPS/GS host roots and retains the existing valid example.

**Boundary:** This is a committed code change and regression fixture; no completed pinned-toolchain test run is claimed. A well-formed deep link is still **not** proof of authenticity, retention, signer, or access control. Operational owners must independently verify the records against the exact candidate SHA and witness live cloud controls. Production remains NO-GO. No remote Actions runs were intentionally initiated, preserving the 100-minute incremental budget limit.


## 2026-10-10 — Consolidation gate: local environment and release-candidate acceptance

The working environment was checked explicitly: `node -v` reports **v22.16.0**, `java -version` reports **21.0.12.1**, and `bun` is **not available** on PATH. Only individual diagnostic copies are present in `/mnt/data`; there is no full checked-out `Klar-Dating` application tree. Hence **the exact candidate release validation cannot be completed in this runtime**. Never present targeted tests on copied files as branch-wide production qualification.

**Mandatory acceptance sequence for the current unmerged candidate:**
1. Prepare one clean, complete checkout of the exact candidate Git SHA on an authorized machine; install Node **22.23.3**, Bun **1.4.2**, Java **21**, the approved browser dependencies, and Firebase emulator prerequisites. Do not bypass the clean-root/source-SHA or report-outside-repository protections.
2. From `phase2_work`, run `bun run verify:local`. Retain its private report with exact `gitSha`, exit codes, elapsed stage timings and full failing-test diagnostics outside source control. Resolve every failure locally first; if code changes, repeat from the new exact SHA.
3. Separately confirm the operational-evidence validator test suite and its CLI contract (exact SHA, environment, host allowlist, ISO evidence floor). Evidence template success must not be treated as a real alert or rotation exercise.
4. When fully green, reconcile the remaining **100-minute incremental GitHub Actions allowance** from actual usage records, and only then consider one tightly scoped remote validation. A green run does not close issue #8.
5. Require independently witnessed production security, secret rotation, alarm delivery/acknowledgement, privacy, canary/rollback and signed approvals. Production **NO-GO** until all records reference the exact promoted build.

**Current state:** no full local preflight, no new remote Actions run, no merge, no deployment, no production operational evidence. The separate candidate and issue #8 remain open; no production authorization inferred.


## 2026-10-10 — Calendar-valid timestamps (isolated local check)

The evidence timestamp parser now checks real calendar boundaries, leap-year February, clock fields and explicit offset ranges, rather than only matching a date-time pattern and trusting permissive `Date.parse()` normalization. The same parser handles the `KLAR_EVIDENCE_NOT_BEFORE` acceptance floor. A new Vitest regression checks impossible February dates, invalid months/hours/minutes and UTC offsets, plus a valid leap-day case.

**Test evidence:** seven parser-level assertions executed successfully in an isolated local Node v22.16.0 harness reproducing the candidate algorithm. The actual Vitest suite and full application preflight at required Node 22.23.3 and Bun 1.4.2 have **not** been executed and remain **PENDING**. Do not count these isolated assertions as exact candidate SHA acceptance, operational evidence, or go-live approval. No GitHub Actions jobs, deployment or merge initiated. Incremental Actions cap: 100 minutes. Production: **NO-GO**.


## 2026-10-10 — Gregorian early-year boundary correction

The prior strict timestamp parser used `Date.UTC(year, month, 0)` to compute the month's last day. JavaScript rewrites years 0 through 99 as 1900 through 1999 in this constructor, causing incorrect leap-day handling for some four-digit ISO years. The candidate replaces the calculation with direct Gregorian leap-year and month-length rules, avoiding this coercion. A Vitest regression covers early-year leap dates and 100/400-year century exceptions.

**Executed local check:** a nine-case standalone Node v22.16.0 assertion harness evaluated the corrected Gregorian month-length calculation; all nine passed. This does **not** constitute a passed Vitest suite or an exact-branch full enterprise preflight. The new repository test has been committed but not run under the required pinned Node 22.23.3/Bun 1.4.2 toolchain. Production gate remains NO-GO; no new GitHub Actions or deployments occurred.


## 2026-10-10 — Future-dated evidence fails closed

Source review identified that chronological ordering alone could accept a full set of events scheduled in the future as if a secret rotation or alert-delivery drill had already occurred. The candidate now rejects any of the five event timestamps and the `evidenceNotBefore` threshold more than **five minutes ahead of validation time** (bounded clock-skew tolerance). A Vitest regression covers both secret rotation timestamps, all three alert-delivery timestamps and the threshold.

**Execution boundary:** a small standalone Node v22.16.0 five-case check passed for the 5-minute clock-skew rule, but the exact updated domain-module Vitest test and full candidate branch preflight under pinned Node 22.23.3 / Bun 1.4.2 remain PENDING. Live cloud evidence and human signoff remain mandatory, and green schema checks cannot prove event authenticity. No new GitHub Actions run, merge or deployment was initiated. Production decision remains **NO-GO**; incremental Actions budget ceiling remains 100 minutes.


## 2026-10-10 — Executed available local diagnostics, no substituted production claim

Ran in the available runtime:
```sh
node --test /mnt/data/klar-report-guard/*.test.mjs /mnt/data/klar-provenance/*.test.mjs
```
Observed Node **v22.16.0**, TAP **12 tests / 12 PASS / 0 FAIL**, process exit **0** (about 82 ms). Covered clean Git root/SHA provenance, dirty/untracked checkouts, missing commits, Git failure propagation, symlink-equivalent paths, external report-path boundary, symlink parent bypass, existing/dangling symlink targets, and missing report parent directory.

**Scope limitation:** these were existing isolated working copies. No exact current candidate Git-blob identity was re-established during this run, and the current operational-control validator / its Vitest tests were not available in this local checkout. Therefore **do not credit these tests against the unmerged candidate's complete acceptance**, or claim a live production audit. The runtime is not the pinned Node 22.23.3 and Bun 1.4.2 is unavailable. The full `verify:local` remains blocked pending an actual complete clean checkout and pinned toolchain. A GitHub Actions run cannot substitute for mandatory local preflight.

No remote workflow, merge, or deployment was initiated. Production remains **NO-GO** pending exact-SHA technical and separately authenticated operational evidence; the incremental Actions cap remains **100 minutes**.
