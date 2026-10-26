# Developer guide

## Purpose

This guide is the shortest safe path from a clean checkout to a reviewable change. Read [Project status](PROJECT_STATUS.md) before changing release, security, data, accessibility, or operational behavior.

## Prerequisites

- Node.js 22.23.3 or a compatible Node 22 release satisfying `package.json#engines`
- Bun 1.4.2 for the app; npm 10.9.2 for the separately locked Functions package
- Java 21
- Docker
- Firebase CLI dependencies installed through `bun ci`
- A Firebase project for integrated development, or the local Auth, Firestore and Storage emulators

## Initial setup

```bash
# Run from phase2_work/
bun ci
npm ci --prefix functions --ignore-scripts --no-audit --no-fund
cp .env.example .env.local
```

Never commit `.env.local`, access tokens, Firebase service-account keys, production exports, test reports containing personal data, or copied production payloads.

## Run locally

Standard development server:

```bash
npm run dev
```

Isolated Auth, Firestore and Storage emulator environment:

```bash
npm run dev:lokal
```

Use the emulator path for feature and test work with synthetic data. Emulator hosts require a demo-prefixed project and use the default database; they cannot silently inherit the production project or named database. Database initialization failures return service unavailable rather than replacing durable storage.

For integrated cloud development, use Application Default Credentials and the explicit project/database configuration. Consent persistence requires a 32-character-or-longer signing secret; provision it through the secret manager for production.

Browser Sentry tracing is disabled. Error reporting requires current consent and emits only allowlisted technical error fields. Do not re-enable default SDK integrations without reviewing their data flows.

## Trust, chat and release contracts

- `AuthContext` reads authorization fields with `getDocFromServer`. Do not reintroduce local age/consent flags, cached snapshots or state from a previous account as permission grants. Persist through the API, then refresh the authoritative profile; failed confirmation must remain visible.
- Route explicit browser error reporting through `reportClientError`. Its in-memory consent state comes from the authenticated server profile and resets on logout, failure or revocation. `beforeSend` independently minimizes events. Do not emit raw request URLs, bodies, storage contents, metrics or traces through another SDK path.
- `useChatGate` owns the fail-closed UI status. Server handlers use `readChatAccess` inside their Firestore transaction: membership, either-direction blocks and required gate answers cannot be skipped. Clients cannot write gate counters or messages directly.
- Text message requests can include a UUID `clientMessageId`. Retry the same draft with the same ID; changing text with an existing ID returns 409. Clear the draft only after a successful persistence acknowledgement. History loads at most 100 recent messages; older-history pagination is not yet provided.
- `deploy/templates/` contains source JSON, without an image. The release workflow runs `scripts/release-manifests.mjs render` with the Buildx digest, inspects that registry reference and uploads deployable JSON plus checksums. Do not restore root placeholder manifests or deploy source templates.

The regression mapping and precise limitations are in [the current remediation record](AUDIT_2026-09-27.md).

Production and local builds enforce [the bundle budget](BUNDLE_BUDGET.md) using Vite's generated manifest. `npm run check:bundle` rechecks an existing build and writes `dist/bundle-report.json`; CI and release evidence retain the report. Do not raise thresholds merely to make a build pass.

### Feature-flag operations

Feature flags are configured only through the typed list in src/server/platform/featureFlags.ts. Server startup validates KLAR_FEATURE_FLAGS, KLAR_KILL_SWITCHES, and every KLAR_ROLLOUT_<FLAG> variable before initializing storage. Unknown names and rollout percentages outside 0..100 are configuration errors; do not rely on silent fallback for production changes. Kill switches still take precedence over forced enablement so incident response can disable a feature immediately.

## Architecture boundaries

### Client

- React and TypeScript live under `src/`.
- Screen-level orchestration belongs in screen or route components.
- Shared interaction behavior belongs in reusable components or hooks.
- Do not bypass `authFetch` or duplicate global authentication behavior.
- Keep accessible names, focus behavior, error state, loading state, offline state, and reduced motion in the definition of done.

### Server

