# PR #119 — Authorized host verification and evidence handover

**Release status: NO-GO / HARD STOP.** Target SHA: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`.

## Separation of duties

- **Release Owner:** provides written scope-limited authorization for a *read-only audit*, selects the immutable candidate and authorizes any eventual workflow/production change separately. This document does **not** lift the existing application correction hard-stop.
- **Infrastructure/SRE:** provisions a disposable Linux x64 host, Docker and approved network access, approved pinned Node v22.23.3 and Bun 1.4.2, isolated nonproduction credentials only, digest-pinned container base and approved scanner versions. Checks resource/cost quotas and wipes host afterwards.
- **Audit operator:** runs exactly the 15 mandatory gates on the exact SHA, captures command/exit code/log, timestamps, checkout SHA, runtime versions, SHA256SUMS and signed runner/build attestations. Worktree changes invalidate results.
- **Security, DPO/Legal, Operations/SRE, Release Owner:** independently review the same final commit and sign off only on real evidence. Organizational provenance and signatory identity must be verified outside the bundle.

## Audit prerequisites

1. Written audit authorization and an approved image digest, scanner version set, lockfile/audit strategy, and hardened runner identity; validate network/registry and disk before invoking commands.
2. Verify exact immutable checkout (`git rev-parse HEAD` equals SHA), do not use local modified ZIPs or fetch mutable branch HEAD for official test.
3. Fresh `results/` directory; do not overwrite a preexisting run. Keep source checkout read-only except deterministic dependency provisioning; audit and hash the tracked tree before/after.
4. Zero production credentials on the runner, tightly controlled artifact visibility and retention. CI, test, build and scanner logs may contain sensitive data; restrict upload access and redact only to **a separately labeled derivative**, never by altering original evidence.
5. Resolve known root lockfile `npm audit`/`ENOLOCK` issue through a separately reviewed decision; do not waive one of the mandatory gates or claim GO using a substitute without explicit governance approval.

## Required result contract

The host handoff must include the original `gates.tsv` with **exactly 15 rows** and `number, command, exit_code, status, log_sha256`, plus `gate-01.log` through `gate-15.log` and `gate-01.exit-code` through `gate-15.exit-code` (zero for success). Additional receipts: `SHA256SUMS`, `baseline.txt` (`commit`, `node`, `bun`), `host-preflight.txt` (`target_sha`), `container-toolchain.log`, `install.log`/`install.exit-code`, `docker-build.log`/`docker-build.exit-code`, `docker-run.log`/`docker-run.exit-code`, `container-toolchain.exit-code`, host/runner stdout/stderr. Four independent approvals are **separate post-audit artifacts**; they can be kept in an independently signed approval bundle bound to the host manifest hash and exact commit. Approval receipts are optional for technical screening, and must never be confused with identity-authenticated sign-offs. If any gate is skipped or fails, record **NO-GO** with the exact RC, do not invent zero.

Structural offline screening (on an isolated workstation) uses the optional `node scripts/verify-host-gate-evidence.mjs --dir /secure/quarantined/results --commit <full-sha>` and never returns GO by itself. Inspect the JSON error list. Reject any missing, tampered or self-asserted evidence; independently verify host attestations and reviewer identity. A synthetic test fixture **does not constitute** application evidence.

## Go/no-go sequence and handover

1. SRE secures and transfers unmodified artifacts to the authorized custodian; SHA256 checks and external attestation are validated independently.
2. Release Governance ensures **all 15 original mandatory gates PASS with exit code 0** and all prerequisites match one commit.
3. Security/Legal/SRE/Owner individually sign attestations for that commit with trusted signatures/review links, not just editable JSON fields.
4. Check production/operational constraints: active TTL collection-group policy inventory, GDPR Art.17/9 evidence and legitimate holds, EU AI Act obligations, deployed CSP, SLO/P95, AI budget, N−1 rollback drills, security reviews, CODEOWNERS/rulesets, critical/high vulnerabilities and emergency stop procedures.
5. Recompute final decision **only with written human authorization**. A clean host scan does not automatically lift the three-cycle correction hard-stop, close 15 GitHub issues or permit merge/deploy.

## Current known result (2026-10-23)

GitHub PR #119 remained Draft/unmerged with exact HEAD SHA; 15 open issues, no identified PR119 check/workflow runs, and no qualifying signed host evidence/approvals. Local previous candidate: 23 targeted dashboard tests PASS under Node 22.16.0, mandatory diagnosis 5 PASS / 6 FAIL / 4 BLOCKED, not qualified. **Final release decision: NO-GO.**

## Evidence sealing ordering (mandatory)

Close all processes writing `host.stdout.log`, `host.stderr.log`, `runner.stdout.log`, `runner.stderr.log` and Docker-run logs **before** generating the final `SHA256SUMS`. In particular, avoid printing additional status messages into hashed logs after the manifest is calculated. Validate the finalized manifest in a separate read-only step and publish or externally sign its SHA-256 digest using a trusted channel. The previously prepared host launcher used `tee` while hashing its own stdout; it must be reviewed and fixed on the authorized host before accepting final evidence. A self-consistent checksum proves only integrity, not authenticity.


## Verified evidence closure contract (2026-10-23, local-only tooling update)

The earlier `execute-on-authorized-host.sh` wrote `SHA256SUMS` while inherited process-substitution `tee` processes could still append to `host.stdout.log` and `host.stderr.log`; the old script therefore **must not be used as trusted final evidence**. Run it only after formal host-script review and correction.

**Strict phase separation:**

1. Record exact immutable checkout and runtime inside the container. Execute the original 15 gates, capture *all* logs and actual exit codes (including failures), and let every writer of the result directory terminate. Host-side `docker-run.exit-code` and host log writers must also be complete. Do not generate `SHA256SUMS` inside an active `tee` or other process-substitution pipeline.
2. From an approved, pinned and separately validated copy of `seal-host-gate-evidence.mjs`, run on the **closed** result directory:

   ```bash
   # This tool is supplied by the dedicated audit tooling branch, NOT the PR119
   # application checkout. Pin and validate its Git blob before deployment.
   node /opt/approved-audit-tools/seal-host-gate-evidence.mjs \
     --dir /srv/klar-audit/results > /srv/klar-audit/seal-report.json
   (cd /srv/klar-audit/results && sha256sum --check SHA256SUMS)
   ```

   `seal-report.json` is deliberately **outside** the sealed `results/` directory; never append to hashed logs after sealing. Sealing works even with nonzero gate results, preserving failure evidence. The sealer refuses to overwrite an existing `SHA256SUMS`, symbolic links, nested entries, or noncanonical file names. It calculates SHA-256 twice before finalization and rechecks afterwards; it cannot prove that a third-party host is authentic or that late writes are impossible.
3. Transfer evidence by the approved secure channel and separately verify the published SHA256SUMS hash against signed runner/build provenance. Run `verify-host-gate-evidence.mjs --dir /read-only/results --commit 7fdf29010c85f16a9b38e5c93186f32e92192f3a` from the pinned audit tooling commit, **not from the mutable application checkout**.
4. The scanner's `technical_evidence_pass=true` means only *internal integrity and mandatory technical checks* passed. Because approvals are signed **after** host checks, missing `approval-*.json` receipts are not fatal to this technical screening. If such receipts are present but malformed, they are fatal. In all cases `release_decision=NO-GO` and `approvals_identity_verified=false` until independent signatories and the Release Owner authorize a separately documented human GO. The four signatures must be bound to the host manifest digest and immutable commit.

**No CI/merge/deploy is authorized by this procedure.** The new tools have only been tested locally under Node.js v22.16.0; a qualified Node.js v22.23.3 host run remains missing.

## Evidence snapshot and hardlink boundary (audit tooling hardening, 2026-10-23)

The technical evidence scanner and sealer now refuse files with more than one hardlink (`nlink != 1`) even when their hashes match: a hardlink may otherwise import outside-host content from the same filesystem. The scanner opens with `O_NOFOLLOW`, checks descriptor/path device and inode identity plus size, mtime and ctime before/after reads, and re-checks the SHA-256 hash **of the exact bytes parsed** from the bounded metadata files against `SHA256SUMS`. The sealer also checks that directory entry names have not changed between enumeration and publication. A zero-length mandatory gate log is **not** accepted as a complete test log, even with an exit code of 0 and matching checksum. Small parsed metadata remain bounded to 2,000,000 bytes; gate logs may be larger and are hashed as streams.

**Operational assumption:** the `results/` directory must be closed and quiescent; the reviewer must use a read-only, independently obtained evidence snapshot. These integrity checks limit accidental and some adversarial replacement races but cannot attest host identity, prevent all privileged concurrent changes, establish origin of a manifest, or demonstrate that self-reported gate output genuinely ran on the target commit. Verify a host-side, independently signed provenance statement outside the evidence bundle. No self-authored receipt can constitute an independent approval.

The audit tools continue to emit `release_decision=NO-GO` even if technical evidence passes, and their local 39/39 tests under Node 22.16.0 **do not qualify** as any of the 15 release gates. The authorized host verification using Node v22.23.3 and Bun 1.4.2 has not been executed or attested here. The separate PR #119 head `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, main and production remain out of scope for this audit-tooling-only update.

