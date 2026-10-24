# P0 #47 — Evidence-gated Product/Legal/Brand marketing claims (2026-10-18)

**Production and copy release: NO-GO.** This is a control to prevent unproven product and marketing assertions, not a certification that marketing features are implemented.

The machine-readable claim matrix at `docs/MARKETING_CLAIM_EVIDENCE_2026-10-18.json` records five sensitive promise families: verified profiles, local 8–12 proposals, real Free use, human-curated selection, and referral privileges. Each remains `blocked` with no invented evidence or fictional sign-off. Approval requires actual product behavior, permanent evidence reference, accountable Product/Legal/Brand reviewers, and a reviewed decision. Referral invitations are not KYC and must not award verification badges.

Run locally from `phase2_work`:
- `node scripts/check-marketing-claims.mjs` validates manifest structure and prevents approval with missing evidence/roles.
- `node scripts/check-marketing-claims.mjs --release` **must fail** while any claim is blocked. It is intentionally fail-closed, not a reason to change blocked states mechanically.

This is not a comprehensive source-copy scanner; human review of DE/EN/ES/FR translations, actual UI, referral flow, accessibility, DSGVO/DSA and deceptive-copy risks remains mandatory. An approved manifest does not substitute for independently enforcing code behavior or the complete release verification gates. Source-of-truth references: issue #47 and the existing `docs/PRODUCT_MARKETING_ENTERPRISE_ALIGNMENT_2026-10-14.md`.

No marketing publication, merge, production deployment or automatic CI run has been triggered. Require evidence-backed signed Product/Legal/Brand decisions before closing #47 or GO-LIVE #8.
