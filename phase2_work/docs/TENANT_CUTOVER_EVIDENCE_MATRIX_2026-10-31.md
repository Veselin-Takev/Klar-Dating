# P0 #254 — Tenant cutover evidence ledger and negative-test matrix

Date: 2026-10-31. Scope: read-only source and CI review, no live environment access. This is a release checklist, **not** proof that listed controls exist.

## Verified baseline

- Stacked Draft PR #267, source commit `32598e807ea8323496e5bc2ec8f5e1f36666d229`, CI run [41246347258](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41246347258): completed/success. In the `validate` job, the dedicated `Firestore rules emulator` step succeeded.
- Source report `MULTITENANT_FOUNDATION_2026-10-31.md`: tenant middleware **not globally mounted**; legacy `users/chats/subscriptions/verification_events` remain flat; new server tenant-context capability does not enforce legacy Admin SDK operations.
- Source report `FIRESTORE_RULES_SCOPE_AND_TENANT_DENY_2026-10-31.md`: Tenant-namespace Firestore client tests implement **pre-cutover default deny**, not end-to-end authorized tenant CRUD. This report contains historical CI/budget language; the newer exact-SHA CI above supersedes its pre-run caveat.

## Evidence register: required before any cutover

| Boundary | Minimum verification | Evidence still required | Owner/signoff |
| --- | --- | --- | --- |
| Legacy UID and tenant assignment | Enumerate all documents, descendants and reference edges; deterministic source-of-truth mapping, explicit conflicts and quarantine; no default tenant | Read-only inventory with source snapshot hash, per-collection counts, unresolved IDs recorded in restricted storage | Data owner + DPO |
| Firebase browser/mobile | Positive own-tenant least-privilege routes and negative foreign/same-tenant IDOR, list, query and real-time listeners, revocation and stale token cases | Exact rules SHA, both Firebase deployment roots, Firestore **and Storage** emulator logs | AppSec |
| Server Admin SDK | Call-site inventory covering routes, workers, Cloud Functions, scheduler, payment/KYC/referral and background retries | Audited adapters + direct Admin SDK BOLA/IDOR tests (SDK bypasses rules) | AppSec + SRE |
| Subcollections and deletion | Tenant member, conversations, media, identity verification, audit, payment, referral; legal holds and retention exceptions | Art.-17 cascade reconciliation, orphan/partial-failure idempotency and legal hold decisions | DPO/Legal |
| Data move | Dry-run mapping, checksums/counts, point-in-time baseline, write fence, replay, resumption and rollback | Approved staging migration and restore drill, independent reconciliation | Data owner + SRE |
| Tenant identities and roles | Claim vs active membership, revoked/deleted members, role intersection, hostile Host/header, copied labels | Full routes/listeners test report and trusted proxy/ingress evidence | AppSec + SRE |
| Live operations | Verified deployed SHA, IAM, alerts, secret ownership, canary and rollback | Host-side artifacts and human approvals linked to #8 | SRE + Release Owner |

## Denial matrix for new tests

For each exposed endpoint and data path, assert `403`/rules denial and **zero data disclosure** for: (1) foreign tenant with valid identity, (2) same tenant / foreign user-object ID, (3) inactive tenant, (4) inactive/revoked membership, (5) missing/mismatched document tenant label, (6) token/header/Host disagreement, (7) stale-role escalation, (8) broad list/query/cursor escaping tenant scope, (9) child subtenant requesting parent records, (10) privileged Admin SDK path bypassing the request authorization. Keep one permitted own-object positive test for every denial group to avoid tests passing solely due to blanket errors. Test cross-collection edges and paginated jobs too.

Store evidence with `commit_sha`, `rules_sha`, `environment`, `test_command`, `exit_code`, timestamp, log digest, accountable reviewer and signoff URL. Do not commit identifiers, raw snapshots or PII to Git.

## Decision boundary

Green CI on #267 establishes **only** the code tested on that commit. It does **not** establish successful migration, complete Admin SDK coverage, real Storage isolation, production alert delivery or release-owner approval. P0 #254, P0 #202, governance #73 and release #8 remain unresolved.

**BLOCKED / NO-GO. No merge, deploy, live migration or Rules/IAM changes authorized.**


## Read-only source inventory utility (subsequent isolated draft commit)

