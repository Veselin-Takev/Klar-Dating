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
