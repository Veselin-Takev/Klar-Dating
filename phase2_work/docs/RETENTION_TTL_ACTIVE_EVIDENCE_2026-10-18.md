# P0 #70 — Firestore TTL ACTIVE evidence gate (2026-10-18)

**DRAFT / NO-GO**, stacked on PR #115. A planning matrix is not a confirmation that Firestore activated retention policies. Per the official gcloud list reference, project and database are separately scoped and can be queried read-only.

## Change
`scripts/check-retention-active-evidence.mjs` validates a captured `gcloud firestore fields ttls list --format=json` JSON array, scoped to the exact declared project and Firestore database. All 13 approved collection groups must have one `expiresAt` field with `ttlConfig.state === ACTIVE`; missing/duplicate fields, incorrect project or database, nonzero expiry offset, and unready states are rejected. No privileged cloud API is invoked by the validator.

`scripts/test-retention-active-evidence.mjs` generates fully synthetic offline evidence and verifies valid input plus nine fail-closed mutation cases without Google credentials or cloud costs.

## Release limitations
Captured JSON is not a signed provenance record; an authorized independent reviewer must confirm capture time, target identity, and actual GCP IAM privileges and attach live staging evidence to the change ticket. Firestore TTL is asynchronous and not equivalent to timely Art.17 deletion; legal holds, actual `expiresAt` writes, DPO approval and full pinned Node22.23.3/Firestore emulator/E2E/build gates remain open. No staging or production policy changed. Issue #70 and release #8: **NO-GO**.

Official references: https://docs.cloud.google.com/sdk/gcloud/reference/firestore/fields/ttls/list ; https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.collectionGroups.fields
