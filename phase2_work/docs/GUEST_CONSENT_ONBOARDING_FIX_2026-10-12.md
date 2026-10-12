# Guest consent onboarding correction — 2026-10-12

## Observed defect
The consent gate `EinwilligungUndAlter` expected a server `evidenceId` and a fresh persistent profile even when the Firebase identity is anonymous. Both **Nichts davon** and **Auswahl speichern** therefore remained on the screen with `Der gespeicherte Nachweis fehlt.`.

## Implementation
- Anonymous Firebase guest: save explicit choices under `klar:guest:consent:<uid>` in browser **sessionStorage** and confirm the exact write by reading it back before advancing.
- The three optional purposes are independent booleans and default to false; rejecting all purposes is a valid successful decision.
- Storage is scoped to the anonymous UID and is not a substitute for the signed/authoritative server evidence ledger. No synthetic `evidenceId` is generated.
- Authenticated non-anonymous users retain the existing POST + returned evidenceId + reread of their durable account record. No relaxation of the server-side verification path.
- If session storage is unavailable, fails, or returns inconsistent data, the guest flow stays on the consent step with an error instead of asserting false success.
- Guest choices are session-lifetime preferences only, not an Art. 7 evidence record for future registered-user processing. Optional account-only processing must continue to require server-verified consent.

## Regression coverage
`tests/guestConsent.spec.ts` exercises purpose choices, isolation between guest UIDs, invalid values, failed write confirmation. `tests/consentUi.spec.tsx` exercises both button paths without any server request or profile refresh for anonymous users while keeping the existing registered-user evidence checks.

## Validation and release status
Changes committed to an isolated branch; **full TypeScript / Vitest / browser E2E / Firebase integration are NOT YET VERIFIED**. Do not merge or deploy based on source inspection alone. Production remains **NO-GO**; Issue #8 operational evidence remains open. No manual GitHub Actions runs initiated. Before triggering more CI, reconcile cumulative billed usage with the user's **100-minute limit** and request approval before spending another 200 minutes.
