# Package D — Profile Media Data Migration & Staged Token Revocation Plan

**Status:** Architecture / scoping only — no execution authorized  
**Issues:** #374, #206  
**Historical parent:** PR #382 — Package C (merged to main; see current state in §8)  
**Parent branch:** `security/issue-374-package-c-upload-cutover-20261118`  
**Parent commit:** `3e7a8e53ffdc2355906006afa7a89f9294cce006`  
**Parent CI:** Enterprise CI Run #2146 (`44302073866`) — completed, success  
**Package D branch:** `security/issue-374-package-d-migration-strategy-20261118`

---

## 1. Executive objective and scope

Package D is intended to plan a backward-compatible migration of existing profile media references from Firebase download-token URLs to canonical opaque references, followed by a controlled staging-only exercise that removes the `firebaseStorageDownloadTokens` custom metadata key from selected test objects.

The target reference format is:

```text
klar-media:v1:<base64url("profiles/{uid}/{objectName}")>
```

The opaque reference is an identifier, not an authorization credential. Every read must continue through the authenticated profile-media proxy and its current requester, target, lifecycle, ownership, MIME-type and size checks.

This document is a design and execution-gate proposal only. It adds no migration worker, no metadata mutation command, no cloud configuration, and no staging or production action.

### In scope for a future implementation

- Inventory and classification of existing records using `photoURL`, `photoUrl` and, after schema confirmation, entries in `photos[]`.
- Backward-compatible conversion of unambiguous, owner-scoped legacy references to canonical opaque references.
- A staging-only dry-run and separately approved canary revocation protocol for Firebase download-token metadata.
- Verification that old token URLs stop authorizing downloads while the authenticated proxy continues serving permitted media.
- Recovery, audit and stop conditions.

### Explicitly out of scope

- Production migration or production token revocation.
- Object deletion, replacement, rename, copy, lifecycle-policy or retention changes.
- Changing Storage Rules, IAM, bucket policy, deployment configuration or Firebase project settings.
- Generating new public download URLs or reintroducing download tokens as a rollback mechanism.
- Migrating verification/KYC media or any non-profile object prefix.
- Removing legacy read support before all relevant consumers and records have been reconciled.

**Release invariant:** `productionApproved=false`; production remains NO-GO.

---

## 2. Verified Package C baseline and current contracts

The plan is based on Package C commit `3e7a8e53ffdc2355906006afa7a89f9294cce006`, verified by Enterprise CI Run #2146 (`44302073866`).

The baseline provides:

1. `ladeProfilfotoHoch()` writes to the owner-scoped `profiles/{uid}/...` path and stores a canonical opaque reference in `users/{uid}.photoURL`; it does not call `getDownloadURL()`.
2. `createCanonicalProfileMediaRef()` and `parseCanonicalMediaRef()` enforce the canonical prefix and owner-scoped path convention.
3. `normalizeProfileMedia()` recognizes canonical references and retains transitional legacy path/URL normalization.
4. `/api/profile-media/self` derives the target UID from a verified Firebase ID token; the public route requires authenticated authorization for a distinct target.
5. The proxy checks revocation during ID-token verification, account lifecycle/deletion state, object existence, image MIME type and size, and streams with private/no-store headers.
6. Storage Rules deny direct client reads under `profiles/{uid}/{file}`.
7. Package C's inventory core/CLI is read-only and emits aggregate counts rather than UIDs, document IDs, paths, URLs, raw metadata or token values.

The existing inventory scans the `users` and `public_profiles` collections and recognises the aliases `photoURL`, `photoUrl` and `photos[]`. Its current scope detects Firebase/GCS download URLs on the configured host allowlist when a non-empty `token` query parameter and an owner-scoped object path can be extracted. Therefore, an inventory count of zero is evidence only for the scanned collections, aliases, hosts and URL shapes; it is not proof that no copied URL exists outside Firestore or no unscanned legacy consumer remains.

Before implementation, re-read the exact parent commit and revalidate these contracts. A changed parent head requires a new baseline review and updated plan.

---

## 3. Database migration strategy

### 3.1 Data model and identity rules

Candidate source collections:

- `users/{uid}`
- `public_profiles/{uid}`

Candidate fields:

- `photoURL`
- `photoUrl`
- `photos[]` (only if product/schema owners confirm it remains an active profile-media alias)

