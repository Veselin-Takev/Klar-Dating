# Issues #374 / #206 — Consolidated Enterprise AppSec, DPO & SRE Review Dossier

**Repository:** `Veselin-Takev/Klar-Dating`  
**Review scope:** Packages A–D (merged) plus E1 implementation for revocable profile media, recommendation adult gates, authenticated UI delivery, upload cutover, diagnostics and the proposed E2 migration/revocation boundary.  
**Status:** Consolidated technical review baseline; independent sign-off is still required.  
**Release decision:** `productionApproved=false` — **NO-GO**.  
**Data / cloud boundary:** This dossier records implementation evidence and proposed controls. It does not authorize a staging or production deployment, Firestore migration, Storage metadata mutation, IAM change or release.

---

## 1. Executive summary

Issues #374 and #206 concern the profile-media authorization and lifecycle boundary, including legacy Firebase Storage download URLs that act as bearer capabilities. The work is organized into four stacked packages:

| Package | PR | Scope | CI evidence | Current PR state |
|---|---:|---|---|---|
| A | #380 | Server authorization, recommendation adult gate, authenticated media proxy | Run #2140 / `44282332776` — historical CI evidence | Merged to main; `ae56d2390fae9d4512a01e1607943fac1ab60f96` |
| B | #381 | Authenticated client media abstraction, temporary object URLs, secure self-view | Run #2144 / `44293821811` — historical CI evidence | Merged to main; `5d6f2e9972111d23d64f1df4af43f0ac475fdfd3` |
| C | #382 | Upload writer cutover to canonical opaque refs; read-only token inventory | Run #2146 / `44302073866` — historical CI evidence | Merged to main; `30690f549f7eac1b925076b1227ee5508845eae2` |
| D | #383 | Migration and staged token-revocation blueprint (documentation only) | Run #2147 / `44304654837` — historical workflow success | Merged to main; `1b30ea60dc9acab31020533fd55ba1cf69feaf33` |

Packages A–D were merged via PRs #380–#383. Package D is a planning document only and did not implement or execute a migration or revocation. The next remediation layer is split deliberately: E1 (#394) covers Storage Rules, authenticated UI consumers, diagnostics/Helmet and static boundary tests; E2 will implement migration/revocation CLI work for P1 #206 in a separate reviewed PR. The exact E1 base is `main` at `30250a1fc82f24834c7ada62f8453df04af20f2a`; E1's own hosted checks remain [TO VERIFY].

**Important interpretation:** CI success validates the code and checks executed by each exact workflow run. It is not independent AppSec approval, DPO approval, SRE change approval, proof of production readiness, or authorization to mutate cloud data.

## 2. Package A — server-side authorization and media proxy (PR #380)

**Branch:** `security/issue-374-revocable-profile-media-20261118`  
**Head:** `b83d1c92ddd4e71ba4fedfa68cdc51ef8c91f399`  
**Base:** `main` at `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`  
**CI:** Run #2140, ID `44282332776`, reported FULL ENTERPRISE CI PASS.

### Delivered security controls

- Recommendation requester checks fail closed: authenticated non-guest, `isAdult === true`, active lifecycle state, and no blocked, suspended, deleted or account-deletion-marked state.
- Recommendation candidates are filtered for adult, active, verified and eligible lifecycle state before serialization.
- Profile media aliases (`photoURL`, `photoUrl`, `photos` and supported storage paths/URL forms) are normalized to canonical opaque references rather than returning legacy bearer URLs.
- Authenticated profile-media streaming endpoint verifies Firebase ID tokens with revocation checking on each request.
- Requester and target lifecycle/adult/deletion state and both block directions are checked.
- Object paths are owner-scoped; image MIME and size are validated; responses use private/no-store caching.
- Direct client reads under `/profiles/{uid}/{file}` are denied by Storage Rules. Owner-scoped writes remain subject to authenticated/non-guest and file constraints.

### AppSec review points

- Independently review the complete authorization matrix, token revocation semantics, error mapping, path canonicalization, block checks, object metadata trust and stream error handling.
- Confirm no alternate route, legacy client or public serialization path leaks a bearer URL or bypasses the proxy.
- Confirm rate limiting, abuse controls, auditability and operational monitoring are adequate for the endpoint's exposure.
- Verify Firebase Admin SDK and Storage SDK behavior against the exact locked versions and deployed runtime.

