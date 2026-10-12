# Accessible isolated-view back navigation — 2026-10-12

## Scope and routing
A shared `BackNavigation` control provides a native button (keyboard-activatable, 44px minimum touch target, focus ring and accessible label) in the legal information views (including withdrawal information), Klar+ purchase view and profile settings. It navigates to the previous in-app history entry if React Router has one; otherwise a trusted route fallback is used. No untrusted redirect URL is accepted.

ProfileSettings compares edited interests with initial interests and asks before discarding unsaved data. Klar+ disables back navigation while the checkout request is pending, avoiding accidental interruption. The existing legal page had a hard navigation anchor which has been replaced by SPA navigation. The repo currently contains withdrawal information in Rechtstexte; no distinct `/withdraw` form was identified in the inspected route map, so a separate contract withdrawal form has not been invented.

## Validation evidence
A focused Vitest test covers direct-entry fallback and cancelling the unsaved-changes confirmation. The full production gates `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, and `npm run build` remain **NOT EXECUTED** in this environment because no full checkout exists and the available Node version is 22.16.0 instead of the project's pinned 22.23.3. No complete production ZIP has been produced. A successful CI on this exact PR head plus security/accessibility review and operational release evidence will be required before any GO. Do not consume Actions minutes beyond the owner's 100-minute ceiling without explicit permission.

## Future checks
Review all remaining isolated modal/form routes, test keyboard and screen-reader flow, inspect unsaved-field tracking in multi-step checkout and withdrawal endpoints if they are subsequently added, and audit contrast in both themes. Production release: **NO-GO**.