## Streamed large-log verification fix (2026-10-23; audit tooling only)

**Finding:** Before this correction, `screenEvidence` correctly SHA-256 checked all `*.log` files via streaming, but then called its 2,000,000-byte bounded metadata reader for seven auxiliary host/runner logs. A legitimate 2 MB+ log was therefore incorrectly labelled `NO-GO`, despite a complete matching SHA256SUMS. The gate-log path was already hashed as a stream; the same constraint must apply consistently to all nonsemantic logs.

**Correction:** The reviewer now checks existence in the sealed manifest and validates the full byte stream against its SHA-256 entry for auxiliary logs without decoding them as metadata. The zero-length mandatory gate-log check uses the SHA-256 digest of the empty byte sequence, rather than a separate path-based file-size read. Identity facts (`baseline.txt`, `host-preflight.txt`), the precise `gates.tsv` table, exit-code receipts, toolchain identity and optional approval receipts **remain bounded and verified on the exact bytes parsed**. A missing log, mismatched large-log hash, nonzero gate, Symlink/Hardlink, oversized metadata or missing approval authenticity still fails closed. Host stderr is allowed to be empty (an expected valid outcome); mandatory individual gate logs may not be empty.

**Evidence:** 43/43 targeted local Node.js tests PASS, including >2 MB valid mandatory-gate and runner logs, >2 MB tampered-gate-log rejection, and missing host stderr-log rejection. These are unqualified diagnostics under Node.js 22.16.0, **not** the release-gate runtime v22.23.3 / Bun 1.4.2. The requirement for a separately authorized host runner, all 15 original gates and four independent human approvals is unchanged. The tool **never issues GO**. See `ADR_PR119_STREAMING_LOG_VERIFICATION_2026-10-23.md`.

