# Klar Vercel age-gate / API / asset incident — 2026-11-06

**Observed site:** https://klar-dating.vercel.app. **Status: production NO-GO; review-only branch.**

## Verified observations

| Symptom | Evidence | Partial correction |
| --- | --- | --- |
| Age gate blocks a valid adult date | POST `/api/account/alter` is HTTP 404, GET `/api/account/status` HTTP 404. Vercel production deployment of Vite frontend is main SHA `96c3857c53f5ced31fe1394895185f42c75bc716`. Its Express API backend is not deployed as Vercel Functions and project routing rules are empty. | Vercel Function proxy routes `/api/:path*` to a separately approved Cloud Run origin, or responds with explicit 503 when unconfigured. Never fake successful age verification. |
| Missing Klar logo | Component references `/Klar_Logo.png` but only `/public/logo.svg` is checked in. | Use `/logo.svg` and retain an accessible fallback. |
| Missing favicon and icon | No `favicon.ico` or `icon.png` in `public`; default browser and notification views request them. | Declare `/logo.svg` as favicon and change stale icon references. Check native notification compatibility separately. |
| Firestore WebChannel Listen 400 and occasional QUIC timeout | Browser console shows 400 from Firestore; frontend selects a named database in its Firebase configuration. Causes such as nonexistent database, App Check, permissions or auth have **not** been verified. | Do not guess a replacement ID, weaken Firestore rules, or write `isAdult` directly from the browser. Verify against GCP/Firebase live project and actual database before a separate fix. |

Read-only Vercel evidence: project `klar-dating` (team `ves3`) has no configured project environment variables and no project-level route rules. The production-alias deployment is `dpl_ATWswvF6oCqGw3eRcQfSFAXqmMX3`, sourced from main SHA `96c3857...`. A successful preview is not a production fix.

## Deployment topology and guard

The Vite frontend issues same-origin `/api/account/alter`, `/api/account/status` and consent calls. Those APIs exist in `src/server/routes/account.ts` under the separate Express backend, designed for a reviewed Cloud Run service. Vite alone does not provide them.

The review branch adds `vercel.json` with API-first routing and an SPA fallback, and a server-side `api/proxy.ts` handler. The proxy requires **both** `KLAR_API_UPSTREAM_ORIGIN` (exact HTTPS origin of independently approved backend) and `KLAR_API_ALLOWED_HOST` (exact lowercase pinned hostname). No such origin has been confirmed, so neither variable was configured and no live API has been enabled. Without them, the proxy returns `503 api_upstream_not_configured` with no-store response headers. It does not return 200 for age, forward unapproved proxy headers or follow backend redirects. Real user authentication, rate limiting, age/consent authorization, Firestore writes and tenant guards remain on the backend.

**Do not** put Firebase Admin service-account JSON or backend credentials into `VITE_*` client variables. Confirm Cloud Run IAM and a suitable server-to-server authorization arrangement with AppSec; do not make a protected backend public just to satisfy a smoke test.

## Mandatory preview-to-production evidence

1. Confirm GitHub exact-head CI, Vercel preview build and correct project root (`phase2_work`). Check that `/api/proxy` actually deploys as a function, not static HTML.
2. Confirm independent approved Cloud Run backend, HTTPS/hostname, identity, Firebase Admin project and **actual** Firestore named database, Auth/App Check and rules.
3. Configure the two proxy environment variables on a **reviewed preview environment only**; ensure both hostnames match exactly. Rebuild preview with config and verify route forwarding, error handling, 401/400, 429 and 5xx.
4. Run `KLAR_VERCEL_PREVIEW_URL=https://<approved-preview>.vercel.app/ node scripts/check-vercel-live-api.mjs` from `phase2_work`. It sends **no real birth dates or authorization headers** and requires unauthorized API routes to reject requests. If preview is SSO-protected, use an approved protected-deployment test mechanism, not public bypass credentials.
5. With a controlled staging test account, verify `/api/account/alter` stores and re-reads the same authorized DOB/isAdult, consent is recorded separately, underage is rejected, and account status cannot be read without auth. Never manually modify production `isAdult`.
6. Confirm logo/favicon requests are 200; check Firebase errors using correct database ID, rules, App Check and GCP logs without exposing personal records. Confirm full accessibility/browser acceptance and Cloud Run readiness, staging canary and independent release signoff.

## Release constraints

The underlying P0 cross-service Firestore/GCS photo-purge TOCTOU (VES-5) remains unresolved and separate from this Vercel fix. No unsafe browser-side age override, production Cloud IAM change, live Vercel promotion or PR merge is authorized. `productionApproved=false`, **NO-GO**. The live 404s will persist until an approved backend, environment and deployment are actually connected; code alone cannot establish that infrastructure.
