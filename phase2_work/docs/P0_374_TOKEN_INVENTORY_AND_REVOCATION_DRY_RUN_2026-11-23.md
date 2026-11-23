# P0 #374 — Offline profile-media token inventory and dry-run revocation plan

**Status:** Package 2 engineering proposal; offline-only; no live inventory or revocation.  
**Baseline:** \`main@616b165d6df783b5fe9c1b45dcb9c5dd53def583\` (tree \`a71eaaf97c22854b1c57ad15296fb5128e36d5ea\`).  
**Release invariant:** \`productionApproved=false\`; production **NO-GO**; P0 #374 remains **OPEN**.

## Purpose and boundary

This package adds a pure, deterministic planner and synthetic negative/boundary suite. It does not invoke Firebase Admin, Google Cloud Storage, Firestore, network, filesystem, or a production route. It accepts in-memory synthetic inventory only and returns aggregate counts and SHA-256 digests; no UID, URL, token, object path, generation value, or raw metadata is returned.

Existing inventory/revocation entrypoints remain separate operational code paths. This package does not run them or authorize live use.

## Offline inventory schema

- \`objects[]\`: synthetic object path, existence, generation, metageneration, and token-metadata-presence flag.
- \`references[]\`: synthetic object path and optional generation/metageneration assertions.
- Bounds: 10,000 object records and 50,000 references.
- Inputs are sorted canonically before hashing. Paths are used only in-memory for joins and digest input; no path-bearing action list is emitted.

## Conflict taxonomy and deterministic plan

| Conflict | Meaning | Effect |
|---|---|---|
| Missing object | Reference has no corresponding existing object | Blocks eligibility |
| Contradictory references | Conflicting versions or duplicate object metadata disagree | Blocks eligibility |
| Generation mismatch | Reference generation differs from object generation | Blocks eligibility |
| Metageneration mismatch | Reference metageneration differs from object metageneration | Blocks eligibility |
| Invalid record | Malformed path, record or version | Rejected before planning |

Manifest SHA-256 covers canonicalized inventory. Plan SHA-256 covers version, manifest digest, exact counts and conflict summary. No timestamp enters either digest. Changed input changes the manifest digest; tampered counts/conflicts fail plan verification.

## Zero-mutation and zero-leak guarantees

Every plan explicitly contains \`storageMutations=0\` and \`databaseWrites=0\`. The pure module imports only Node SHA-256; no Firebase/GCS/Firestore SDK, network, database, filesystem, or mutation adapter.

Never log input records, exception objects from SDKs, UIDs, object paths, download URLs, token values, generation/metageneration values, or raw metadata. Errors are static. Output contains only aggregate counts, conflict categories, and digests.

## Independent approvals before any future live operation

No live operation is authorized. A separately reviewed proposal must obtain exact-digest and exact-target approvals:

1. **AppSec:** threat model, ownership/path validation, token exposure, least privilege, replay/idempotency, rollback.
2. **DPO:** lawful purpose, minimization, retention, DSGVO Art. 5/9/17 impact, deletion and hold handling.
3. **SRE:** target project/bucket identity, backup/recovery, version preconditions, rate limits, monitoring, stop and incident rollback.
4. **Release Owner:** separate written authorization for exact environment, cohort, digest, time window and operation.

The verifier models independent APPSEC/DPO/SRE approvals with distinct reviewer IDs, exact digest binding and expiry. It does not authenticate identities or establish legal approval. Release Owner authorization remains additional. Any live execution requires a separate PR and explicit user authorization.

## Test and command

- \`npm run test:profile-media-token-dry-run\` runs synthetic Node test fixtures only.
- \`npm run check:enterprise\` includes the suite.
- Coverage: deterministic digests, zero mutation assertions, legacy token metadata, already-absent metadata, missing objects, contradictory references, generation/metageneration conflicts, stale/tampered plans, missing/invalid approvals and synthetic UID/path/URL/token redaction.

**Explicit exclusions:** no \`server.ts\`, global middleware, route mounts, active Rules, \`firebase.json\`, \`complianceStorage.ts\` interlock, workflows, dependencies, lockfiles, live bucket inventory, live token revocation, \`photoURL\` migration, real PII/UID/token, or Cloud/IAM/Firestore/Storage/deployment changes.
