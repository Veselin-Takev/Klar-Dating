# Klar Design-System Hardening — 2026-10-07

## Scope

Application-wide readability and interaction consistency, with focused remediation of `ChatView` and `MessageBubble`.

## Implemented

- Global canvas token standardized to `#FAF8F5`.
- Serif typography is applied consistently to `h1`–`h3`; body/UI text remains in the sans-serif face.
- Global body baseline is 16px with 1.5 line-height; long-form copy primitive uses 1.65 line-height and a 68ch measure.
- Shared `klar-page`, `klar-card`, `klar-input`, `klar-icon-button`, `klar-chat-scroll`, and `klar-chat-message` primitives added to the central stylesheet.
- Interactive controls use a minimum 44px target where the shared primitive is used; existing 24px WCAG minimum remains enforced globally.
- Focus-visible treatment remains centralized and keyboard-safe.
- Reduced-motion and forced-colors behavior remains centralized.
- Chat message bubbles use readable 16px text, 1.62 line-height, whitespace preservation, improved padding and restrained width for long conversations.
- Audio-message transcription preview uses readable text sizing and spacing.
- Chat timestamps use a legible 12px treatment instead of 10px microtext.
- Chat input uses a 16px shared input primitive, 44px send target, visible focus ring, and existing Enter/Shift+Enter semantics.
- Chat header is now semantic `<header>` and the message region uses a dedicated scroll/readability primitive.
- Layout and application shell consume the shared page primitive rather than maintaining an independent visual shell language.

## Accessibility / contrast evidence

`npm run check:kontrast` passes all configured WCAG thresholds after the canvas update:

- Body text: >= 4.5:1
- UI outlines: >= 3:1
- Text on accent: >= 4.5:1

A dedicated `check:design-system` gate validates the central design tokens and Chat accessibility/readability contracts.

## Release-gate status

The six requested commands were executed exactly. The current runner does not contain the project's installed dependency toolchain, so the following remain environment-blocked rather than falsely marked PASS:

- `npm run check:enterprise` — blocked because package `typescript` is absent from `node_modules`.
- `npm run typecheck` — blocked because the configured type packages are absent.
- `npm run test:pure` — `vitest` executable absent.
- `npm run test:rules` — `firebase` executable absent.
- `npx playwright test` — Playwright is not locally cached and registry access is unavailable.
- `npm run build` — `vite` executable absent.

These environment limitations are not treated as production verification.
