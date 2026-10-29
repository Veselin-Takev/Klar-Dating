# Launch summary account-deletion read boundary — 2026-10-29

Status: DRAFT / PRODUCTION NO-GO. Scope: `GET /api/launch/summary` only.

## Finding and change
The existing endpoint loaded `users/{uid}` directly and evaluated city/community density without checking `account_deletions/{uid}`. A deletion-pending account could still request launch context. The endpoint now reads profile and deletion marker in the same Firestore read-only transaction before parsing the city or computing density. Missing profile or present deletion marker returns HTTP 409; Firestore failures return HTTP 503. No density lookup occurs on denied requests. Valid profiles retain the prior response shape and city selection.

## Verification and limitations
Three HTTP negative regressions in `tests/launchEndpoint.spec.ts` cover deletion marker, missing profile and read failure. The shared baseline fixture was extended with `getAll` to model the read transaction. No local tests were run by the author in this environment: Node v22.16.0 is below the repository minimum v22.23.3; GitHub host DNS is unavailable to the local container. Exact-HEAD CI, emulator concurrency and independent Security/DPO review are required. This does not fix the independent activation-summary, referral, retention or partner-conversion P0 issues, and does not claim production Art.17 completion.

## Risk / rollback / release decision
Risk: existing clients for deleted/missing profiles may now receive 409 rather than density data; clients should treat 409 as a terminal account-lifecycle state. Transaction reads add a read of the deletion marker. Rollback: revert this isolated branch/commit after Security+DPO authorization, never bypass deletion protection without an alternative. Do not merge or deploy pending review. Production NO-GO.
