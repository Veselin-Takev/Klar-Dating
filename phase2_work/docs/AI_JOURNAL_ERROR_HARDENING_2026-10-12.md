# AI Date Debrief / Journal: resilient request handling — 2026-10-12

## Scope and confirmed findings
The current repository does not contain `AIngCoachService.ts`. The actual feature is `src/components/SmartDatingJournalWidget.tsx`, with two direct API calls to `/api/generate-reflection-from-emojis` and `/api/dating-journal-analysis`. Previously these requests did not check HTTP status or validate response shapes, and the analysis catch logged the error without displaying a useful user-facing failure. The emoji path returned a generic error. Network timeouts were not enforced at this UI boundary.

## Changes
Shared `src/lib/journalAiRequest.ts` now limits request duration to 15 seconds, distinguishes HTTP 429 from service and malformed-response errors, and aborts timed-out fetches. Both widget paths validate their expected response shapes and display accessible inline alerts; journal notes and selected vibes remain available for retry. No invented Key Learnings, Pros/Cons or success state are shown after errors.

## Budget policy
`src/server/aiBudget.ts` already reserves budget atomically in Firestore before provider requests and enforces 15-second SDK timeout. `src/server/kontingente.ts` separately classifies hourly quotas. Do not bypass either control after 429 or transaction failures. The UI fallback is **non-entitlement-bearing**: the user can keep editing a draft, but no new AI inference occurs without valid budget, identity, authorization and consent checks. Any real provider or budget changes require server review and integration tests.

## Verification status
Targeted tests were added in `tests/journalAiRequest.spec.ts` for success, quota exhausted, invalid schema, service failures, and abort/timeout. The requested full gates `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, and `npm run build` have NOT been independently executed in this environment. A complete production ZIP has NOT been created. Treat the branch as unverified until exact-head CI and independent review finish. No manual GitHub Actions runs; respect the user's remaining 100-minute usage ceiling.

Release remains **NO-GO**, including Issue #8 production evidence.
