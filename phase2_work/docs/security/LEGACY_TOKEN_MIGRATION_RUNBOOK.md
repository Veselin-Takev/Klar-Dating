# Legacy Firebase Auth session migration — PR #360

The operator entry point is `phase2_work/scripts/migrate-revoke-legacy-tokens.ts`.
It is read-only against Auth unless `--apply` is present. No production apply is
part of this change. Storage download capabilities are a separate migration:
`scripts/revoke-media-capabilities.ts` must also be inventoried and executed by
the authorized operator; revoking Auth refresh tokens does not revoke those URLs.

## Scope and execution

Run from `phase2_work` with the pinned Node toolchain and installed dependencies.
Use an approved ADC identity with only the required Auth user read/list and,
for apply, update permissions. Do not put credentials in arguments or in Git.
Select the real approved project explicitly; choose `--tenant=default` for the
default Auth namespace or a specific Identity Platform tenant ID. Run separately
for **every** Auth tenant in the approved inventory. Application Firestore tenant
IDs are not necessarily Identity Platform Auth tenant IDs.

Choose a fixed UTC second at the beginning of the maintenance window, at least
two seconds before execution. Keep that exact cutoff and checkpoint for retries.
The checkpoint must be outside the repository, in an existing private directory.

```sh
node --import=tsx scripts/migrate-revoke-legacy-tokens.ts \
  --project="$KLAR_PROJECT_ID" --tenant=default \
  --cutoff="$KLAR_MIGRATION_CUTOFF" \
  --checkpoint="$KLAR_AUTH_CHECKPOINT" --max-users=1000
```

The first run is a dry-run. Archive its aggregate JSON receipt in the controlled
evidence vault. Add `--apply` to the same command only for the authorized migration
window. Exit 3 means more pages remain; repeat the identical command to continue.
Exit 1 means failure; do not mark the migration complete. Successful completion
returns exit 0 and `completed: true`. Dry-run enumerates from the start and never
consumes the apply cursor. `--max-users` limits each invocation, not total scope;
apply throttles revocations to at most ten per second, serially.

## Idempotency and recovery

The checkpoint binds project, Auth tenant, cutoff and emulator mode; incompatible
reuse fails before any Auth API call. Completed apply runs do no further work.
Each page is checkpointed only after all revocations and provider postconditions
succeed. A retry re-reads `tokensValidAfterTime` and skips accounts already fenced
strictly after the cutoff, including crashes between provider success and local
checkpoint persistence. Accounts created after the cutoff are skipped, including
UID deletion/recreation races. A disappeared account is an idempotent success.

The private checkpoint includes an opaque provider pagination cursor, which may
encode account identifiers. Treat it as personal data, never log/commit it, and
delete it under the approved maintenance-evidence retention schedule. Aggregate
stdout receipts contain no UIDs, emails or session tokens.
The private checkpoint uses mode 0600, a same-directory atomic rename and a
single-process lock. Only one operator may migrate a project/Auth tenant at a
time, even when different checkpoint names are available. After a hard crash,
verify no operator process remains before removing the stale `.lock`; inspect and
remove an incomplete `.next` only after preserving the last committed checkpoint.
Never edit the cutoff or manufacture a completed checkpoint. Persist the directory
on durable storage for a production run; a temporary runner filesystem is insufficient.

Firebase's revoke API advances validity to **execution time**, not to a historical
cutoff. The first apply can therefore also end sessions established during the
window. Retries avoid repeating a successfully confirmed revocation. Freeze Auth
tenant/UID imports and project reassignment during inventory/apply; pagination is
not a globally transactional snapshot. Compare the completed inventory and receipts
against the maintenance inventory before declaring system-wide completion.

## What revocation proves

Existing refresh tokens fail and API verification using `verifyIdToken(token, true)`
rejects revoked ID tokens. Locally verified ID tokens and Firebase Rules do not
automatically observe a refresh-token revocation: honor the existing application
account fences, disable direct protected Storage access, and allow the documented
ID-token lifetime to elapse before asserting that every previously issued token is
unusable everywhere. The script does not disable users or create a permanent login
ban. Never use its receipt as proof of Storage-capability migration or universal
instant JWT expiry.

## Synthetic dry-run evidence

`tests/legacyTokenMigrationNative.spec.ts` invokes the actual CLI against a loopback
Firebase Auth emulator in the isolated `demo-klar-legacy` project. It compares the
provider's validity timestamp before and after dry-run, then verifies apply,
completed rerun and a rejected checkpoint scope change. Unit regressions exercise
provider failures, lost checkpoints, postcondition failures and bounded pagination.
The final run and exact source evidence are recorded in
[`DUAL_SIGN_OFF_READY.md`](../../../docs/security/DUAL_SIGN_OFF_READY.md).
These synthetic checks are **not** a successful production inventory/dry-run.
