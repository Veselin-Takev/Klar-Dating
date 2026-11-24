# Combined referral and launch privacy integration — 2026-10-29

**Status: DRAFT; NO-GO.** Base is PR #187 commit `35fd3a0f17f75ea3c3c5bd04ca98e426e16aee26`; transplant from PR #188 commit `fa8d361e7295e9643ceae8e755e1133314db6a14`.

## Change and test contract
Retain PR #187 referral hardening (adult/inactive eligibility, unique referral code rejection, immutable attribution event, no-store headers and real Firestore emulator race test). Add PR #188 transactionally guarded `GET /launch/summary` read against `users/{uid}` and `account_deletions/{uid}`, returning 409 before density lookup on missing/deleting profiles, 503 on backend errors. Merge HTTP negative fixture and `baseDb` test transaction double without replacing referral regressions.

## Provenance and gates
PR #187 Enterprise CI [40859593767](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40859593767) PASS; PR #188 last source CI [40867491062](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40867491062) PASS on distinct trees. These are **not** combined-tree evidence. Exact-head integration CI and 10 mandatory gates, emulator race, SRE/Security/DPO approvals, and downstream dependent PR rebase/reconciliation are pending. No local execution with the required Node runtime here; no merge to main, no deployment. If CI fails, amend isolated integration branch and record failure SHA/logs before re-evaluation. **PRODUCTION NO-GO.**

## Integration dependencies
The integration branch contains functionality from both feature PRs. Do not merge #187 and #188 plus this integration PR independently: avoid duplicate commits and stale approvals. Select one reviewed merge path after cross-diff review. Authoritative source security/privacy ADRs remain in each PR until intentionally consolidated.

## Combined-tree CI result — 2026-10-29
The combined PR #189 HEAD `6f499df54890869d83d4205e1c58bb29f9e66ed7` passed [Klar Enterprise CI run 40869323930](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40869323930). GitHub job 123432023605 independently reports success for Enterprise static gates, typecheck, tests, build, CI production smoke and browser acceptance. This evidence belongs exclusively to the identified HEAD SHA and does not certify any subsequent documentation commit, a full independently executed 10-command local gate matrix, real production telemetry or independently signed Security/DPO/SRE reviews. No PR reviews were recorded at the time of verification. Retain draft, no merge, no deployment. Next: independent specialist reviews, verify test logs and staging/production evidence, then choose one merge path for the overlapping PRs. **PRODUCTION NO-GO.**
