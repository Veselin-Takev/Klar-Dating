# Reactive Consent Settings, authoritative receipt readback — 2026-10-12

## Root cause and behavior
ConsentSettings previously waited for `refreshProfile()`, but rendered its purpose statuses solely from the AuthContext profile state. The AuthContext fetch can return a server snapshot without applying it when Firestore reports pending local writes, causing an unchanged button despite an acknowledged decision.

The UI now validates both the nonempty receipt `evidenceId` and a matching purpose-specific value from a subsequent authoritative profile fetch. Only then does it set a component-local confirmed state, immediately updating "Erlaubt"/"Nicht erlaubt" without a reload. The override is cleared when the auth UID changes. If the receipt/readback fails or disagrees, the UI shows a failure and does not optimistically claim consent.

The existing server API owns the Firestore transaction and HMAC-SHA256 ledger. This change does not fabricate evidence, write consent client-side, or bypass any server validation. A distinct production issue could remain if the server receipt does not match the server-visible profile; in that case, the fail-closed UX is intentional.

## Regression and verification
`tests/ConsentSettings.spec.tsx` now verifies immediate withdrawal state, successful grants for KI-Auswertung and Fehlerberichte, and evidence mismatch rejection. Initial fixture already grants Produktanalyse, which is covered by withdrawal. The test suite has not yet been run at the current branch head.

Required quality gates: `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, `npm run build` are UNVERIFIED here. A full verified repository ZIP is not available from the current GitHub connector context. Exact-head CI and dedicated consent integration / race-condition tests are required. Release remains NO-GO until operational and privacy signoff. No manual Actions run initiated; owner 100-minute cap still applies.
