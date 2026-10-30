# P0 #48 — Fail-closed ambiguous member referral ownership (2026-10-30)

**Candidate status:** Isolated Draft feature branch, **NOT VERIFIED** until exact-head CI and independent staging; **PRODUCTION BLOCKED / NO-GO**.

## Source-verified defect and threat
Before this patch, `POST /api/referral/claim` in `src/server/routes/launch.ts` resolved a supplied invitation code with `users.where('referralCode','==',code).limit(1)`. Two users holding a duplicate legacy or corrupt `referralCode` would produce an arbitrary single inviter, allowing incorrect `referredBy` attribution. The 10-character truncated Base64url-derived HMAC code is deterministic but no global uniqueness constraint is enforced by this query. Do not claim that a collision actually happened to users.

This is **attribution integrity**, not proof of qualified KYC or granted premium benefits. `referralQualified` is still set to `false` on first attribution and no reward is issued. The previous [#215](https://github.com/Veselin-Takev/Klar-Dating/pull/215) same-inviter/different-inviter conflict fix is retained.

## Atomic fix
- Query `where('referralCode','==',code).limit(2)`, never `limit(1)`. If **exactly one** matching user is not found, deny with the existing generic `400 {error:'Einladung nicht verfügbar.'}`. Do not disclose any owner identity, resolve arbitrarily or write attribution records. A self-referral also retains its existing generic rejection.
- A uniquely resolvable valid code continues through the existing Firestore transaction, user/deletion-marker checks and explicit existing-attribution conflict gate. No new token format, secret rotation, database schema, KYC claim, referral reward, partner flow or user-visible success contract.
- `tests/launchEndpoint.spec.ts` uses a bounded query mock (respects `limit(2)`), tests **two and three duplicate owner records** for the same code with HTTP 400 and zero `users` / `referral_events` writes, and retains first attribution and same-inviter regression coverage.
- `tests/memberReferralClaimConcurrencyEmulator.spec.ts` adds a **real local Firestore emulator** case with two inviter records sharing a code. It rejects the request with 400, verifies the invitee is not attributed, and confirms no referral event exists for either inviter. Its prior competing-different-codes race remains tested. Synthetic UID-suffixed fixtures and rate-limit document are cleaned up.

## Verification boundaries
- Source changes are **not** verification. Require exact-head CI to report the new `launchEndpoint.spec.ts` cases and **2 real emulator tests** (not skipped), full typecheck, mandatory enterprise gates, build and browser acceptance. Do not inherit 199-file successful CI from #215 ancestor [run 41114655498](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41114655498).
- Integration test uses a synthetic injected password-provider request context; it does not verify a real Firebase Admin ID token. Emulator is restricted to `demo-klar`, expected local port, no prod/fallback mode.
- Staging: confirm that duplicate legacy codes are rare/absent with **privacy-minimized aggregate counts only**. Never export a real referral code, UID, recipient or complete query result. Decide a controlled conflict-resolution policy with Product/DPO before changing stored data or invitation codes.
- Retain current onboarding-appropriate unqualified attribution. Do not award Klar+ periods or claim verified users until separate Didit/KYC, consent, adult, expiry, anti-fraud, Art.17 and Finance/Product release requirements are met.
- A `400` for ambiguous legacy codes can break affected invitation links by design; confirm documented support/incident path and staging rollback. **Do not perform automatic data rewrites or secret rotations** to hide collisions.

## Governance
This change belongs on an isolated Draft PR stacked on #215; no direct `main` commit, merge, production Firebase access, deployment or manual CI launch. Frozen PR #119 / RC R2 stay untouched. Independent Security, DPO/Legal, Product/SRE and Release Owner approvals remain mandatory. Issues #48/#47/#8 and other P0 privacy blockers remain OPEN. **NO-GO**.