The UID must come from the Firestore document identity and be independently checked against the media path. Do not trust a UID, owner, or object path supplied by a browser request or embedded without validation in a profile field.

For a legacy URL, the migration parser must:

1. Accept only the explicitly reviewed Firebase Storage/GCS download URL host allowlist.
2. Require a non-empty `token` query parameter for the bearer-URL classification.
3. Decode the object path exactly once; reject malformed percent encoding.
4. Require the path prefix `profiles/{documentUid}/` and reject traversal, empty segments, backslashes and malformed paths.
5. Never copy the URL or token into application logs, standard output, analytics or ordinary migration receipts.

Raw storage paths, malformed URLs, unknown hosts, wrong-owner references and ambiguous records must be classified separately. They must not be silently converted. Canonical references must be parsed with the existing canonical parser and must decode to the same document owner's path.

### 3.2 Classification before writes

Run the Package C inventory in explicit read-only mode and create a restricted migration assessment. Each profile media field is classified as one of:

| Classification | Required action |
|---|---|
| Already canonical and owner-valid | No-op; verify object and proxy contract |
| Legacy URL, owner-valid, object exists | Eligible for conversion |
| Legacy URL with wrong owner / invalid encoding | Quarantine for manual resolution; no write |
| Referenced object missing | Quarantine; no write |
| Same field aliases resolve to different objects | Conflict; no automatic winner |
| Unsupported host or URL form | Unresolved; no write |
| Empty / absent media field | No-op |
| Canonical ref with invalid owner/path | Quarantine; no write |

Before an eligible record is admitted, fetch object metadata and verify object existence, expected `profiles/{uid}/` ownership, allowed image content type (`image/jpeg`, `image/png`, `image/webp`) and the proxy size bound (greater than zero and below 8 MiB). Metadata is only an input to validation; do not expose its raw value in reports.

If `photoURL` and `photoUrl` disagree, do not choose one based on recency or field casing. Require a documented schema rule or operator-reviewed resolution. Preserve the order and cardinality of `photos[]`; convert only entries that independently pass validation. Do not silently drop duplicates or unresolvable entries.

### 3.3 Backward-compatible migration phases

**Phase DB-0 — Compatibility freeze**

- Confirm every deployed server/client reader involved in profile display can consume `klar-media:v1:` and route image reads through the authenticated proxy.
- Confirm the old writer has been retired or blocked by an explicit compatibility gate; new uploads must continue to write canonical references only.
- Keep the existing legacy-read path enabled during the staged conversion window.
- Define the minimum safe rollback release: it must understand canonical references. Rolling back to a build that treats the canonical value as a download URL is prohibited.

**Phase DB-1 — Read-only preflight**

- Run the existing inventory against an explicitly selected staging project/bucket first.
- Record aggregate counts, inventory timestamp, project/bucket identity, inventory tool commit, page counts and a digest of the non-secret run manifest.
- Build a restricted candidate set from the read-only scan. Do not publish raw UIDs, document paths, URLs, object paths or token values in the summary.
- Compare the candidate set with the latest inventory and stop on unexpected count drift, incomplete pagination, permission errors or ambiguous records.

**Phase DB-2 — Dry-run migration plan**

- Produce a deterministic per-record action plan without writing Firestore.
- For each eligible field, compute the canonical reference from the validated owner-scoped object path using the same v1 base64url representation as the shared helper.
- Include expected source-field state, destination canonical value digest, document/field classification, object generation/metageneration evidence and a compare-and-set precondition in the protected execution manifest. Do not include raw token values or full legacy URLs in normal logs.
- Count planned updates, no-ops, conflicts, unresolved records and missing objects. The totals must reconcile with the read-only inventory.

**Phase DB-3 — Staging migration canary**

- Apply only to a dedicated staging dataset and a small, explicitly allowlisted cohort.
- Update only fields whose values still equal the preflight source values. Use a Firestore transaction or equivalent compare-and-set guard so a concurrent profile edit is never overwritten.
- For records with both aliases, update only the aliases defined by the approved schema contract; do not add duplicate fields merely to make totals look consistent.
- Preserve all unrelated Firestore fields. Never replace an entire document from a stale export.
- Make the operation idempotent: already-canonical values are no-ops; changed source values are conflicts requiring a fresh read and new plan.
- Process bounded batches with checkpoints. A batch failure must leave already committed records individually identifiable by a protected, non-secret receipt and allow safe resume without replaying successful changes.

