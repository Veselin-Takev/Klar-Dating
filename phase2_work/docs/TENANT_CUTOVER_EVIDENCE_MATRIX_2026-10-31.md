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

