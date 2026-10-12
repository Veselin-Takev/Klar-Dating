# Consent onboarding: local session fallback by authentication mode

Date: 2026-10-12. Release status: **NO-GO pending verification**.

## Decision matrix

| Mode | Persistence and navigation | Server authorization |
| --- | --- | --- |
| Anonymous Firebase guest | UID-scoped sessionStorage, read-back confirmation, then continue | No server evidence claim |
| Not authenticated | Isolated sessionStorage key (unauthenticated-session), read-back confirmation, then continue | No identity claim; age verification remains a separate required gate |
| Registered user, successful authoritative evidence | Existing server POST, evidenceId + profile reread before continue | Server-authoritative |
| Registered user, POST acknowledges a decision but lacks evidenceId | Store local preference and continue | Not sufficient to enable optional server-side processing; server permission remains fail-closed |
| Registered user, API error, missing acknowledgement, or evidence/profile mismatch | Error remains visible, no false server success | Fail closed |

Both voluntary choices remain equivalent, default disabled, and neither can forge a durable `evidenceId`. Local session preferences are not a GDPR Article 7 server audit ledger. Account permissions must depend on the authoritative consent engine, not the fallback storage. No bypass of the separate mandatory adulthood verification has been authorized.

## Verification
New tests exercise guest, unauthenticated and acknowledged-account-without-evidence paths. Existing tests continue to cover no acknowledgement and mismatched authoritative evidence. Full pinned toolchain, typecheck, Vitest, emulator and browser acceptance have not been executed in this environment. Do not merge, deploy or grant release approval until these gates pass. Production remains **NO-GO**; issue #8 remains open.

No manual GitHub Actions run has been started. Account for the cumulative 100-minute hard cap before any new CI run; ask for explicit authorization before further 200 minutes.

## CI regression triage – 2026-10-12

PR #12 run [38234343831](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38234343831) failed in the Vitest Tests gate: 2 assertions in `tests/consentUi.spec.tsx` expected an error from registered-user authoritative evidence validation but the mocked auth user was `null`, so the component correctly used the new unauthenticated local session branch and no alert appeared. The failing test fixtures have been corrected to explicitly use a non-anonymous authenticated identity; the success case with a matching authoritative receipt is similarly made explicit. New parameterized coverage confirms both button choices operate locally without network calls in an unauthenticated session. Commit: `e3eecf3890c4b264634a81eb615e941aa22a7a20`.

**Security boundary:** no production consent check or evidence requirement was altered by this test-only fix. Local fallback is not an Article 7 server consent ledger and must never enable optional server processing. This fix remains UNVERIFIED until the exact-head CI and privacy review pass. Production **NO-GO**; avoid manually launching Actions and reconcile the owner's 100-minute cap.

## E2E CI follow-up — run 38286292642 (2026-10-12)

The preceding PR #12 run passed 164 Vitest files / 1,081 individual tests, but **Browser acceptance failed**. The failures shared a 30-second timeout in `tests/e2e/identity-helpers.ts:55`: the helper awaited a `POST /api/einwilligung` after clicking **Nichts davon** for an anonymous Firebase guest. Under the reviewed guest-local consent design, no such POST should occur. This was a stale test contract, not evidence that the new guest UI request failed.

Changes: `b40bc0d2fae882e4819d361bed734bb42ce6cb65` adds an explicit `guest | registered` test mode; for guests, it verifies sessionStorage consent purposes instead of waiting for a nonexistent response; for registered users, it continues to require an actual successful server POST and `evidenceId`. Commit `9104e526ac59d1b6c02a22f962ce34bfbce763ff` adjusts the onboarding test to assert guest-local storage and expressly selects the registered server-evidence path in the registration test. Productive consent logic was **not** weakened to satisfy tests.

The revised browser suite has **not yet been proven PASS at the new PR head**. In particular, navigation after guest page reload requires review against the application gate contract. The production release remains **NO-GO**; no manual Actions jobs were started, and cumulative consumption against the owner's 100-minute cap must be reconciled before further execution.

## Browser acceptance second failure – AuthGate transition
Run 38287990487 passed 164 Vitest files / 1,081 tests but failed five Playwright cases waiting for Hauptnavigation. Root cause: EinwilligungUndAlter stored a UID-bound guest decision locally, while AuthGate continued to demand an authoritative `profileData.einwilligung.version`; the component had no completion callback to trigger a gate re-evaluation. Commit `af7db0bb` makes AuthGate accept a previously stored UID-scoped guest choice only for completion of the guest UI step and passes a completion callback to rerender immediately. This does not grant optional AI/analytics consent or forge a server HMAC ledger. Recheck exact-head CI and guest reload/identity switch; production NO-GO.
