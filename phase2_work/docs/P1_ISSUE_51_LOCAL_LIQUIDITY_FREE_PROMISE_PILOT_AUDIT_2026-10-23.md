# P1 #51 — Local liquidity, honest Free usage and one-city launch readiness

**Date:** 2026-10-23 | **Status:** **BLOCKED / PRODUCTION NO-GO; pilot NOT AUTHORIZED**  
**Source:** [Draft PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119), HEAD `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, unmerged, unchanged.  
**Issue:** [#51](https://github.com/Veselin-Takev/Klar-Dating/issues/51) (OPEN during review).  
**Branch:** isolated documentation `docs/ci-governance-audit-2026-10-23`; no app code, pull request, `main`, Firebase database, CI or production changes.

**Method:** Read-only exact-commit GitHub source review and acceptance design. This document contains **no real-user cohort data, verified city density, executed tests, load results, live KYC funnel, retention report, marketing deployment or human go-live signature**. No city or numeric minimum is approved by documenting this worksheet. Treat thresholds below as *observed code heuristics* or future *decision fields*, not validated market-launch policies.

## 1. Exact source-to-claim traceability

| Control | Observed source at immutable PR #119 HEAD | Production/pilot evidence needed |
| --- | --- | --- |
| Launch city allowlist | [`src/server/platform/launchPlatform.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.ts) declares **München, Berlin, Hamburg, Köln, Frankfurt am Main**. | A selection of supported cities is **not** a decision to pilot all five; Product/Privacy/SRE must formally select **one** community based on consenting supply and local value. No live city data were read. |
| City counts | `getLocalDensity()` reads `public_profiles.where('location','==',city).limit(500)`; "active" means not flagged inactive and `lastActiveAt` no older than **7 days**; verified counts further require `isVerified===true`. | **Query-bounded observed document subset**, not guaranteed true full-city population, real active use, target preference/age segment, mutual compatibility or actual recommendation reachability. A size of 500 can truncate totals and its unsorted subset is not an independently established representative sample. |
| City readiness heuristic | `densityBand`: `building <5`, `emerging >=5`, `active >=20`, `strong >=50`; `evaluateCityLaunchReadiness` treats `activeUsers>=5` as generally ready and recommends inviting until 20, more verification if verified share <40%. | These are **hardcoded aggregate heuristics**, not a demonstrated cohort-supply guarantee or legally approved launch threshold. "Ready" can be computed for five active and **zero verified** users despite serving only verified candidates. The ratio says nothing about age/intent compatibility or report-rate guardrails. |
| Profile publication/activity | [`toPublicProfile`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.ts) writes `active:true` and `lastActiveAt:FieldValue.serverTimestamp()` on profile projection; [`profile/publish`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/profileRecommendations.ts) requires authenticated adult, valid profile and rejects examples, but does **not** require a completed KYC decision to publish. | A profile publish refreshes the seven-day activity field even if the person has not actually conversed or returned. The verified-only recommendation read gate remains a separate protective control. **Do not equate public-profile recency or publication with meaningful D7/D30 retention.** |
| Candidate availability | [`getRecommendations`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.ts) excludes requester, examples, blocked profiles, `active===false`, unverified profiles, ages outside bounds and `lastActiveAt>7 days`. It scores candidates and sorts inside a **500-document** city query. | This is a useful **server-side safety boundary** for candidate quality, but returns up to the requested per-call limit; no guaranteed 8–12 qualified candidates for each user's demographic/intention context. Real two-way preference/compatibility validation, blocks, gender/intention availability and density by segment need Product/Privacy-approved measurement. |
| Daily volume claim | [`routes/profileRecommendations.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/profileRecommendations.ts) accepts **1–30** suggestions per request (default 12); [`Dashboard.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/screens/Dashboard.tsx) explicitly requests 30; [`Tips.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/screens/Tips.tsx) says "Nur 8–12 Profile am Tag". | **Confirmed claim-to-request mismatch.** No observed server-enforced unique daily 8–12 suggestions. [`pure.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/pure.ts) separately limits **new first contacts to 8/day for all plans** (UTC quota-day resets at 04:00 UTC); this is not a suggestion quota. Resolve claim only after Product review, never merge two different limits. |
| No-supply versus error UX | [`Dashboard.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/screens/Dashboard.tsx) sets `serverProfiles=[]` when recommendation request fails and also for a genuinely empty result. [`KlarMatchWidget.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/components/KlarMatchWidget.tsx) returns `null` when no suggestions. | **Source-observable state ambiguity**: an outage can look like local supply shortage and vice versa. Add explicit loading/empty/failed/stale states with accessible truthful fallback; never manufacture actual user cards or label an API error "nobody nearby". |
| Local launch UI | [`LocalLaunchWidget.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/components/LocalLaunchWidget.tsx) shows activity and verified counts, invites people and offers five cities. On city change it does **not** reset old summary before fetching; failed summary reads are silently ignored. | **Potential stale-city count display** until a successful response. Require city+timestamp-bound response, cancellation of prior query, no-data fallback and privacy-checked small-cell disclosure before an actual pilot. |
| Activation metrics | [`launchPlatform.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.ts) accepts named `activation_events` with a UID, self-declared event name and metadata allowlist, using Firestore create and a weighted score. [`routes/launch.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/launch.ts) accepts these events from authenticated clients. | **User-supplied events do not prove server-trusted KYC, delivered invitations, valid referrals, or meaningful retention.** Scored "activated" is a UX heuristic, not a D7/D30 cohort proof. Do not count self-reported `referral_qualified` as a trusted verified conversion. |
| First recommendations instrumentation | [`KlarMatchWidget.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/components/KlarMatchWidget.tsx) posts `first_recommendations` after **any array** response, including an empty array. It also trims visible widget list to **3**. | **Confirmed event-definition bug** if measured as "served at least one suggestion": a zero-result response can generate a success event. Instrument positive eligible count only on the authoritative server; separately classify `empty`, `error`, `no_eligible_city`, `excluded`, `served`. |
| Free/paid/advertising | [`src/lib/klarPlus.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/lib/klarPlus.ts) says **no advertisements currently delivered**, **Klar+ not bookable**, and equality of eight first contacts for Free and Plus. [`routes/billing.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/billing.ts) returns **501** on current `BUCHBAR=false`. | Do not promote "free through video ads", ad-free subscription benefits, currently buyable Klar+, or referral-based Plus grants. Prove a fully free actual contact/onboarding/conversation journey on the genuine code path and verified production terms, separate from any future optional monetization. |
| Rollout switch | [`featureFlags.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/featureFlags.ts) enumerates limited preexisting flags, with **no explicit dedicated `LOCAL_REFERRAL_CITY_PILOT`** or named reward cap switch. | No verified environment-specific pilot kill switch or budget stop for #51 has been established. Need Security/SRE-approved default-OFF user/cohort policy and negative tests after governance unlock. |

**Do not assume that the existing `LAUNCH_CITIES` constant, city density labels or "Founding 500" membership are proven local liquidity or a defensible marketing scarcity claim.** Empty-city and error behavior must never fabricate a populated community.

## 2. P1 findings: static evidence versus real-world impact

| ID | Classification | Required disposition |
| --- | --- | --- |
| `P51-01` | **Confirmed source contract mismatch**: 8–12/day claim versus per-request 1–30, Dashboard 30. | Product/Brand/Legal own one exact claim; Engineering must enforce true daily server semantics or remove numeric daily claim; real E2E. |
| `P51-02` | **Aggregation/selection limitation**: 500 city documents and 7-day refreshed projection active field vs real eligible cohort. | Signed city/segment inventory, meaningful activity metric, coverage/pagination, 7-day true active vs 30-day retention, record-level dedup. |
| `P51-03` | **Weak readiness proxy**: active >=5 can be "ready" with zero verified, without eligible users for selected age/intention segments. | Use real per-eligible cohort availability distributions, not just raw city count, as launch gate. |
| `P51-04` | **Confirmed empty/error UX ambiguity** in Dashboard; stale city summary possible after city change. | Explicit status and retry, clear stale state on selection, accessible low-density fallback. |
| `P51-05` | **Confirmed attribution/activation semantics gap**: client-reported named events; widget sends "first_recommendations" when array empty. | Separate server-derived success/eligibility from client telemetry; guard rewards/KYC independently. |
| `P51-06` | **Live evidence missing**: no actual consent-based city cohort, completed KYC/verified fractions, D7/D30, report-rate, cost or retention drill supplied. | Independent privacy-safe data capture and SRE/Product/Legal review before selecting or scaling any pilot. |
| `P51-07` | **Free promise and planned ads/Plus are distinct.** | Prove actual free flow, 8-first-contact equality and truthful no-ad/current nonbookable policy. |
| `P51-08` | **Rollout governance missing**: no source-demonstrated dedicated local pilot kill switch. | Signed cohort policy, stop limits and default-OFF toggles; rollback by SRE, no live activation under lockdown. |

These findings do **not** establish the real user population of any listed city, low/high conversion or an active production outage. Potential UI issues are derived from source logic, not a completed browser accessibility or incident test.

## 3. One-city pilot decision worksheet (future; NONE AUTHORIZED)

**No city is selected by this audit.** Eligible launch candidates in code: München, Berlin, Hamburg, Köln, Frankfurt am Main. Do **not** infer preference for any city from the reviewer's physical location, the ordering of constants, or a mock cohort.

**Proposed one-city selection precondition** — Product/Operations/DPO sign an evidence packet with:
- real, privacy-consented verified active supply by **coarse, sufficiently large and legally justified cohorts**, not raw individual identity lists or source-of-truth `active` booleans;
- account status, KYC signed approval, 7-day active behavior, demographic preference compatibility, user-block exclusions and outreach/abuse state, deduped;
- actual offered/visible suggestions per eligible request and per *unique user-day*, together with honest zero-result rate and rate of people whose configured constraints leave no eligible candidates;
- full genuine Free onboarding, account verification, available safe first contacts, conversation continuation and report/block flows; accurate product-language DE/EN/ES/FR;
- observed consented first-party cohort D7/D30 retention and day-by-day verified supply; no paid push, fabricated testimonials, unapproved reward, fake user density or FOMO;
- independent security/legal approval for analytics, privacy, rights/erasure, query sampling, small-cell redaction and retention.

### Required pilot KPIs, without invented numeric accept thresholds

| KPI | Exact numerator / denominator or definition | Evidence owner |
| --- | --- | --- |
| `available_verified_candidates_per_eligible_user` | Distinct live, eligible, verified, unblocked and compatible profiles per active eligible requesting user, segmented only at permitted sufficient aggregation | Product + Backend + Privacy |
| `qualifying_suggestions_8plus_coverage` | Eligible user-days with **>=8** genuinely eligible unique candidates / all eligible user-days. If less than eight, show transparent actual count; **target threshold TBD by Product**, not guaranteed | Product / Analytics |
| `zero_suggestion_rate` | Eligible recommendation requests with a valid empty response / all eligible successful recommendation requests (exclude failures) | Product / SRE |
| `recommendation_error_rate` | Server failures, timeout or invalid production responses / all genuine recommendation requests | SRE |
| `KYC_completion_rate` | Unique accounts with verified signed success in specified cohort/window / real eligible KYC starts, with repeated attempts separately tracked | Security + Finance |
| `activation_rate` | Accounts with a **server-authenticated** agreed activation milestone / fully eligible verified registration cohort, with meaningful events not merely client events | Product + Security |
| `D7_retention`, `D30_retention` | Registrants active in preapproved windows around days 7 and 30 / original enrolled eligible cohort (account deletion/censoring rules preapproved) | Analytics + DPO |
| `first_contact_to_conversation_rate` | True completed two-way conversations / legitimate first-contact attempts, respecting privacy and spam mitigation | Product + Privacy |
| `report_rate` and `block_rate` | Reports/blocks per defined completed conversation or contact volume, with material-abuse thresholds and low-volume suppression | Trust & Safety |
| `free_journey_completion_rate` | Eligible non-paying users completing a real safe onboarding/recommendation/contact flow / all eligible non-paying user attempts | QA + Product |
| `cost_per_verified_activated_user` | True attributable incremental acquisition, KYC attempts, Cloud/AI, fraud and support costs / signed verified and activated accounts; no fake revenue | Finance + FinOps |
| `organic_vs_invited_lift` | Approved privacy-safe randomized or causally interpretable cohort outcome difference, with guardrails for self-selection | Product + Analytics + DPO |

**Threshold approval fields still blank:** single city, test period, eligible age/intent group, minimum `qualifying_suggestions_8plus_coverage`, maximum legitimate zero/error rates, KYC ratio, D7/D30, report/spam thresholds, budget ceiling, privacy/small-cell limits, owner identities, experiment stop criteria and actual approval evidence. **None may silently default to the current 5/20/50 source heuristic.**

## 4. Pilot protocol, privacy and release brakes

1. **Source-only and business decision stage (now):** Keep PR #119 Draft, issue #51 OPEN, `NO-GO`. DPO/Product/SRE/Trust & Safety approve measurement definitions, legal basis, segment aggregation, one-city cohort and **actual** halt criteria. Do not launch an experiment simply because the city exists in source.
2. **Post-unlock implementation (authorization required):** Dedicated feature branch, preserve verified/blocked filtering, add genuine provenance for activity/serving and server-trusted KPI receipts, split empty/error states, align daily number claim, add default-OFF cohort flag with SRE-controlled kill-switch, avoid irreversible behavioral changes or increased paid incentives.
3. **Local-first tests:** Node 22.23.3, Bun 1.4.2; real Firestore emulator with zero/2/5/20/50-city supply, no verified candidates, mismatch age/intention cohorts, stale active field, 500+ documents/cursor fairness, blocklists, malicious example profiles, concurrent reload, API outage/timeout, dual accounts, quota equality and zero-result event distinction. Browser E2E for empty, retry, offline and DE/EN/ES/FR a11y; all exact-SHA required security/AI-PII/Art.17 checks when permitted.
4. **Authorized shadow cohort (later):** Never count client-emitted `referral_qualified` or `first_recommendations` as purchase/KYC proof; compare server-confirmed visible eligible results and actual usage. Remove raw UIDs, token strings and special-category information from external analytics, track opt-outs and DSAR deletion.
5. **SRE/Finance gates:** Multiwindow health/no-data alerts, actual usable profiles, local supply trends, trust & safety report rate and costs, negative economics/budget triggers, feature flag rollback that preserves core Free and approved user rights. No unapproved ads/Plus/payment/reward path.
6. **Decision after real data:** Written Product/Legal/DPO/Security/Finance/SRE go/no-go **for this pilot only**, not production app release. Any future production merge additionally needs full host evidence, independent exact-SHA CI and Release Owner approval under Issue #8.

### Required negative/operational tests — NOT EXECUTED HERE

| Test | Expected PASS requirement |
| --- | --- |
| 20 active, zero verified | Do **not** call city genuinely launch-ready for verified user experience; actual eligible suggestions zero and truthful availability fallback |
| 20 verified, all incompatible/blocked | Same fail-closed zero-result behavior; aggregated city count not enough |
| 5 eligible but product says 8–12 per day | Cannot assert fulfilled daily guarantee; do not insert example/fabricated people |
| 501/503 error versus 200 empty `[]` | Distinguishable error and real no-supply UI and metrics, correct retry without false marketing |
| Profile update versus meaningful activity | Publishing again does **not** artificially satisfy true retention or D7/D30 |
| Empty API recommendation array | Must **not** record server-certified first **successful suggestion** event |
| Client tries `referral_qualified` or arbitrary `first_contact` | Cannot mint genuine signed KYC, qualification, reward, trustworthy financial/cohort KPI |
| 500+ city profiles or dense segments | Valid complete counts, no arbitrary silent sample bias or starvation |
| Stale city selection and request error | No previous-city stats presented as if current city, clear unavailable status |
| Existing 8-first-contact limit for Free & Plus | Identical enforced quota, no paywall, rewards, ad gates or subscription requirement to contact |
| Low density, high abuse, low KYC, negative unit economics | Approved halt conditions stop **new rollout**, do not retroactively erase user data or destabilize basic app |
| Signed privacy/retention and identity role checks | Legitimate source, no sensitive payload or linkable analytics leakage; external event receiver lacks raw PII |

## 5. Related issue dependencies and ownership

- [P0 #47](https://github.com/Veselin-Takev/Klar-Dating/issues/47) — canonical truthful claims, verified badges, 8–12/daily versus actual 1–30 per request and no ad-/Plus-funding promises.
- [P0 #48](https://github.com/Veselin-Takev/Klar-Dating/issues/48) — eligibility and identity-based member invitation, referral code contract and finite Klar+ reward design.
- [P1 #49](https://github.com/Veselin-Takev/Klar-Dating/issues/49) — editable, low-pressure share UX must remain optional and non-coercive.
- [P1 #50](https://github.com/Veselin-Takev/Klar-Dating/issues/50) — consented funnel metrics/experiment; authenticated server source for verified outcomes.
- [P1 #53](https://github.com/Veselin-Takev/Klar-Dating/issues/53) — actual KYC/fraud/Cloud costs, budget/ROI and reward cap; no money without external receipts.
- [P1 #71](https://github.com/Veselin-Takev/Klar-Dating/issues/71) — production 300-ms fleet SLI and on-call alerts need actual telemetry.
- [Release #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) and [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73) — authentic host evidence, effective CODEOWNERS, protected reviews and separate final Production GO.

**Result:** This document is a **P1 source/acceptance audit only**. No real data, numeric cohort decision, approved city, QA PASS, experiment, feature launch, CI run, merge or production change. **Issue #51 OPEN; Klar Production Readiness BLOCKED / NO-GO.**

Related: [P0 evidence register](P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md), [Issue #8 GO/NO-GO](ISSUE_8_PRODUCTION_GO_LIVE_GATE_RECONCILIATION_2026-10-23.md), [Issue #53 unit economics](P1_ISSUE_53_KLARPLUS_REFERRAL_UNIT_ECONOMICS_AUDIT_2026-10-23.md).
