# ADR — Production CSP fail-closed with isolated local emulator exception (2026-10-19)

**Status:** Proposed security change on the unmerged integration branch. **Release decision:** NO-GO.

## Observed problem and threat

`server.ts` previously used `NODE_ENV === "production" && VITE_EMULATOR !== "true"` to decide whether Helmet emits an enforcing CSP. An accidental or untrusted `VITE_EMULATOR=true` in an otherwise production deployment could turn off CSP entirely. The `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` variables were also directly appended to CSP sources, including production hosts if leaked into deployment configuration. A mere static check for the existence of 12 directives did not cover these runtime decisions.

OWASP recommends an enforced HTTP Content-Security-Policy header; `Content-Security-Policy-Report-Only` cannot replace enforcement. Reference: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html .

## Decision

1. `src/server/cspRuntimePolicy.ts` determines enforcing CSP based on `NODE_ENV=production`, `KLAR_RUNTIME_ENV=production`, or recognized Cloud service markers (`K_SERVICE`, `GAE_ENV`, `FUNCTION_TARGET`, `FUNCTION_NAME`). The front-end Vite flag can **never disable production CSP**.
2. Emulator HTTP/WS sources in `connect-src` and Firebase Auth iframe sources in `frame-src` are suppressed on production/Cloud runtimes. They are permitted only for explicitly authorized local smoke tests: `NODE_ENV=production KLAR_RUNTIME_ENV=local KLAR_ALLOW_LOCAL_EMULATOR_CSP=true`, without Cloud service markers.
3. `npm run start:lokal` sets these opt-in local smoke values without changing production deployment configuration. `npm run check:csp` now runs both existing 12-directive static checks and three Node 22 runtime-policy regression tests.
4. This is a targeted boundary hardening, **not** an independent guarantee that a deployed reverse proxy/CDN actually serves the expected CSP. Manual HTTP-header, Browser CSP Evaluator, Firebase login/iframe and service worker smoke tests remain required.

## Security limitations and accepted tradeoffs

- A development build can still omit Helmet CSP to support local Vite tools; production deployments must declare the appropriate runtime environment.
- An explicitly mislabelled non-Cloud deployment (`NODE_ENV=development` with no production/Cloud markers) is not automatically detectable by this policy. Infrastructure must fail closed on release and deployment configuration checks.
- The smoke opt-in must **never** be configured in production secrets, cloud environment variables or CI release jobs. Production CSP does not get disabled even if those flags are mistakenly supplied, but local emulator source expansion would be an avoidable exception outside recognized Cloud runtimes.
- No connection-string, secrets, application business state or OAuth changes are made by this decision.

## N-1 compatibility and rollback

No Firestore index, collection schema, field name, API response, permission, data migration or persistent user state changes. The previous binary remains schema-compatible (N-1). Rollback is a **code-only** revert of the feature branch after security-owner approval; it must **not** be deployed simply to reintroduce the CSP bypass. For local emulator tests after rollback, remove the new opt-in flags from the `start:lokal` script as part of the same reviewed change. Existing Cloud policies and data are never automatically reverted.

## Verification

- Node 22.23.3: `npm run check:csp` PASS (12 directives + 3 runtime regression tests).
- Exact HTTP response-header behavior in deployed browsers: NOT VERIFIED.
- Full TypeScript/Vitest/Firestore Emulator/E2E/release Build: BLOCKED in this offline checkout without installed dependencies.
- Independence of Security/SRE/Privacy reviews: PENDING.

**Production NO-GO.**
