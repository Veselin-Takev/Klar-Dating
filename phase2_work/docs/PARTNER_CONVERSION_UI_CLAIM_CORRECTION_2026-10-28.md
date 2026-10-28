# P0 #47/#55 — Partner assertion claim correction (2026-10-28)

**Status:** DRAFT, release **NO-GO**. Base main `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Verified source

`src/server/partnerReferralService.ts` records signed webhook conversions as `rewardStatus: 'pending_verification'` and `proofStatus: 'partner_assertion_only'`; it does not credit qualified counters or mark rewards earned. The partner widget nevertheless displayed `Bestätigte Empfehlungen` and called partners `Geprüfter Partner`. A provider HMAC authenticates an assertion, not the underlying purchase or partner's independent certification. Those labels can mislead users.

## Change

Keep the UI functional but change claims to `Technisch erfasste Conversions`, `Aktivierte Partnerkampagne`, and an explicit explanation that signed partner notifications do not prove purchases or payouts. Consent wording now refers to recording pending-check partner reports rather than confirmed referrals. No API schema, counters, reward state, authorization, personal data, or backend behavior changes.

## Regression, validation, release

`node scripts/test-partner-conversion-copy.mjs` checks the removal of unsubstantiated claims and presence of cautious disclosures. CI must execute exact-HEAD typecheck and test suite; this static check is **not** independent evidence that the partner offer is legitimate. Product/Brand/Legal/DPO approval of all #47 claims and independent buyer/purchase verification under #55 remain necessary. Existing marketing claim matrix remains blocked. No deployment or merge authorized until mandatory gates and applicable reviews. Rollback: revert the isolated PR. **NO-GO**.