**Phase DB-4 — Staging reconciliation**

- Re-run the inventory and independently count canonical, legacy, unresolved, missing and conflicted references.
- Verify every migrated canonical value decodes to an object owned by the document UID and the object passes the proxy's MIME/size/existence checks.
- Exercise authenticated proxy reads for migrated records and negative authorization/lifecycle cases.
- Do not proceed to token revocation while any in-scope record remains unresolved or any supported consumer still requires a legacy bearer URL.

### 3.4 Write semantics and audit

The future migration worker should use explicit allowlisted collection/field paths, bounded page/batch sizes, strict input validation and a documented dry-run default. An execution flag must not be inferred from environment variables alone.

Required audit evidence:

- Exact source commit, migration tool version and configuration digest.
- Explicit staging project and bucket identity.
- Start/end time and bounded batch identifiers.
- Aggregate counts for planned, changed, skipped, conflicted and failed records.
- Per-record recovery checkpoint in a restricted audit store, using the minimum identifiers needed for reconciliation.
- No raw URLs, Firebase download tokens, image bytes, access tokens or unrestricted profile documents in logs.

A mismatch between preflight and execution state is a skip-and-review condition, never a blind overwrite.

---

## 4. Staged token revocation strategy

### 4.1 Safety prerequisites

No metadata removal may be attempted until all of the following are true in the selected staging environment:

- The migration canary has completed and passed independent reconciliation.
- Every in-scope media field is canonical or explicitly excluded with an approved reason.
- The application under test is the Package C-compatible proxy implementation.
- New upload writers no longer generate or persist download-token URLs.
- Direct Storage reads remain denied by Storage Rules.
- The staging project ID and bucket are explicitly allowlisted and independently displayed before execution.
- The selected object set is a small, dedicated test cohort with no production data.
- A fresh metadata read and object generation/metageneration value have been captured for each candidate.
- A separate change approval authorizes metadata mutation in staging. This Package D planning PR does not grant that authorization.

### 4.2 Dry-run protocol

The first staging revocation command must be dry-run only. It must:

1. Accept an explicit staging project, bucket and exact allowlisted object cohort.
2. Reject production-like project IDs, unexpected buckets, emulator/live-mode ambiguity and missing explicit confirmation.
3. Read each object's current metadata and capture generation/metageneration.
4. Report only counts: objects selected, token metadata present, already absent, missing, changed-since-inventory and rejected.
5. Produce the exact intended action manifest in a restricted location without revealing token values.
6. Perform zero metadata writes and zero object data writes.

The dry-run must prove that the planned target set is exactly the approved cohort. Any mismatch is a hard stop.

### 4.3 Controlled staging canary

After a separate staging execution approval:

1. Re-read metadata immediately before the change.
2. Confirm the object's current generation and metageneration still match the approved manifest. If not, stop for that object and re-plan.
3. Remove only the custom metadata key `firebaseStorageDownloadTokens`; preserve content type, cache control, custom metadata unrelated to the token, object contents, generation and all unrelated metadata.
4. Use the Cloud Storage metadata patch semantics with a metageneration precondition. For the Node.js Cloud Storage client, the documented pattern is `file.setMetadata({ metadata: { firebaseStorageDownloadTokens: null } }, { ifMetagenerationMatch })`. The SDK documents that assigning `null` unsets a custom metadata key. This exact behavior must still be exercised against the pinned dependency version and staging emulator/project before expanding the canary.
5. Re-read metadata and verify that the token key is absent. Never print the previous or resulting token values.
6. Treat a precondition conflict as a stop/reconcile event; do not blindly retry with a refreshed precondition.
7. Treat already-absent metadata as an idempotent no-op only after the object identity and current metadata have been revalidated.

The operation must never use an object rewrite, copy, upload, delete, rename or broad metadata replacement. Only the one approved custom metadata key may be removed.

### 4.4 Functional verification after each canary

For every staging test object:

**Legacy bearer URL path**

