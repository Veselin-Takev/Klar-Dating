# P0 #254 — Consolidated Storage Tenant Evidence (Draft Integration)

**Date:** 2026-11-01 · **Branch:** `integration/p0-254-storage-policy-evidence-convergence-20261101`  
**Parent:** [Draft #284](https://github.com/Veselin-Takev/Klar-Dating/pull/284) exact SHA `47d4fbc3afc1e9a3207d01d11621d1079929af5d`, full [CI #41342810126](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342810126) SUCCESS. Parent includes six native Firestore Tenant Rules cases, four native Storage Rules cases and six native Retention Firestore cases. **Release: BLOCKED / NO-GO.**

## Why this integration branch exists

Two separate unmerged Draft branches investigated overlapping P0 #254 legacy Storage media visibility. [Draft #285](https://github.com/Veselin-Takev/Klar-Dating/pull/285), SHA `170a0586b22aed47a37c8d82e6cf6843896c6c32`, has a **read-only source-risk marker** report, while [Draft #287](https://github.com/Veselin-Takev/Klar-Dating/pull/287) explored cross-tenant `getMetadata` calls in addition to the `getDownloadURL` calls already exercised by #284. Blindly merging both would duplicate suites and create two partially overlapping static gate contracts.

This new **isolated integration rehearsal** derives from the validated #284 chain and applies **only net-new coverage**, without overwriting its six Firestore Tenant tests, four Storage Tenant tests or six Retention tests:

- Exact original read-only scripts copied from #285: `scripts/check-storage-tenant-risk-markers.mjs` (blob `703636517b0de2f2f5e07ec2603305f5010040d1`) and `scripts/check-storage-tenant-risk-markers.test.mjs` (blob `ce68990b34821d47768523b228c2ebb48ffebbec`).
- The existing four-test `tenantStorageBoundary.emulator.spec.ts` gains a **cross-tenant profile metadata read (currently permitted under checked-in signedIn-only Rules)**, **owner verification metadata denial**, **foreign verification metadata denial**, and tenant-prefixed metadata denial. No duplicate test suites and no changes to the Firebase Storage Rules.
- The existing mandatory `check:tenant-native-storage` source gate and its mutation tests now require both profile metadata-permission and owner verification metadata-denial assertions. A new `check:storage-tenant-risk` runs the read-only marker report plus its Node regressions. The existing dual-P0 enterprise gate checks both checks and still retains all Firestore tenant, biometric retention and Art.-17 controls.

## Limitations and GO gates

Only synthetic objects in loopback `demo-klar` Firebase Emulators. Cross-tenant readable profile metadata and downloads may be legitimate dating profile discovery, but tenant-specific policy, age, consent and DPO/Product/Legal signoff are required. Neither green Emulator tests nor checked-in source SHA attest the actual production deployed bucket/Rules, Cloud Storage signed URLs or backend Admin SDK authorization.

Independent tests must cover same/cross tenant BOLA, revoked/deleted accounts, cached URLs, verified claims, client/SDK versus Admin bypass, tenant mapping and Art.-17 cascade. P0 #202 remains blocked by durable authorized queue >300, GCS generation-fenced deletion/404/412 evidence, legal holds, decision consistency and independent receipts. No merge, deployment or real data operations are authorized.

**Required evidence:** New **exact-head full CI** showing source/mutation gates and all **four native Storage, six native Tenant Firestore and six native Retention** test cases actually executed. The prior #284 PASS is **not inherited**. P0 #254 and #202 remain OPEN; `productionApproved=false`, **Production NO-GO**.
