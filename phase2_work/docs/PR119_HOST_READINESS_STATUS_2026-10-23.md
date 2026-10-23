# PR #119 — Enterprise host readiness checkpoint (2026-10-23)

**Release: NO-GO / HARD STOP; no production approval.**

- Immutable target PR #119 HEAD: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`; PR remained Draft, open, unmerged.
- Audit-tooling branch before this document change: `1b76d3cb57a6150231adea5b30d5ccdcad113260`.
- Open GitHub issues on latest read: **15**.
- Existing seal/verify tool tests: **43/43 PASS** (local, Node.js v22.16.0).
- Read-only host-preflight tests: **24/24 PASS** under Node.js v22.16.0. The tool and tests are committed on this isolated audit branch, **not installed or authorized on an Enterprise host**.
- Actual local read-only preflight: **Exit 1 / NO-GO**, because Node.js v22.16.0 differs from mandatory v22.23.3; Bun 1.4.2 and Docker were unavailable; no approved container-image digest or written host-run authorization reference was supplied.
- 15 mandated application gates on authorized immutable host: **0/15 PASS evidenced**. Human Security, DPO/Legal, SRE, Release Owner approvals: **0/4 evidenced**.
- No new application tests, Docker builds/runs, GitHub Actions runs, remote merges, or production deploys were performed as part of this readiness check.

**Next prerequisite:** Security and Release Owner must independently approve a single read-only test scope, host identity, pinned artifact provenance, tested tooling version and cost budget. SRE provisions an isolated authorized host with the exact runtime and Docker/network dependencies. After that, run the exact 15 gates on the immutable target SHA, seal untouched original logs only after all writers exit, verify signatures/checksums and obtain four independent human approvals. Technical PASS alone cannot confer GO.

See `ADR_PR119_READ_ONLY_HOST_PREFLIGHT_2026-10-23.md` and `PR119_AUTHORIZED_HOST_VERIFICATION_RUNBOOK_2026-10-23.md`. The executable preflight and its tests are now committed on the isolated audit branch, but they are **not authorized as an Enterprise host launcher** and do not qualify any Mandatory Gate.

## Cost-free-only authorization and immutable checkout observation (2026-10-23)

**Permission:** The user explicitly authorized continued work **only when no additional cost is incurred**. This permits local read-only QA and isolated branch documentation; it is **not** an independently verified Security or Release Owner approval to run an Enterprise host, trigger paid GitHub Actions, deploy, or waive the application HARD STOP.

**New control:** The read-only preflight now requires a separate **actual source checkout** root via `--checkout /absolute/immutable/source` or `KLAR_AUDIT_CHECKOUT_DIR`, and checks actual Git `HEAD`, target tree SHA `05f22f0ca387ae37573b1f81e85ead901dce3da9`, and clean tracked/untracked status. Merely specifying the target commit is not sufficient. The audit-tooling branch itself is a different Git commit and must not be substituted for the target application checkout.

**Evidence:** 24/24 preflight tests and 43/43 prior verifier/sealer tests PASS locally using Node.js v22.16.0. Real local preflight exits 1 / NO-GO with 7 blockers, including unavailable Node.js v22.23.3, Bun, Docker, approved image digest, independent host authorization, and actual Git checkout. Host Mandatory Gates **0/15 evidenced**, independent four release sign-offs **0/4 evidenced**. Nothing in this update certifies production GO.

**Scope:** Two audit-only JavaScript files and governance documentation; PR #119, main, production, application dependencies, paid actions and workflows remain unchanged. See `ADR_PR119_VERIFIED_IMMUTABLE_CHECKOUT_2026-10-23.md`.

## Cost-free immutable checkout index-flag guard (2026-10-23)

A reproducible local test showed that `git status --porcelain=v1` reports no changes after editing a tracked file if that file is marked `assume-unchanged` (`git ls-files -v` shows `h`); likewise `skip-worktree` (`S`) can conceal changes. The previous PR119 host preflight checked Git HEAD/tree and status but did not reject these flags.

The audit-branch-only `preflight-authorized-host-audit.mjs` now runs read-only `git ls-files --cached -v -z`, demands a nonempty set of ordinary `H` entries and rejects any other index prefix or a failed probe. The reported fields include `checkout_index_flags_safe`; the mandatory decision logic raises `CHECKOUT_INDEX_FLAGS_UNSAFE` and never issues release GO. No `git update-index` or other source mutation occurs in the actual preflight; regression fixtures use throwaway Git repositories only. The command-output buffer is capped at 4 MiB and fails closed if exceeded.