- Use a synthetic, staging-only Firebase download URL captured before revocation.
- After removal, request that exact old URL in a controlled test client.
- Require a non-success response and verify that no image bytes are returned.
- Do not log or persist the URL/token in CI artifacts.
- Repeat with cache bypass and a fresh client. A previously downloaded or cached copy cannot be recalled by token revocation; document that limitation in the test report.

**Authenticated proxy path**

- Use a valid, non-anonymous staging Firebase ID token.
- Request the corresponding canonical media reference through the profile-media proxy.
- Require HTTP 200, expected image content type, expected byte length/hash and private/no-store response headers.
- Verify the stream returns the unchanged original object bytes.
- Confirm the proxy uses the object path resolved from the canonical reference, not a legacy URL.

**Negative authorization tests**

- Missing/invalid/revoked ID token: 401.
- Anonymous requester: 403.
- Requester/target inactive, blocked, suspended, deleted or deletion-marked: fail closed using the endpoint's defined 403/404 behavior.
- Cross-owner canonical reference, malformed ref, traversal path or unknown object: non-success.
- Direct client Storage SDK read: denied by Storage Rules.

Do not interpret the legacy URL failure alone as proof that the proxy works; both sides must be independently tested.

### 4.5 Staged expansion criteria

Only after the canary has passed may a separately approved staging batch be considered. Expand in bounded cohorts and reconcile after every batch. Stop immediately on:

- any authorized proxy read failure;
- any legacy URL that still returns media bytes;
- any direct Storage client read that succeeds;
- any wrong-owner or lifecycle-gate bypass;
- any unexpected metadata mutation beyond the single token key;
- any metageneration conflict, inventory drift, missing object, unexpected cache result or audit-count mismatch.

No production cohort or production revocation is covered by this plan. Production would require a separate release manifest, independent security/privacy review, explicit change authorization, operational window, monitoring and rollback sign-off.

---

## 5. Rollback and immutable safety procedures

### 5.1 Invariants

1. **Object immutability:** migration and token revocation never delete, replace, rewrite, move or rename profile objects.
2. **Canonical reference durability:** once a record is converted, its canonical reference remains a valid identifier even if the old bearer token is revoked.
3. **No bearer restoration:** rollback must never recreate or restore `firebaseStorageDownloadTokens`, regenerate public URLs, or reinsert legacy token URLs into Firestore.
4. **Minimum compatible application:** rollback may move only to a build that understands canonical refs and serves images through the authenticated proxy. A pre-canonical reader is not an acceptable rollback target.
5. **No blind reverse migration:** do not convert canonical refs back into legacy download URLs. The object path is recoverable from a validated canonical ref; the bearer capability is not required for recovery.
6. **Per-record atomicity:** if the compare-and-set source value changed, skip that record and reconcile; do not overwrite concurrent user changes.
7. **Fail closed:** if the proxy or authorization dependency is unavailable, do not fall back to direct bearer URL serving.

### 5.2 Recovery scenarios

| Failure point | Recovery |
|---|---|
| Before any Firestore write | Stop; no data rollback required |
| During migration canary | Resume from protected checkpoints; already-canonical records are no-ops |
| Firestore conflict / user changed field | Skip record, re-read and produce a new candidate plan |
| After Firestore migration, before token removal | Keep canonical refs; restore service using a Package C-compatible proxy build; legacy values may remain only on records not yet converted |
| During token metadata removal | Stop the cohort; inspect each object with a fresh read; do not assume partial batch state |
| After token removal | Keep canonical refs and proxy path; do not restore the old token or URL; use a compatible proxy build and repair the proxy issue |
| Proxy regression | Roll back proxy application code only to a previously validated canonical-ref-compatible build; keep direct reads denied |

The migration should preserve the original Storage object generation and content. It does not need a copy of a bearer URL as a rollback artifact. If a record cannot be resolved safely, leave it unchanged and keep that record out of the revocation cohort.

### 5.3 Operational stop and escalation

Every execution batch must have a single operator, a separate reviewer and a written stop authority. On a stop condition:

- stop scheduling new records/objects;
- do not auto-retry metadata mutations;
- retain non-secret evidence and exact per-object state in the restricted audit store;
- verify whether the last attempted operation committed by reading metadata;
- reconcile Firestore and Storage independently;
- escalate before resuming.

---

## 6. Required implementation packages and acceptance gates

The following work is proposed for the separate E2 implementation PR and is not part of this documentation-only plan or E1 PR #394.