**Repository scope:** This correction belongs to the isolated `audit/pr119-host-evidence-governance-2026-10-23` branch only; it does not change the PR #119 application commit `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, `main`, a release workflow or production.


## Read-only host readiness checkpoint (2026-10-23)

Before spending GitHub Actions minutes or starting an authorized Docker audit, Security and Release Owner must first approve immutable scope, known image digest/provenance, tool versions, run budget and host identity. A **locally tested audit-branch** preflight (24/24 local tests) checks local Node v22.23.3, Bun 1.4.2, Docker daemon, git/bash/checksum, immutable image digest *syntax*, existence of a written authorization **reference**, and a private fresh results directory. The preflight and its tests are now integrated on this audit branch but **not approved for Enterprise host execution**. It performs no build, Docker run, network fetch or mandatory gate and never issues GO. The host operator must independently authenticate the exact audited script and acquire separate written Security + Release Owner authorization before using it; merely finding a file in GitHub is not execution permission.

This sandbox's read-only diagnostic yielded exit 1/NO-GO (Node v22.16.0; Bun and Docker absent; no approved digest/authorization reference). This is **sandbox evidence only**, not an authorized-host failure. Existing audit verifier/sealer regression tests 43/43 PASS; preflight tests 24/24 PASS, both under the wrong release runtime. Keep the existing application HARD STOP and 0/15 qualified Mandatory Gates / 0/4 sign-offs. Do not modify the target PR #119 SHA, merge, deploy or run chargeable workflows. See `ADR_PR119_READ_ONLY_HOST_PREFLIGHT_2026-10-23.md` and `PR119_HOST_READINESS_STATUS_2026-10-23.md`.

**Preflight source integration (audit branch, 2026-10-23):** `phase2_work/scripts/preflight-authorized-host-audit.mjs` and `phase2_work/scripts/preflight-authorized-host-audit.test.mjs` are present in the audit-only branch and passed 24/24 local tests under Node.js 22.16.0. The local CLI still reports exit 1 / NO-GO. No authorized host identity, digest provenance, paid test scope, Runtime v22.23.3/Bun 1.4.2, or four independent sign-offs have been demonstrated. Do not use these tests as a release qualification or modify PR #119.

## Mandatory observed source checkout guard (cost-free audit-tooling update, 2026-10-23)

The preflight must be invoked using the **separate, actual, read-only PR #119 source checkout**, for example:

