# P0 #47 — Klar product claims, verification UI and glossary: source-bound audit

**Audit date:** 2026-10-23  
**Decision:** **BLOCKED / NO-GO**. **Issue #47 remains OPEN**, without Product, Brand or Legal signoff.  
**Exact inspected source:** Draft [PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119), `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, not merged.  
**Audit location:** isolated documentation-only branch `docs/ci-governance-audit-2026-10-23`. The observations below apply to that exact source snapshot; **no test was run and no deployed production system was inspected**.

## 1. Executive findings and severity

| Finding | Evidence from exact SHA | Impact / disposition |
| --- | --- | --- |
| **P0/UI-TRUST-01: Unconditional "verified" badge in chat list** | [`src/screens/Chats.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/screens/Chats.tsx): `parseChatProfile()` drops all verification state; `DismissableChat` renders `<ShieldCheck aria-label="Verifizierte Verbindung" />` for **every** chat. The header also links to profile as `Verifiziert` unconditionally. | **Confirmed static UI logic defect**, not a production reachability claim. Trust designation must be conditional on an authoritative, current `isVerified === true`. Unknown/false status -> no verification badge; header must also reflect real authenticated-user state or use neutral copy. |
| **P0/CLAIM-02: 8–12 daily profiles are not established by the inspected API** | [`src/screens/Tips.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/screens/Tips.tsx) promises `Nur 8–12 Profile am Tag`. [`src/server/routes/profileRecommendations.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/profileRecommendations.ts) parses `limit` with default **12** and accepted query range **1–30**; [`launchPlatform.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.ts) returns up to that limit per request. | **Mismatch between marketing copy and observed per-request contract.** No stateful daily 8–12 recommendation quota has been demonstrated from these paths. A separate [`DAILY_CONTACTS = 8`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/pure.ts) limits **first-contact messages**, not recommended-profile requests. Do not conflate. |
| **P0/CLAIM-03: Ad-supported free use not supported by inspected MVP policy** | [`src/lib/klarPlus.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/lib/klarPlus.ts) expressly states that no advertisements are delivered and rejects an ad-free selling point. [`src/server/pure.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/pure.ts) documents deletion of ad-based contact boosts. [`Chats.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/screens/Chats.tsx) describes removal of a button that claimed a reward without delivering it. | Existing external copy about watching short advertisements for extra free use **must not be represented as active** without a newly implemented, verified and legally reviewed revenue/consent/SSV flow. Free core access and **advertisement-based** access are different claims. |
| **P0/CLAIM-04: Klar+ purchasability and incentives** | [`src/lib/klarPlus.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/lib/klarPlus.ts): `BUCHBAR = false`, explanatory `HINWEIS_NICHT_BUCHBAR`; the source documents a `501` checkout gate pending valid payment integration. | Do not promote currently purchasable Klar+, free subscription access, live paid benefits or referral rewards based on a concept. Availability requires actual billing, entitlement, refunds and compliance checks. |
| **P0/CLAIM-05: "Hand-selected" or guaranteed vetted inventory** | [`launchPlatform.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.ts) filters candidate profiles (including `isVerified === true`) and computes an automated compatibility/freshness score. The inspected path does not prove human/manual curation. | Do not use "handverlesen"/manual selection or imply every user will receive 8–12 available real profiles every day without demonstrated human workflow, city-level supply and live data. Recommend truthful wording about **algorithmically selected** verified suggestions, conditional on production validation. |
| **P0/CLAIM-06: Verification authority versus display** | [`src/server/verification/diditKyc.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/verification/diditKyc.ts) handles signed provider decisions and writes `isVerified`. [`launchPlatform.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.ts) exposes public `isVerified: data.isVerified === true`. [`src/server/routes/chat.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/chat.ts) includes a public profile in the authenticated chat-list payload, but [`Chats.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/screens/Chats.tsx) discards its status. | **Remediation can preserve existing authority**: accept only server-derived boolean `true`, propagate it through a strict DTO and conditionally render it. Never derive a verified state from referral links, UI presence, older badges or a client-set flag. Static inspection does **not** substitute for verifying KYC webhook runtime behavior. |

