# Partner attribution: Firebase ID-token revocation boundary — 2026-10-18

**Release status: DRAFT / NO-GO.** Scope: P0 #56; stacked on the visitor consent and anonymous-account protection PRs.

## Finding and correction

The public partner redirect optionally accepts a bearer Firebase ID token to identify a visitor for tracking. Prior code called `verifyIdToken(token, false)`, which verifies token structure/signature/expiry but does **not** additionally check whether Firebase Admin has revoked that account's refresh tokens. Thus the visitor could remain eligible for tracking using an otherwise-valid ID token after administrative revocation until its expiry.

The helper now calls `verifyIdToken(token, true)`. A revoked token, disabled account, invalid token, or Firebase Auth validation failure causes the existing promise rejection to return `null`; `recordPartnerClick` then provides the untracked direct destination. Existing owner and visitor consent, age, account-deletion, anti-bot, campaign status and anonymous-account checks remain in place.

## Explicit trade-offs and limitations

Checking revocation may require a Firebase Auth backend lookup and thus adds latency and operational dependency to the optional token path. Treat unavailable Auth as a non-attributed visitor; do not allow tracking on errors. For already-attached trusted `req.user` claims, this patch does not independently recheck revocation; that trust boundary belongs to the central auth middleware and must be validated independently. Server-side consent is still transactionally enforced, but third-party retention, contract, and real purchase attestation remain unresolved.

## Validation and rollout

Run `node scripts/check-partner-visitor-auth-boundary.mjs` from `phase2_work` for the static guard. Then run true HTTP/Firebase Emulator tests covering revoked token, disabled account, valid permanent account, valid anonymous account, missing token, Firebase Auth outage and revocation/consent race. Execute exact-head Node 22.23.3 mandatory gates, Security/Privacy review and p95 monitoring. Revert only with approval, because it would re-enable a weaker token trust boundary. No cloud writes, CI reruns, migrations or deployment performed.