- `server.ts` owns the Express runtime and API composition.
- Authenticate before authorization.
- Operational and admin routes must perform explicit role checks.
- Do not authorize by email address, document-name patterns, client claims without verification, or user-controlled object identifiers.
- Bound request sizes, validate shape, apply timeouts, and avoid returning stack traces or dependency details.

### Data

- `firestore.rules` is default deny.
- Client writes remain blocked unless a narrowly reviewed rule and test justify them.
- Server-side state changes should be transactional and idempotent where retries are possible.
- New personal-data fields require classification, purpose, retention, export, deletion, and access-control decisions.

### Platform

- `src/server/platform/` contains launch-platform controls such as deterministic feature decisions.
- Feature flags require an owner, rollout plan, metric, kill switch, and removal date.
- Runtime objectives are defined in `ops/slo.json`.

## Common validation commands

### During implementation

```bash
npm run typecheck
npm test
```

### Security and architecture changes

```bash
npm run check:enterprise
npm run test:rules
npm run test:enterprise
```

### Accessibility changes

```bash
npm run check:kontrast
npm run test:a11y
```

Automated accessibility tools find only a subset of WCAG issues. Complete the manual matrix in [Accessibility standard](ACCESSIBILITY.md) for material UI changes.

### Browser flows

```bash
npx playwright test
```

Add or update browser coverage for the full user-visible behavior, including the error and recovery path. Do not rely only on the public entry-page Axe scan.

### Production candidate

```bash
npm run release:verify
docker build --pull -t klar-app:local-verification .
```

## Test expectations

A change is incomplete without the narrowest reliable regression test.

| Change type | Minimum evidence |
|---|---|
| Pure algorithm or parser | Unit and boundary tests |
| React interaction | Component test plus keyboard and accessible-state assertions |
| API behavior | Authenticated API test including forbidden and invalid cases |
| Firestore access | Emulator-backed allow and deny tests |
| Critical user journey | Playwright happy path and recovery path |
| SLO or scaling change | Reproducible load test and cost/resource comparison |
| Retention or deletion | Timestamp validation, deletion test, and operational evidence |
| Release or rollback | Dry run or controlled drill record |

Critical journeys include identity, guest upgrade, onboarding, music preferences, discovery, matching, chat, safety/reporting, legal consent, export, deletion, verification, offline behavior, and dependency failure.

## Pull-request checklist

- [ ] Behavior and risk are described.
- [ ] Tests reproduce the intended behavior and the relevant failure case.
- [ ] TypeScript and applicable quality gates pass.
- [ ] Authentication and authorization remain explicit.
- [ ] Personal-data purpose, retention, export, and deletion are addressed.
- [ ] Keyboard, screen-reader semantics, reflow, focus, contrast, motion, and error recovery are considered.
- [ ] SLO, logging, metrics, alerts, and runbooks are updated where applicable.
- [ ] Documentation links do not claim more than the evidence proves.
- [ ] Feature flags include owner, metric, kill switch, expiry, and cleanup issue.
- [ ] No credentials, personal production data, sensitive runtime test artifacts or local environment files are committed. Reviewed audit documents belong in `docs/`.

## Release workflow

1. Merge only after required checks and independent review.
2. Create a protected semantic-version tag.
3. Preserve the generated SBOM, checksums, provenance, and image digest.
4. Deploy the exact digest as a no-traffic candidate.
5. Verify `/api/health` and `/api/ready`.
6. Start the 10% canary and observe SLO, error, safety, and cost signals.
7. Promote explicitly or execute rollback.
8. Record approvals, observations, final digest, and any exception.

Follow [Production runbook](PRODUCTION_RUNBOOK.md) for authoritative operational steps.

## Troubleshooting

### Firebase access denied

- Confirm that the emulator is running for local tests.
- Confirm the expected authenticated UID and role.
- Add a rule test before changing `firestore.rules`.
- Do not relax default-deny behavior to make a local flow pass.

### Readiness returns 503

- Liveness may still be healthy.
- Check Firestore connectivity, credentials, and dependency timeout.
- Treat readiness failure as a traffic-routing signal, not a reason to make liveness depend on external systems.