```bash
node /absolute/audit-tools/phase2_work/scripts/preflight-authorized-host-audit.mjs \
  --checkout /absolute/pr119-source-at-7fdf2901 \
  --results /absolute/fresh/private/results
```

The argument `--checkout` (or explicit `KLAR_AUDIT_CHECKOUT_DIR`) MUST point at the physical repository root, not the audit-tooling repository, a symlink, a subdirectory, or a writable working tree containing staged, modified or untracked files. The preflight checks `git --no-optional-locks -C <checkout> rev-parse --verify HEAD`, `HEAD^{tree}`, `--show-toplevel`, and `status --porcelain=v1 --untracked-files=all`, without fetching or changing source. Expected application HEAD: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`; expected tree: `05f22f0ca387ae37573b1f81e85ead901dce3da9`.

Missing checkout, wrong commit/tree, redirected checkout path or unclean source MUST fail closed. The preflight never issues GO or establishes provenance merely by reading local git output; the external authorized host must independently attest its identity and immutable checkout. See `ADR_PR119_VERIFIED_IMMUTABLE_CHECKOUT_2026-10-23.md`.

**Cost control:** The requester authorized only cost-free work. No paid runner/CI minutes, remote build, network-install, deployment or workflow run is approved. Local tests: **24/24 preflight + 43/43 verifier/sealer PASS** on Node v22.16.0, **not** on the required host runtime. On this free sandbox, actual preflight returned **exit 1 / NO-GO**, with no actual PR checkout or mandatory gate logs. This audit-only code must be reviewed and authenticated before authorized host deployment.

## Cost-free immutable checkout index-flag guard (2026-10-23)

A reproducible local test showed that `git status --porcelain=v1` reports no changes after editing a tracked file if that file is marked `assume-unchanged` (`git ls-files -v` shows `h`); likewise `skip-worktree` (`S`) can conceal changes. The previous PR119 host preflight checked Git HEAD/tree and status but did not reject these flags.

The audit-branch-only `preflight-authorized-host-audit.mjs` now runs read-only `git ls-files --cached -v -z`, demands a nonempty set of ordinary `H` entries and rejects any other index prefix or a failed probe. The reported fields include `checkout_index_flags_safe`; the mandatory decision logic raises `CHECKOUT_INDEX_FLAGS_UNSAFE` and never issues release GO. No `git update-index` or other source mutation occurs in the actual preflight; regression fixtures use throwaway Git repositories only. The command-output buffer is capped at 4 MiB and fails closed if exceeded.

Verification: **29/29 focused preflight tests PASS and 72/72 combined audit-tooling tests PASS** locally under Node.js **v22.16.0**, not the release-pinned v22.23.3. The real local read-only preflight still exits **1 / NO-GO** (Bun/Docker/pinned runtime/host authorization and authentic PR checkout absent). **0/15 qualified application gates** and **0/4 independently authenticated human release approvals** evidenced. The user's authorization is limited to cost-free preparation and does not constitute Security/Release Owner host authorization.

Limitations: these checks reject known Git index blind spots but do **not** independently hash every working-tree byte against a trusted signed source snapshot. A compromised host, forged Git commands, adversarial index manipulation, symlinked dependencies or stale runner attestations require independent host provenance and immutable artifacts. Do not infer GO, execute CI, or deploy. New ADR: `ADR_PR119_GIT_INDEX_FLAG_FAIL_CLOSED_2026-10-23.md`.

**Operator reminder:** on an expressly authorized host, use the dedicated immutable PR #119 application checkout for `--checkout`. The audit-tooling branch is a *different* SHA and must not be passed as the application checkout. Inspect `checkout_index_flags_safe` and all findings before any gate run; read-only readiness alone is neither permission to spend runner minutes nor proof of 15 PASS gates.

## Free-only checkout verification: ignored artifact rejection (2026-10-23)
A concrete gap was reproduced: normal Git porcelain status can report a clean checkout while ignored files such as `.env` and `node_modules/` exist. The pre-install, read-only preflight now also runs `git ls-files --others --ignored --exclude-standard -z` and fails `CHECKOUT_IGNORED_FILES` if the result is nonempty, while retaining the previously integrated `assume-unchanged` / `skip-worktree` guard. Failed Git enumeration is fail-closed. Ignored path names are never written into the JSON findings. The tool must run **before** dependency installation in a fresh checkout.
**Local evidence:** 35/35 preflight tests and 43/43 evidence validator/sealer tests PASS = **78/78**, Node v22.16.0 only. Real local read-only run: **exit 1 / NO-GO** with seven infrastructure/authorization/checkout blockers. **No qualified Enterprise host tests or independent approvals** were performed; PR #119 immutable HEAD remains `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, 0/15 release gates and 0/4 approvals evidenced. User permits **cost-free work only**. See `ADR_PR119_IGNORED_CHECKOUT_ARTIFACTS_2026-10-23.md`.


