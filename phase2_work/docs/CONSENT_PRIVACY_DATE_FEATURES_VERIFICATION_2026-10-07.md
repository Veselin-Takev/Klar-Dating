# Klar Enterprise — Consent / Privacy / Date Features Verification

Date: 2026-10-07
Master: v149

## Scope

This verification covers the four requested high-end features represented by the supplied UI references:

1. Granular consent management
2. Privacy screen lock
3. Date Planner and Date Calendar
4. Date-preparation checklist with UID-scoped offline synchronization

## Static verification

- `npm run check:consent-center` — PASS
- `npm run check:privacy-screen` — PASS
- `npm run check:date-planner-boundary` — PASS
- `npm run check:date-prep-checklist` — PASS
- `npm run check:legal-updates` — PASS
- `npm run check:language-switcher` — PASS
- `npm run check:design-system` — PASS
- `npm run check:chat-translation` — PASS
- `npm run check:kontrast` — PASS

## Consent / GDPR controls

The UI uses the authenticated `/api/einwilligung/zweck` endpoint. Server persistence is transaction-based and produces a signed HMAC-SHA256 evidence record. Firestore client writes to the consent evidence and audit collections are denied by rules. Art. 9 withdrawal invokes the existing sensitive-field purge path.

## Privacy screen

The screen lock activates manually, after two minutes of inactivity, and when the document becomes hidden. Unlock is an explicit user action. No biometric capability is fabricated or required.

## Date Planner / Calendar

Date plans and availability are stored below the authenticated user's Firestore namespace and can only be written through the authenticated API. The API validates the connection, verification state, active state, block relationships, city and Vibe. Reminder scheduling is server-side and idempotent.

## Checklist

Date-preparation checklist state is stored in UID-keyed IndexedDB for offline continuity and synchronized to `users/{uid}/checklists/date_prep` through an authenticated API. No legacy browser-local calendar/checklist persistence remains.

## Release-gate limitation

The repository-level feature gates pass in the current runner. The six full release commands cannot all be green in this environment because the runner has no installed `typescript`, `vitest`, Firebase CLI/emulators, Vite or cached Playwright package. These are environment/toolchain blockers and must not be represented as production PASS.
