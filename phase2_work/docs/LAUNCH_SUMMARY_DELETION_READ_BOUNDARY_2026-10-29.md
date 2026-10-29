# Launch summary account-deletion read boundary — 2026-10-29

Status: DRAFT / PRODUCTION NO-GO. Scope: `GET /api/launch/summary` only.

## Finding and change
The existing endpoint loaded `users/{uid}` directly and evaluated city/community density without checking `account_deletions/{uid}`. A deletion-pending account could still request launch context. The endpoint now reads profile and deletion marker in the same Firestore read-only transaction before parsing the city or computing density. Missing profile or present deletion marker returns HTTP 409; Firestore failures return HTTP 503. No density lookup occurs on denied requests. Valid profiles retain the prior response shape and city selection.

## Verification and limitations
Three HTTP negative regressions in `tests/launchEndpoint.spec.ts` cover deletion marker, missing profile and read failure. The shared baseline fixture was extended with `getAll` to model the read transaction. No local tests were run by the author in this environment: Node v22.16.0 is below the repository minimum v22.23.3; GitHub host DNS is unavailable to the local container. Exact-HEAD CI, emulator concurrency and independent Security/DPO review are required. This does not fix the independent activation-summary, referral, retention or partner-conversion P0 issues, and does not claim production Art.17 completion.

## Risk / rollback / release decision
Risk: existing clients for deleted/missing profiles may now receive 409 rather than density data; clients should treat 409 as a terminal account-lifecycle state. Transaction reads add a read of the deletion marker. Rollback: revert this isolated branch/commit after Security+DPO authorization, never bypass deletion protection without an alternative. Do not merge or deploy pending review. Production NO-GO.

## CI diagnosis and test-double repair — 2026-10-29
Enterprise CI run [40865426235](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40865426235) failed at tests after successful static gates, TypeScript and functions build. Two new negative test cases received 503 instead of 409: the custom mocked Firestore transaction omitted `get`, while the upstream distributed rate limiter calls `tx.get`; limiter failure returned early before the launch handler. This was an invalid test double rather than evidence of a failed account-deletion guard. Test fixture now implements `get` and `set` alongside `getAll` to permit rate-limiter preflight. The production route was not changed by the repair. Exact-head tests must be rerun; this note does not claim a PASS. No manual CI re-run triggered, no main merge or deploy. **Production NO-GO.**

## Exact-HEAD verification and integration risks — 2026-10-29
GitHub Enterprise CI [40866258805](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40866258805) reports **success** for commit `f532163dc3bd725dc894162b1757c001c67bb607` after repairing the test transaction double. This is a CI result, not a claim of independent local execution or production authorization. No PR review submissions were recorded at verification time; PR #188 remains draft and unmerged.

**Integration order:** Draft PR #187 also edits `src/server/routes/launch.ts` and `tests/launchEndpoint.spec.ts` against the same main base `2808dc1cbb485f70b403681c108cea5a3361d950`. Both PRs report individually mergeable against main, which does **not** certify their combined tree. Before either merge, explicitly reconcile both changes in an isolated integration branch; preserve referral immutability, no-store headers, and this account-deletion read boundary. Re-run exact merged-tree CI, real Firestore emulator tests and mandatory approvals. Do not resolve semantic conflicts by discarding either privacy guard. **NO-GO pending independent Security/DPO and release-owner evidence.**
