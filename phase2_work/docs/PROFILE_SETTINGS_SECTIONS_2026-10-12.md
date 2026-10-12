# Klar Profile Settings Information Architecture — 2026-10-12

## Scope
The real profile settings tab is embedded in `src/screens/Profile.tsx`; `ProfileSettings.tsx` is a smaller separate interests form. The old profile settings tab rendered consent, caching, pause/focus, support, subscription, privacy visibility, language, theme, notifications, subscription management, verification and account destruction in one uninterrupted scroll.

## New layout
Three large, keyboard-accessible, 44px minimum category controls divide the tab into **Sicherheit & Datenschutz**, **Präferenzen & Hinweise**, and **Erweitert & Konto**. Consent and visibility are under privacy, focus/pause and personalization under preferences, and subscription/account lifecycle under advanced. Nonselected section containers use CSS `hidden` rather than unmounting controls, preserving existing state, active modals and subscriptions. Existing signed ledger, statutory cancellation and deletion mechanics remain intact. Earth-tone light background uses #FAF8F5, dark theme retains existing stone palette.

## Verification and release
The targeted static regression test is a structural guard, **not** proof of accessibility or functional behavior. The requested full gates `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test` and `npm run build` are NOT independently executed from a local checkout, and exact-head CI must be inspected. Manual WCAG keyboard/screenreader review, safe focus positioning upon category switch, responsive viewport test and contrast verification remain pending. A complete production ZIP has not been produced; production **NO-GO** until independent technical and operational signoff. Avoid manually rerunning Actions and reconcile use against the owner's remaining 100-minute ceiling.
