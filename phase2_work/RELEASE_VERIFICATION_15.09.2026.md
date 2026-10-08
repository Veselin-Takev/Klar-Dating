# Klar — Release Verification 15.09.2026

## Changes applied

- Removed the committed runtime environment file containing a real-looking Gemini credential.
- Removed the hard-coded Firebase server password and switched server Firestore access to Firebase Admin/ADC.
- Removed insecure audit-key fallbacks; `AUDIT_LOG_SECRET_KEY` is mandatory when audit encryption is used.
- Made the server honor the platform `PORT` variable.
- Replaced simulated translation success with a real translation-service call or an explicit no-result fallback.
- Stopped the mail worker from marking messages as delivered when SendGrid is not configured.
- Disabled the unverified AdMob reward callback instead of granting quota from an always-true signature check.
- Disabled the mock identity-verification provider/routes until a real provider integration and webhook verification are configured.
- Removed client-side fabricated AI opener fallbacks.
- Added secret scanning, GitHub CI/release automation, GitLab CI, Docker production packaging, health check, and Playwright self-start configuration.
- Removed historical repair scripts and generated test/build artifacts from the production source package.

## Executed checks in this environment

- JavaScript/MJS/CJS syntax checks: **PASS**
- Secret scan: **PASS**
- Git whitespace/diff check: **PASS**
- Firebase public configuration completeness: **PASS**
- Node engine declaration: **PASS**
- Hook/static naming/template checks: **PASS**
- Accessibility button-label check: **PASS (0 findings)**
- AI endpoint strategy check: **PASS (23/23)**
- WCAG contrast check: **PASS**
- CSP directive check: **PASS (12/12)**
- Service Worker routing check: **PASS (10/10)**
- Firestore resource null-access check: **PASS (0)**
- Route inventory: **PASS; 59 routes, 23 AI routes**
- Script reference check: **PASS (0 missing)**
- Effect/network dependency check: **PASS (0)**
- package.json / package-lock root dependency metadata: **PASS**
- GitLab/GitHub YAML parsing: **PASS**

## Not honestly executable here

The execution environment provides Node.js **22.16.0**, while the project requires **>=22.22.2**, and it has no usable npm registry/network access. A fresh `npm ci` therefore cannot complete. Consequently these gates are configured in CI but are not falsely marked green in this local report:

- full dependency installation
- full TypeScript compilation against installed project dependencies
- complete Vitest suite
- Firebase emulator rule execution
- Playwright browser E2E
- production Vite/esbuild build
- Docker image build

The GitHub/GitLab pipelines use Node.js **22.23.3** and make these gates mandatory before a semantic-version release tag is promoted.

## Release status

**Prepared production-source release / Release Candidate.**

Do not promote to production until the CI pipeline on Node.js 22.23.3 completes green and the target environment has real secrets, Firebase IAM/ADC, monitoring, backups and a tested rollback image configured.
