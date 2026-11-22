# P0 #254 Package 5 — Isolated Default-OFF Tenant Route Guard Adapter

**Baseline:** `main@b6093992bbfd5e68ac75ace34861ac36860dfe41` (Tree `4aefa2d8e36e66dfe82c674bba49327faa102b4d`; PR #402 merged).  
**Branch:** `security/p0-254-package5-tenant-route-guard-adapter-20261122`  
**Status:** Draft implementation; no production route is mounted or enabled.  
**Release invariant:** P0 #254 remains **OPEN**; `productionApproved=false`; production **NO-GO**.

## Purpose and isolation boundary

Package 5 composes the existing read-only tenant-context resolver from `tenantContext.ts` with the existing tenant-scoped repository from `tenantRepository.ts`. It is an injectable adapter for a future, separately reviewed route integration. It is not imported by `server.ts`, global middleware or any existing route mount.

The adapter captures only the server-owned configuration value `enabled`. Exactly `true` enables its isolated execution path. Missing configuration, missing property, `undefined`, `false`, `null`, strings, numbers and all other values mean disabled. The disabled branch returns HTTP-style 503 `tenant_route_guard_disabled` before invoking token verification, tenant resolver reads, authorization policy or store operations.

## Five mandatory contract invariants

1. **Default-OFF:** enablement is evaluated from injected server configuration at adapter construction. No request field or client claim can enable it. Disabled calls have zero verifier, tenant, membership, policy and store invocations.
2. **Authentication:** enabled calls delegate Bearer parsing and verification to `createTenantContextResolver`. Its dependency contract requires `verifyIdToken(token, true)`; missing, invalid and revoked tokens return 401.
3. **Tenant authority:** only the verified signed `tenantId` claim plus independently read active tenant and membership records can issue a context. `X-Tenant-ID` and host/subdomain values are equality hints only. Mismatch, missing claim, inactive or inconsistent membership fails closed with 403.
4. **Resource authorization:** only the exact frozen, module-issued `TenantContext` from `tenantContext.ts` reaches `tenantRepository.ts`. The repository derives canonical `tenants/{tenantId}/...` paths and asks the injected trusted server-side policy for exact-path owner/participant evidence before any store call. Request body, query values, roles and routing hints are not policy evidence.
5. **No privileged shortcut:** `admin` and `super_admin` receive no bypass. Repository owner/participant rules apply to every role. Participants may read; only the verified owner may create/update/delete.

## Adapter result contract

- Disabled: `503 tenant_route_guard_disabled`.
- Missing Bearer credential: `401 tenant_authentication_required`.
- Invalid/revoked token: `401 tenant_authentication_failed`.
- Invalid tenant claim, routing mismatch, inactive tenant/membership or inconsistent identity: `403 tenant_context_denied`.
- Resource BOLA/IDOR, invalid evidence, forged context or forbidden participant write: `403 tenant_resource_denied`.
- Resource authority or store availability failure: `503 tenant_resource_authority_unavailable` or `503 tenant_store_unavailable`.

All failure results are frozen. No exception or dependency failure is converted to an allow.

## Test matrix (synthetic identities, injected dependencies, fake store only)

| Area | Adversarial case | Expected proof |
|---|---|---|
| Default-OFF | Missing config, undefined, false, null, 0, string, object | 503 before verifier/resolver/policy/store; all invocation counters zero |
| Authentication | Missing, invalid, revoked Bearer token | 401; verifier receives `checkRevoked=true` when a token exists |
| Tenant claim | Missing signed `tenantId` | 403; no policy/store access |
| Routing hints | `X-Tenant-ID` or host/subdomain mismatch | 403; hints cannot select tenant |
| Membership | Missing, inactive or contradictory server membership | 403; no policy/store access |
| Cross-tenant BOLA | Actor in tenant B against tenant A resource | 403; zero store reads/writes |
| Same-tenant IDOR | Non-owner/nonparticipant actor | 403; zero store reads/writes |
| Evidence integrity | Missing owner, empty/missing/contradictory participant list, wrong tenant/path | 403; zero store reads/writes |
| Policy failure | Trusted policy throws | 503; zero store reads/writes |
| Privileged roles | `admin` and `super_admin` foreign resource attempts | 403; no bypass |
| Participant boundary | Verified participant reads chat, attempts update/delete | Read succeeds; mutation denied; no write |
| Owner boundary | Verified owner mutates tenant-native resource | Success only at canonical `tenants/{tenantId}/...` path |
| Payload isolation | Client payload forges owner/participant/tenant fields | Policy receives only resolver-derived context and canonical path |

The test suite uses no Firebase SDK, live database, emulator, real UID, email, KYC or other real PII. The fake store records every read/write.

## Activation and future cutover prohibitions

- Do not import this adapter into `server.ts`, global middleware or any existing production route.
- Do not set a production feature flag to true or enable this adapter in a deployment.
- Do not activate candidate Firestore/Storage Rules or replace active Rules/config.
- Do not alter `tenantContext.ts`, `tenantRepository.ts`, `legacyTenantMapping.ts`, active `firestore.rules`, `storage.rules`, `firebase.json`, `complianceStorage.ts` (503 interlock), workflows, dependencies or lockfiles.
- No legacy-to-tenant migration, automatic tenant assignment, live/staging scan, real PII, Cloud/IAM/Firestore/Storage/bucket/deployment mutation or production cutover.

## Required independent checkpoints before any future route cutover

1. **AppSec:** independently review bearer revocation, server-only flag provenance, tenant/membership consistency, exact-path policy evidence, BOLA/IDOR negative tests, role non-bypass and fail-closed behavior.
2. **DPO / Privacy:** approve tenant data classification, owner/participant semantics, Art. 17 deletion propagation, retention/legal holds, auditability and data-subject access boundaries.
3. **Backend / SRE:** verify actual deployment identity, server config provenance, observability, rollback and fail-closed operational behavior in a separately authorized isolated staging environment.
4. **Release governance:** require a separate change ticket, exact staging evidence, independent approvals and explicit release decision. Passing this Draft PR's CI does not authorize activation.

## Evidence lifecycle

- Immutable source baseline: `main@b6093992bbfd5e68ac75ace34861ac36860dfe41`, tree `4aefa2d8e36e66dfe82c674bba49327faa102b4d`, after PR #402.
- Klar Enterprise CI [Run #45066992154](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45066992154): exact baseline SHA; SUCCESS — 221 files / 1,737 tests / 0 failed; tenant Rules contract 9/9 on `demo-klar`; Playwright 35/35; Typecheck, Functions Build, Build, Production Smoke and Enterprise Static Gates PASS.
- Enterprise Compliance & Security Audit Gate [Run #45066992124](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45066992124): exact baseline SHA; SUCCESS — Gitleaks 1 commit / approximately 33.59 KB / 0 leaks, CLI v8.24.3 checksum OK, regression 4/4; Tier 1 549 packages and Full Supply-Chain 1,245 packages, both 0 High+; Production Build PASS.
- This Package 5 Draft PR's own CI and Audit Gate runs: **[TO VERIFY]** until completed on its exact final HEAD. Do not transfer baseline run IDs to this PR or create a docs-only SHA-bump commit.
- P0 #254 remains **OPEN**; `productionApproved=false`; production **NO-GO**.
