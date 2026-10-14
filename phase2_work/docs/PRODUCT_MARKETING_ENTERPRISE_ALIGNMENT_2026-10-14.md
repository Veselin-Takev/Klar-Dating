# Klar v149 — Product & Marketing Enterprise Alignment (2026-10-14)

**Decision: Concept needs targeted revision before Referral 2.0 coding; PRODUCTION NO-GO.** Reviewed source: user-provided `enterprise_product_marketing_concept (1).md` (Draft, 2026-10-14), sections 1–7. Product assessment against actual GitHub main, inspected `f423afeb60cdce82a94330b2daf2d3c4a332e512`; status is a point-in-time repository inspection, not a live deployment audit.

## Alignment and important corrections

| Concept element | Existing source baseline | Decision |
| --- | --- | --- |
| Intentional dating and low-noise referrals | 8–12 suggested profiles, verification gate and calm interface exist in code, but live population/retention not demonstrated | **Fit**; use verifiable claims |
| P2P Member Pass/WhatsApp/iMessage | `src/components/LocalLaunchWidget.tsx` shares `/api/referral`; `src/server/routes/launch.ts` supports code generation and claims | **Partial**, needs safe deep links, controlled share UI, attribution, expiration |
| Quality gate/reward | Referral attribution records `referredBy` and `referralQualified:false`; no end-to-end verified-referral Klar+ payout established from inspected paths | **Gap**, do not infer completion from existence of a field |
| 'Verified' badge for invited user | `isVerified` must follow the signed Didit identity flow | **Reject** automatic badge claim |
| Waitlist bypass / exclusive passes | Claim/waitlist eligibility not demonstrated | **Hold claims** until real enforceable policy |
| Premium-only sharing/extended-filter incentives | Klar's real Free promise / clear Klar+ time rewards | **Revise**: no pressure/paywall, reward as fixed-duration Klar+ only when economically and legally approved |
| Marketing templates A/B/C | Draft uses forbidden glossary words and fabricated first-person wine-bar/date narratives | **Rewrite** with truthful, editable copy, no false social proof or FOMO |
| B2B partners | `partnerReferralCore`, `partnerReferralService`, `partnerReferrals` and `PartnerReferralWidget` already implement distinct consent-backed partner campaign path | **Do not duplicate** P2P referrals and partner campaigns |
| In-app booked date packages | Booking, merchant of record, refunds, SLA, location safety, EU legal and provider contracts not established | **Defer** marketplace |
| Coaching/psychology add-ons | Medical/therapy regulatory, vulnerable-user and Article 9 privacy risks | **Defer** pending specialist review |
| AI prompts and coach | Existing coaching utility; no evidence new model infrastructure is needed | **Optimize existing** with privacy, rate limit, cost guardrails |

## GitHub delivery backlog (effort ranges are rough planning assumptions, not measured engineering estimates)
- **P0** [#47](https://github.com/Veselin-Takev/Klar-Dating/issues/47): claims/glossary/Free and verification alignment — 1–3 person-days; quality very high; ROI high through avoided rework.
- **P0** [#48](https://github.com/Veselin-Takev/Klar-Dating/issues/48): idempotent and abuse-resistant verification-based rewards design — 5–10 person-days; quality very high; ROI medium/high if referral funnel proves viable.
- **P1** [#51](https://github.com/Veselin-Takev/Klar-Dating/issues/51): local density and Free promise pilot readiness — 3–6 person-days; ROI very high because cohort liquidity drives user value.
- **P1** [#50](https://github.com/Veselin-Takev/Klar-Dating/issues/50): consent-safe funnel instrumentation and experiment — 3–6 person-days; ROI high via learning velocity.
- **P1** [#53](https://github.com/Veselin-Takev/Klar-Dating/issues/53): Klar+ reward cost model, finance and legal approval — 2–4 person-days discovery; ROI high from cost control.
- **P1** [#49](https://github.com/Veselin-Takev/Klar-Dating/issues/49): low-pressure share sheet, safe app links, preview and rollback — 5–9 person-days; ROI conditional on liquidity and funnel.
- **P2** [#52](https://github.com/Veselin-Takev/Klar-Dating/issues/52): validate three candidate partners, minimal link/coupon pilot — 2–5 person-days for discovery only; ROI unproven.

## Dependencies and delivery gates
1. Align concept (#47) and production controls [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8), with named Product/Legal/Security signoff before touching verified/reward state.
2. In parallel, begin requirements and measurement schema for #48/#50, city-quality baselines #51, and finance model #53; prefer tests and flags, no production reward credit.
3. Only implement/refine P2P invite UI #49 after KYC gating and instrumentation have explicit acceptance tests and a feature-flagged one-city cohort.
4. Only evaluate partner API/commission expansion #52 after real city engagement and unit economics; avoid an in-app bookings/payment marketplace until justified.
5. Use traffic and funnel evidence (verified/activated referred members, D7/D30, reports, CAC per verified active user, gross margin net of KYC, support, fraud, incentives and cloud) to decide rollout. No fabricated ROI figures.

## Existing proven technical evidence and gaps
- Prior user-run clean-worktree baseline: TypeScript 3 targets passed, enterprise policy gates passed, Vitest 178 suites/1,163 tests passed, production build and Firebase-emulated production smoke passed. Those are historical test observations, not tests on this document branch nor live vendor services.
- PRs #41 (onboarding fallback), #42 (Node runtime policy), #44 (Action pins), #45 (active pin enforcement), #46 (historical provenance NO-GO gate) are merged as of this review.
- Release candidate remains **NO-GO** pending real Cloud Run IAM/monitoring, consent and legal end-to-end, alert delivery, secret rotation, operational rollback evidence and independent named approval. A static successful provenance gate explicitly does not mean production release authorization.
- This document creates planning/acceptance criteria. No referral reward, waitlist bypass or paid partner booking is hereby enabled.

## Product decision
**Start specification, technical discovery, measurement planning and copy corrections now.** Start feature-flagged MVP coding after #47/#48 acceptance and security architecture review; avoid a public referral growth launch until #8 release gates, one-city liquidity and qualified-referral economics are proven.