| Gate | Required evidence |
|---|---|
| D-A — schema contract | Field ownership, alias precedence, public-profile mapping and photos-array decisions approved |
| D-B — migration dry-run | Deterministic plan, owner validation, missing/conflict classification, count reconciliation |
| D-C — migration emulator tests | Compare-and-set conflict, idempotency, pagination, partial batch and resume tests |
| D-D — staging migration canary | Explicit staging identity, bounded cohort, post-migration reconciliation |
| D-E — revocation dry-run | Exact allowlist, metadata preconditions, zero writes, redacted report |
| D-F — staging revocation canary | One-key removal, metageneration guard, metadata absence proof |
| D-G — dual-path verification | Old URL fails; authorized proxy streams unchanged media; all negative authorization tests fail closed |
| D-H — rollback drill | Recovery to a canonical-compatible proxy build without restoring bearer tokens |
| D-I — independent review | Security, privacy, backend and release-owner approval; exact-head Enterprise CI PASS |

No gate is satisfied by this plan alone. CI success on this documentation-only PR will not prove migration correctness or authorize revocation.

---

## 7. Security, privacy and observability requirements

- Treat Firebase download URLs as bearer capabilities and avoid placing them in logs, analytics, issue comments, screenshots or unrestricted artifacts.
- Do not output raw `firebaseStorageDownloadTokens` metadata. Count presence/absence only.
- Minimize personal data in receipts; store detailed record-level reconciliation only in access-restricted, short-retention operational evidence.
- Do not log image bytes, image hashes tied to a user's identity, authorization headers, Firebase ID tokens or full Firestore documents.
- Keep proxy cache policy private/no-store; never introduce a public CDN or browser-cache fallback as part of migration.
- Maintain the existing adult/active/lifecycle/deletion and block checks.
- Monitor aggregate proxy success/denial/error counts and migration counters only; do not add profile identifiers to general telemetry.

---

## 8. Approval boundaries and current status

This document authorizes planning only. It does not authorize any Firestore write, Storage metadata patch, staging execution, production execution, project selection, IAM change or deployment.

Current package state (superseding the original planning-time PR lifecycle):

- PR #380 / Package A merged to main at `ae56d2390fae9d4512a01e1607943fac1ab60f96`.
- PR #381 / Package B merged to main at `5d6f2e9972111d23d64f1df4af43f0ac475fdfd3`.
- PR #382 / Package C merged to main at `30690f549f7eac1b925076b1227ee5508845eae2`; its read-only inventory does not perform migration.
- PR #383 / Package D merged to main at `1b30ea60dc9acab31020533fd55ba1cf69feaf33`; this remains a planning document only.
- E1 is the separate Draft PR #394 for Storage Rules/pure-model parity, authenticated UI consumers, diagnostics/Helmet and the static guard. Its base is `main` at `30250a1fc82f24834c7ada62f8453df04af20f2a`; its own exact-head checks remain [TO VERIFY].
- E2 will deliver the migration and token-revocation CLI implementation for P1 #206 in a separate reviewed PR. No migration worker or revocation executor is included in E1.
- Production: `productionApproved=false` — NO-GO.
- No live cloud resources, Storage objects, download-token metadata, IAM or deployments are mutated by this plan or E1.

**Next authorization boundary:** E2 implementation requires its own reviewed feature PR. Any staging mutation requires explicit staging-only approval. Any production migration or token revocation requires a separate explicit production authorization and release decision.

---

## 9. Official technical references

- [Google Cloud Storage — View and edit object metadata](https://docs.cloud.google.com/storage/docs/viewing-editing-metadata): custom metadata keys can be removed by patching the key with `null`; the documented Node.js example uses `ifMetagenerationMatch` to avoid metadata races.
- [Google Cloud Storage Node.js client — File.setMetadata](https://googleapis.dev/nodejs/storage/latest/File.html): documents merge behavior and `null` as the value to unset previously set metadata.
- [Firebase Storage Android API — getDownloadUrl](https://firebase.google.com/docs/reference/android/com/google/firebase/storage/StorageReference): describes long-lived download URLs as tokenized and revokable.

These references describe platform behavior. Package D must validate the exact pinned SDK behavior and the observed Firebase download-URL behavior in the selected staging environment before any approved rollout.
