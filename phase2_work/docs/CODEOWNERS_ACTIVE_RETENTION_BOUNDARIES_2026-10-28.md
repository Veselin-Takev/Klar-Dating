# Active compliance CODEOWNERS coverage — Issue #73 (2026-10-28)

**Draft / Production NO-GO.** Based on `main` `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Finding and change

The root CODEOWNERS and the deterministic policy already explicitly covered 21 files, but four additional active security-sensitive paths relied on generic `/phase2_work/` technical ownership: `functions/src/retention.ts`, `src/server/partnerReferralDeletion.ts`, `src/server/routes/launch.ts`, and `src/server/platform/launchPlatform.ts`. To keep the review surface explicit, root CODEOWNERS now assigns each path to the verified repository technical owner, and `scripts/check-codeowners.mjs` requires the exact final matching rule. Four negative regression cases remove one specific mapping at a time and verify that the check refuses the resulting generic fallback. The protected-path count is 25.

## Governance boundaries and required evidence

The technical owner `@Veselin-Takev` is **not** an independent Security, Privacy/Legal, Operations or Finance signoff. No non-existent team is introduced; organization/team permissions and branch protection requiring CODEOWNER reviews are not verified. No GitHub branch-protection or cloud configuration is modified. Exact-HEAD enterprise CI and independent functional approvals remain mandatory. Issue #73 and #8 must not be marked closed until all reviewer rights, branch rules and specialist signoffs are evidenced. **PRODUCTION NO-GO**.
