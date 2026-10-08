# Accessibility Standard

Klar targets WCAG 2.2 level AA. Accessibility is a release requirement, not a one-time certification.

## Automated release gates

Every pull request and release must pass:

- TypeScript and component tests.
- `npm run check:kontrast` for governed design tokens.
- `npm run test:a11y` for Axe WCAG A/AA checks, 320 CSS-pixel reflow, and visible keyboard focus.
- The complete Playwright suite, which also executes the accessibility specification.

Automated tools detect only a subset of accessibility defects. A green build is necessary evidence, but is not by itself a WCAG conformance claim.

## Manual acceptance matrix

Complete this matrix for each material user-flow or design-system change and before every production release.

| Area | Required verification | Environments |
|---|---|---|
| Keyboard | All functions reachable; logical order; no trap outside modal dialogs; Escape closes dismissible dialogs; focus is never obscured | Chrome, Firefox, Safari |
| Screen reader | Names, roles, states, errors, headings, landmarks, live regions, dialog entry/exit | NVDA + Chrome, VoiceOver + Safari |
| Reflow and zoom | No loss of content/function at 200% and 400%; 320 CSS-pixel width without two-dimensional scrolling except essential content | Desktop browsers |
| Visual | Text/non-text contrast, focus appearance, dark mode, forced-colors mode, information not conveyed by color alone | Light, dark, Windows High Contrast |
| Motion | Functionality with reduced motion; no unexpected motion or flashing | `prefers-reduced-motion: reduce` |
| Input | Touch targets at least 24 by 24 CSS pixels; labels usable by voice input; errors identified with recovery guidance | Mobile viewport and speech input |
| Cognitive | Instructions are consistent; time limits can be extended or are absent; authentication does not rely on memory puzzles | Critical journeys |

The reviewer stores date, build SHA, browser/assistive-technology versions, tested flows, defects, and evidence link in the release record. A person other than the implementer signs off critical journeys.

## Critical journeys

1. Sign in, guest entry, and account creation.
2. Onboarding including interests, music preferences, email validation, save error, and completion.
3. Profile discovery, matching, chat, and safety/reporting.
4. Consent, privacy, legal updates, data export, and account deletion.
5. Offline, server error, authorization error, empty, and loading states.
6. Payment and identity verification where enabled.

## Defect policy

- **Blocker:** A critical journey cannot be completed with keyboard or supported assistive technology. No release.
- **High:** WCAG A/AA failure with no practical workaround. Fix before release.
- **Medium:** Degraded experience with a reliable workaround. Owner and deadline required.
- **Low:** Usability improvement beyond the current conformance baseline. Track in the accessibility backlog.

Regressions receive the same incident and rollback treatment as other production defects. Accessibility-related customer reports must be triaged with an accessible contact channel.

## Conformance evidence

A public WCAG conformance statement or VPAT/ACR requires a completed manual matrix and an independent audit of the production build. Record the exact product version, scope, exclusions, supported user agents, known issues, and remediation dates. Re-audit after material framework, navigation, authentication, or design-system changes.

## Manual release evidence

For production release evidence, use `docs/accessibility-evidence.template.json` as the starting record and validate the completed copy with:

    npm run a11y:evidence -- path/to/completed-accessibility-evidence.json <exact-40-char-build-sha>

The validator requires the evidence buildSha to match the exact build SHA supplied by the release/CI context, declared scope and environments, an independent reviewer, all seven manual matrix areas marked `pass` with notes and evidence links, and no unresolved Blocker/High findings. A template or partially completed record intentionally fails.

This structure follows the current W3C evaluation approach: define evaluation scope, identify representative functionality, perform human evaluation with relevant assistive technology, and report findings. Automated tools remain supplementary and cannot establish conformance on their own.

References:

- W3C WCAG-EM 2.0 overview: https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/
- W3C accessibility evaluation report template: https://www.w3.org/WAI/test-evaluate/report-template/
- WCAG 2.2 conformance guidance: https://www.w3.org/WAI/WCAG22/Understanding/conformance
