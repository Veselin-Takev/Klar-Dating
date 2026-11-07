# Klar v149 — Release Gate & Evidence Register (2026-11-07)

> Status: **NO-GO** | productionApproved=false | Read-only assessment / documentation only. This document does not grant release approval.

## Scope and provenance
- Repository: `Veselin-Takev/Klar-Dating`. This is a **documentation-only** review branch from `main`; no app code or cloud resources changed by this report.
- Linear: [VES-5](https://linear.app/takev/issue/VES-5), [VES-11](https://linear.app/takev/issue/VES-11), [VES-8](https://linear.app/takev/issue/VES-8).
- PR evidence: [#339](https://github.com/Veselin-Takev/Klar-Dating/pull/339), [#340](https://github.com/Veselin-Takev/Klar-Dating/pull/340), [#337](https://github.com/Veselin-Takev/Klar-Dating/pull/337), [#338](https://github.com/Veselin-Takev/Klar-Dating/pull/338).
- Confirmed branch CI (not an overall release approval): [Run 42379433515](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42379433515), tested SHA `30f3d83e2b6bce7b5ff62d88ec04c5fc3c7a2795`. PR reports 199 test files / 1,539 tests, 28 Firestore fence cases, 26 browser tests; all relevant gates PASS. **Do not transfer this CI verdict to a different SHA**.
- Current overall release candidate SHA and independent cloud evidence **not yet verified by this register**.

## Release-blocking conditions

| Gate | Current evidence | Missing release proof | Decision |
| --- | --- | --- | --- |
| P0 VES-5 Firestore/GCS cross-service race | Draft stack #317–#339, successful #339 branch CI | Universal writer adoption; actual IAM/storage hold interlock; deterministic late legal hold/decision revocation after final Firestore check but before GCS delete must prevent unauthorized deletion; crash/replay/lease and staging evidence | **BLOCKED** |
| P0 VES-11 age verification | Draft #337 fail-closed proxy and asset fixes, #338 accessible mobile DOB UI | Approved HTTPS Cloud Run backend; approved pinned upstream and env configuration in preview; authenticated age gate and exact UID state readback; Firebase DB, rules, App Check and IAM check; preview smoke & device accessibility | **BLOCKED** |
| P1 VES-8 cloud controls | Linear acceptance criteria | Actual deployed Scheduler jobs, SA/IAM, Firestore TTL, Cloud Storage retention/holds, old worker disable, telemetry, rollback, redacted independent staging evidence | **OPEN** |
| Release SHA CI | #339 CI on one exact commit only | Independent full CI on *final consolidated* commit, immutable artifact digest, SBOM/dependency security review and provenance | **OPEN** |
| Compliance and approvals | Existing repository/Linear issue plans | AppSec, DPO/Legal, SRE, QA and Release Owner sign the same immutable candidate | **OPEN** |

## Latest checked CI and runtime staging hardening — 2026-11-07

- **VES-5 CI fail-closed guard** [Draft #342](https://github.com/Veselin-Takev/Klar-Dating/pull/342): exact commit `3dcc6c203907c6ca78c85af39031ab77920d364f`, [Enterprise CI run 42407127495](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42407127495) returned **completed SUCCESS**, and the single `validate` job returned **SUCCESS**. This establishes CI success on #342's branch only, not an independently verified cross-service Firestore/GCS purge interlock. Draft remains unmerged and VES-5 P0 open.
- **VES-12 Firebase runtime mismatch fix** [Draft #343](https://github.com/Veselin-Takev/Klar-Dating/pull/343), exact SHA `601c316c4b875242989f488473bba61b4c22322c`: reject disagreeing `GCLOUD_PROJECT` / `GOOGLE_CLOUD_PROJECT` / `FIREBASE_PROJECT_ID` and avoid importing the Firestore database ID from an unrelated Firebase config into an explicitly selected staging project. [Enterprise CI run 42413071403](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42413071403) is **completed SUCCESS** with `validate` **SUCCESS** on that exact commit. No merge or cloud verification is implied.
- **VES-12 pre-initialized Admin app protection** [stacked Draft #344](https://github.com/Veselin-Takev/Klar-Dating/pull/344), exact SHA `86f655588eaedaae984c28ab43fc0bfa1c0c673a`: only reuse the intended `[DEFAULT]` Firebase Admin app, and reject an existing default when `options.projectId` is absent or differs from runtime selection; add regression cases for named app and conflicting/unknown default. [Enterprise CI run 42413771612](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42413771612) was **in_progress** at last check; its verdict must not be inferred from parent #343's PASS. This is a review-only dependent PR, not a main release.
- **Screenshot-based user-verified Cloud account state**: `klar-admin` has Billing linked to `Mein Rechnungskonto`, but its saved monthly budget listed `0,00 € / 0,00 €`, thresholds `50/90/100` and name `10`. This **does not prove** the intended EUR 10 threshold or EUR 8 middle alert. Validate amount, actual-cost thresholds, account scope and notifications before creating billable Firestore, Cloud Run or Workload Identity resources.
- The user reports that the previously unknown Google project `prime-casing-48f9p` was reviewed and appears in order; the security inquiry is **deprioritized by user confirmation**, not independently attested here. No ownership, billing-security or creator attribution should be asserted without direct cloud evidence.
- Both real production blockers, **VES-5** and **VES-11**, and `productionApproved=false` remain unchanged. No production promotion or merges.

## Ordered execution plan

1. **Retain fail-closed state.** Do not enable `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED`, `VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED` or `productionApproved`; no production merge or promotion.
2. **VES-5 adversarial cross-service proof.** Inventory every moderation, legal hold, Art.17, Admin SDK, Scheduler and external Storage writer. Implement/review a mandatory write coordination protocol with durable token, object generation, retention/hold and recovery reconciliation. Instrument an explicit test barrier after final Firestore authorization and before GCS deletion. Inject a legal hold/decision revocation; assert deletion was prevented on the real writer path. Test generation conflict, 404/412, timeouts, crash replay, leases and audit. Record exact source SHA, cloud project, emulator/staging setup, redacted outputs and independent reviewer.
3. **VES-11 preview-only end-to-end.** Verify upstream identity and approved HTTPS hostname; configure approved preview host variables through change control; test signed-in Firebase Auth, App Check and least-privilege API reachability. Verify an adult and underage test user through server-authoritative API and exact authenticated UID state readback, without DOB logging or browser-only bypass. Verify missing backend remains 503 fail-closed. Run mobile keyboard, 200% zoom and TalkBack checks; retest Firestore Listen 400 separately.
4. **Integrate drafts sequentially.** Audit PR dependencies / branch bases, codeowners and required reviews; no blind bulk merges. After approved review, rerun tests on each new integration SHA; do not treat a green child PR as approval of all ancestors.
5. **Release candidate freeze.** Record final `main` SHA, lockfile, artifact digest and build provenance. Execute mandatory lint, secrets, SAST/SCA, typecheck, unit/integration/Firestore rules/emulator tests, Playwright, load/performance, privacy and accessibility checks against *that same* SHA.
6. **Operational and regulatory acceptance.** Verify real Scheduler, IAM/TTL/retention/holds, backup-restore, alarm routing, canary, rollback, consent, Art.17 and applicable NIS-2/EU-AI-Act obligations with dated evidence, not source-only claims.
7. **Formal release decision.** Require separate AppSec, DPO/Legal, SRE, QA and Release Owner signatures with risk register and documented exceptions. P0 open or missing critical evidence → NO-GO. Only then staged roll-out, monitored canary and reversible expansion.

## Evidence format (mandatory for every closure)
`Gate | environment/project | exact code SHA/artifact digest | test scenario | executed-at UTC | command/run URL | result | redacted log or screenshot | independent reviewer | remaining risk | signoff`

## Integrity notes
- Do not claim no bugs or zero residual risk; claim only measured acceptance.
- Do not treat a Vercel READY frontend, a unit-test-only pass, or GitHub branch CI as proof that authenticated production flows work.
- This register records **unresolved** prerequisites, not completed security fixes.
