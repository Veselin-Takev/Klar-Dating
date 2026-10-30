# ADR — P1 #204: Profile media access must use server-owned adult and active-account state

Date: 2026-10-30
Status: **DRAFT / STACKED ON #203 / REVIEW REQUIRED / PRODUCTION NO-GO**

## Source-verified finding

The current Firebase `storage.rules` permits `allow read: if signedIn();` for `profiles/{uid}/{datei}`; signed-in unknown-age and underage accounts can pass the *source* condition. The in-memory `storageRulesEngine.ts` instead expects an optional `token.isAdult` claim, which the audited `processAgeVerification` does not issue. The authoritative state already exists: server-side `users/{uid}.isAdult` and `accountStatus` (active or locked_underage/pending). The Firestore client create/update rules do not allow promotion of `isAdult` by the user. Therefore rules, model and CI tests contradicted one another.

## Implementation and security decision

In Firebase Storage Rules, a `istAktiverErwachsener(uid)` helper reads **server-owned** `users/{uid}` in the **default Firestore database** with `firestore.get(...)`; require exactly `isAdult == true` and `accountStatus == 'active'` on both reader and target owner for profile read. Require current owner's adult+active state for create/update/delete, in addition to existing non-anonymous owner, image-type and strict size checks. Missing/unknown/locked/deleted account states fail closed. **No `token.isAdult` claim**, no client-editable `age` / `birthdate` privilege input. No changes to `verification/` biometric write lock from PR #203. This patch changes source policy only; any non-compatible older account remains restricted until server-side adult status is repaired through approved re-verification.

A Storage Rules request may access at most two distinct Firestore documents; profile-read uses requester and owner, owner-write uses one. Cross-service Rules reads consume Firestore quota/billing, work only with the default Firestore database, and require cross-product IAM authorization on actual deployment. These operational constraints require staging and SRE/Finance approval before deployment. See official Firebase Storage Rules reference and conditions guide.

## Test/evidence plan

- Static `scripts/check-profile-storage-authz.mjs` is mandatory within `check:enterprise`: enforce explicit requester+owner gates, canonical age writer and absence of stale JWT claim enforcement.
- Real `tests/storageRules.spec.ts` in the Auth/Firestore/Storage emulator trio seeds **server-owned** age and account states and checks permitted adult reader/owner write, denied unknown/underage/pending/deleted/guest readers, missing-profile and forged-claim negative cases, target-age isolation, owner-only delete, and strict write boundaries. Existing biometric `verification/` tests remain.
- In-memory `tests/enterprise/storageSecurityRules.spec.ts` is aligned with server-resolved requester and target state, and **cannot** substitute for emulator results.
- CI exact-HEAD TypeScript/Functions/build/E2E and the dedicated Storage Emulator suite must pass before any merger consideration; no staging or production mutation is authorized.

## Limitations and release blockers

The `accountStatus` writer paths, blocked-user relationship policy and actual deployed IAM/rules must be reviewed with Privacy and Product. Storage Rules do not govern Admin SDK access, signed URLs, previously-issued Firebase download tokens, browser caches, CDN copies or GCS IAM; those require separate threat modeling and revocation controls. Service-owned `isAdult` represents the current age gate, not independent documentary KYC proof. Deploying cross-service `firestore.get` conditions may require enabling service permissions in the Firebase project. Validate both missing-account fail-closed and allowed adult access in an approved staging project; inventory user age migrations and old installed app versions, obtain formal Security, DPO/Legal, SRE, Finance and Release Owner signoffs.

**P1 #204 remains OPEN / PRODUCTION BLOCKED / NO-GO.**

## CI regression and targeted fix (2026-10-30)

The initial exact-head [Enterprise CI #41011278498](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41011278498) on `76e7bacebc4ce1957fc96cc67a18593742dc2a7a` **FAILED** in TypeScript tests at `storageRules.spec.ts:105–109`: Firebase `UploadTask` is thenable but does not satisfy the test helper's `Promise` type. The five new negative `put()` assertions now use `Promise.resolve(UploadTask)`, matching existing emulator test conventions. This was a **test helper type mismatch**, not evidence of rule authorization PASS. Full exact-HEAD CI and actual positive/negative Storage Emulator outcomes must be re-evaluated after the fix. Production NO-GO.

## CI syntax correction (2026-10-30)

The second [Enterprise CI #41011509901](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41011509901) on `a905e8285269752d4dd7a26e5a8001c614b8c121` **FAILED** in the TypeScript parser, `TS1005 ')' expected` on the same five assertions at lines 105–109. The previous wrapper edit had introduced `Promise.resolve(...)` but omitted the closing `assertFails` parenthesis. This corrective commit adds **only** the missing five closing parentheses to the test code, with no Storage Rules or application policy change. An exact-head clean CI run is required; **no passing emulator evidence on this patch exists yet**. Production NO-GO.
