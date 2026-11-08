# Final source baseline certification — v0.1.1-rc1

**50/50 registered candidates complete. `baselineFixed=true`; `productionApproved=false`.** Human review and merge sign-off remain pending in PR #358, which consolidates #356 and #357.

## Immutable evidence

- Source: `951b16b243354321ca9c2c31bde8deab9e00060a`. [Full Enterprise CI: SUCCESS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42504754895).
- Main comparable baseline: **1636/1636 PASS** = 1524 Vitest / 206 files + 86 Enterprise Node + 26 Playwright.
- Dedicated Rules: 118 repeated PASS; excluded from addition. The repeated launch-platform six tests are also excluded.
- Additional mandatory checks are recorded separately: 12 Admin SDK anti-bypass tests, 4 SAST coverage tests, 6 IAM and 4 collection-inventory tests, plus other CI policy regressions. They are not added to the comparable main-suite total.
- Typecheck, Functions build, production application build, emulator production smoke, Enterprise static gates and pinned Semgrep boundary fixtures: PASS.
- Strict repository Semgrep 1.184.0: **0 findings, 0 diagnostics/parser errors**, 616 rules, 1152 scanned targets. Downloaded JSON inspected; ZIP digest verified against GitHub artifact metadata.
- All **681/681 first-party runtime source files** across app, Functions, server and scripts occur in the JSON scanned-target list. The coverage denominator excludes test/spec suites, declarations and vendored/generated code. Semgrep default exclusions remain explicit; this is not a claim that every documentation or third-party byte is analyzed.
- TypeScript AST evidence: **0 explicit AnyKeyword nodes across 128 production server/core-auth/Functions files and server.ts**. Historical client/test inventory is not relabeled as a repository-wide zero-any proof.

Machine evidence: [WAVE3_VERIFICATION.json](WAVE3_VERIFICATION.json), [batch register](MIGRATION_BATCHES.json), [private infrastructure hashes](ADMIN_INFRASTRUCTURE.json), [empty legacy inventory](LEGACY_ADMIN_ACCESS.json).

## Final seven candidates

| Candidate | Result |
| --- | --- |
| Functions native factory | Returns closed maintenance repository; explicit database and trusted configured tenant |
| Server composition root | Scoped health, verified-claims checklist factory, scoped audit writer and private lifecycle API |
| AI budget | Tenant-global counters, native transactions and atomic owner/erasure fences |
| AI cache | Scoped cache, owner/erasure fences, atomic expiry cleanup and provenance stripping |
| API native factory | Private native client; closed production repository APIs; no automatic local fallback |
| In-memory store | Explicit local-only, empty and tenant-scoped; no synthetic age/consent/account grants |
| Durable store | Explicit local-only JSON repositories, tenant-separated snapshots, atomic writes, exclusive lock and stale-writer rejection |

The 50-file denominator is unchanged. Four coupled maintenance scripts were migrated separately and do not inflate that denominator. Legal seeds and profile repair are dry-run by default; `--apply` and explicit trusted tenant configuration are required. No live command was applied.

Native SDK construction is still necessary inside **two exact private factory files**. The canonical repository owns native refs and transactions. Four reviewed infrastructure modules are hash-pinned; this is not an unrestricted directory exemption. The working-tree AST guard detects untracked raw SDK use, constructor aliases, raw fixture imports, dynamic/namespace imports, re-exports, computed raw methods and infrastructure drift. Tests exercise these failures. `getDb` is only a loopback demo-emulator compatibility hook, denied in production/cloud and statically banned from application imports.

## Scope and operational gates

The certified code baseline covers the supported default-tenant API and explicitly configured maintenance tenants. It does not assert mathematical impossibility of all future access paths or certify effective deployed IAM. Admin SDK bypasses client Rules; the repository is an application control, not an IAM sandbox. IAM manifests match the documented source model. Production migration flags remain off outside synthetic validation.

No production deployment, IAM apply, data migration, payment, refund, production deletion or merge was performed. Effective service-account grants, reviewed data cutover, production ACTIVE-TTL evidence and external-service/verification-photo fencing remain production gates. Physical verification-photo purge remains hard-disabled. Provider-wide aggregate AI spend is an operational control separate from tenant-global database counters. The latest Vercel Preview is READY for the certified source commit; this clears the earlier rate-limit build obstacle, but does not attest runtime production IAM or approve a promotion.

`releaseGovernance.decision=NO-GO`, `candidateVerified=false`, `fullPreflight=BLOCKED` and `productionApproved=false` remain intact. Baseline certification permits human review of PR #358; it does not approve production.

## Verification corrections

An initial overloaded local startup exceeded the fail-closed deadline; a clean isolated startup succeeded. The first local main-suite run had 1,522 PASS and two timeouts in the old payment fixtures. Those fixtures created competing Vite servers and used retired routes. They were replaced with concrete Stripe-signature and unauthenticated subscription checks against the harness-owned loopback API; their targeted rerun passed. An intermediate immutable CI scan reported two HTTP findings for an IPv4 loopback literal in those tests. The tests now identify localhost explicitly; no rule was disabled or suppressed. The final full CI above is authoritative and passes all 1524 Vitest tests.

## Review gate

**CERTIFIED_PROCEED — source baseline only.** Stop for manual code review and merge sign-off on PR #358. `PROMOTE` is required before the requested merge; production approval remains a separate human decision.