### Known residual

Existing Firebase download-token URLs may remain usable until separately inventoried and explicitly revoked. Package A does **not** claim to revoke existing tokens.

## 3. Package B — authenticated client media cutover foundation (PR #381)

**Branch:** `security/issue-374-client-media-cutover-20261118`  
**Head:** `3befc46251559dc4965a2c9a7ccfe808af49827d`  
**Base:** Package A head `b83d1c92ddd4e71ba4fedfa68cdc51ef8c91f399`  
**CI:** Run #2144, ID `44293821811`, reported FULL ENTERPRISE CI PASS.

### Delivered controls

- Shared `profileMediaClient` abstraction / `useAuthenticatedProfileMedia` and `profileMediaApiPath`.
- Uses same-origin `authFetch` to attach the current Firebase ID token; anonymous sessions fail closed.
- Converts successful image responses to temporary browser object URLs.
- Releases object URLs when the target or authenticated viewer changes and on component unmount; object URLs are not persisted to profile data or durable browser storage.
- Adds `GET /api/profile-media/self`; the target UID is derived only from the revocation-checked Firebase ID token, not from a caller-supplied UID.
- Self-view endpoint checks adult, active, lifecycle and deletion state, resolves the owner's media alias server-side and streams private/no-store bytes.
- Profile screen avatar uses the authenticated self-view route.

### Explicitly outstanding in the Package B scope

At the time of the PR description, other profile-media consumers (recommendation cards, chats, dashboard, profile detail and widgets) still required migration to the shared client hook. Package C addresses the upload writer but does not, by itself, prove every UI consumer has been migrated. AppSec and QA must verify the current full consumer inventory before release.

## 4. Package C — canonical upload writer and read-only token inventory (PR #382)

**Branch:** `security/issue-374-package-c-upload-cutover-20261118`  
**Final head:** `3e7a8e53ffdc2355906006afa7a89f9294cce006`  
**Base:** Package B head `3befc46251559dc4965a2c9a7ccfe808af49827d`  
**CI:** Run #2146, ID `44302073866`, FULL ENTERPRISE CI PASS. An earlier run #2145 failed on an invalid Storage inventory test page; the fixture was corrected to respect the page-size contract and the production validator was not weakened.

### Upload writer cutover

- `ladeProfilfotoHoch()` no longer imports or calls `getDownloadURL()`.
- Uploads are owner-scoped under `profiles/{uid}/...`.
- After upload, the client rechecks that the authenticated session is still the same UID and non-anonymous before writing the Firestore profile reference.
- Persists a canonical `klar-media:v1:` opaque reference in `users/{uid}.photoURL`.
- Shared client encoder and server parser use base64url path encoding; server normalization accepts a canonical ref only when the decoded object path belongs to the profile UID.
- Existing legacy alias normalization remains during transition.

### Read-only inventory

The inventory core and CLI are designed to:
- Paginate Firestore `users` and `public_profiles` and the Storage `profiles/` prefix.
- Inspect referenced and listed object metadata to count token metadata presence, missing references, duplicates, unresolved legacy URLs and orphaned objects.
- Emit aggregate counts only; no UIDs, document IDs, object paths, URLs, raw metadata, token values or SDK exception messages.
- Require explicit mode selection. Emulator mode requires Firestore and Firebase Storage emulator hosts and a `demo-*` project. Live read-only mode requires explicit flags, project ID and bucket, and is intended to use list/get operations only.

**Boundary:** The inventory is read-only. It does not migrate Firestore records, remove token metadata, delete or overwrite objects, or change IAM/deployment configuration. The live inventory has not been run as part of this package evidence.

## 5. Package D — migration and staged token-revocation blueprint (PR #383)

**Branch:** `security/issue-374-package-d-migration-strategy-20261118`  
**Head at dossier preparation:** `73b6d0c864c41efec0743370a238a1b555af43ff`  
**Base:** Package C head `3e7a8e53ffdc2355906006afa7a89f9294cce006`  
**CI:** Run #2147, ID `44304654837`, completed with workflow conclusion `success`; job `validate` completed successfully. The job-step evidence shows success for Enterprise static gates, Typecheck, Functions build, Tests, Build, Production smoke and Browser acceptance. The browser diagnostics upload step was skipped because no failure diagnostics were needed.

