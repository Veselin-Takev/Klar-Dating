# Klar — Final Enterprise Release Verification

**Stand:** 15.09.2026

## Freigabestatus

- GitHub/GitLab Source Upload: **READY**
- Enterprise Release Package: **READY**
- Direct Production Deployment: **BLOCKED until CI release gates pass**

The source tree has been hardened for the launch strategy focused on local density and meaningful connections. No production certification is claimed from the local environment alone.

## Implemented launch/product hardening

- Local launch cities with density bands.
- Verified, active, local recommendation pool.
- Deterministic Meaningful-Connection scoring and explicit match reasons.
- Activation funnel and activation score endpoint.
- Founding 500 cohort with transactional allocation and no fake scarcity.
- Referral generation fails closed without configured secrets/public URL.
- Referral secret requires a 32+ character deployment secret.
- Activation metadata is allowlisted and bounded to reduce PII leakage.
- Onboarding and local-city selection feed the activation funnel.
- Match explanation has a deterministic non-invented fallback.
- No fake referral URL fallback.

## Security corrections

- Admin namespace endpoints use centralized role authorization.
- Authorization supports direct Firebase custom claims as well as role/roles claims.
- Verification decision supports moderator/trust-safety/admin roles explicitly.
- Fixed a real `ChatView` error-path reference (`setProfile` → `setProfileData`).
- Fixed a real `klarCore` missing import for `toPublicProfile`.

## Static verification performed locally

PASS:
- Secret scan
- CSP directive audit (12/12)
- Accessibility contrast audit
- Service Worker pass-through audit (10/10)
- Firestore rule null-access audit (0 violations)
- Production-data gate (no bundled sample profiles)
- KI strategy audit (23/23)
- Accessible button-label audit (0)
- Route inventory: no remaining undefined symbol findings from the route scanner
- TypeScript syntax checks of all modified TS/TSX files: no parser errors detected

## Full release gates still required

The current execution environment exposes Node 22.16.0 while the repository requires Node >=22.22.2. `npm ci` therefore cannot be executed normally here. A dependency installation attempt with the engine override also timed out. As a result, the following are intentionally **not marked PASS** locally:

- full `npm run typecheck`
- Vitest/Node test suites with installed project dependencies
- Firebase emulator integration/rules suite
- Playwright E2E suite
- Vite/esbuild production build
- complete `npm run release:verify`

The repository CI must run these on Node 22.23.x before a production tag/deployment is allowed.

## Release gate

Production deployment is approved only when all CI checks are green and the resulting immutable artifact is the artifact that gets deployed.