Run from `phase2_work`: `node scripts/inventory-tenant-access.mjs > tenant-access-candidates.json`. This scans `src/` and `functions/src/` with deterministic file ordering; it emits source-relative paths, source SHA-256, category and line numbers only, without snippets, cloud calls, customer IDs or credentials. Keep the resulting JSON in approved audit storage, **not** in a public commit if filenames themselves are sensitive. The tool is intentionally limited to static textual candidate matching; false positives and false negatives are expected (e.g. aliased imports, dynamic API access, generated code and non-source deployment configurations). A reviewer must independently enumerate Firebase rules, bucket policies, jobs, SDK wrappers, all repository roots, subcollections, UID links, mutations and deletion handlers. Running the utility has not been verified in this environment and does not discharge any acceptance criterion in #254.


## Deterministic inventory CI regression (new, unverified head)

The isolated draft now contains `scripts/inventory-tenant-access.test.mjs` and wires `npm run check:tenant-inventory` into `check:enterprise`. The test launches the inventory twice, requires identical output, nonempty candidate results, exact source SHA-256 integrity, bounded source-relative paths and a minimum output schema without code snippets. This detects inventory drift or serialization failures; it **does not** confirm all privileged call sites are enumerated or that access policies are correct. The exact new PR head requires a fresh CI pass; previous passing runs do not prove this commit.


## 2026-11-01 — Entry-point inventory completeness correction

PR #268 on previously validated SHA `80f716e9943b44890bb5832246f8d036c4bd656f` passed [CI run 41250404123](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41250404123). Subsequent inspection found the candidate inventory overlooked `phase2_work/server.ts`, the app's root Express route entrypoint, because its traversal considered only `src/` and `functions/src/`. A targeted patch now includes `server.ts` in the deterministic SHA/line-category manifest even if zero signatures are matched, with a required-file fail-closed preflight. The regression test requires this path to be present. This corrects *one known inventory scope omission*, but is not proof of exhaustive privileged access coverage: other files, dynamic calls, rules and permissions still require manual analysis. **The new exact head has not yet been validated by CI and retains NO-GO.**


## 2026-11-01 — Source denominator retained (follow-up)

Static matching originally omitted any source file without recognized signatures, hiding the review denominator and making newly abstracted SDK access wrappers invisible in the report. The inventory now emits **every scanned source file**, including zero-hit entries with a full-file SHA-256; `hits: []` means *not detected by these regexes*, **not** safe, unused or authorized. Reviewers must reconcile this complete scanned-file list with repository tree, nested packages, imports and route registration, then explicitly sign off the excluded directories and non-code infrastructure. The regression test accepts and validates zero-hit entries. Existing CI result #41251063730 relates to the earlier SHA `4d517c99...` and cannot validate these later commits; check the latest SHA and associated job steps before claiming PASS. No production change or cutover authorized.

## 2026-11-01 — Critical module inventory regression

An additional regression now demands that the source manifest include the root Express entrypoint, tenant-auth, tenant Admin SDK read adapter and biometric-retention module. It also checks deterministic path order, recognized hit categories, category membership and line-number bounds. This is a guard against *accidental exclusion* of known high-risk modules, not a review of access authorization. New commit `cd2373c3c30ced6b9f6ebeb06c59f8c6853e28e6` requires fresh CI evidence and independent code review. No test result for this commit is asserted here.


## 2026-11-01 — CI failure triage: stacked-branch integration gap

Exact previous head `5e0a5707ebbeb89b43632be77e38639316e255e8` failed [Enterprise CI #41251895105](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41251895105) in `Enterprise static gates`: `check:tenant-inventory` asserted the presence of `src/server/multitenant/tenantAuth.ts` on a PR #268 checkout based on `main`, although the file currently exists only in stacked, unmerged tenant PR history. This was a test topology failure; it does **not** mean the tenant authorization implementation passed or failed in this checkout. The test now requires root `server.ts` and `functions/src/retention.ts` unconditionally, and for each stacked multitenant module checks that its inventory inclusion exactly matches on-disk existence. The absent module remains an explicit **unintegrated prerequisite**, never a security PASS. This narrower change requires successful exact-head CI before considering PR #268 validated. A later upstream merge must rerun the inventory test and independently examine the real tenant authentication/migration paths.