## Mandatory gate-contract blocker – static read-only reconciliation (2026-10-23)

**DO NOT initiate a paid or unapproved host audit.** The exact PR #119 checkout has a Bun-only application dependency policy: `phase2_work/bun.lock`, no `phase2_work/package-lock.json`, and explicit enforcement against introducing one. The requested unmodified Gate 07, `npm audit --audit-level=high`, requires an npm lockfile by default and cannot be treated as PASS for the Bun-only application. The Functions npm dependency graph has a separate committed lock. Release Owner and Security must approve a versioned full-coverage SCA gate contract covering both graphs before any actual run. Gitleaks and Semgrep invoked via `npx` must also have reviewed/pinned binaries and rules prepared offline. These are policy and provenance blockers, *not* evidence that the application was scanned successfully or failed a vulnerability check. All 15 commands are statically inventoried; **0/15 qualified host PASS and 0/4 human approvals evidenced**. See `PR119_GATE_CONTRACT_STATIC_RECONCILIATION_2026-10-23.md` and `ADR_PR119_SCA_LOCKFILE_GATE_RECONCILIATION_2026-10-23.md`. This cost-free documentation update does not change the original required gates or authorize CI, merge, deploy or production GO.


## Approval gate before executing original Gate 07 (2026-10-23)

DO NOT attempt to force `npm audit --audit-level=high` to PASS from the Bun-only application directory by adding a synthetic package-lock, using `--no-package-lock`, ignoring ENOLOCK, or substituting `bun audit` without a formally approved versioned policy. The original PR119 manifest/lockfile/policy source files were independently confirmed against GitHub's immutable tree, 5/5 Git blobs PASS. A local nonexecuting gate-contract screen verified the conflict (exit 1; `NO-GO`); no real advisory scan was run. The proposed composite Gate 07 is only a decision request awaiting authenticated Security + Release Owner approval, plus validated Bun/Functions npm vulnerability coverage, signed scanner provenance and zero-cost authorized host scope. See `PR119_SCA_GATE07_DECISION_REQUEST_2026-10-23.md` and machine-readable `PR119_SCA_GATE07_DECISION_REQUEST_2026-10-23.json`. This read-only local evidence cannot lift the HARD STOP: **0/15 qualified host gates PASS, 0/4 signoffs**. The static contract screen and its tests are now integrated **only** on the isolated audit branch; they are **not** qualified on the authorized Enterprise host or approved for changing any release gate. Never start paid CI based on these notes.


## Static SCA contract screen now integrated (2026-10-23)

Audit-branch path: `phase2_work/scripts/screen-pr119-sca-gate-contract.mjs`; targeted suite: `phase2_work/scripts/screen-pr119-sca-gate-contract.test.mjs`. This script performs read-only inspection of supplied manifest/lockfile/policy files, without subprocesses, network requests, registry queries, dependencies, or writes. For the five independently Git-blob-verified source files from PR119, it returns **exit 1, BLOCKED, NO-GO**, and flags unproven Gitleaks/Semgrep provenance. The full local audit-tooling test suite is 91/91 PASS using Node.js v22.16.0; these tests **do not** count toward the required 15 host gates. This screen hardcodes the target SHA but **does not itself authenticate the input checkout or host**; the separate checkout guard and external provenance review remain mandatory. Gate 07's original command remains unchanged pending an authenticated Security and Release Owner decision. No CI, merge, deploy or production GO may be inferred.


## P0 #70 — 20-group TTL documentation reconciliation (2026-10-23; NO-GO)

