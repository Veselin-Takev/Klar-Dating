# P0 #254 — Native Firestore Rules: tenant-claim boundary and legacy UID evidence

**Date:** 2026-11-01  
**Branch:** `security/p0-254-native-tenant-rules-negative-evidence-20261101`  
**Parent:** [Draft #282](https://github.com/Veselin-Takev/Klar-Dating/pull/282), SHA `5c82c3c2f7847a63eef09a863e194106cfba96d9`, [CI #41339344795](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41339344795) **SUCCESS**. Parent was an *unmerged source-only Rules checksum/config audit*, not deployed-Rules verification.  
**Release:** **P0 #254 OPEN / Production BLOCKED-NO-GO.** Nothing in this PR authorizes live tenant data, a migration, rule deployment or privileged Admin SDK operations.

## Source-observed gap and intended evidence

The current checked-in Firestore Rules use legacy global `/users/{userId}` ownership via Firebase Auth `request.auth.uid == userId`. They **do not check `tenantId` in a signed claim or an active tenant membership** on this root. The existing Rules suite verifies own-versus-other UID, but a migration-specific tenant-claim baseline was missing. Meanwhile `/tenants/{tenantId}/users/{uid}` has no allow rule in this source, so Firestore clients must fail closed by default. That means the future tenant namespace is **not yet functional for client access**, and cannot be declared production ready.

A new node-only `tests/tenantRulesBoundary.emulator.spec.ts` uses `@firebase/rules-unit-testing` against the actual checked-in `firestore.rules` in a **loopback Firestore Emulator** for the explicit `demo-klar` project. It creates only synthetic UID/tenant records using the test library's `withSecurityRulesDisabled`, and verifies:

1. With the **same UID** but different mocked signed `tenantId` claims, the legacy `users/{uid}` profile is still readable. This is intentionally a **legacy tenant-fence gap** assertion, **not** an acceptable tenant isolation policy.
2. Another UID cannot read or overwrite the same legacy full-profile record, even when its tenant claim is the same.
3. Both tenant-prefixed synthetic records are **currently denied to all clients**, even legitimate same-tenant owners; this is secure default-deny yet **not a functioning tenant cutover**.
4. Forged administrative roles or tenant identifiers do not grant read access to tenant-prefixed records or another UID's legacy profile.
5. Client-side writes of `tenantId` or `roles` into a legacy full profile are denied; an ordinary authorized name edit remains functional.
6. Unauthenticated Firestore reads of legacy and tenant-prefixed records are denied.

The new `check:tenant-native-rules` command and Node mutation suite are mandatory in `check:enterprise`, and the dual-P0 integration guard verifies the new check is not removed. A source guard requires the native suite, demo project/loopback requirement, real rules evaluator and that `test:ci` launches a Firestore Emulator. **A static gate alone cannot prove those tests executed**; the exact-head CI job log must show this new Vitest suite with **six tests run and passed**, in addition to the prior six native retention tests.

## Limits and production decisions

- **Rules-test Auth tokens are mocked.** Tests do not establish actual Firebase Auth custom-claim issuance, active membership, IAM, Admin SDK tenancy filters, Cloud Storage rules or deployed production Rules.
- **No tenant authorization path is activated.** This PR does not add any `allow` permissions to `tenants/{tenantId}`; do not 'fix' default-deny by broadening reads/writes without approved claims + membership authorization.
- **No live customer records or storage objects** are read, written, deleted, migrated, backfilled or inspected. No deploy or Scheduler/IAM/TTL adjustment.
- **Still missing for #254:** a reviewed authoritative claim-to-membership contract, signed tenant resolution, UID/path ownership cross-product, rules for each tenant collection, Admin SDK BOLA guards, storage paths and access scopes, migration freeze/backfill/rollback, Art. 17 cascade and independent AppSec/DPO/Legal/SRE signoffs.
- **Still missing for #202:** a real source-authorized biometric retention producer/consumer, legal holds, durable >300 workload, authenticated GCS 404/412/generation deletion evidence, crash recovery receipts and staging assurance.
- **CI governance:** This branch is a stacked *Draft*; require exact SHA enterprise checks, the new six native Rules tests and six existing native retention tests, app build/smoke/browser and combined evidence, then independent approvals and final merged SHA validation.

**Conclusion: P0 #254 and #202 OPEN, `productionApproved=false`, Production BLOCKED / NO-GO.**


## 2026-11-01 — exact-head CI triage

Initial SHA `29716be04eb50833248c2693455a952c9f098ddb` [CI #41341495412](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41341495412) FAILED at Typecheck after Enterprise Static Gates passed, because `tests/tenantRulesBoundary.emulator.spec.ts` imported the unused symbol `expect` under strict TypeScript TS6133. **No new native tenant Rules test ran in that failed CI.** Removed only the unused import at SHA `850ff21a1d775262663ca0c6a55268c31e516be8`; fresh [CI #41341745237](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41341745237) was in progress at this entry. Neither parent #282's green CI nor the failed initial #283 CI is valid success evidence for the latest head. P0 #254 remains OPEN, release NO-GO.