Verification: **29/29 focused preflight tests PASS and 72/72 combined audit-tooling tests PASS** locally under Node.js **v22.16.0**, not the release-pinned v22.23.3. The real local read-only preflight still exits **1 / NO-GO** (Bun/Docker/pinned runtime/host authorization and authentic PR checkout absent). **0/15 qualified application gates** and **0/4 independently authenticated human release approvals** evidenced. The user's authorization is limited to cost-free preparation and does not constitute Security/Release Owner host authorization.

Limitations: these checks reject known Git index blind spots but do **not** independently hash every working-tree byte against a trusted signed source snapshot. A compromised host, forged Git commands, adversarial index manipulation, symlinked dependencies or stale runner attestations require independent host provenance and immutable artifacts. Do not infer GO, execute CI, or deploy. New ADR: `ADR_PR119_GIT_INDEX_FLAG_FAIL_CLOSED_2026-10-23.md`.

## Free-only checkout verification: ignored artifact rejection (2026-10-23)
A concrete gap was reproduced: normal Git porcelain status can report a clean checkout while ignored files such as `.env` and `node_modules/` exist. The pre-install, read-only preflight now also runs `git ls-files --others --ignored --exclude-standard -z` and fails `CHECKOUT_IGNORED_FILES` if the result is nonempty, while retaining the previously integrated `assume-unchanged` / `skip-worktree` guard. Failed Git enumeration is fail-closed. Ignored path names are never written into the JSON findings. The tool must run **before** dependency installation in a fresh checkout.
**Local evidence:** 35/35 preflight tests and 43/43 evidence validator/sealer tests PASS = **78/78**, Node v22.16.0 only. Real local read-only run: **exit 1 / NO-GO** with seven infrastructure/authorization/checkout blockers. **No qualified Enterprise host tests or independent approvals** were performed; PR #119 immutable HEAD remains `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, 0/15 release gates and 0/4 approvals evidenced. User permits **cost-free work only**. See `ADR_PR119_IGNORED_CHECKOUT_ARTIFACTS_2026-10-23.md`.


## Static 15-gate contract reconciliation — 2026-10-23 (cost-free, NO-GO)

A read-only check of exact PR #119 tree `05f22f0ca387ae37573b1f81e85ead901dce3da9` (1,300 entries, not truncated) confirms a release-contract conflict: application `phase2_work/` is Bun-only with `bun.lock` and *without* `package-lock.json`, explicitly enforced by `scripts/check-dependency-locks.mjs`, while mandatory Gate 07 is `npm audit --audit-level=high`, which defaults to requiring an npm lockfile. A separate offline npm 10.9.2 fixture reproduced `ENOLOCK`/exit 1; **this is not a release-gate execution**. Functions has its own npm lockfile. Gitleaks/Semgrep must be preinstalled and supply-chain verified; do not allow unreviewed `npx` downloads. 15/15 commands have been statically mapped; **0/15 host gate PASS and 0/4 human sign-offs evidenced**. 78/78 previous audit-tooling tests were re-run and passed under unqualified Node v22.16.0. An explicit Security/Release Owner policy decision is required; there is **no authorization to alter gates or run costed CI**. Details: `PR119_GATE_CONTRACT_STATIC_RECONCILIATION_2026-10-23.md` and `ADR_PR119_SCA_LOCKFILE_GATE_RECONCILIATION_2026-10-23.md`.


## Machine-checkable PR #119 Gate 07 policy conflict (2026-10-23, cost-free)

The immutable PR119 source was cross-checked against the GitHub tree for **all five** SCA-relevant package/lock/policy source blobs (5/5 exact Git-blob matches). A new isolated **locally tested candidate**, `scripts/screen-pr119-sca-gate-contract.mjs`, detected the Bun-only application vs. npm-audit-lockfile conflict with exit **1 / BLOCKED / NO-GO** on that exact source subset. The static SCA contract screen and 13 targeted tests are now committed to the **isolated audit branch only**, but are **not qualified or authorized** on the required Node.js 22.23.3 / Bun 1.4.2 Enterprise host. In total **91/91 local audit tooling tests PASS on Node 22.16.0**; they are not release gates. The gate policy is **unchanged**, and the decision request remains **unapproved**, with 0/15 host gates and 0/4 independent release signoffs evidenced. New review packet: `PR119_SCA_GATE07_DECISION_REQUEST_2026-10-23.md`, `PR119_SCA_GATE07_DECISION_REQUEST_2026-10-23.json`. Only cost-free code/document review authorized; no network scanners or paid CI permitted.


## Static SCA tool integration (2026-10-23; cost-free)

