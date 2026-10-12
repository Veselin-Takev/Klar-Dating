# Accessible isolated-view back navigation — 2026-10-12

## Scope and routing
A shared `BackNavigation` control provides a native button (keyboard-activatable, 44px minimum touch target, focus ring and accessible label) in the legal information views (including withdrawal information), Klar+ purchase view and profile settings. It navigates to the previous in-app history entry if React Router has one; otherwise a trusted route fallback is used. No untrusted redirect URL is accepted.

ProfileSettings compares edited interests with initial interests and asks before discarding unsaved data. Klar+ disables back navigation while the checkout request is pending, avoiding accidental interruption. The existing legal page had a hard navigation anchor which has been replaced by SPA navigation. The repo currently contains withdrawal information in Rechtstexte; no distinct `/withdraw` form was identified in the inspected route map, so a separate contract withdrawal form has not been invented.

## Validation evidence
A focused Vitest test covers direct-entry fallback and cancelling the unsaved-changes confirmation. The full production gates `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, and `npm run build` remain **NOT EXECUTED** in this environment because no full checkout exists and the available Node version is 22.16.0 instead of the project's pinned 22.23.3. No complete production ZIP has been produced. A successful CI on this exact PR head plus security/accessibility review and operational release evidence will be required before any GO. Do not consume Actions minutes beyond the owner's 100-minute ceiling without explicit permission.

## Future checks
Review all remaining isolated modal/form routes, test keyboard and screen-reader flow, inspect unsaved-field tracking in multi-step checkout and withdrawal endpoints if they are subsequently added, and audit contrast in both themes. Production release: **NO-GO**.

## CI browser acceptance remediation (2026-10-12)

PR #14 run [38287394814](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38287394814) passed 164 Vitest files (1,074 tests) and 25 of 26 browser tests. The sole failure was `tests/e2e/legal-and-safety-flows.spec.ts` looking for a **link** named 'Zurück zur App'; the implementation intentionally replaced the anchor with an accessible **button**. The test also expected an unconditional root redirect even after navigating among legal tabs, contrary to the documented previous-in-app-view behavior. Commit `629b0889033699220c9aec87e561184a825a374e` now asserts button semantics and return to the immediately preceding AGB tab. Direct-entry route fallback and unsaved-form confirmation remain covered separately by `tests/backNavigation.spec.tsx`.

This is a test-contract correction, not a relaxation of application logic. **Exact-head CI still needs to pass**; production release remains NO-GO pending complete gates and operational approvals. No manual GitHub Actions run initiated. Observe owner's 100-minute Actions budget ceiling.