**Overall:** Source code contains at least one concrete false-trust UI logic defect. The product-claim differences are independently significant and require Product/Legal review, UI correction and actual acceptance tests before #47 can be closed.

## 2. Claim-to-proof-to-owner decision matrix

| Proposed production-facing claim | Exact technical predicate | Required acceptance evidence | Proposed owner(s) | Current decision |
| --- | --- | --- | --- | --- |
| "Weniger Auswahl, mehr Raum für echte Gespräche." | Actual navigation, bounded candidate pool and messaging experience | Browser E2E across DE/EN/ES/FR, a11y and realistic test data, no fabricated user experience | Product + Brand + QA | **Draft wording only; not approved** |
| "Bis zu 12 passende Vorschläge pro Abfrage" (only if intended) | Default 12 profile suggestions **per request**, with server query limit between 1 and 30 | API contract tests for query `1/12/30/31`, empty city, empty inventory, duplicated requests; UI truthful request behavior | Product + Engineering + QA | **Technical observation, not approved UI copy** |
| "8–12 Profile pro Tag" | Server-side unique-user/day quota, stable 4:00 reset if intended, 8–12 real eligible profiles where available | Explicit documented business decision, data model/atomic limits, clock-boundary/race tests, real city density; legal claim review | Product + Backend + QA + Legal | **HOLD: not proven by inspected endpoint** |
| "Verifizierte Profile" | Signed Didit decision and authoritative persisted `isVerified`; UI displays badge only if === true | KYC negative webhooks, revocation, stale profile, unknown/null, false and true UI cases, emulator and Playwright with real DTO contract | Security + QA + Privacy | **HOLD UI defect** |
| "Kostenlose Kernfunktionen" | Actual entitlement and user journey without a mandatory purchase | E2E onboarding, contact allowance and full core functionality for nonpaying account; terms and pricing review | Product + Legal + QA | **NOT LIVE-ATTESTED** |
| "Kostenlos durch kurze Werbevideos" | Delivery from real approved ad provider, consent compliance, verified SSV, correct reward and anti-fraud/idempotency | Real provider E2E, security, age/consent, privacy and revenue policy; separate rollback | Product + Finance + Security + Privacy | **DO NOT CLAIM** on current source |
| "Klar+ jetzt abonnieren" | Purchasable entitlement and authoritative payment/rollback state | Signed provider events, happy/error/refund, GDPR and EU cancellation flows; supervised canary | Product + Finance + Legal + QA | **DO NOT CLAIM** while `BUCHBAR=false` |
| "Persönliche Einladungen" | Issuance/claim by existing `/referral`, independent of KYC and partner flows | Authentication, nonce/replay, self-referral protection, consent, shared copy; #48 approval | Product + Security + Privacy | **Limited truthful feature description only** |
| "Von Menschen handverlesen" | Named, auditable human-curation workflow with reviewed identity/availability | Human selection audit, fairness/DSA/privacy review, operational capacity | Product + Brand + Legal | **DO NOT CLAIM** without proof |

**Important vocabulary:** In user-facing copy, use `Verbindungs-Vorschläge`, `persönliche Einladung`, `Klar+-Zeiträume`. Avoid prohibited engagement terminology, invented scarcity, unverifiable testimonials, guaranteed real-world outcomes and paid/verification-based social pressure. Preserve locale-parity DE/EN/ES/FR.

## 3. Targeted remediation design — not implemented under the release lockdown

### A. Chat-list verification badge (highest priority; P0)

