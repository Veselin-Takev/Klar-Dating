# P0 Issue #70 — Firestore TTL policy coverage, staging evidence and legal holds

**Review date:** 2026-10-23 · **Decision: BLOCKED / PRODUCTION NO-GO**  
**Repository:** `Veselin-Takev/Klar-Dating`  
**Examined source:** Draft [PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119), exact HEAD `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, not merged.  
**Issue:** [#70 — Firestore TTL provisioning](https://github.com/Veselin-Takev/Klar-Dating/issues/70), open on inspection.  
**Isolation:** Documentation-only `docs/ci-governance-audit-2026-10-23`; no code/workflow/production candidate, Firestore database or Cloud policy was changed.

**Verification scope:** Read-only GitHub file review plus publicly documented Google Cloud TTL behavior. The presence of scripts, tests, old PASS lines, environment flags, a synthetic JSON file or a `gcloud ... update` command in a document **is not** evidence of approved and ACTIVE real TTL. **No script, test, CLI, emulator or live Staging/Production Cloud query was executed in this audit.** No independently signed operator/host evidence has been received here.

## 1. At exact source SHA: approved-intent inventory (20 planned groups, not externally approved)

The following **source allowlist** exists as the array in [`scripts/configure-retention.sh`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/configure-retention.sh). The term "source allowlist" does **not** claim DPO/Legal endorsement or actual Cloud state.

| # | Collection group | Scope / control to inspect before a future apply |
| --- | --- | --- |
| 01 | `messages` | Conversational data; expiry timestamp, linked subcollections and legal holds |
| 02 | `archived_messages` | Archived data must not extend original retention |
| 03 | `ki_zwischenspeicher` | AI temporary cache; actual Date/Time fields and erasure |
| 04 | `age_attempts` | Short-lived age-verification attempts; fraud retention exception |
| 05 | `funnel_events` | Analytics purpose, consent, 30-day claim and erasure |
| 06 | `ai_budget` | AI reservation expiry; consistency with distributed budgeting |
| 07 | `kyc_events` | Verification deduplication evidence versus lawful minimum retention |
| 08 | `account_deletions` | **Only completed** deletion tasks expire, not open or manual-review records |
| 09 | `deletion_log` | Completion evidence: aggregate-only claims and lawful retention |
| 10 | `partner_referral_click_rate_limits` | Expiry and linkable IP/device identifiers |
| 11 | `partner_referral_webhook_rate_limits` | Partner webhook abuse and reconciliation window |
| 12 | `partner_referral_admin_rate_limits` | Admin-based counters and account erasure |
| 13 | `partner_referral_user_rate_limits` | User-based counters and account erasure |
| 14 | `password_reset_rate_limits` | Reset code/rate-limit windows; timestamp creates and updates |
| 15 | `verification_mail_rate_limits` | Email-sending limiter; both timestamp write paths |
| 16 | `account_deletion_rate_limits` | Account deletion abuse controls; do not delete active deletion tasks |
| 17 | `kyc_start_rate_limits` | KYC entry-rate limiter; timestamp and age/retention |
| 18 | `kyc_reconciliation_events` | KYC reconciliation history and legal-hold handling |
| 19 | `chat_message_rate_limits` | Distributed chat limiter; shared Date expiry writer |
| 20 | `chat_gate_answer_rate_limits` | Distributed answer limiter; shared Date expiry writer |

The initial 13 names and subsequent seven additions are both represented in [`docs/DATA_RETENTION.md`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/docs/DATA_RETENTION.md). The complete, externally authorized matrix revision is **NOT VERIFIED**. `KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19` is a **self-declared environment marker**, not a cryptographic signature or independent approval.

## 2. Implemented preventive controls — present in source, not executed here

1. [`configure-retention.sh`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/configure-retention.sh) defaults to DRY RUN. Live apply is rejected unless `KLAR_APPLY_RETENTION=true`, `KLAR_ENVIRONMENT=staging`, target project/database confirmation, distinct production identity, DPO/Legal and inventory flags, a 20-group revision marker and a verified GCP staging project label are present. Production apply is not authorized.
2. Before its **first** update it performs a read-only, exact-project/database `gcloud firestore fields ttls list --format=json`, runs [`check-retention-active-evidence.mjs --mode preflight-ids`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/check-retention-active-evidence.mjs) and skips previously ACTIVE allowlisted policies. Missing groups are updated sequentially (partial change possible on failure).
3. The ACTIVE evidence checker rejects malformed names, wrong target identity, wrong field, duplicate, non-ACTIVE state, nonzero/nondefault offset and unexpected group. Its normal mode requires **exactly the 20 source allowlisted fields**. Its preflight mode permits only an **ACTIVE subset**; preflight PASS must never become final ACTIVE PASS.
4. [`check-retention-matrix.mjs`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/check-retention-matrix.mjs) independently contains a hardcoded **20-name** expected list and checks the provisioner plus documentary tokens/guard markers. [`check-retention-expiry-writers.mjs`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/check-retention-expiry-writers.mjs) checks known seven newer writer groups (create/update Date requirements). These are **static heuristics**, not comprehensive runtime schema or legal-proof attestations.
5. [`verify-retention-staging-live.sh`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/scripts/verify-retention-staging-live.sh) has a genuinely read-only intended Cloud command sequence (project describe, TTL list), explicit staging/project/database limits, a private outside-repo optional file export, source-evidence validation and SHA-256 receipt. It **does not invoke `check-retention-matrix.mjs` or an independently verified signed external matrix**. Its printed PASS is expressly not an independent approval.
6. [`package.json`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/package.json) includes `check:retention-p0` (source gates, mutation tests, fake-gcloud checks) and `verify:retention-staging-live` (read-only live verifier). The former cannot replace the latter; neither attests independent reviewer identity.
7. Existing scripts include offline negative cases for 12 final evidence mutations, seven existing-policy preflight mutations, 13 source-matrix mutations, 20 expiry-writer mutations and a mocked Stage read-only verifier. Their **source** was inspected. This report makes **no claim to have executed them** at this SHA.

## 3. Risk and evidence gap matrix

| ID | Precise source-backed finding | Priority and required action |
| --- | --- | --- |
| `P70-01` | `docs/DATA_RETENTION.md` still includes old authoritative-looking text saying **13 ACTIVE groups** in its activation instructions and readonly checker description, followed later by the new **20-group** extension. | **P0 operational-documentation drift**. After DPO/SRE adoption of the final 20-row policy, replace (not just append to) older 13-group operating instructions on the intended release branch. Until then expressly mark legacy text superseded. |
| `P70-02` | The standalone Staging live checker reads its `required` groups by parsing the **mutable provisioner**; it checks a 20-count, but does not itself execute the separate **hardcoded** canonical `check-retention-matrix.mjs` or compare the result to an independently signed external authorized policy manifest. A simultaneous edit to both the provisioner and live source cannot be independently authenticated by its own PASS line. | **P0 attestation-independence gap**, not proof any unauthorized policy exists. Require owner-approved immutable policy manifest/digest and exact policy/version verification during authorized evidence capture; run source-check gates on same pinned SHA. Reject human or machine acceptance based on 20/20 count alone. |
| `P70-03` | Live ACTIVE proof, approved full project/database inventory and DPO/Legal legal holds were not presented. Prior 2026-10-19 emulator record states actual Art.17 SDK assertions did not finish despite emulator startup. | **P0 missing external release evidence.** Demand independently authenticated GCP export, signer, UTC, hashes and successful real emulator assertions. No empty/scoped connector response qualifies as Cloud PASS. |
| `P70-04` | The preflight snapshot and 20 sequential updates are not atomic across Firestore administration. Concurrent admin changes or midway failures can leave a partially altered configuration. | **Known TOCTOU and partial-activation risk**. Authorized controlled window, least-privilege Cloud permissions, operation IDs, after-each-step response log, post-apply independently signed all-20 ACTIVE inventory; no automatic disabling/re-enabling of policies on retry. |
| `P70-05` | Firestore TTL applies to collection groups, not to legal-hold document exceptions automatically; it is asynchronous and nonrecursive. When enabled, existing expired documents may become eligible for bulk deletion. | **Potential irreversible deletion / regulatory risk.** Inventory real `expiresAt` value types, negative/legacy dates, current legal holds, shared subcollections, backups and deletion side effects per group **before** any apply. Approved retention policy must specify if/when per-document expiry is omitted/cleared under lawful hold. |
| `P70-06` | Current evidence checker can correctly validate a supplied JSON array but does not independently validate an untrusted file's origin, operator permissions, timestamp or manifest signer. `verify-retention-staging-live.sh` records a hash but not an authenticated external signature. | **Evidence authenticity gap**. Bind the actual exported bytes to project, database, Git SHA, operation attempts, capture time, immutable location and independently authenticated SRE/DPO approval. SHA-256 does not itself prove provenance. |
| `P70-07` | Source `check-retention-matrix.mjs` tests whether docs contain the group command tokens, but does not establish that every group's legal processing purpose, actual TTL timestamp, value type and retention/hold decision is approved. | **Policy vs source scope gap**. Build a signed row-by-row policy and actual data schema tests; static string search is not substantive legal approval or live expiry behavior. |
| `P70-08` | The root CI/security release evidence, 15 host log package and actual independent signoffs remain unavailable; PR #119 is Draft/unmerged. | **Global governance gate**. No merge, production TTL changes or GO before verified mandatory gates and human approvals. |

**Nuance:** The 20-name hardcoded static checker offers meaningful defense against unreviewed code drift when it is actually executed on the exact candidate SHA. The distinct weakness is that a **standalone** `verify:retention-staging-live` PASS is not yet cryptographically bound to the separately approved legal policy, and does not invoke that static list checker. This is not a claim of an exploited security defect or a failed production configuration.

## 4. Required evidence protocol — without executing mutating operations

**A. Independent Policy Approval (DPO/Legal + SRE):** Freeze a versioned, immutable and authenticated policy document covering the 20 group names, exact `expiresAt` field, per-row TTL timestamp rules and retention period, live dataset inventory, old historical expired values, hold exceptions, Cloud region/project/database, third-party/PII and deletion metrics impact. Include actor, SHA/digest and reviewer ticket. Approve **before** any Staging enablement.

**B. Read-only inventory (authorized actual operator, later):** Capture `gcloud projects describe` and `gcloud firestore fields ttls list --project=APPROVED_STAGING --database=APPROVED_DATABASE --format=json` using least-privilege read identity, in a controlled private channel, **only after separate execution authorization**. Validate exact project/database and full actual field list against the signed policy. Do not confuse evidence ingestion with proof of signer or completion.

**C. Existing-value and hold inventory:** Sample/types for each group, future/expired values, deletion job state and hold exceptions; assess backup, legal, DSAR, financial and KYC evidence. Reject incompatible Date, unexpected collection groups, subcollection/orphan risk, any unapproved active policy or unknown deletion impact. Record the DPO decision for each exception.

**D. Restricted Staging apply (not authorized by this report):** In a separately approved change window, with exact target/project and independent approvals, run the approved fail-closed provisioner; archive operation IDs and zero/limited update plan. Abort and reconcile if an operation becomes incomplete. No automatic retries that bypass preflight and no production write.

**E. Independent post-apply ACTIVE evidence:** At exact project/database ensure all **20 and only 20** independently signed policies are ACTIVE, expiry offset is approved, and include capture time, complete original JSON, SHA-256, signer/runner identity and immutable ticket. The source checker and evidence checker must operate against the same approved matrix; existing `CHECK PASS` / policy count alone is insufficient.

**F. Behavior validation:** Only once unlocked, execute genuine Firestore SDK/emulator Art.17 owner/invitee/child-claim concurrency and restart tests, write-side actual `Timestamp` checks for all source groups and live Staging TTL deletion delay/monitoring under approved dummy data. Ensure historical expired records and Legal Holds cannot be deleted without legitimate authorization.

**G. Human release review:** Security, DPO, Legal, SRE and Release Owner separately examine exact-SHA P0/P1 gate receipts; `main`-push CI receipt and release immutable evidence are required **after** an independently authorized merge. Production TTL would need its own explicit separate change authorization even following Staging acceptance.

### Release acceptance ledger (all NOT VERIFIED in this session)

| Evidence object | Target | State |
| --- | --- | --- |
| Signed 20-row DPO/Legal/operations matrix + holds and inventory | Exact matrix revision + signer | NOT PROVIDED |
| Original `gcloud ttl list` output | Signed project/database, full list, UTC | NOT PROVIDED |
| Actual independent all-20 ACTIVE state and absence of unknown rules | Correct effective Cloud configuration | NOT VERIFIED |
| Original real Firestore emulator Art.17 tests with exact SHA | Concurrent deletion/restart/owner claims | NOT VERIFIED |
| Historical expired-data migration/hold risk analysis | Zero unauthorized deletion | NOT PROVIDED |
| CI/host `gates.tsv` + 15 logs + `SHA256SUMS` | Actual matching SHA and signed provenance | NOT PROVIDED |
| Security/DPO/Legal/SRE/Release Owner signoffs | Genuine independent approvals | NOT PROVIDED |

## 5. Official Firestore TTL semantics (public documentation)

Google Cloud and Firebase describe TTL for collection groups as **asynchronous** (typically within 24 h of expiry), **non-transactional**, **nonrecursive** regarding subcollections, potentially affecting pre-existing expired documents when a new policy becomes ACTIVE, and billable for delete operations. For Native mode TTL, Standard edition requires a Date/Time value; absent/invalid fields do not automatically expire. The independently approved matrix must accommodate these characteristics.

- https://docs.cloud.google.com/firestore/native/docs/ttl
- https://firebase.google.com/docs/firestore/ttl

The source documentation and tests do not prove actual service configuration. Do not copy scripts to an environment with real Cloud credentials or mark a mock PASS as an operational attestation.

## 6. Decision and provenance

- Audited GitHub source and exact PR #119 metadata **read-only** on 2026-10-23.
- No test, check, CLI, Cloud, TTL apply, emulator start or direct production command run.
- No signed live GCP evidence or independent legal approval received.
- No production candidate, CI workflow, PR #119, `main`, release artifact, legal hold or environment variable changed.
- This documentation-only report lives outside the locked release candidate on a separate audit branch.
- **Issue #70 remains OPEN. Production release is BLOCKED / NO-GO.**

Related [P0 #56 privacy and retention audit](P0_ISSUE_56_PARTNER_PRIVACY_RETENTION_AUDIT_2026-10-23.md), [P0 release-evidence register](P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md), [Host evidence intake](CI_HOST_EVIDENCE_INTAKE_RUNBOOK_2026-10-23.md), and [Governance lockdown](CI_GOVERNANCE_LOCKDOWN_2026-10-23.md).
