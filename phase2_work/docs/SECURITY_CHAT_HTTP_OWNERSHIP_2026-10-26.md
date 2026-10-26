# Security checkpoint: authenticated HTTP chat ownership — 2026-10-26

**CI-Nachtrag 26.10.2026:** PR #136 ist nach vollständiger erfolgreicher [CI 40387030005](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40387030005) integriert. Getesteter Head: dd59e548e0dbf037279b716d9c2eec0b3044700a. Die untenstehenden lokalen/pending-Angaben dokumentieren den früheren Prüfzeitpunkt. Aktueller Befund-/Freigabestatus: [Auditstatus](SECURITY_AUDIT_STATUS_2026-10-26.md). Produktion bleibt **NO-GO**.


Status: eight new integration cases prepared; real emulator execution/full exact-head
CI pending. No local emulator pass is claimed. Production: **NO-GO**.

## SEC-06 evidence gap

`tests/chatHttpOwnership.spec.ts` exercises the running application at its actual
`/api/chats/:chatId` and `/api/messages/mark-read` mounts. It does not inject req.user,
mock authentication, replace the router or substitute a database implementation.
Four synthetic registered accounts are created through the local Auth emulator;
the Admin SDK verifies their real tokens before requests. One account deliberately
lacks the server-owned adult gate. Firestore holds uniquely named synthetic fixtures.

Eight cases check:

- Both legitimate participants receive the correct counterpart profile.
- A valid adult outsider first passes account-status authentication, then receives
  403 on the foreign chat without a synthetic profile marker or counterpart ID.
- Both directions of a block deny access.
- Pending recipient erasure denies chat access; pending requester erasure is denied
  at the authentication boundary with the existing 409 contract.
- A valid account without adult approval is rejected with `alter_fehlt`.
- A foreign read-receipt write returns 403 and leaves the document unchanged;
  the authorized participant subsequently succeeds on the same resource.

The suite requires both local Auth and Firestore emulators. It refuses non-loopback
emulator hosts; existing runtime policy requires a demo project. Requests target
only loopback port 3000. Cleanup removes only owned fixture IDs and emulator accounts.
No production data, external provider, email delivery or live staging is involved.
The existing standard CI test command discovers this suite. With CI=true, missing
required emulators fail at module load rather than silently skipping the evidence.
CI must confirm that
all eight cases executed, not merely skipped, before this evidence is accepted.

## Current limits and release status

This is authenticated HTTP evidence for the specified chat read/read-receipt paths,
not a complete authorization matrix or proof for all API routes, Storage downloads,
all age/consent transitions or every race condition. Existing handler-level tests
remain complementary. SEC-06 remains partially open until remaining route/rule and
scanner evidence gaps are addressed.

PR #135 passed full CI 40383735092 and merged as
cb135c886bd21619c0a55107ba7a1e9fcb4fadcf. The deterministic prompt suite is now
explicitly executed and the former invalid-token case no longer claims IDOR proof.

SEC-01 named-database-compatible media authorization, remaining dependency findings
and raw logging/actual sink controls remain open. Independent acceptance, actual
isolated live staging/rollback and actual container build/scan evidence are separate.
There is no separate staging project. Production remains **NO-GO** until the protected
official release process has evidence tied to the exact release commit.
