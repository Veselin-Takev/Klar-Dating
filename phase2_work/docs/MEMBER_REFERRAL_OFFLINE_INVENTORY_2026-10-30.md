# P0 #48 – Offline-only legacy member referral inventory (2026-10-30)

**Status: implementation candidate in isolated Draft branch; no deployment, no active migration. PRODUCTION BLOCKED / NO-GO.**

## Reason for the change
The staged atomic registry in Draft [#219](https://github.com/Veselin-Takev/Klar-Dating/pull/219) is **not connected** to existing member invitation routes. Before an approved shadow backfill, the owner must understand whether *supplied* legacy records contain duplicate codes, malformed values or contradictory code assignments. It would be unsafe to treat a clean first page as a complete, uniquely mapped collection, or to include raw UIDs and invitation codes in issue comments.

The parent #219 corrected source head `6314431111115da5b62b7d42d0eb18d32eceb7a9` passed [CI #41122106204](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41122106204), validate job `124290533135`: real `memberReferralCodeRegistryEmulator.spec.ts (5 tests)`, `rules.spec.ts (88 tests)`, `memberReferralRegistryReleaseBoundary.spec.ts (2 tests)`, overall **201/201 test files PASS**. That previous PASS is **not** verification for this additional inventory module.

## New module (does not query any user data)
`src/server/memberReferralMigrationInventory.ts` exports a pure `summarizeMemberReferralInventory(records, maxRecords)` for caller-provided synchronous or async rows. It imports no Firestore, HTTP, filesystem, Firebase credentials, logging or Admin SDK; it is not invoked by any runtime endpoint or batch job. It does **not** enumerate production, stage or GitHub data.

It validates local row shapes, Firebase UID path-safe bounds and the existing ten-character uppercase Base64url-compatible code alphabet. It computes **counts only**: records seen, absent/malformed codes, repeated owner-code rows, unique-code groups, multi-owner collision groups and owners with conflicting code assignments.

- No raw UID, referral code, name, email, token or document payload is included in the returned aggregate object.
- An upper bound of 100,000 in-memory rows prevents unbounded consumption; the default is 50,000. Truncation throws `member_referral_inventory_limit_exceeded`, not a partial clean report.
- A failing/interrupted input iterator rejects the call; there is no falsely successful partial output.
- The report explicitly says `coverage:'provided_stream_only'` and `migrationAuthorized:false` **even for an empty or collision-free input stream**. Full collection coverage and source accuracy cannot be proven by a pure analyzer.
- Row identifiers and codes are held temporarily **in process memory** to detect cross-record duplicates. This is not anonymous processing and still requires approved minimization, device safety and retention if ever fed real customer data.
- Aggregated counts can themselves be sensitive for tiny groups. A DPO-approved disclosure threshold is required before sharing live aggregate output outside restricted audit systems.

## Test evidence requirements
`tests/memberReferralMigrationInventory.spec.ts` includes seven offline pure tests for duplicate owners, repeat rows, contradictory ownership, invalid/missing codes, non-disclosure of identifiers, bounded-resource failure and interrupted iterator. The tests use only synthetic values. **No exact-head CI or unit PASS is claimed until separately observed.**

## Explicitly unimplemented / release blockers
The analyzer is **not** a migration runner or a backfill, has no cloud connection, does not approve an inventory scope, cannot establish complete scanning/pagination, and does not create registry entries. Before any data-bound inventory, require documented Security/DPO/Legal authorization for data access, least-privilege read scope, aggregation disclosure threshold, pagination checkpoints, integrity reconciliation, collision quarantine and secure deletion of temporary audit material.

Before live code ownership enforcement, require the [proposed registry ADR](ADR_MEMBER_REFERRAL_ATOMIC_CODE_OWNERSHIP_2026-10-30.md) acceptance, legacy import and claim-time verification, real staging token tests, deletion/retry/rollback proof, independent Product/Security/DPO/SRE/release approval. No Klar+ benefits, age/KYC or reward permissions are enabled by this report.

**Governance:** child Draft branch stacked on #219, no direct `main`, frozen PR #119 / RC R2 unchanged. No manual CI dispatch, live Firestore reads, migration writes, merge or deploy. P0 #48 and go-live #8 remain OPEN / NO-GO.

## Verified exact-head CI checkpoint (2026-10-30)
- [Draft PR #220](https://github.com/Veselin-Takev/Klar-Dating/pull/220), source SHA `8091cd6811e2c9ab8713a8c771468dfa22ba4c6a`: [Enterprise CI #41123682738](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41123682738) **completed/success**, validate job `124296600259` **completed/success** with zero failed job steps.
- Original job log confirms `tests/memberReferralMigrationInventory.spec.ts (7 tests)` PASS, `tests/rules.spec.ts (88 tests)` PASS, and **202/202 test files** PASS. This verifies the pure supplied-stream classifier, not completeness of any customer inventory.
- The subsequent [Draft PR #221](https://github.com/Veselin-Takev/Klar-Dating/pull/221) introduces independent offline **provided-page continuity** checks, with a separate exact-head CI required. A chain of caller-supplied cursors is **not** a cryptographically or server-verified Firestore snapshot.
- No live data, manual workflow dispatch, migration, server route activation, merge or deployment. **Production remains BLOCKED / NO-GO.**
