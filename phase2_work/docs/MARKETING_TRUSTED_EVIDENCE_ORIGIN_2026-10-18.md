# P0 #47 — Trusted source restrictions for marketing claim evidence (2026-10-18)

**Decision:** Draft / NO-GO; stacked on draft #90.

## Finding
The earlier claim-validator accepted any plausibly formatted HTTPS string as 'evidence'. A fabricated or externally controlled HTTPS URL could satisfy the shape gate even when it did not originate in Klar's development evidence trail.

## Change
The manifest gate accepts *only* canonical HTTPS URLs hosted on `github.com` under `Veselin-Takev/Klar-Dating`, without URL userinfo, nondefault ports, query strings or fragments. For each approved claim, at least one implementation reference (commit/PR/file) and one numeric GitHub Actions run URL are mandatory. Distinct URLs, distinct Product/Legal/Brand role identifiers, explicit GO status, and canonical manifest pin remain required. New negative mutations reject foreign hosts, URLs containing credentials, and the absence of a workflow-run reference.

**Important limitation:** Matching a URL string does *not* prove the referenced commit or run exists, that checks passed, that CI used the right code SHA, that tests cover this specific marketing claim, or that GitHub reviewers are authorized. All of those must be checked via authenticated GitHub APIs and independent Product/Legal/Brand review before any release. A complete manifest must never be interpreted as automatic production GO.

## Local verification
`node scripts/test-marketing-claims.mjs`; `node scripts/check-marketing-claims.mjs`; `node scripts/check-marketing-claims.mjs --release` (expected NO-GO, 0/5 claims approved). Run entire Node 22.23.3 mandatory typecheck/Vitest/Emulator/Playwright/build/audit suite before production. Changes are on a draft branch only; no deployment, CI rerun or master merge. #47 and #8 stay open.
