# Profile media release evidence and controlled migration — 2026-10-30

## Decision
**PRODUCTION BLOCKED / NO-GO.** This document is a review checklist, not operational proof or authorization. At capture, PRs #203, #205, #207 and #208 were open **drafts** with a dependency chain #203 -> #205 -> #207 -> #208. PR #208 exact head: `ee12d1a8beee19e225b43bcf41b14153999181dc`. GitHub Enterprise CI run [41016453582](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41016453582) was **in_progress** at first observation and subsequently returned **completed/success** via GitHub API on 2026-10-30. This establishes the workflow conclusion for this SHA only; individual emulator/staging/live-environment evidence and independent reviews are still unverified.


## Exact-head CI job-log audit (2026-10-30)
- **Observed result:** workflow [41016453582](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41016453582), job `validate` ID `123933776535`, completed/success for PR #208 head `ee12d1a8beee19e225b43bcf41b14153999181dc`. Step summaries show PASS for Enterprise static gates, Typecheck, Functions build, Tests, Build, Production smoke and Browser acceptance. Browser failure-diagnostic upload was skipped (not itself a failed gate).
- **Job-log proof of real local emulators:** `firebase emulators:exec --project demo-klar --only auth,firestore,storage` started Auth, Firestore and Storage; test summary: **197 test files passed (197)**. `tests/verificationPurgeHttpEmulator.spec.ts` (10 tests), `tests/verificationPurgeCursorEmulator.spec.ts` (1 test) and `tests/partnerReferralDeletionEmulator.spec.ts` (4 tests) reported PASS. This verifies *CI emulator execution*, not deployed rules or token revocation.
- **Explicit follow-up:** Logs contain two `com.google.firebase.rules.runtime.common.EvaluationException: Error: storage.rules line [32], column [14]. Null value error.` warnings. Despite passing tests, inspect their exact failing-rule context and expected deny behavior; add targeted negative assertions if missing. **Warning classification remains UNRESOLVED**, not silently waived.
- **Toolchain:** CI policy gate explicitly reported **Node 22.23.3 / Bun 1.4.4**. This supersedes earlier planning notes referring to Bun 1.4.2 for this run. It does not prove that the deployed runtime uses the same versions.
- **Evidence limits:** API step summaries and available logs were inspected; artifacts, staging CORS, live IAM, customer-object inventory and revoked legacy URL denial have not been independently verified. No new CI run was dispatched by this audit.

## Read-only preflight evidence to collect
- [ ] Pin exact tested SHA, corresponding PR ancestor SHAs, CI jobs, failing/skipped tests, Node/Bun versions, artifact hashes; record reviewer and timestamp.
- [ ] Inventory **deployed** Firebase Storage/Firestore Rules, Firestore owner and viewer `isAdult` / `accountStatus` transitions, service account IAM, CORS policies for each real bucket and relevant client origins. Source and emulator tests do not establish deployed configuration.
- [ ] Inventory profile object generations, old `firebaseStorageDownloadTokens` metadata and referenced download URLs, signed URLs, proxy caches and CDN behavior using approved, privacy-minimized aggregate reports. Never put live tokens, object-user mappings or personal images in CI logs or tickets.
- [ ] Verify that block, suspension, deletion, underage, anonymous, session revocation and owner-policy changes deny new reads in **staging**; explicitly test existing old token URLs separately, because Firebase Security Rules do not retroactively invalidate bearer links.
- [ ] Test browser SDK `getBlob` with actual staging CORS and authorization, Safari/Chrome/mobile, missing and malformed media, loading/placeholder, offline and performance; ensure no credential-bearing fallback or token-bearing telemetry, referral, analytics or public projection.
- [ ] Verify privacy-consistent legal holds, Art. 17 deletion and storage-object-version cleanup; test 404/412 retries, concurrent image replacement, retention scheduler interactions, approved restoration/rollback and alert delivery.

## Controlled migration and rollback (requires separate human change approval)
1. Freeze approved inventory scope and take a privacy-safe baseline (counts, SHA, policy versions). Document responsible Security/DPO/SRE operators and release window.
2. Validate source-path dual-read behavior and bucket ownership in isolated staging; use staged synthetic records and credentials. Do not interpret component tests as production revocation proof.
3. Define auditable phased legacy-record migration, idempotent checkpoints, token invalidation/rotation and caches; preserve legal holds. Explicitly identify rollback limits: an invalidated leaked URL cannot be made private again merely by reverting client code.
4. Specify halt thresholds (unexpected denial, read errors, latency, 404/412 conflict, CORS failures), feature flag, rollback owner and incident response; perform a rehearsal with production-like permission boundaries.
5. Only after recorded Security, DPO/Legal, SRE, Product/Finance and Release Owner approval: execute separately authorized change and capture post-change denial evidence. **This document authorizes no changes or production operations.**

## Integration policy
Do not merge stacked drafts blindly: ancestor branches are PR bases, and a check on #208 is not a substitute for separately reviewing the final rebased/merged SHA. Preserve frozen PR #119 / RC R2. Never trigger extra workflows while an automatic run is active; respect the user's GitHub Actions budget. Record results and approvals in issue #206 and the release gate issue #8. Do not mark either closed until all acceptance evidence is verified.

## Outstanding linked findings
- P0 #202 / draft #203: decision-based verification photo retention, generation-precondition behavior and deployed Scheduler inventory.
- P1 #204 / draft #205: actual Storage authorization versus model, active-adult policies, blocked/deleted account behavior.
- P1 #206 / drafts #207 and #208: legacy token revocation, approved migration, real browser CORS, staging deny tests.
- P0 #70: deployed Firestore TTL matrix ACTIVE evidence.
- P1 #73: actual code owner teams and branch protection evidence.
- Release #8: exact final SHA and independent sign-offs.

**Evidence ledger:** created from GitHub API metadata on 2026-10-30. All unchecked items remain unverified; the existing CI run was observed (not triggered) and completed/success. No new CI test, staging check, live policy read, merge, deploy, token rotation or production deletion was performed as part of this documentation step.
