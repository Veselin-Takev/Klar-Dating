# CI remediation audit — 2026-10-10

Production decision: **NO-GO**. These targeted fixes are not a complete candidate acceptance.

## Verified evidence from previous CI attempts

- PR #9, run 38077022435, validate job 114286034640: 159 Vitest files passed, five failed during import because Node's built-in `node:test` was loaded through Vitest/Vite; 1035 test assertions passed. Commit under test: `286a991e776885199bb1028d380e239821de88ac`.
- PR #10, run 38082617231, validate job 114302474816: `Offline queue index regression` failed at `scripts/offline-replay-auth.test.mjs` because the assertion required a previous transaction syntax. 28/29 Node assertions passed. Commit under test: `64a0f2c959f292d25186ecf687f65d7e13b83305`.

## Targeted remediation

- PR #9: exclude `scripts/*.test.mjs` from Vitest discovery. This does not remove dedicated `node --test` executions.
- PR #10: assert that the chat access guard runs inside the actual asynchronous Firestore transaction, rather than insisting on the outdated one-expression arrow callback. The identity mismatch check remains asserted.

## Required verification

1. Run dedicated Node regression tests and Vitest discovery with the frozen installation on each exact new head SHA.
2. Complete the full clean-checkout release preflight (Node 22.23.3, Bun 1.4.2, Java 21), including integration tests, TypeScript, Firebase emulator, production build and Chromium/Playwright.
3. Independently reconcile remaining Actions minutes before any manual rerun, observing the additional 100-minute limit.
4. Close issue #8 operational evidence and obtain human release authorization. Do not merge or deploy until the exact candidate passes all gates.

No manual Actions rerun, merge, or deployment was initiated for this remediation. Earlier CI failures are *diagnosed*, while the new commits are *unverified*.

Branch scope: PR #9.
