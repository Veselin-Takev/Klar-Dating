# Consent onboarding: local session fallback by authentication mode

Date: 2026-10-12. Release status: **NO-GO pending verification**.

## Decision matrix

| Mode | Persistence and navigation | Server authorization |
| --- | --- | --- |
| Anonymous Firebase guest | UID-scoped sessionStorage, read-back confirmation, then continue | No server evidence claim |
| Not authenticated | Isolated sessionStorage key (unauthenticated-session), read-back confirmation, then continue | No identity claim; age verification remains a separate required gate |
| Registered user, successful authoritative evidence | Existing server POST, evidenceId + profile reread before continue | Server-authoritative |
| Registered user, POST acknowledges a decision but lacks evidenceId | Store local preference and continue | Not sufficient to enable optional server-side processing; server permission remains fail-closed |
| Registered user, API error, missing acknowledgement, or evidence/profile mismatch | Error remains visible, no false server success | Fail closed |

Both voluntary choices remain equivalent, default disabled, and neither can forge a durable `evidenceId`. Local session preferences are not a GDPR Article 7 server audit ledger. Account permissions must depend on the authoritative consent engine, not the fallback storage. No bypass of the separate mandatory adulthood verification has been authorized.

## Verification
New tests exercise guest, unauthenticated and acknowledged-account-without-evidence paths. Existing tests continue to cover no acknowledgement and mismatched authoritative evidence. Full pinned toolchain, typecheck, Vitest, emulator and browser acceptance have not been executed in this environment. Do not merge, deploy or grant release approval until these gates pass. Production remains **NO-GO**; issue #8 remains open.

No manual GitHub Actions run has been started. Account for the cumulative 100-minute hard cap before any new CI run; ask for explicit authorization before further 200 minutes.