### 5.1 Backward-compatible Firestore migration strategy (proposed; not implemented)

1. Establish an approved schema contract for `users`, `public_profiles`, `photoURL`, `photoUrl`, and any supported `photos[]` representation. Define alias precedence and conflict rules before writing.
2. Run inventory and classify each record: already canonical, eligible legacy URL/path, malformed, wrong owner, missing object, ambiguous aliases or concurrently changed.
3. Validate each candidate against the owning UID and `profiles/{uid}/` object prefix; verify object existence, MIME and size using the same server-side acceptance rules.
4. Generate the canonical `klar-media:v1:` reference with the existing shared encoding contract.
5. Apply per-record transaction/compare-and-set semantics against the exact source value observed during planning. Preserve unrelated fields and never replace a whole document from a stale snapshot.
6. Make the worker idempotent and resumable with bounded batches and protected checkpoints. Already-canonical records are no-ops; changed source values are skipped and reconciled.
7. Re-run independent inventory and proxy tests. No token-revocation cohort may proceed while in-scope records remain unresolved or an active consumer still depends on a legacy bearer URL.

### 5.2 Staged token revocation protocol (proposed; not executed)

**Preconditions:** approved staging project and bucket identity; canonical-compatible application/proxy deployed to staging; migrated canary records reconciled; direct Storage reads denied; new upload writer does not create download URLs; exact staging-only object allowlist; generation/metageneration captured; separate staging mutation approval.

**Dry-run:** read metadata for the exact allowlist, report counts only, produce a restricted action manifest and prove zero writes. Reject ambiguous emulator/live mode, production-like project IDs, unexpected buckets, changed objects and missing confirmation.

**Canary mutation:** only after separate approval, re-read each object's metadata and use a metageneration precondition. Remove only `firebaseStorageDownloadTokens`; preserve object bytes and all unrelated metadata. Verify absence with a fresh metadata read. A precondition conflict is a stop-and-reconcile event, not a blind retry.

**Paired functional verification:**
- Legacy path: request the synthetic staging URL captured before revocation; require a non-success result and no image bytes. Use a fresh client/cache-bypass test. Previously downloaded or cached copies cannot be recalled by revocation.
- Proxy path: use a valid non-anonymous staging ID token and canonical reference; require HTTP 200, expected image content type, byte length/hash and private/no-store headers, with unchanged original bytes.
- Negative cases: missing/invalid/revoked token, anonymous requester, blocked/deleted/inactive/deletion-marked accounts, wrong-owner/malformed/traversal references, missing objects and direct Storage SDK reads must fail closed.

Expand only in separately approved bounded staging cohorts after reconciliation. Stop on any proxy regression, legacy URL still serving bytes, direct read success, authorization bypass, metadata drift, unexpected metadata change, object mismatch or audit-count discrepancy.

### 5.3 Rollback and immutable guarantees

- Do not delete, rewrite, copy, move, rename or overwrite Storage objects as part of migration/revocation.
- Do not recreate `firebaseStorageDownloadTokens`, regenerate bearer URLs or convert canonical references back to bearer URLs.
- A rollback application build must understand canonical references and use the authenticated proxy. A pre-canonical reader is not an acceptable rollback target.
- Keep canonical Firestore references after token removal; repair or roll back proxy application code to a validated compatible build rather than restoring bearer access.
- Use per-record compare-and-set; skip conflicts rather than overwriting concurrent user edits.
- If a record cannot be safely resolved, leave it unchanged and exclude it from the revocation cohort.
- On any stop condition, halt new work, do not auto-retry, inspect actual state with fresh reads, preserve minimal restricted evidence and obtain independent approval before resuming.

**Package D is a planning document only.** It does not implement a migration worker, token-removal command or staging execution.

## 6. Consolidated security and privacy control matrix

