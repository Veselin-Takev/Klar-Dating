# RC isolation closure — 2026-11-08

Status: review candidate; baselineFixed=false, productionApproved=false.

## Supported boundary

The RC has UID-rooted paths and no complete tenant resolver. Tenant-bearing
identities must therefore fail closed. The protected Express auth middleware
now rejects Firebase firebase.tenant and custom tenantId/tenant_id markers,
including empty/null markers, before any UID-based database access. Firestore
and Storage signed-in predicates reject the same markers. Default-namespace
users retain the existing ownership and discoverability rules.

This is containment, not a certified multitenant implementation. Named tenants
are unsupported. Admin SDK, signed internal jobs and independently deployed
services require their own tenant resolution and IAM proof. Public discovery
is still product-policy controlled and is not reclassified as private data.

## Deterministic evidence added

- Claim validator: default namespace positive and seven ambiguous/tenant negatives.
- Native Firestore rules: same UID from two Firebase tenants, custom tenant aliases,
  rejected private reads, mutations and nested creation, with default-owner positive.
- Real Auth emulator custom tokens: authenticated existing owner plus tenant marker
  denied at account, chat and subscription API mounts without chat-data leakage.
- Native Storage: two tenant collisions cannot read, overwrite, delete or upload
  verification media for the same UID; default namespace still succeeds.
- Dedicated npm run test:rules now mandatory in CI in addition to full emulator tests.

Critical runtime src Auth/middleware/payment/server modules have no explicit any
AST nodes in the existing inventory after #356. Test doubles elsewhere retain
explicit any; no repositorywide Zero-any assertion is made.

## Consolidation and deployment

Parent e30d11e2 contains #356 and #357 linearly; no conflicting merge or local
reset is required. This child includes their complete history. Actual merges
remain pending review; none are performed by this audit.

Read-only Vercel inspection verified deployment dpl_DdvnDZMi63XzUdsXwmJmUuzi4v4b
READY for code 7c63dfc057394b43327b1b153817ef0fad3d5290:
https://klar-dating-68w2a59t1-ves3.vercel.app
The prior rate-limit warning does not block this existing preview. The changed
code requires fresh build/emulator evidence; READY alone is not API proof.

A finite negative suite cannot establish 100% impossibility of BOLA/IDOR.
Full application tenant migration, deployed Rules/IAM and external writer
inventory remain certification blockers. baselineFixed must remain false.

## Verified isolation containment — 2026-11-08

Code SHA `4dc39cd5c760ae15459836e541aa3c139ad4323a`; full
[CI 42478659998](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42478659998): SUCCESS.
1,415 Vitest + 86 Enterprise Node + 26 Playwright = **1,527 PASS** across these
nonoverlapping suites. Dedicated npm run test:rules: 92 PASS, repeated cases
already included in Vitest, not added again. Typecheck, Functions/App build,
production smoke and static Enterprise gates PASS. Tenant claim validation,
real-token API refusal and native Firestore/Storage tenant-collision cases executed.

#356 and #357 are conflict-free and included in #358; they remain unmerged.
Vercel preview for prior code 7c63dfc0 is READY; the new preview is rate-limited.
The current code's successful CI production build provides independent build proof.

**Full tenant certification NOT GRANTED; baselineFixed=false, productionApproved=false.**
Named tenants are denied rather than resolved. External Admin SDK/deployed
Rules/IAM, complete tenant migration, universal schema/reachability and remaining
Zero-any requirements are not certified. Finite negative tests cannot prove
100% impossibility of BOLA/IDOR. No CERTIFIED_PROCEED and no feature release.

## Claims / request-context and Admin boundary completion attempt

resolveVerifiedTenantContext uses Zod for UID shape, rejects unsupported tenant
claims and creates an immutable default-namespace principal. requireAuth calls
it only AFTER revocation-aware Firebase token verification, before DB access;
request body/query/header tenant identifiers are never passed to this resolver.
currentUserId rejects a mismatch between verified context and req.user UID.
A real-token HTTP test forges header/query/body owner and tenant identifiers
and verifies that the native Admin-SDK checklist write modifies only the owner.

A separate real-emulator characterization shows that raw Admin SDK CAN read
both synthetic owners. This is expected privilege behavior and demonstrates
why Rules PASS cannot certify external Admin SDK access. Signed internal jobs,
Functions and external privileged writers are outside the authenticated Express
request context; they require scoped IAM and an independently reviewed writer
inventory. These are remaining blockers, not evidence to relabel as PASS.

## PR consolidation

PR #358 is the single lead PR targeting release/v0.1.1-rc1. #356 and #357 are
superseded/consolidated by #358; their complete commit histories are preserved.
No merge, branch deletion or force push is performed. Documentation evidence
branch is synchronized forward alongside the lead branch.

## Finalizing evidence — 2026-11-08

Lead PR #358 targets release/v0.1.1-rc1 directly and consolidates/supersedes
#356 and #357, including all code and evidence commits without deletion or reset.

Full [CI 42479679094](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42479679094)
SUCCESS on code SHA `f8f6fa59f2129e7f174204449b6b9f384939a3f6`:
1,424 Vitest + 86 Enterprise Node + 26 Playwright = **1,536 PASS**.
Dedicated Firestore Rules: 92 PASS, repeated cases not added. Typecheck,
Functions build, App build and production smoke PASS. Nine new tests relative
to the preceding 1,527 baseline verify immutable context/UID validation, actual
owner-bound Admin-SDK API writes despite forged request fields, and raw Admin
SDK privilege characterization.

Scoped claims-to-context resolution: PASS. Native Rules and protected API
owner-bound checks: PASS. Full system tenant certification: NOT GRANTED.
The raw Admin SDK can read both synthetic owners and bypasses Security Rules.
External service accounts, Functions/internal jobs and deployed IAM/Rules
have not been independently inventoried and verified. Named tenants remain
unsupported; rejecting their tokens is containment, not tenant provisioning.

**baselineFixed=false; productionApproved=false. No CERTIFIED_PROCEED.**
This final metadata update refers explicitly to the immutable tested code SHA;
its own automatic CI is separate from the completed code run above.
