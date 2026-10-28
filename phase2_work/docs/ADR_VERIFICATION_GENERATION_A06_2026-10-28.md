# ADR: Decision-time GCS generation binding for verification photos (A-06)

**State: DRAFT / Production NO-GO.** Based on PR #160 head `38f7e7016a784152cc1e518919a0d88eab488aaf`.

## Threat and control
A user can replace an object at an unchanged `verification/{uid}/...` path.
Deletion by path alone could erase a newer unverified photo. Capture GCS
`metadata.generation` before committing the manual moderation decision,
recheck the request/path in its Firestore transaction and store that immutable
`storageGeneration` with `verification_events`. For automated purge, reject
legacy events without this proof and all holds, pending decisions, changed event
records, 404 and 412 results. Delete using `ifGenerationMatch`, never
`ignoreNotFound`. Audit digest is bound to the generation.

## Remaining non-atomicity and review blocks
- GCS deletes and Firestore audit commits are not a single atomic transaction;
  crash after GCS delete may leave an event unacknowledged. A signed reconciliation
  or human review is required; never infer successful deletion from 404 alone.
- Snapshot-to-delete state races still require a transactional lease/CAS design;
  captured generation protects against deleting a replaced object, not every
  possible business-state race.
- Historical events without generation cannot be backfilled from **current**
  object metadata. Keep them blocked for independent privacy/legal handling.
- A-15 persistent keyset pagination is proposed in a separate stacked
  Draft PR and still requires real Firestore/index/lease tests. A-02 staging
  TTL ACTIVE proofs are separate. This path is for legacy manually moderated photos, not a Didit
  retention migration.
- Validate exact HEAD with Node 22.23.3/Bun 1.4.4 Enterprise CI, Firestore
  and Storage emulator, 404/412/concurrency/crash negative cases, and independent
  Security/Privacy/Legal/Ops approvals. `RELEASE_MANIFEST.json` stays NO-GO.
