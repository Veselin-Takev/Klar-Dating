# Klar Enterprise production-readiness watch — 13 November 2026, 11:59 CET

**Decision: BLOCKED / NO-GO — `productionApproved=false`.** This is a read-only evidence checkpoint plus documentation on the existing audit review branch. It is not a human sign-off, merge authorization, deployment approval, legal opinion or production certification.

## Repository and exact main evidence

- Repository exists and is accessible: [Veselin-Takev/Klar-Dating](https://github.com/Veselin-Takev/Klar-Dating).
- Fresh `main` HEAD: `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`.
- Exact `validate` check on that SHA: [run 42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `129478192916`, completed/success. The check-run `head_sha` equals the main SHA.
- The monitored Drafts still have base SHA `96c3857c53f5ced31fe1394895185f42c75bc716`; current main is two commits ahead. Their exact-head CI is therefore branch evidence, not an integrated-current-main release result.

## Fresh open-PR inventory and stack graph

GitHub REST `pulls?state=open`, both pages (100 + 94), was fetched and the graph recomputed from open PR base/head refs:

- **194 open PRs: 192 Draft, 2 non-Draft** (#358 and #361).
- **50** target `main`; **144** target other branches.
- 141 base refs match an open PR head; 3 have no matching open parent (#219, #214, #213).
- 53 roots; maximum observed open-PR reference-chain depth: 35. This graph is based on branch-name references, not a reconstruction of closed-branch Git ancestry.
- Largest stacks: #269 = 40 PRs; #317 = 27; #203 = 20; #253 = 14; #219 = 10; #192 = 10; #160 = 6; #214 = 5; #337 = 4; #172 and #140 = 4 each.
- Head-ref prefixes: fix 81, security 55, test 19, docs 11, integration 10, audit 7, feat 5, feature 2, dependabot 1, release 1, audit-enterprise-e2e 1, Veselin-Takev-patch 1; two remaining refs have no listed prefix.

## Exact monitored PR heads, checks and reviews

The check-run `head_sha` was checked against each exact PR head. The listed `validate` job result is not inferred from an earlier SHA.

| PR | State / exact head SHA | Compare to fresh main (ahead / behind) | Exact GitHub Actions `validate` run / job | Submitted reviews |
|---|---|---:|---|---:|
| [#251 Governance](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | Draft · `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / `129836618469` — success | 0 |
| [#269 Legacy photo purge](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | Draft · `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / `127220743813` — success | 0 |
| [#203 Decision/generation purge](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | Draft · `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / `127211414732` — success | 0 |
| [#253 Multi-Tenant](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | Draft · `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / `125601704190` — success | 0 |
| [#313 Enterprise audit](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | Draft · `fd2d8a817a0804229e62a73690352a2c10eeba0f` | 116 / 2 | [43403053746](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/43403053746) / `131810461844` — success | 0 |
| [#314 Vercel evidence](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | Draft · `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / `125861548924` — success | 0 |

Additional non-Draft / dependency state:

- [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) is **closed, unmerged**. Old head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`; [run 41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018), job `125572558770`, failed at **Enterprise static gates**. Its one review was by the repository owner; independent approvals = 0.
- Open successor [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) is non-Draft, head `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`, 1 / 2 relative to current main, 0 reviews. [Run 42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job `129461862107`, failed at **Enterprise static gates**: the production container release must generate GitHub-signed provenance bound to the immutable image digest. The Vercel Preview Comments check is successful but does not satisfy provenance.
- Open non-Draft [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) targets `release/v0.1.1-rc1`, head `1321c42ffe1c5919c1baccaada66a650ab811f93`, 69 / 2 relative to main, 0 reviews. [Run 42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job `129478019942`, failed **Browser acceptance**: consent-withdrawal E2E, 28 passed / 1 failed; the expected withdrawal confirmation was replaced by a generic failure after Firestore `PERMISSION_DENIED`. Its title's “1636 PASS” claim does not override this exact-head failure.

For #251/#269/#203/#253/#313, the separate Vercel Preview Comments check is success/no unresolved feedback. That check is not an application-health or production-approval signal. #314 has only its successful GitHub `validate` check and **zero Vercel deployments for its exact head**.

## Active main Ruleset #25756841

Live GitHub API read: Ruleset #25756841 is **active** for `refs/heads/main`; strict required status check `validate`; deletion and non-fast-forward protections enabled; no bypass actors. However:

- `required_approving_review_count = 0`
- `require_code_owner_review = false`
- `dismiss_stale_reviews_on_push = false`
- `require_last_push_approval = false`
- `required_review_thread_resolution = false`

`require_extra_approval_for_unattributed_changes=true` is present, but its effective protection for the relevant paths has not been proven by a negative merge test. The live Ruleset therefore does **not** establish mandatory independent specialist approval.

## Current source-backed blockers and open issues

All requested issues remain **OPEN**: [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70), [#254](https://github.com/Veselin-Takev/Klar-Dating/issues/254), [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8), [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73), [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204), [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206).

Current-main source reads confirmed:

- **P0 #202:** `functions/src/index.ts` still exports both `deleteExpiredPhotosCron` and `purgeVerificationStorageCron`. The 24-hour legacy worker calls `deleteExpiredPhotoPage`; `retention.ts` lists `verification/` and deletes when Storage `timeCreated` is older than 30 days, subject to holds/generation. It does not bind deletion to a moderation decision / `fotoLoeschenAb`. This is a source-confirmed release blocker, not proof that the legacy job is deployed or has deleted customer data. #269 and #203 both remain Draft, have no reviews, and overlap in six files; do not blind-merge.
- **P0 #70:** the retention script enumerates 20 collection groups and restricts activation to an approved staging configuration; no project-bound 20/20 production `ACTIVE` readback, legal-hold evidence or Art.-17 staging proof was obtained.
- **P0 #254:** tenant middleware file `phase2_work/src/server/multitenant/tenantAuth.ts` is absent (404) on current main; #253 remains an unmerged Draft. No live tenant cutover/BOLA/Art.-17 proof was obtained.
- **P0 #73 / #8:** live Ruleset permits zero approvals; production IAM, secrets, alert delivery, canary, restore/RTO/RPO and Release Owner evidence remain unverified.
- **P0 #55 / #56:** partner purchase authenticity, consent/tracking legal basis and retention/cascade evidence remain open; treat as release blockers if monetized B2B partner flows are in this release scope.
- **P1 #204:** current `storage.rules` permits profile-image reads for `signedIn()` only, while the platform policy engine requires adult reader and adult target. This is source-policy drift, not proof of live unauthorized access.
- **P1 #206:** `src/lib/klar.ts` persists Firebase `getDownloadURL()` into `users/{uid}.photoURL`; revocable per-viewer media authorization and legacy token revocation are not proven in staging.

## Vercel read-only verification

- Authenticated team `ves3` currently lists exactly one project: `klar-dating`, ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`. `get_project` succeeds. Project metadata still reports `live=false` and Node `26.x`, while repository/release Node pin is `22.23.3`.
- Main production-target deployment `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` is READY and bound to exact main SHA `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. A READY deployment record does not prove traffic, runtime health or release approval.
- Current #313 preview `dpl_GbASTNXeyPYwD2sLaHB4XTETx8iw` is READY, target=null, bound to exact #313 head `fd2d8a817a0804229e62a73690352a2c10eeba0f`.
- Exact-head #314 deployment count is 0.
- The previously confirmed `login-page-prototype` deletion remains complete: the historical authenticated project/deployment reads returned 404 `not_found`, and the current team list still contains only `klar-dating`. No deletion was retried.
- Neon/Postgres/Better-Auth provider credentials were not read, rotated or revoked; this deletion evidence does not revoke them.

## Decision and actions

**`productionApproved=false` — BLOCKED / NO-GO.** Missing mandatory gates: one exact integrated release SHA; complete critical purge/receipt/race evidence; live TTL/legal-hold/Art.-17 evidence; tenant/BOLA and migration proof; production operations/restore/alert evidence; independent Security/AppSec, DPO/Legal, SRE, Finance (where relevant) and Release Owner approvals.

No code changes, main commits, merges, deployments, Ruleset changes, secret operations, production Firebase/GCS/IAM/Scheduler/database mutations or provider-credential operations were performed in this checkpoint. No human approval was fabricated.
