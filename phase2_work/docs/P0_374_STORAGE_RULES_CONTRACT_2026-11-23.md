# P0 #374 Package 3 — Isolated Candidate Storage Rules Contract

**Baseline:** `main@6f3f4f6ed8662ece91e4522d5c6dbb29abc015f7` (Tree `726effe0ec7f70d1039ed531a299504a281fecb4`; PR #406 merged).
**Branch:** `security/p0-374-package3-storage-rules-contract-20261123`; Draft PR number and final HEAD are held in GitHub metadata.
**Status:** Offline, hermetic candidate contract only; not an active Firebase Rules deployment.
**Release invariant:** P0 #254 and P0 #374 remain **OPEN**; `productionApproved=false`; production **NO-GO**.

## Boundary and design

The candidate artifact `phase2_work/storage.p0-374-candidate.rules` is intentionally not referenced by active `firebase.json`. It denies every direct client read and write, including all `profile-media/v1/` object paths. It has explicit legacy UID-root denials and a recursive default-deny catch-all. There is no public, authenticated, owner, tenant, or admin client fallback.

This is deliberately stricter than a tenant-aware client Storage policy: the Package 1 server delivery contract is the only intended profile-media read path. Its authorization prerequisites include authenticated non-guest requester, adult and age-verified status, consent, active/non-deleted target, verified-adult target, and bilateral non-block. Candidate Storage Rules do not duplicate or replace those server-side checks. Tenant and ownership authorization for any future server-side object mapping must be independently evidenced before cutover.

## Critical limitation: persistent download tokens

Firebase Storage Rules do not invalidate an already-issued Firebase download-token URL. A token-bearing URL can be used outside the normal Rules authorization path until the token is removed/rotated or the object is otherwise made unavailable. Therefore:
- This candidate Rules artifact denies new direct client Storage SDK reads.
- It does **not** claim to revoke or neutralize pre-existing token URLs.
- Package 2 remains an offline inventory and dry-run plan only; no live inventory or revocation is authorized here.
- Any future token revocation requires a separately approved, independently reviewed, auditable operational change.

## Threat / denial matrix

| Threat or request | Candidate result | Enforcement boundary |
|---|---|---|
| Unauthenticated / anonymous / guest direct read | DENY | Catch-all + explicit media deny |
| Underage / unverified adult direct read | DENY | All direct reads denied; server eligibility remains Package 1 |
| Cross-tenant read or write | DENY | All direct client operations denied |
| Non-owner read or write | DENY | All direct client operations denied |
| Bilateral block in either direction | DENY | Server delivery policy in Package 1; no direct client read |
| Deleted / deactivated account | DENY | Server delivery policy in Package 1; no direct client read |
| Canonical opaque `profile-media/v1/` direct read/write | DENY | Explicit candidate match |
| Malformed, traversal, encoded traversal or legacy UID path | DENY | No allow rules; canonical-path contract rejects malformed identifiers |
| Persistent download-token URL | NOT A RULES REVOCATION CONTROL | Existing URL bypass requires separately approved token revocation |
| Any undefined object path | DENY | Recursive catch-all |

## Offline Vitest contract

Run from `phase2_work/`:

```bash
npm run test:profile-media-storage-rules-contract
```

The suite uses `describe`, `it` and `expect` from Vitest. It uses synthetic strings and local file reads only. It does not import `node:test`, initialize Firebase SDKs, start Java, require Firebase Emulator binaries, or contact a Firebase project.

The suite covers default deny, direct reads/writes, authentication/guest/adult/tenant/owner/block/account denial scenarios, malformed and legacy paths, traversal and encoded traversal, token-URL rejection as an object path, candidate isolation, and a Git-blob SHA check proving `phase2_work/storage.rules` remains byte-identical to the authorized base (`318fd66f58c6db78c69fabb9d472874d67692fef`).

This is a deterministic source/policy contract test, not a Firebase Rules emulator proof. Firebase Rules parser/runtime semantics still require a separately approved emulator or staging validation before any future activation.

## Isolation and exclusions

- Active root and `phase2_work/` `storage.rules`, `firestore.rules`, and `firebase.json` are not changed.
- No change to `phase2_work/server.ts`, global middleware, production route mounts, or `src/server/routes/complianceStorage.ts` (503 interlock).
- No changes to `.github/workflows/`, Vitest configuration, dependencies, package lockfiles, or other lockfiles.
- No live bucket inventory, token revocation, `photoURL` migration, Cloud/IAM/Firestore/Storage/deployment mutation.
- No real PII, UID, token, URL, bucket metadata, or credentials.
- Only the `scripts` object in `phase2_work/package.json` is changed: one Vitest command is registered and wired into `check:enterprise`.

## Required independent approvals before any future cutover

1. **AppSec:** review threat model, Rules semantics, cross-tenant and token-bypass behavior, and independent negative tests.
2. **DPO:** review purpose limitation, age/verification processing, retention, Art. 17 deletion implications, and legal basis.
3. **SRE:** verify operational ownership, rollback plan, monitoring, incident response, and a separately authorized non-production validation path.
4. All approvals must identify the exact candidate commit/tree and expire or be invalidated when that evidence changes.

No approval is inferred from this Draft PR or green CI. P0 #254 and P0 #374 remain OPEN; `productionApproved=false`; production remains NO-GO.
