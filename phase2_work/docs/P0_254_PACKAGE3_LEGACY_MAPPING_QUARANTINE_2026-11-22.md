# P0 #254 Package 3 — Legacy Tenant Mapping & Quarantine Dry-Run

**Baseline:** `main@b516d56cec7ffb21f45e9544e3cc015391071697` (Tree `19274303931cf84596d8208a28f33bf43715e800`; PR #400 merged).  
**Status:** Draft implementation; exact-head CI/Audit evidence **[TO VERIFY]**.  
**Release invariant:** P0 #254 remains **OPEN**; `productionApproved=false`; production **NO-GO**.

## Purpose and boundary

Package 3 supplies a deterministic, side-effect-free classification engine and a local-file-only report generator. It processes synthetic fixtures against an explicit, reviewed, row-level manifest. It is not a migration, a tenant-assignment authority, a production cut-over, or evidence of live data state.

The existing `tenantContext.ts` and `tenantRepository.ts` are architectural references only; this package does not modify or wire them into routes. No server route, Rules file, workflow, dependency, or runtime integration is changed.

## Mapping invariant

A record may be `MAPPED` only if exactly one row-level manifest entry exists, the entry is explicitly reviewed, has a non-empty evidence reference, contains a schema-valid tenant ID, and its tenant, owner and complete participant evidence agree with the synthetic record. The owner must be present in the participant list; participant IDs must be unique and complete.

All other records are `UNMAPPED` and quarantined. Missing evidence, ambiguous candidates, owner contradictions, orphaned records, incomplete participants, cross-tenant multi-party records, duplicate/colliding entries, invalid tenant IDs and forbidden-inference-only records cannot be mapped. Structural manifest corruption aborts the entire run closed.

## Forbidden tenant inference

No tenant may be inferred from `uid`, `pairId`, composite participant IDs, `providerId`, KYC/session IDs, email hashes, document IDs, hostnames, profile fields, request headers, or any other legacy identifier. No default tenant exists. Agreement among weak identifiers does not substitute for an explicit reviewed mapping row.

## Quarantine semantics

`UNMAPPED` means no tenant authority was established. It is a deny-by-default quarantine classification, not a deletion, relocation, or access grant. Reports include a stable reason code and never contain real UIDs, email addresses, KYC data, or production records.

## Offline report bundle

The CLI reads only local JSON fixtures and a local manifest and writes `mapping-report.json`, `mapping-report.csv`, `mapping-report.md`, `manifest.sha256`, and `fixtures.sha256`. Stable record ordering, fixed engine version and explicit offline run parameters make identical inputs reproducible. No network, database, Firebase SDK, emulator, staging or live connection exists in this implementation.

## Synthetic test matrix

The fixture suite covers: approved unique mapping; missing entry; multiple candidate tenants; contradictory owner; orphaned record; incomplete participant list; cross-tenant chat; UID-only; pairId-only; providerId-only; duplicate/colliding manifest entries; and invalid tenant ID. Additional tests prove input immutability, no default-tenant fallback, malformed-manifest abort, duplicate record quarantine, deterministic report hashes and absence of network/database/Firebase imports.

## Explicit non-goals and exclusions

- No Firebase Admin, Firestore, Storage or Cloud SDK imports.
- No emulator, staging or live database access; no `--apply`, write-back or migration mode.
- No changes to `tenantContext.ts`, `tenantRepository.ts`, `server.ts`, existing routes, `firestore.rules`, `storage.rules`, or `src/server/routes/complianceStorage.ts` (503 interlock).
- No changes to `.github/workflows/`, dependencies or lockfiles.
- No real UID, email, KYC or other PII in fixtures or reports.
- No production authorization, live tenant assignment, or change to `productionApproved=false`.

## Draft evidence lifecycle

The immutable baseline above is certified by Klar Enterprise CI Run [#45035415288](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45035415288) and Enterprise Compliance & Security Audit Gate Run [#45035415323](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45035415323), both on exact main SHA `b516d56cec7ffb21f45e9544e3cc015391071697`. This branch's own CI and Audit runs remain **[TO VERIFY]** until observed on its exact PR HEAD.