### Playwright cannot start

- Confirm Java 21 and browser installation.
- Ensure ports used by the local API and Firebase emulators are free.
- Run the same `npm run dev:lokal` command configured in `playwright.config.ts`.

### Accessibility test passes but the flow is unusable

- Axe does not validate every interaction or assistive-technology behavior.
- Reproduce with keyboard only, then NVDA with Chrome and VoiceOver with Safari.
- Verify focus entry, focus order, focus restoration, announcements, reflow, and error recovery.

## Documentation updates

Use [Documentation index](README.md) to find the authoritative document. Update documentation in the same pull request as the behavior it describes. Dated audits remain historical snapshots; update [Project status](PROJECT_STATUS.md) for current readiness.

## Maintenance and reproducible validation

### Container dependency installation

The active phase2_work/Dockerfile uses the pinned Bun build image and bun install --frozen-lockfile. After building, it reinstalls the production dependency graph with --production. The Node runtime receives the built output and production dependencies. Do not substitute npm ci for the app graph: its canonical lockfile is bun.lock. Functions retain their separate npm lockfile.

CI policy: the Enterprise CI/CD and Playwright workflows run for **every pull request**, including stacked pull requests whose base is another review branch. Push-triggered CI remains limited to `main`. Do not treat documentation-only checks on a stacked PR as sufficient release evidence; both the full `validate-and-test` gate and critical browser journeys must run on the exact integration head.

Run `npm run check:functions` to compile maintenance jobs and verify their Frankfurt endpoints. Deployment requires `FIRESTORE_DATABASE_ID` matching the API database; no default is inferred. Follow [Firebase operations](FIREBASE_OPERATIONS.md) before any deployment.

Use `npm run test:ci` for the API and isolated emulator suite, `npm run test:production` for the built server, and `npm run audit:inventory` after structural changes. CI uses the locked Firebase CLI 15.31.0, Node 22.23.3 and Java 21. Emulator tests run serially across files to avoid shared database resets; Playwright retries remain zero. Port preflight fails rather than terminating unrelated processes.

Audit the app with the pinned Bun toolchain and the Functions package with npm against their respective committed lockfiles. Follow the SCA/release workflow rather than generating a competing app package-lock.json to satisfy an npm audit command. A green threshold gate still allows moderate findings; retain and review the full report.


## Increment 28 September 2026

The language API is `PATCH /api/account/preferences`, authenticated, with the strict JSON body `{ "language": "de" | "en" | "es" | "fr" }`. It updates only the current account. Unsupported values/extra fields return 400, missing identity 401, persistence failure 503. The UI changes immediately and reports persistence failures. `npm run check:i18n` checks all key and interpolation sets; TypeScript checks key usage. Catalog completeness is not full screen translation coverage.

AI calls mounted in `server.ts` use `createBudgetedAI` within the authenticated request context. Do not introduce direct SDK clients or retry loops that bypass reservations. Daily UTC budget configuration, timeout behavior, retention requirements and limitations are documented in [the current audit](AUDIT_2026-09-28.md#betrieb-und-tco). The unused Gemini cache prototype is not an enabled cache or a measured cost saving.

Payment webhook regression tests sign local fixtures with the Stripe SDK and use the isolated Firestore emulator. They do not charge cards or establish real provider readiness. Return URLs use the configured HTTPS origin allowlist. Keep completion markers and entitlement changes within one database transaction; cancellation tombstones must survive delayed events.

## Explicit local-only durable fallback

The durable fallback is **not** a production or staging recovery mechanism. Enable it only for local development with both `NODE_ENV=development` and `KLAR_ALLOW_DURABLE_DB_FALLBACK=true`. Production, staging, and ordinary emulator operation use the native Firebase Admin Firestore client; backend initialization failures fail closed.

The durable adapter does not provide independently verified Firestore transaction atomicity, batch atomicity, recursive deletion, or consistent post-commit mirroring. Do not use it for billing, consent, KYC, account deletion, or other compliance/security integration testing. Use the isolated Firebase Auth, Firestore, and Storage emulators with synthetic fixtures instead. Do not commit local durable data.