1. In the existing `ChatListProfile` DTO, add `isVerified: boolean`. In `parseChatProfile`, parse `isVerified: profile.isVerified === true`. Maintain server authentication and anti-example guards.
2. Render `<ShieldCheck aria-label="Verifizierte Verbindung" />` only when `profile.isVerified === true`. Missing, `null`, malformed, unverified and stale/failed profile states must **fail closed**: never show a verified badge.
3. Replace the static header text `Verifiziert` with a neutral `Verifizierung prüfen` link **unless** a trusted authenticated current-user verification source is fetched and validated. Do not infer user's status from whether `/api/chats` returned successfully.
4. Ensure KYC status updates/revocation invalidate the client view on refresh/auth changes; avoid caching a privileged trust designation across accounts.
5. Add targeted tests: `true` badge, `false` no badge, missing no badge, `null` no badge, malformed no badge, signed revoke/removal, account switch, and screen-reader label only on actual badges. Use real `/api/chats` serialized profile contract in integration coverage.
6. Re-run security KYC authority gates and all mandatory PR exact-SHA CI, emulator and E2E gates **only after** the authorized audit unlock. No application code change in this docs-only audit.

### B. Daily suggestions / quota statement

1. Decide and separately define **profile suggestions per day**, **maximum suggestions per API request**, and **new contacts per quota-day**. They currently represent distinct operations.
2. If strict 8–12 daily suggestions are approved, enforce on the server with consistent time boundary, idempotent snapshots and concurrency guards; test refresh, multi-device, 4:00 timezone/UTC handling, and supply shortage.
3. If not approved/implemented, change copy to an accurate nonnumeric description rather than promising daily allocation. Do not secretly enforce a new cap by changing one parameter without Product decision and fairness/privacy review.

### C. Free/advertising/Klar+ statements

1. Separate **free core functionality** from **ad-based additional allowance** and **paid membership availability** in the canonical claim catalog.
2. Remove or mark ad-supported earning copy as **planned**, not active, absent real delivery + signed rewards.
3. Use `BUCHBAR=false` as a hard marketing availability boundary; do not sell future Klar+ benefits as currently purchasable.
4. Require approved DE/EN/ES/FR product labels, valid accessibility semantics, and a testable claim-to-API proof. Do not generate fabricated personal testimonials.

## 4. Issue #47 acceptance gates — owner action needed

- **Product/Brand:** Approve canonical glossary, separate the three quotas, approve exact customer-facing claim list, and document whether any human curation is actually provided.
- **Security/Engineering:** Authorize and implement the conditional verified UI contract, review account/verification authority, ensure referrals cannot grant a trust badge.
- **QA:** Authorize/execute the targeted negative/positive cases plus real emulator/browser E2E and full CI for the exact amended commit.
- **Legal/DPO:** Assess truthful commercial claims, free/ad disclosure, consent/verification representation, fairness, accessibility and internationalized copy.
- **Release Owner:** Bind all decisions/receipts to a protected commit SHA, verify the original host evidence, independent signoffs and all P0/P1 gates; separately decide #47 issue closure, merge readiness and later production GO.

The release manifest at inspected PR #119 HEAD is NO-GO; the host-evidence intake and mandatory tests are not validated. Do not merge #119, modify `main`, trigger CI, deploy, alter KYC/Firestore or close #47 based on this source audit.

## 5. Audit trail and provenance limits

- Evidence basis: direct repository file reads at `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, GitHub issue #47 and prior product alignment document.
- Verification scope: **static source read**, no runtime calls; the /api/chats source includes server-public profile, but whether every deployed response matches it was not verified.
- No credentials, private user records or sensitive host artifacts copied into this report.
- No actual Product/Brand/Legal/Security approval was obtained.
- No new test run or external CI evidence asserted.
- **NO-GO maintained.**

Related: [P0 Release Evidence Traceability](P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md), [CI Host Evidence Intake](CI_HOST_EVIDENCE_INTAKE_RUNBOOK_2026-10-23.md), [Governance Audit Lockdown](CI_GOVERNANCE_LOCKDOWN_2026-10-23.md).
