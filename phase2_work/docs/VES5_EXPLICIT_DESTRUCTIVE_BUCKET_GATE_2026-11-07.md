# VES-5 — Explicit GCS bucket safety gate for destructive verification purge

**Review-only; P0 OPEN / production NO-GO** — 2026-11-07

## Evidence and scope
Parent [Draft PR #317](https://github.com/Veselin-Takev/Klar-Dating/pull/317) implements a decision-aware photo purge, with a default-deny environment flag, lease, Firestore intent/proof and GCS generation precondition. The scanned implementation still used `getStorage().bucket()` (implicit default) when no bucket dependency was supplied. That does not prove the selected bucket belongs to the intended Cloud project, and a wrong default would be particularly dangerous for irreversible photo deletion.

## Independent defensive fix on a stacked Draft branch
- Require an explicitly configured and syntactically valid `FIREBASE_STORAGE_BUCKET` whenever the production route has no injected test bucket. No `gs://` URL, whitespace, path or implicit default.
- After HMAC authentication and the existing `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED=true` check, reject missing/invalid bucket configuration with HTTP **503** and `verification_storage_purge_bucket_unconfigured` **before getDb(), Firestore leasing, or GCS calls**.
- Retain injected `getBucket()` only for deterministic emulator tests. When the production code selects Storage it calls `getStorage().bucket(explicitName)` instead of the default bucket.
- Add unit edge cases and an actual signed HTTP test that asserts 503 without reaching `getDb()` when no bucket is configured.
- Extend `check:compliance-storage-purge` to fail if an implicit default `getStorage().bucket()` reappears or the no-bucket validation moves below the first DB access.

## Mandatory dependencies and limits
- A provided name is **not** proof of ownership: verify the exact bucket's project ownership, retention/holds, IAM, uniform bucket-level access and storage write/delete principals independently in GCP.
- The independent Firebase Admin SDK default app protection in [Draft PR #344](https://github.com/Veselin-Takev/Klar-Dating/pull/344), plus its parent [#343](https://github.com/Veselin-Takev/Klar-Dating/pull/343), must be integrated/reconciled to bind Cloud Storage and Firestore Admin identities to the reviewed project. This P0 fix alone does not enforce SDK project consistency.
- **Critically unresolved:** post-authorization Firestore/GCS TOCTOU race. A decision or legal hold written after the final Firestore transaction but before the GCS delete can still leave a deletion unauthorized. A generation-match condition protects only GCS object replacement, not Firestore authorization changes. **Do not enable the purge flag** until all writers adopt a fenced state machine and a real adverse staging test prevents an unauthorized delete.
- Account deletion and external/Admin SDK writers, Scheduler/IAM and Cloud TTL inventory, Art. 17 retention obligations, crash/replay, signed independent AppSec/DPO/SRE/ReleaseOwner approvals and exact final SHA CI remain mandatory.
- GitHub review branches only; no main merge, IAM/billing/storage changes, production deletion or deployment. `productionApproved=false`.

## Validation plan
```sh
cd phase2_work
npx vitest run tests/complianceStoragePurge.spec.ts
npm run check:compliance-storage-purge
npm run check:retention-p0
npm run release:verify
```
A passing branch CI is necessary but **not** sufficient for release. Record exact SHA and workflow URL only after the CI verdict.

Related [Linear VES-5](https://linear.app/takev/issue/VES-5) and [Linear VES-12](https://linear.app/takev/issue/VES-12). The user-selected `klar-admin` project has linked Billing but the saved budget screenshot has yet to prove the desired EUR 10 / 50-80-100 alerts. No billable staging resources are authorized.
