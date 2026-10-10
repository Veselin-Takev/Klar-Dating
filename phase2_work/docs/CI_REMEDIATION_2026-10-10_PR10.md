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

Branch scope: PR #10.

## Follow-up: CI run 38083324966 (2026-10-10)

The latest observed validate job 114304624097 moved past the earlier offline-replay assertion and failed the Typecheck step. Four exact TypeScript diagnostics were recorded:

- `src/screens/AdminDashboard.tsx:126`: getSyncLogs now requires the authenticated owner UID. The dashboard was changed to read the UID from AuthContext, query only those logs, and clear the list when no signed-in user exists.
- `src/server/platform/productionControls.ts:74-75`: a single array entry was considered possibly undefined under strict indexed access. An explicit fail-closed guard was added before dereference.

Both corrections were committed to this PR branch; **the resulting exact SHA has not been validated with the complete frozen toolchain**. The last CI result is therefore not proof of a successful release. No manual Actions rerun, merge or deployment was requested. Automatic PR-triggered runs, if any, still count toward the user's hard **100-minute cumulative cap**; actual billed consumption and remaining authorized balance must be independently reconciled before initiating further runs.

Keep **NO-GO** pending full preflight, live operational controls (issue #8), and explicit accountable approval.

## Follow-up: strict TypeScript indexed access (2026-10-10)

CI run `38084712603` at SHA `005fb2ce43859138c1a0d3e77d87c416da788a3f` failed at Typecheck on four `TS2532` diagnostics in `tests/aiPiiSanitizer.spec.ts:45-48`. The test file now uses optional index access for these assertions under `noUncheckedIndexedAccess`, preserving all four expected values including the unmodified source and encoded inline media. Change commit `5f6df3ada270de3f2a18ae82b0acab89b84793d0`.

The fix is **committed, not yet proven by a full exact-head preflight**. CI results for a different SHA cannot release this candidate. No manual remote rerun, merge or deployment authorized; reconcile cumulative GitHub Actions usage against the user's strict 100-minute cap before initiating further jobs. Production remains **NO-GO** pending complete gates and independent operational signoff.

## Follow-up: CI run 38085333471, test discovery and chat safety (2026-10-10)

The observed run for prior head `87af6d7296989eab58369699c9ff211df58cc54e` failed during Tests: 16 `scripts/*.test.mjs` files were collected by Vitest even though they use Node's built-in test runner, and two `tests/chatSafetyEnforcement.spec.ts` assertions failed after the test mock omitted the required Firestore preflight `tx.get`. The production message handler was not modified.

Targeted fixes committed: `fa4afd7b3c8abf00fbb1f97ebed04e6dbfd76ad6` excludes Node-runner files from Vitest collection; `e91341a559edc7249c4b8da01ae84887bbc3c67f` makes the transaction mock return a missing document so the existing chat safety assertions exercise the intended branch. Dedicated `node --test` coverage remains mandatory and must not be skipped.

**Verification status: NOT YET VALIDATED at the new full head.** The failures were diagnosed from actual Actions logs, but successful CI, real production controls, and release signoff have not been demonstrated. Maintain **NO-GO**. Do not manually trigger Actions without independently reconciling cumulative usage against the user's 100-minute ceiling; request explicit approval before a further 200 minutes.