For the immutable original PR119 SHA `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, the staging-only provisioner, static matrix guard and read-only policy-evidence validator use exactly **20** `expiresAt` TTL Collection-Groups (13 original + 7 later added). Earlier operational text requesting evidence for only 13 groups was outdated; the isolated audit branch now corrects three such assertions in `docs/DATA_RETENTION.md`, retaining historical 13-group narrative. Do not treat dry-run PLAN lines, offline fixtures, mocked gcloud calls, valid local evidence JSON, a matrix approval *environment variable*, or Git source hashes as evidence of LIVE Cloud activation or authenticated Legal approval. Original bytes of 13 source files matched GitHub blobs (13/13); six relevant offline test scripts passed; **no gcloud network access or TTL mutation occurred**. Before any host or staging change, independently obtain the full 20-group DPO/legal-hold/expired-inventory decision, authenticate exact GCP project+database, capture all ACTIVE policies with independent provenance and real end-to-end deletion/hold tests. These steps are **not authorized by cost-free testing permission alone**. P0 issue #70 stays OPEN, host gates 0/15, approvals 0/4 and Production **NO-GO**. See `PR119_P0_70_TTL_20_GROUP_SOURCE_RECONCILIATION_2026-10-23.md`.


## P0 #55 partner webhook purchase-proof acceptance (2026-10-23; NO-GO)

On the immutable PR119 SHA `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, verified original source stores signed partner events as **pending verification only**, not automatic `earned` or direct qualified counter credit (5/5 source Git blobs PASS). Historical 2026-10-14 documentation is now annotated accordingly. Partner-provided buyer UID and purchase assertions **are not independent purchase/buyer proof**. The pending buyer claim reservation needs approved bounded expiry, dispute and reconciliation policy. Before settlement, require buyer-authenticated single-use intent, independently proven sale and fulfillment, refund/chargeback reversal, lawful retention/Legal Holds, anti-fraud tests, provider-key rotation and genuine emulator/E2E evidence. A separate local candidate source-mutation screen passed 27/27 targeted Node22.16.0 tests; **it is not installed in this repository commit**, is not an authorized host gate and does not prove actual runtime behavior. No paid CI, staging mutation, merge, production deploy or GO was authorized. P0 #55 OPEN, **0/15 qualified host gates, 0/4 approvals; NO-GO**. See `PR119_P0_55_PARTNER_WEBHOOK_TRUST_SOURCE_AUDIT_2026-10-23.md`.


## P0 #55 — Isolated audit-branch static assertion guard (2026-10-23)

Audit-only commands on an independently authenticated PR119 source checkout: `node scripts/screen-pr119-partner-webhook-boundary.mjs --source-dir <verified-phase2-work-root>` and `KLAR_WEBHOOK_SCREEN_SOURCE_DIR=<verified-phase2-work-root> node --test scripts/screen-pr119-partner-webhook-boundary.test.mjs`. Do not use the audit-branch HEAD as a substitute for original application SHA. This pattern-based, read-only screening **does not verify signatures at runtime, authenticate buyer purchase, exercise Firestore concurrency, prove provenance, or contribute mandatory host Gate credit**. 27/27 local tests PASS under unqualified Node 22.16.0; CLI exit 0 only states structural patterns were found and output always marks production `NO-GO`. Consult unapproved `ADR_PR119_PARTNER_PURCHASE_PROOF_CLAIM_REVERSAL_2026-10-23.md` before any scoped Product/Security/Legal/Finance review. No partner settlement implementation, refunds, schema changes, cloud changes, CI, merge, deployment or release GO is authorized. 0/15 host gates; 0/4 approvals.


## P0 #56 — partner data flow and legal-basis decision checkpoint (2026-10-23)

