# Enterprise Integration Rehearsal — P0 #202 Retention × P0 #254 Tenant Boundary

**Date:** 2026-11-01  
**Branch:** `integration/p0-202-254-gate-convergence-20261101`  
**Base:** unmerged P0 #202 [Draft #280](https://github.com/Veselin-Takev/Klar-Dating/pull/280), exact SHA `4f53bcfef9d31ddbd9672465b2362ee1f7d726ac`, full [CI #41336278230](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41336278230) **SUCCESS**, including **six executed** Firestore Emulator tests and full build/smoke/browser checks.  
**Independent tenant source:** unmerged P0 #254 [Draft #268](https://github.com/Veselin-Takev/Klar-Dating/pull/268), exact head `71c0d31c6e8ad3e8c681f793dd3daba285d50c7c`, full [CI #41282765859](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41282765859) **SUCCESS**.

**Release decision:** **BLOCKED / NO-GO.** Two successful independent PR CIs do not establish successful integration or production readiness.

## Deliberately scoped source-only integration

This is **not a merge** of either Draft into `main`. A new isolated Draft based on the retention head **imports only the four exact tenant source-inventory/regex-test files** from #268, without changing its production logic. Their upstream Git blob SHA values are preserved and reviewable:

| Copied artifact | Upstream blob SHA |
|---|---|
| `scripts/inventory-tenant-access.mjs` | `efa6c0dcdb68606e5730e431c172546f468ab998` |
| `scripts/inventory-tenant-access.test.mjs` | `791e2d7203cfd2b8599fbed0b6b76bcfb30f06f2` |
| `scripts/tenant-access-patterns.mjs` | `9053f0b162ead238115a3d9663278d89fb27795f` |
| `scripts/tenant-access-patterns.test.mjs` | `e0ec827768c04acdedd89336fda5f46dda7f2908` |

The project `check:enterprise` now **runs** both sets of controls: `check:tenant-inventory` from #268 plus the existing `check:legacy-photo-purge`, `check:compliance-storage-purge`, `check:retention-census-safety` and `check:purge-work-inert` from the #280 chain. None of those existing gates was removed, disabled or replaced.

A new `check:dual-p0-integration` entry and its Node mutation tests require **exactly once** each mandatory invocation, source tests for both domains, and no silent regression in the resulting `package.json` gate chain. The tenant scanner produces an aggregate/read-only file/line/sha256 source inventory and heuristic access categories **only**. It does not access a live Firestore or GCS database, migrate records, or prove tenant authorization by regex.

## Verification gates

- [ ] **New combined exact-head CI** must complete Enterprise Static Gates, Typecheck, Functions Build, Tests, build/smoke/browser acceptance successfully with `check:tenant-inventory` and `check:dual-p0-integration` actually invoked alongside retention gates.
- [ ] Independently validate all *other* tenant source branches/PRs and conflict-free ordering. This rehearsal copies **inventory only** and does not include tenant middleware, Firestore rules, tenant migration, signed manifest, live data isolation or tenant-specific Article-17 deletion checks.
- [ ] Perform supported negative same-tenant BOLA/IDOR and cross-tenant tests in Firebase Auth, Firestore and Storage Emulators plus Admin SDK before integrating real tenant-aware endpoints.
- [ ] Independent deterministic legacy→tenant mapping, lawful data hold/retention Art. 5/9/17 signoff, repeated dry-runs and staged rollback/write fencing are required.
- [ ] P0 #202 still lacks an authorized durable >300 queue, external-source decision/legal-hold coupling, GCS 404/412/replacement crash provenance, deployed Scheduler/IAM inventory and receipt reconciliation.
- [ ] Independent release governance: reviewers #73, DPO/Legal/AppSec/SRE/Release Owner signed approval, merged final SHA CI and approved staging evidence; final `productionApproved` only after these pass.

**No production environment/data queries or writes, merges to main, object deletions, Scheduler/IAM/TTL mutation or deployment performed. Both P0 #202 and #254 remain OPEN; Production BLOCKED / NO-GO.**
