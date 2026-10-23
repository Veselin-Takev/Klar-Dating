# P0 #56 — Idempotent partner consent withdrawal after profile purge (2026-10-18)

**Draft / NO-GO.** Stacked on PR #103.

## Finding
During account deletion, the user profile may be removed before a later consent-withdrawal request arrives. The previous service called requirePartnerUserData on a missing snapshot and threw account_not_found even though account_deletions/{uid} confirmed ongoing deletion.

## Change
Inside the existing Firestore transaction, if allowed=false, the account-deletion marker exists and the user snapshot is missing, return {allowed:false,version:null} without recreating the profile or writing any new personal-data ledger. Repeated requests are read-only. An allowed=true request remains blocked with account_deletion_pending. If there is no account-deletion marker, missing users still fail with account_not_found. A new in-memory Vitest regression covers all four cases, no mutations, and no duplicate audit entries.

## Limitations
The deletion record's existence is treated as evidence of a deletion workflow, not an independent proof that every downstream copy has been erased or processing stopped. Audit deletion-worker ordering, external systems, media removal and Art.17 retention obligations. Do not recreate personal ledgers once the profile has been purged solely to satisfy an API retry. Verify real Firestore transaction semantics and all Node22.23.3 Vitest, Emulator, TypeScript, security, Playwright and build gates; independent Privacy/Legal approvals required. No CI re-run, merge or production change. P0 #56 and release #8 OPEN; NO-GO.