For immutable PR119 SHA `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, source inspection confirms `url.searchParams.set('klar_referral', token)` on eligible partner destinations. No-referrer/no-store headers do **not** hide intentionally sent destination query data. Consent versions/quarantined epochs, visitor eligibility checks and Article 17 referrals/ledger deletion are present in source but not validated in end-to-end browser, external partner logs, real Firestore Emulator, approved staging or legal-hold procedure. The DPO/Legal/Finance must approve per-purpose VVT/lawful basis, token audience and retention, data recipients/transfers, withdrawal notice and tracking/ePrivacy applicability before any protocol modification or production go-live. See `PR119_P0_56_PARTNER_TRACKING_PRIVACY_EVIDENCE_2026-10-23.md` and `ADR_PR119_PARTNER_TOKEN_MINIMIZATION_AND_ERASURE_2026-10-23.md`. Offline static candidate: `screen-pr119-partner-privacy-boundary.mjs`, **30/30 local tests PASS on Node 22.16.0, exit 1/NO-GO**; the read-only checker and its tests are now committed **only to the isolated audit branch** and are not approved as a release gate. **No live Cloud, provider, CI or costed verification was performed**, and no Art.17 or release signoff may be inferred. Issue #56 remains OPEN; host gates 0/15, final human approvals 0/4.


## P0 #56 audit-branch static checker (not an authorized host gate)

The isolated audit branch now contains `phase2_work/scripts/screen-pr119-partner-privacy-boundary.mjs` and `screen-pr119-partner-privacy-boundary.test.mjs`. On a **separately authenticated immutable original PR #119 checkout** the read-only source checker can be invoked with `node scripts/screen-pr119-partner-privacy-boundary.mjs --source-dir <ORIGINAL_PR119_PHASE2_WORK>` from the audit-tool root. The source checkout must be verified independently: the checker sets `source_integrity_proven_by_this_tool:false`. Its JSON lists ten structural checks but always sets `production_release_decision:'NO-GO'`; exit code 1 is **expected**, not an override to bypass. Targeted local tests (30/30 PASS) use unqualified Node v22.16.0. Do not misreport static controls as proof of lawful consent, external partner log deletion or successful Art.17 emulator/staging tests. DPO/Legal/Finance and Security must approve the per-purpose token transmission and recipient/retention design before any product correction, and the exhausted application-correction cycle still forbids silently changing product code. **No CI/paid services/merge/deploy/Cloud mutation; release NO-GO, 0/15 host gates, 0/4 final approvals.**


## P1 #73 — verify *base* CODEOWNERS, not only PR-head source (2026-10-23)

Before treating any CODEOWNERS source test as a release-control PASS, independently record PR number, actual base ref/SHA, candidate head ref/SHA and the authoritative CODEOWNERS Git blob on each branch. PR #119's real base is `test/p0-art17-owner-claim-cascade-regressions-2026-10-18` at `9e886c67c97201602cd969fc57dfc9bf2d019c90`, **not main**. The base root CODEOWNERS has only generic engineering ownership for `phase2_work/`; the head adds specialized Security/Finance. The new offline base-vs-head proof yielded **0/17** specialist coverage in the base versus **17/17** in the head, 26/26 local tests PASS (Node 22.16.0), CLI exit **1 / NO-GO**. Do not treat the nested `phase2_work/CODEOWNERS` file as active GitHub CODEOWNERS. Draft PRs have no automatic owner requests. Administrator-authenticated team/write access, CODEOWNERS validation and actual base branch rules remain unverified (main protection GET 403). PR review submissions currently returned zero. Request an independently approved repository governance repair; do **not** retarget or mark PR119 ready, merge, change CODEOWNERS/main/base or submit reviewer requests under this audit-only authorization. 0/15 host gates, 0/4 final signoffs. Details: `PR119_P1_73_CODEOWNERS_BASE_BRANCH_GAP_2026-10-23.md` and `ADR_PR119_CODEOWNERS_BASE_BRANCH_ENFORCEMENT_2026-10-23.md`.


## Integrated static P1 #73 CODEOWNERS comparison (2026-10-23)

On the isolated audit branch `phase2_work/`, run `node --test scripts/screen-pr119-base-codeowners.test.mjs` (**26/26 local PASS**, Node.js 22.16.0, nonqualified). Then run `node scripts/screen-pr119-base-codeowners.mjs --base-file "$(pwd)/scripts/fixtures/codeowners-pr119/BASE_CODEOWNERS" --head-file "$(pwd)/scripts/fixtures/codeowners-pr119/HEAD_CODEOWNERS"`. The real screen is **expected** to exit **1 / NO-GO** with base specialist coverage 0/17 and head 17/17. Both fixtures are historical verified Git blobs; current live base and head identities must be independently checked before interpreting later conditions. It is NOT an authorized host gate and cannot prove GitHub team existence, write access, actual code-owner review enforcement or independent signoffs. Never mark PR119 ready, retarget or edit its base, change CODEOWNERS or start chargeable CI without separate authorized change control. **P1 #73 OPEN; host gates 0/15, approvals 0/4, HARD STOP.**


## P1 #57 — verified source/documentation mismatch and missing settlement (2026-10-23)

Do not treat the webhook payload name `qualified_conversion`, a successful HMAC, `partner_conversion_asserted` ledger entry or duplicate reply `already_recorded` as permission to credit Klar+, accept a commission receivable or declare a purchase proven. The original `recordPartnerConversion` creates an **unverified** `pending_verification` event with `partner_assertion_only` proof state and does **not** increment qualified counters in that path. The older `docs/PARTNER_REFERRAL_SYSTEM.md` wording implied `earned`; the isolated audit branch corrects that documented status and adds `PR119_P1_57_PARTNER_REWARD_SETTLEMENT_DECISION_2026-10-23.md`. Evidence: original Git blob `caac15e4609cd526e47a487a2d6d5f335649995d`; 57/57 prior boundary tests + 14/14 local source/doc mutation tests PASS on Node 22.16.0 (not host-qualified). Finance/Product/Security/DPO-Legal must approve the future purchase/fulfillment/reversal contract before any implementation. No automatic or retroactive modification of historical `earned` records. **0/15 host-gate PASS and 0/4 final sign-offs; NO-GO.**


## P1 #57 static reward source/document checker now on audit branch (2026-10-23)

The read-only `scripts/screen-pr119-partner-reward-contract.mjs` and 14 negative/contract tests `scripts/screen-pr119-partner-reward-contract.test.mjs` have been integrated on the **isolated audit branch only**, not PR #119. To test a trusted immutable PR119 file and the corrected audit-branch documentation, invoke `node scripts/screen-pr119-partner-reward-contract.mjs --service <VERIFIED_PR119_SRC_SERVER_PARTNER_REFERRAL_SERVICE_TS> --doc <AUDIT_BRANCH_DOCS_PARTNER_REFERRAL_SYSTEM_MD>`. For targeted test reproduction set `KLAR_REWARD_SOURCE=<VERIFIED_PR119_SRC_SERVER_PARTNER_REFERRAL_SERVICE_TS>` and run `node --test scripts/screen-pr119-partner-reward-contract.test.mjs`. The checker rejects implicit inputs and never loads dependencies or runs purchases, payment calls or migrations. Original source and remote document were cross-checked for all 11 expected patterns. Local **71/71** composite tests PASS under Node.js v22.16.0; only a static source/doc check, **not** Firestore/Stripe fulfillment or mandatory Enterprise host gate proof. It cannot decide whether a buyer purchased, whether Klar+ was granted or whether refunded entitlements were reconciled. Product/Security/DPO/Legal/Finance decisions, qualified host gates and independent signoffs are still missing; **NO-GO**. No paid CI, PR modification, merge or deployment.


## P1 #71 — Production SLO qualification after source threshold repair (2026-10-23)

The immutable PR #119 candidate already imports the 300ms canonical API-P95 target, with a 299/300/301ms boundary test; **do not revive the historical 1500ms source issue**. The remaining blocker is **fleet-SLO provenance**: local 15-minute per-process samples, exported quantile **gauge** instead of aggregatable histogram, empty-window P95=0/nonbreach, policy indicator `p95(klar_http_latency_ms)` not emitted in reviewed exporter, and an undecided exactly-300ms inequality. A static 19-test checker and regression suite are now **integrated only on the isolated audit branch**; it verifies Git blobs in a supplied directory but cannot attest an authorized host, whole checkout or live metrics. No 30-day SLI, approved PromQL, burn-rate alerts or real pager delivery have been evidenced. To proceed requires Product/SRE SLI scope approval, approved privacy-safe fleet histogram / query, authoritative zero-traffic behavior, validated burn-rate semantics, authenticated staging traces, actual on-call delivery and independent final human approvals. **Do not run paid CI/staging nor alter production settings absent written approval.** See `PR119_P1_71_P95_SOURCE_TO_LIVE_SLO_GAP_2026-10-23.md` and `ADR_PR119_FLEET_P95_SLO_EVIDENCE_2026-10-23.md`. P1 #71 OPEN, 0/15 host gates, 0/4 final approvals, NO-GO.


## 2026-10-23 — Read-only P95 audit screen integrated (NO-GO)

The exact locally tested `scripts/screen-pr119-slo-evidence.mjs` and `scripts/screen-pr119-slo-evidence.test.mjs` now exist **only on the isolated audit branch**. Local Node v22.16.0 tests 19/19 PASS; the supplied original PR119 five-file subset independently matched 5/5 immutable Git blobs and the CLI returned exit **1 / NO-GO** with all eight threshold patterns passing. Checker input hash checks do not attest an entire checkout, the required Node 22.23.3 host, live 30-day fleet metrics, PromQL or pager delivery. See `PR119_RELEASE_DECISION_DEPENDENCIES_2026-10-23.md` for documented PR review/merge and qualified release dependencies. The 300ms source threshold is fixed; #71 stays OPEN, 0/15 host PASS and 0/4 approvals remain. No paid CI, application, staging, cloud, merge or deployment change.

**Read-only reproduction:** `node --test scripts/screen-pr119-slo-evidence.test.mjs` in audit-branch `phase2_work`; `node scripts/screen-pr119-slo-evidence.mjs --source-root <INDEPENDENTLY_AUTHENTICATED_EXACT_PR119_PHASE2_WORK>` deliberately exits 1/NO-GO. Never pass an audit-head checkout as proof of original PR head. No host-gate credit.
