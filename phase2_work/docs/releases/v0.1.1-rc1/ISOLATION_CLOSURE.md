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
