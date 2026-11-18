# Profile Media Upload Cutover & Legacy Token Inventory

## Upload writer

`ladeProfilfotoHoch()` uploads to the owner-scoped `profiles/{uid}/` path and persists a canonical opaque `klar-media:v1:` reference in `users/{uid}.photoURL`. It does not call `getDownloadURL()` and does not store a Firebase bearer download URL. The server recognizes the reference only after decoding it and verifying that the object path belongs to the requested UID.

## Read-only inventory

Run from `phase2_work/`.

### Firebase emulators (recommended first run)

```sh
npm run profile-media:inventory:emulator
```

This command starts isolated Firestore and Storage emulators under the `demo-klar` project, then performs the inventory. The script refuses emulator mode unless both emulator hosts are present and the project ID begins with `demo-`.

### Explicit live read-only mode

A live inventory requires Application Default Credentials with read access and all of the following explicit arguments:

```sh
npm run profile-media:inventory:dry-run -- --live-read-only --confirm-live-read-only --project-id YOUR_PROJECT_ID --bucket YOUR_BUCKET
```

This mode is intentionally separate from the default invocation. It refuses environments with emulator host variables and requires an exact project and bucket selection.

## Inventory scope and output

The utility paginates `users` and `public_profiles` Firestore documents and the Storage `profiles/` object prefix. It inspects object metadata and reports aggregate counts for:

- legacy Firebase download-URL references and duplicate object references;
- unresolved or missing referenced objects;
- referenced and total objects with `firebaseStorageDownloadTokens` custom metadata;
- profile Storage objects that are no longer referenced by those Firestore aliases.

The report does not include UIDs, document IDs, object paths, URLs, token values, raw metadata or SDK exception messages. It only calls Firestore list/get operations and Storage list/get-metadata operations.

**No mutation is implemented:** the inventory does not upload, overwrite, delete, change metadata, revoke tokens, update IAM, or alter deployment settings. It is a diagnostic baseline only. Token revocation or cleanup requires a separate reviewed plan, a separately approved execution, and a subsequent verification report.
