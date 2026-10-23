# Klar Safe Core — smallest evidence-gated release proposal
**Proposal only (2026-10-23). Release: NO-GO. No application capability is presently independently certified “100% flawless”.**

## Principle
No engineering process guarantees mathematically bug-free software for all devices, users and future operating conditions. Define “100% verified” as **100% PASS for all mandated gates on the exact enabled release artifact**, zero unresolved critical/high vulnerabilities or release-scoped P0 defects, full negative/rollback E2E evidence and independently signed four-role release approval. Unknown, skipped, cached or historical evidence = NOT PASS.

## Conditional functional allowlist (all unapproved until verified)
1. **Account essentials**: email registration/login, deterministic logout/token revocation, session persistence, verified profile-state hydration and safe account settings. Explicit coverage of offline, repeat requests, failed Firebase ADC, cross-user authorization and persistence. Existing #74 Typecheck/CI FAIL; nothing is certified yet.
2. **Basic, consented conversation**: Entdecken/Verbindungs-Vorschläge, Gespräche, profile and non-AI navigation only where user acceptance, accessibility, DE/EN/ES/FR translations, abuse/report/block and Firestore read/write rules all pass. No claim of guaranteed quantity or hand-selection without actual source/staging evidence.
3. **Mandatory privacy/security**: consent granularity/withdrawal, Art17 deletion/export, Firestore TTL/legal hold/retention, signed KYC authority where trusted-status badges are displayed, privacy overlay and logging sanitization. This is **not optionally excluded** from Core; P0 #70/#56 and security gates must be resolved on the enabled domain.
4. **Operational safeguards**: least-privilege IAM, no secrets in repo or user logs, no browser-cache sensitive response, correct 300ms SLO metric definition, real 30-day fleet evidence, on-call tested notifications, incident rollback/canary and signed artifact provenance.

## Denylist for first release unless separately approved and exhaustively verified
- Monetized **B2B partner campaigns**, stable `klar_referral` token propagation, partner conversion attribution, asserted buyer UID, partner-admin actions and referral-derived Klar+ entitlements. Block routes, scheduled jobs, counters and externally shared links **server-side fail-closed**, not merely by hiding navigation. P0 #55/#56/#70 plus Finance #57 and operational #58 unapproved.
- **Member Referral 2.0 / Invitation Pass / automatic rewards** (P0 #48), until KYC-bound, non-coercive abuse-safe and idempotent eligibility with explicit Legal/Product approvals. Never grant verified badges by invitation.
- Any **new paid subscription/Stripe benefit, vouchers, unproven Klar+ bonus**, or coins/currencies. Existing billing only if independently tested and approved; no change in a Core rescue release without full controls.
- Unverified Product/Marketing claims from #47: “hand-picked”, “8–12 local daily”, unlimited Free usage, universal verification, special early access or rate/discount promises. Copy must accurately match tested behavior, DE/EN/ES/FR, legal basis and Product/Brand sign-off.
- AI Coach, translator, experimental ranking or other components with unverified consent/PII/budget/a11y/safety/E2E. Navigation labels can exist only if they do not suggest inoperable functionality or mislead users; affected routes/features must be disabled safely.

## Exact artifact release gate
- Release Owner/Product fix **one exact immutable source SHA, target branch, allowlist, denylist, legal claims**; main is not assumed release-ready simply because it exists.
- GitHub admin proves valid **base-branch CODEOWNERS**, real independent reviewer identities, branch-protection/ruleset enforcement and approvals. Do not use #119 HEAD-only owner changes to approve its current Draft BASE.
- Security + Release Owner approve corrected **Gate07 Bun application + npm Firebase Functions** dependency audits, and authentic pinned Gitleaks/Semgrep scanners. Reject lockfile bypasses and unapproved replacements.
- On an authorized **genuinely free** enterprise host with Node.js **22.23.3**, Bun **1.4.2**, Docker and original Git provenance, obtain **15/15 mandatory PASS**: three TS configs, lint, unit/integration, emulator, Playwright, security/SCA, build/smoke, release provenance and the full scoped suite.
- Product/SRE approve actual **30-day fleet histogram/PromQL**, P95 ≤/below 300ms semantics, no-traffic UNKNOWN handling, burn-rate paging, real alert delivery, SLO and cost budgets.
- DPO/Legal authorizes verified Art17 cascade/consent, privacy notices, legal holds, ACTIVE TTL on intended project/database and retained mandatory finance records. E2E concurrent/race/refund/rollback fail-closed negative tests are required.
- Staging isolated from production; reproducible immutable image/SBOM/attestation, tested canary and rollback, exact deployed SHA. **Security, DPO/Legal, SRE/Operations, Release Owner 4/4 independent final signoffs.**
- **Any missing evidence, test failure, changing SHA, open release-scoped P0 or unapproved costs = NO-GO.** Do not label 100% PASS from local static screens or past PR CI alone.

## Proposed merger/launch order
1. **No merges now.** Repair #120 policy coupling and #121 TS18048 on separately approved change branches; no unsafe “force green” changes.
2. Independently review **#68** documentation and **#69** scoped security/privacy safeguards, compare against current main, requalify candidate SHA. Clean up #63/#65/#66/#67 after accepted successors.
3. Decide release scope to exclude partner/referral/reward expansion, then isolate Core with real server-side feature denial, correct statements and mandatory privacy controls. **This exclusion is a proposal, not implemented or authorized.**
4. Prove full qualified test/monitoring/operations gates and four independent signoffs; only then GO.

**Earliest release date unknown**, despite previous optimistic planning windows. No PR today is evidenced 100% releasable. Reassess schedule only after blockers/host/legal approvals are resolved. Retain current production state until that time.