The read-only tool `phase2_work/scripts/screen-pr119-sca-gate-contract.mjs` and its test suite `screen-pr119-sca-gate-contract.test.mjs` are now present **on the isolated audit branch only**. The complete local audit-tooling test set was rerun: **91/91 PASS** under Node v22.16.0; the independent 5-file PR119 source subset again yielded **exit 1 / BLOCKED / NO-GO** for Gate 07 with 0 scanners run. This remains static evidence, not a qualified release Gate 07 or an authorization to replace it. Security/Release Owner decision remains pending, all 15 Enterprise host gates unverified, all four final sign-offs absent. Do not run CI, use paid services, merge or deploy.


## P0 #70 offline TTL source reconciliation — 2026-10-23 (cost-free, NO-GO)

The original PR #119 TTL provisioner and evidence validator already require **20 expiresAt Collection-Groups**, not the four in the older issue text. The exact original bytes of 13 relevant scripts/documents were cross-checked against the immutable GitHub tree (**13/13 Git blobs PASS**). Six offline source/mutation/mock-gcloud test commands all **PASS under local Node.js v22.16.0**. No real Cloud TTL policy was read, activated or modified. The source `DATA_RETENTION.md` still contained **three stale operational instructions requiring 13 ACTIVE groups**; these have been corrected **only on the isolated audit branch** to reflect the technically planned **20**, without asserting Legal/DPO approval or LIVE Cloud ACTIVE status. Historical references to the original 13-group matrix were retained. Mandatory Enterprise host gates remain **0/15 evidenced** and independent approvals **0/4**. See `PR119_P0_70_TTL_20_GROUP_SOURCE_RECONCILIATION_2026-10-23.md` and the corrected `DATA_RETENTION.md`. The actual Stage/Production TTL state is **UNKNOWN**; P0 issue #70 remains OPEN and Release NO-GO.


## P0 #55 partner webhook trust boundary, immutable-source review (2026-10-23)

Five PR119 partner-conversion source/test Git blobs **5/5 PASS** independently against GitHub. The current source signs partner assertions and stores `pending_verification` with no immediate credit; the 2026-10-14 historical `earned` memo is annotated. However `buyerUid` is partner-asserted without independent purchase proof, an unverified claim reserves buyer attribution, and refund/chargeback and reconciliation evidence are absent. A **local candidate** static screen passed **27/27 Node v22.16.0 tests**, but has **not** been committed or Enterprise-host qualified; no Vitest, emulator or E2E was executed. Product/Security/DPO/Finance decisions remain absent. P0 #55 remains OPEN, **0/15 host gate PASS**, **0/4 final sign-offs**, **NO-GO**. See `PR119_P0_55_PARTNER_WEBHOOK_TRUST_SOURCE_AUDIT_2026-10-23.md`.


## P0 #55 — Source guard and buyer-proof design (2026-10-23; cost-free)

The isolated audit branch now includes `scripts/screen-pr119-partner-webhook-boundary.mjs` and 27 targeted structural/mutation tests; **27/27 PASS** locally on Node.js 22.16.0 against source inputs separately verified as 5/5 original Git blobs. Static guard CLI exit 0 means pattern checks only; its JSON always records **Production NO-GO**. The immutable source records signed assertions as `pending_verification` / `partner_assertion_only` without immediate credit. However, verified buyer/purchase linkage, expiring provisional claims, refund/chargeback and independent Finance/Legal approval remain absent. A **proposed, unapproved** buyer-intent and settlement-state ADR is `ADR_PR119_PARTNER_PURCHASE_PROOF_CLAIM_REVERSAL_2026-10-23.md`. Issue #55 OPEN, 0/15 qualified gates and 0/4 final approvals. No host run, product correction, paid CI or deploy.


## P0 #56 — partner tracking and Art.17 read-only audit (2026-10-23, free-only, NO-GO)

Ten files from immutable original PR #119 Git tree `05f22f0ca387ae37573b1f81e85ead901dce3da9` were separately verified by Git-blob SHA (**10/10**). A local read-only privacy source screen and 30 mutation/input tests passed **30/30** on unqualified Node.js v22.16.0; the tool deliberately exits **1 / NO-GO** on the original source and is **not yet integrated on this audit branch**. Existing consent-epoch invalidation, nontracked redirect for ineligible visitors, and Art.17 sweep/quarantine are source-observed. Critical P0 #56 remains: `trackedDestination` forwards a **stable `klar_referral` handle as external partner URL query**; the GDPR lawful basis, VVT, partner logs/recipients/transfers, live consent/Art.17 deletion, retention/legal holds, and DPO sign-off are not verified. New docs: `PR119_P0_56_PARTNER_TRACKING_PRIVACY_EVIDENCE_2026-10-23.md` and `ADR_PR119_PARTNER_TOKEN_MINIMIZATION_AND_ERASURE_2026-10-23.md`. **Issue #56 OPEN, mandatory host gates 0/15, final independent approvals 0/4; NO-GO.** No app, CI, Cloud, partner or paid operation.
