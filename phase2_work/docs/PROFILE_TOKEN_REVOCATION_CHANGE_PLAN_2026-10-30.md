# P1 #206 — Legacy Firebase Profile Download Token Revocation: Controlled Change Plan
Date: 2026-10-30. Status: **DRAFT / NOT EXECUTED / PRODUCTION NO-GO**.

## Verified implementation boundary
At candidate draft #210 head `06e9b4f54e2792835f16aeeb35ccddff46b39041`, `src/lib/profileMediaSource.ts` parses canonical `profiles/{uid}/{file}` and Firebase download-URL references to Storage paths, discarding the URL query. `src/components/AuthorizedProfileImage.tsx` uses authenticated SDK `getBlob`, checks bucket, image MIME and size, and revokes temporary object URLs when an effect is cleaned up. This design reduces newly minted bearer URLs. It **cannot invalidate old tokens already copied externally** and does not guarantee immediate revocation of already-fetched browser image bytes. PRs #203–#210 are stacked drafts, not yet deployed.

## Stage 0 — independent authorization and safe evidence design (read-only)
- [ ] Security/DPO/Legal approve purpose, controller, minimal metadata fields and retention for the inventory; SRE approves IAM identity and read-only scope.
- [ ] Bind review to exact deployed GCP project, storage bucket(s), Firebase app, Firestore database, deployed Rules generation, existing CORS, CDN/proxy configuration and all published client versions.
- [ ] Inventory *counts only* of objects in `profiles/`, references using `photoURL`, `photoUrl`, `photos`, objects with `firebaseStorageDownloadTokens` metadata, signed URL methods, object versioning/holds. Do **not** collect token values, full URLs, UID/object path mapping or profile photos into tickets/CI artifacts. Evidence should carry aggregate counts, audit time, operator role, approved scope and an integrity digest.
- [ ] Confirm all clients support authenticated `getBlob` and browser CORS in synthetic staging. Demonstrate missing/blocked/underage/deleted reader denial and permitted adult/active reads. Record which platform/browser versions remain unsupported.
- [ ] Determine which old URLs will be rejected after token metadata changes. Do not assume changing Firebase Storage Rules, rolling back code, deleting a Firestore URL field or clearing cache revokes previously shared bearer links.

## Stage 1 — synthetic staging rehearsal (change-approved only)
- [ ] Create isolated synthetic test user and image objects, generate known *test-only* legacy token URL and verify pre-change access; never paste URL into CI or plaintext audit records.
- [ ] Run new-app path reference conversion, authenticated access and missing-user/blocked-user tests; verify mobile/browser CORS.
- [ ] Test metadata-only legacy token revocation against the **same test object**, verify old URL denial without authentication, and confirm authenticated object retrieval still works as policy permits. Validate SDK/GCS behavior with the pinned provider version rather than extrapolating from emulator.
- [ ] Include object generation preconditions, concurrent replacement, legal holds, 404/412 retries, idempotent resume, partial failure, rollback and on-call alerting. Do not mutate user production data.
- [ ] Explicitly distinguish **client rollout rollback** (may restore code) from **token revocation rollback** (cannot restore confidentiality of already disclosed tokens, nor make exposed bytes disappear).
- [ ] Produce aggregated pass/fail evidence, no tokens or personally identifiable data, and a stop/abort decision.

## Stage 2 — gated migration proposal, NOT authorization
- [ ] User/profile references: compare all supported field shapes and producers/consumers; define dual-read and migration checkpoints with no new long-lived URLs.
- [ ] Define zero-downtime operational sequence: client compatibility gate, stage proof, privacy approval, minimal read-only production inventory, bounded change batches, generation-sensitive metadata update/rotation, repeatable audit, rollback, interruption recovery, and post-change review.
- [ ] Establish abort thresholds for unexpected profile-image 403/404, CORS failures, latency, storage transaction errors, user complaints, legal holds or unexpected URL survivability.
- [ ] Review signed URLs, service account ACL/IAM, CDN and proxy caches separately; token metadata revocation alone does not automatically revoke all alternate delivery capabilities.
- [ ] Independent Security + DPO/Legal + SRE + Product/Finance (where applicable) + Release Owner must approve exact change set, evidence, maintenance window and communications. Follow issue #8 and #206. No implicit GO from green CI.

## Safety invariants
1. No automatic production token listing/rotation, no full bearer URL logging, no mutation of Storage Rules/IAM/CORS without approved deployment.
2. Never rely on `getDownloadURL` for viewer authorization; default deny whenever the server-owned profile status is unavailable.
3. Preserve Art. 17 deletion and legal holds; do not use customer photos as test material.
4. Do not close #206 until old-token deny evidence is observed in **approved staging** and production rollout evidence is signed.
5. Preserve PR #119 / RC R2 and main; do not blindly merge stacked #203→#205→#207→#208→#209→#210.

## Evidence ledger
Read-only GitHub metadata verified on 2026-10-30: PR #208 HEAD `ee12d1a8beee19e225b43bcf41b14153999181dc`, #209 HEAD `f7b73e1d62daa438ead37473e4af2b0d22b837e9`, #210 HEAD `06e9b4f54e2792835f16aeeb35ccddff46b39041`; all open/draft. PR #210 CI [#41024941378](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41024941378) had previously passed. No new cloud data, token inventory or live environment proof was available during this review. **NO-GO.**