| Control objective | Implemented evidence | Remaining review / proof |
|---|---|---|
| Adult-only recommendation access | Package A requester and candidate gates | AppSec test matrix for all routes and data sources; DPO review of age-data processing |
| Lifecycle and deletion fences | Package A proxy/recommendation checks; Package B self-view checks | Verify every consumer and all deletion race conditions |
| Authenticated media access | Package A proxy; Package B authenticated client/self route | Independent auth, revocation, block-direction and abuse testing |
| Direct Storage read denial | Package A Storage Rules | Verify deployed rules in a controlled environment; no production rule change authorized here |
| No new bearer URL creation | Package C upload writer | Search all upload writers, background jobs, admin tools and legacy clients |
| Legacy bearer URL inventory | Package C read-only inventory tooling | Execute separately approved read-only inventory against explicitly identified environment |
| Legacy record migration | Package D design only | Implement, test, dry-run, reconcile and obtain approvals |
| Legacy token revocation | Package D design only | Staging-only mutation approval, canary, dual-path tests and audit evidence |
| Privacy-safe logs | Package C aggregate-only inventory design; Package D logging requirements | Verify application/proxy logs, traces, analytics, crash reports and support tooling |
| Rollback safety | Package D immutable rollback design | Demonstrate rollback drill in staging without token restoration |

## 7. Independent sign-off checklist

All sign-offs below are **pending** until an identified reviewer records an explicit decision against the exact release candidate, commit SHA, environment and evidence bundle. PR author assertions and CI success are not substitutes.

### 7.1 Application Security (AppSec)

- [ ] Review exact source SHAs and complete diffs for PRs #380–#383.
- [ ] Independently test Firebase ID-token verification, revocation checking, anonymous rejection, authorization status codes and token/session edge cases.
- [ ] Verify requester and target adult/lifecycle/deletion gates, both block directions and recommendation candidate filtering.
- [ ] Verify owner-scoped canonical-reference parsing, traversal/encoding resistance, MIME/size checks and object ownership.
- [ ] Verify direct Storage reads are denied and no alternate API, client, URL, cache or serialization path exposes bearer URLs.
- [ ] Verify every client consumer uses authenticated media loading and object URLs are revoked on all lifecycle paths.
- [ ] Verify upload writers cannot persist `getDownloadURL()` results; search all app, functions, admin and migration code paths.
- [ ] Review inventory CLI mode guards, pagination, redaction, read-only guarantees and error handling.
- [ ] Review migration compare-and-set, idempotency, checkpoint security and token-revocation metageneration preconditions.
- [ ] Witness staging negative tests, legacy URL failure, authorized proxy byte-integrity success and direct-read denial.
- [ ] Record findings, severity, residual risk acceptance and explicit AppSec **APPROVE / REJECT**.

**AppSec reviewer:** ____________________  **Date:** __________  **Decision:** __________

### 7.2 Data Protection Officer (DPO)

- [ ] Confirm purpose limitation and lawful basis for profile-photo processing and the adult eligibility gate.
- [ ] Review whether age/adult status, profile photos, block state and deletion markers are special-category or otherwise sensitive personal data in the actual processing context.
- [ ] Confirm data minimization in Firestore migration inputs, inventory outputs, audit receipts, logs and monitoring.
- [ ] Review retention periods, access controls and deletion behavior for migration checkpoints and audit evidence.
- [ ] Confirm data-subject deletion and correction workflows remain effective during partial migration and token revocation.
- [ ] Assess whether a DPIA or DPIA update is required and document the decision.
- [ ] Review international transfers, processors/subprocessors, storage region, access paths and relevant contractual controls.
- [ ] Confirm that revoking a URL does not get misrepresented as erasure of previously downloaded or cached copies.
- [ ] Approve user-facing privacy notices/communications if required.
- [ ] Record residual privacy risks and explicit DPO **APPROVE / REJECT**.

**DPO reviewer:** ____________________  **Date:** __________  **Decision:** __________

### 7.3 Site Reliability Engineering (SRE)

- [ ] Verify exact staging project ID, bucket, region, billing boundary and isolation; no environment inferred from defaults.
- [ ] Confirm staging deployment uses the exact reviewed commit and compatible Storage Rules, proxy and client.
- [ ] Review rate limits, timeouts, streaming concurrency, memory use, retry behavior and proxy availability.
- [ ] Establish SLOs and alerts for proxy success/error/latency, auth failures, inventory/migration progress and reconciliation drift.
- [ ] Confirm logs and metrics do not contain tokens, bearer URLs, authorization headers, image bytes or unnecessary profile identifiers.
- [ ] Review batch sizing, checkpoints, concurrency controls, idempotency and operator stop authority.
- [ ] Witness dry-run zero-write evidence and staging canary metadata precondition behavior.
- [ ] Verify backup/recovery and canonical-compatible application rollback; demonstrate no bearer-token restoration.
- [ ] Confirm incident response, escalation contacts, maintenance window and change record.
- [ ] Record operational readiness and explicit SRE **APPROVE / REJECT**.

