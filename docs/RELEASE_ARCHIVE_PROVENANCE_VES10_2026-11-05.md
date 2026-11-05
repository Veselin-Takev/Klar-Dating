# Klar Release Archive Provenance — VES-10

**Date:** 2026-11-05 · **State:** historical ZIP **NOT VERIFIED**, production **NO-GO**.

## Source of truth

Two source-controlled checksum manifests were independently read on GitHub:

- `Klar_Enterprise_Final_15.09.2026.SHA256SUMS` — Git blob SHA `53843516a4bd2e2ce71ac07ce2d191d9c1101ebe`.
- `phase2_work/Klar_Enterprise_Final_15.09.2026.SHA256SUMS` — the **same** Git blob SHA.
- Each specifies the same historical archive `Klar_Enterprise_Final_15.09.2026.zip` with SHA-256 `36b2a3ac3953cecc0bbfecbf7ca7f7cc2dd0e39f118820a51591bcce97725aac`.

The manifests refer to the historical path `/mnt/data/Klar_Enterprise_Final_15.09.2026.zip`. This is **not** a guarantee that such a path or file exists today, and the checksum is not evidence of original custody. The Git history audit #7 verified reachable Git objects, not never-committed local archives. Library title search did not surface an authenticated copy of this specific 15 September ZIP. Avoid describing the archive as destroyed when its location is merely unproven.

## Safe, read-only verification

The review-only `scripts/check-legacy-release-archive.mjs` can check source manifest consistency without guessing an archive. In a trusted isolated working copy, run:

```bash
node scripts/check-legacy-release-archive.mjs --manifests-only --report=audit-results/ves10-release-archive.json
```

Result `MANIFESTS_CONSISTENT_ARCHIVE_UNVERIFIED` is **not an archive certification**.

Only if the release owner supplies a trusted, unchanged copy in an access-controlled offline location, run:

```bash
node scripts/check-legacy-release-archive.mjs --archive=/secure/offline/Klar_Enterprise_Final_15.09.2026.zip --report=audit-results/ves10-release-archive.json
```

The verifier streams SHA-256 from a regular file opened with no-follow for the final path component. It does not unpack, execute, modify, upload or log its contents. It checks both manifests before reading the candidate. Any missing file, symlink, conflicting manifests, archive-name substitution or hash mismatch fails closed. The JSON result includes only the expected checksum, observed digest, byte count and a restricted verdict/reason, not the local path.

The successful verdict `ARCHIVE_BYTES_MATCH_MANIFESTS_CUSTODY_UNVERIFIED` confirms **only** byte equality to the source-controlled checksums. Authenticity, owner chain-of-custody and whether this was the exact originally published release still need independent proof. Do not infer a production release approval from any SHA match.

## Evidence acceptance gates

1. Confirm archive origin (owner, controlled storage system, immutable object version, retrieval date, transfer method) and obtain an independent release-owner attestation.
2. Keep the candidate in protected storage; verify access controls, retention, malware-scan policy and DPO permission if personal data might be included. Never commit this ZIP into a public repo.
3. Execute the offline hash comparison on the original bytes and preserve the SHA-bound JSON verification output plus chain-of-custody record in a long-lived protected evidence store. CI artifacts have finite retention.
4. Inventory other pre-Git development assets against the verified v149/R2 trees. Differences must be classified, not blindly copied or history-rewritten.
5. The GitHub workflow runs only fixture tests and manifest-only validation. **It cannot and must not fabricate a passing original ZIP result when the ZIP is unavailable.**

## Current release status

VES-10 remains **open** until the original archive and custody are validated. VES-5 P0 Firestore/GCS cross-service fencing remains unresolved; no merge/deploy or production photo deletion. `productionApproved=false`.

## Additional anti-rebaseline control and test evidence

Two simultaneously edited manifests must not silently redefine the approved September 2026 hash. The verifier therefore pins the historical SHA-256 `36b2a3ac3953cecc0bbfecbf7ca7f7cc2dd0e39f118820a51591bcce97725aac` independently in code and rejects a coordinated checksum rewrite with `historical_release_digest_changed`. The manifest target is likewise restricted to the recorded `/mnt/data/Klar_Enterprise_Final_15.09.2026.zip` or its exact basename, not an arbitrary path sharing that basename.

Native tests use a synthetic ZIP with an unrelated hash through **pure, imported helpers**, never through an override to the release command. The actual CLI does not accept a user-supplied expected digest and refuses a synthetic ZIP as original evidence. A passing fixture test does not close VES-10; successful real-archive verification is still pending an authentic source, safe handling, and owner attestation.

All changes are review-only on dependent Draft PR #327. The automatic manifest-only audit remains explicitly `MANIFESTS_CONSISTENT_ARCHIVE_UNVERIFIED` until a verifiable original exists. `productionApproved=false`.