**SRE reviewer:** ____________________  **Date:** __________  **Decision:** __________

### 7.4 Release owner / governance

- [ ] All required AppSec, DPO and SRE decisions are recorded and approved.
- [ ] Independent code review and exact-head Enterprise CI are green for the implementation candidate.
- [ ] Release manifest, migration manifest, staging evidence and rollback plan are immutable and versioned.
- [ ] Staging mutation approval is separate, explicit and limited to the named project, bucket and cohort.
- [ ] Production migration/revocation has a separate explicit production authorization and release decision.
- [ ] `productionApproved` remains false until the formal production approval process is complete.

**Release owner:** ____________________  **Date:** __________  **Decision:** __________

## 8. Stop conditions and prohibited actions

Stop immediately and escalate if any of the following occurs:
- a requester or target authorization/lifecycle check is bypassed;
- any direct client Storage read succeeds;
- any new bearer download URL is written;
- an old staging bearer URL continues returning image bytes after approved revocation;
- an authorized proxy request fails or returns different bytes after token removal;
- a migration candidate is wrong-owner, missing, malformed, ambiguous or concurrently changed;
- a metadata precondition fails or an unrelated metadata field changes;
- inventory totals, action manifest and execution receipts do not reconcile;
- logs or artifacts expose token values, bearer URLs, ID tokens, image bytes or unnecessary personal data.

No package in this dossier authorizes:
- merging any PR into `main`;
- changing `productionApproved` to true;
- running a Firestore migration;
- mutating Storage token metadata or objects;
- modifying IAM, cloud resources, billing, project configuration, Storage Rules in a live environment or deployment configuration.

## 9. Current verified release posture

- PRs #380–#383: merged to main; their exact merge SHAs are recorded in §1 above.
- Package D CI Run #2147 (`44304654837`): historical workflow success for the Package D source SHA only.
- PR #394: canonical E1 Draft, open and unmerged; its own current-head CI and Audit Gate remain [TO VERIFY].
- E2 migration/revocation CLI implementation remains a separate P1 #206 follow-up.
- `productionApproved=false` — **NO-GO**.
- No staging migration or token revocation is evidenced by this dossier.
- No live cloud, Storage object, download-token metadata, IAM or deployment mutation is authorized or performed by this dossier.

## 10. Technical references

- [Firebase Storage download URLs](https://firebase.google.com/docs/storage/web/download-files) — client download URL behavior and access model.
- [Cloud Storage object metadata](https://cloud.google.com/storage/docs/metadata) — object metadata concepts and custom metadata.
- [Cloud Storage request preconditions](https://cloud.google.com/storage/docs/request-preconditions) — generation and metageneration preconditions.
- [Node.js Cloud Storage File API](https://googleapis.dev/nodejs/storage/latest/File.html) — SDK metadata operations; validate exact behavior against the pinned package version before any staging mutation.

**End of dossier.**


## 11. E1/E2 workstream boundary — 2026-11-21

E1 is tracked in [Draft PR #394](https://github.com/Veselin-Takev/Klar-Dating/pull/394), branch `security/issue-374-e1-rules-ui-cutover-20261121`, based on `main` SHA `30250a1fc82f24834c7ada62f8453df04af20f2a`. E1 includes Firestore-backed fail-closed profile Storage owner rules and pure-model parity, authenticated media rendering across the nine agreed UI consumers, diagnostics redaction, active Helmet `no-referrer`, static boundary enforcement and regression coverage.

E1 explicitly excludes any migration worker or download-token revocation executor. E2 will implement `profile-media-migration.ts` and `profile-media-token-revocation.ts` for P1 #206 only after a separately reviewed PR and explicit staging-only authorization. No E2 action or cloud mutation is performed by E1.

The PR remains Draft/unmerged; exact-head hosted CI and Audit Gate are [TO VERIFY]. `productionApproved=false` remains mandatory.
