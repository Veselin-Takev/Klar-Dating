# Current audit status — 8 October 2026

**Current candidate:** PR #1 / `security/v149-autonomous-consolidation` at `33ef9eb3255919bec8b07d4132665754fa8ae930`.

## Current authoritative status

- The supplied CI run `37799221240` failed in **Typecheck**; static Enterprise gates passed and Tests/Build/Smoke/Browser steps were skipped.
- Root cause identified: the v149 branch exposed `getDb()` and the durable Firestore adapter as `unknown` while the codebase consumes the Firestore contract structurally. This produced a cascading strict-TypeScript failure set (803 diagnostics in the historical run), dominated by `durableStore.ts`.
- The remediation restores an explicit `JsonObject`/JSON value contract, a typed `Firestore` boundary in `db.ts`, and explicit Express request augmentation for authenticated/session/guest state. No strict compiler flag was weakened and no broad `any` escape hatch was introduced.
- A new Enterprise CI run for the corrected head `33ef9eb...` is pending. The previous run on an intermediate head was automatically cancelled by GitHub concurrency and is not evidence of the corrected head.
- **Production release remains NO-GO / NOT CONFIRMED.** No production promotion is authorized until the corrected exact-head CI passes TypeScript, tests, build, production smoke and browser acceptance, followed by the required operational/governance evidence.

## Release evidence rule

A static gate PASS does not compensate for a failed or cancelled dynamic gate. Only exact-head evidence from the release candidate is authoritative.

---


The v149 audit remediated the `/api/account/alter` contract, differentiated age-gate UI errors, hardened AuthClaims normalization and aligned browser security headers. Static verification passes where the dependency-free runner can execute it. Full typecheck/test/build/E2E and production promotion remain blocked until the locked dependency graph and protected CI/cloud evidence are available. Production release is **NOT confirmed**.

## Current authoritative status — 1 October 2026

> This section supersedes all older same-day baseline/status sections below. Historical sections remain for traceability.

- Current technical baseline: `main@6eb37a86` after PR #124.
- PR #121 restored the enforced dependency-security baseline after the newly published `basic-ftp` advisory; its exact head passed Enterprise CI, Documentation and Playwright before merge.
- PR #122 (journal audio boundary) and PR #124 (Smart Audit boundary) both passed Enterprise CI, Documentation and Playwright on their exact current-main heads before merge.
- The legacy server/UI modularization and AI-boundary series tracked under issue #27 is complete. No pull requests remain open.
- High/Critical audit thresholds remain enforced; no security exception or threshold reduction was introduced.
- Production release remains **NOT confirmed**. The remaining blockers are external/operational evidence: real load/cost/SLO measurements and approval, real restore/rollback exercises, real secret rotation plus alert delivery/acknowledgement, manual assistive-technology accessibility evaluation, and demonstrably enforced protected-main/required-check/independent-review governance (or an explicitly approved equivalent control).

## Authoritative post-merge audit — 1 October 2026

> This section is the current source of truth and supersedes older same-day candidate/blocker notes below. Historical sections are retained for traceability.

- Current audited baseline after stack recovery: `main@b864e3a9` (PR #100 on top of PR #101). Post-merge Enterprise CI and Playwright both pass. Enterprise CI passed static security checks, TypeScript, 109 Vitest files, API/Firebase emulator tests, production build, production-routing smoke test, bundle evidence and production container build. Playwright passed 21/21 browser tests.
- Dependency security remains within the enforced release gate: root full audit reports 1 low + 11 moderate, root production 1 low + 5 moderate, Functions production 2 moderate, and **0 high / 0 critical**. PR #96 is merged; the audit threshold was not weakened.
- Vitest 5 (#55) and Vite 8.3.1 (#56) are merged. Vite is build-only in `devDependencies`, paired with esbuild ^0.28.2, and the production container passed after the migration.
- Presence checks confirm the intended direct-main merges #56, #74, #75, #77, #78, #79, #80, #98, #99 and #101 are represented in `main`.
- One stack-integration defect was found and repaired: PR #81 was merged into PR #74's feature branch rather than `main`, so its feedback-router delta initially never reached `main`. Replacement PR #100 carried the complete #81 feedback delta together with the superseding profile/recommendations router, passed Enterprise CI, Documentation and Playwright on head `e65ab6aa`, and was squash-merged as `b864e3a9`.
- Vite 8 reports one forward-compatibility warning on the audited baseline because `vite.config.ts` uses `__dirname`; this audit branch replaces it with `import.meta.dirname`. The change is accepted only after Enterprise CI, Documentation and Playwright pass on the exact audit head.
- Production release remains **NOT confirmed**. External/provider evidence, real production load/cost/SLO and restore/rollback evidence, IAM/secret/alert delivery, manual accessibility evidence, and demonstrably enforced protected-main/independent-review governance remain separate release gates.

## Update 1 October 2026 — trace-backed profile write confirmation repair

- A final-baseline Playwright trace on PR #95 proved that the remaining onboarding failure was not an age-gate timeout: the UI showed “Deine Angaben konnten nicht gespeichert werden”, and `fetchProfile()` rejected a backend read solely because `snapshot.metadata.hasPendingWrites` was true.
- Firebase documents that `waitForPendingWrites()` waits only for writes already pending when it is called. A later independent write can therefore set pending metadata again. The repair confirms the exact fields written by the current `updateProfileData` call against `getDocFromServer()`, while refusing to apply a pending snapshot as profile/consent authority; the live server-confirmed listener remains authoritative for UI state.
- Top-level `undefined` values are omitted before `updateDoc`, so optional onboarding data such as absent music preferences cannot fail Firestore serialization. Explicit `null` remains preserved.
- Focused unit regressions cover undefined-field omission, field-scoped confirmation, mismatch rejection and exact nested-value semantics. The registered-account onboarding Playwright journey remains the end-to-end acceptance test.
- Exact head `1e0ffad5` passed Enterprise CI, Documentation and Playwright, including the registered-account onboarding journey that previously reproduced the false save failure. Production release remains **NOT confirmed** because the external operational/governance evidence gates remain separate.

## Update 1 October 2026 — exact-head CI stabilization

- PR #98 is merged on `main` as `a155399a` after Enterprise CI, Documentation and Playwright passed on exact head. It fixes the product-level onboarding persistence race by awaiting Firestore pending writes before the existing authoritative server read.
- Secure-baseline revalidation has full Enterprise/Documentation/Playwright passes for #74, #75, #77, #78, #79, #80, #84, #86, #87, #88, #89, #90, #91, #92, #93, #94 and #95, plus stacked #81/#82 after preserving stack order and refreshing their bases. Draft/review governance remains separate from technical validation.
- Independent Playwright failures on unrelated branches exposed a second CI-harness weakness: the shared age/consent helper relied on Playwright's generic 5-second assertion default after server writes that are intentionally followed by a fresh Firestore read.
- PR #99 centralizes the persisted age-gate wait in `waitForAgeGate`, uses it in both guest and registered onboarding journeys, and exactly matches the age POST response. It adds no fixed sleep, product retry or weaker assertion. Exact head `e492457b` passed Enterprise CI, Documentation and Playwright on top of merged PR #98.
- Production release remains **NOT confirmed**: protected-branch/independent-review enforcement and real production operational evidence remain separate release gates.

## Update 1 October 2026 — onboarding write confirmation stability

- Repeated Playwright traces on independent PR heads exposed a real onboarding persistence race: the Firestore update had already been accepted, but the immediately following authoritative server read could still report `hasPendingWrites=true`, causing the UI to show “Deine Angaben konnten nicht gespeichert werden” and remain before the age/consent gate.
- The fix waits with Firestore's `waitForPendingWrites(db)` after `updateDoc` and before the existing `getDocFromServer` confirmation. This preserves the fail-closed persistence contract: onboarding still advances only after a server-confirmed profile; no retry loop, timeout increase, optimistic success or rule bypass is introduced.
- The registered-account onboarding Playwright journey remains the end-to-end acceptance test. Production release status is unchanged and remains **NOT confirmed**.

## Update 1 October 2026 — dependency security and PR revalidation

- PR #96 removes the repository-wide high-severity npm-audit blocker without lowering any audit threshold. The current resolution uses patched transitive versions and a version-scoped npm override for `@firebase/firestore@4.17.2` so that only its vulnerable nested `@grpc/grpc-js` line is forced to patched `1.13.6`. A future Firestore upgrade is therefore not silently pinned by this workaround.
- Registry-backed GitHub Actions validation on the candidate resolution passed `npm ci`, all static security checks, TypeScript, the API/Firebase emulator suite, production build, production-routing smoke test and container build. Root audit evidence measured 12 findings (1 low, 11 moderate, 0 high/critical), production root 6 (1 low, 5 moderate, 0 high/critical), and Functions production 2 moderate (0 high/critical). The final version-scoped/docs head must pass the same exact-head gates before merge.
- PR #55 (Vitest 5) is no longer blocked by matcher typings: the Vitest-specific Testing Library adapter and Vitest 5 matcher augmentation are in place; Documentation and Playwright pass on its reviewed head. Its Enterprise CI must be rerun after the security baseline lands on `main`.
- PR #44 remains blocked by the ESLint 10 / `eslint-plugin-jsx-a11y@6.10.2` peer-range incompatibility. PR #56 remains blocked by Vite 8.3.1 requiring esbuild ^0.27/^0.28 while the repository is on ^0.25. Neither blocker is bypassed with forced/legacy peer resolution.
- Production release remains **NOT confirmed**. Protected-branch/independent-review governance and the real production load/cost/SLO, restore/rollback, IAM/secret/alert and manual accessibility evidence gates remain open.

## Update 29 September 2026

- PR #51 was merged by squash after clean mergeability and successful `generate`, `validate-and-test` and `test` checks. The resulting `main` commit is `ca7b6c15970e7875e95fa3e840f3786b229b4d76`.
- PR #52 could no longer be updated cleanly after the squash because its history contained PR #51. Its exact unique delta was isolated as five commits / 86 files (48 modified, 38 added, no deletions or renames) and replayed atomically on current `main`. The replacement is PR #58, branch `feat/global-readiness-2026-09-29-rebased`, initial head `033f0d9f68a21642918e36a39852cfabfa344a3a`. PR #52 is superseded by #58.
- Governance remains a release blocker: branch protection for this private repository cannot be enabled on the current GitHub plan. The GitHub branch-protection API returns HTTP 403 and requires GitHub Pro or a public repository. An enterprise production release therefore still requires demonstrably enforced protected-branch / required-check / independent-review controls or an equivalent approved governance mechanism.
- Dependency updates remain gated by integration evidence. PR #55 (Vitest 5) fails TypeScript/TypeDoc because DOM/axe matcher typings are no longer resolved; PR #56 (Vite 8) and PR #44 (lint/type group) conflict with current `main` and had red CI. They are not release candidates. PRs #57, #54 and #53 may only be merged after their refreshed checks on the current base are fully successful.
- Production release is **NOT confirmed**. Provider acceptance, real cloud/IAM/retention evidence, manual accessibility validation, load/cost/SLO evidence, restore/rollback drills and an independent release approval remain mandatory where listed below.


### Accessibility baseline fix — 29 September 2026

- The PR #58 Playwright run exposed one real WCAG 2 AA failure in the magic-link recovery dialog: the submit button rendered #1c1c1c on #3f4a3c (1.83:1).
- Root cause: text-on-accent was used as a Tailwind utility while --color-on-accent was declared outside @theme, so the semantic foreground utility was not reliably generated and the button inherited the normal ink color.
- The semantic on-accent token is now declared in @theme (#ffffff in light mode, #161815 in dark mode). The existing Axe/Playwright test remains the acceptance test; production release is still not confirmed until the complete release evidence is green and independently approved.


### Chat- und Matching-Hardening — 29 September 2026

Stacked auf PR #58, noch **nicht** Bestandteil von `main` und kein eigenständiger Produktionsfreigabenachweis.

- Issue #27 / Phase 1c: Die serverseitige Chat-Gate-Prüfung war bereits transaktional, die Firestore-Regeln erlaubten Teilnehmern jedoch direkte Nachrichten-Reads unabhängig vom Gate. Die Rules erzwingen jetzt auch für Client-Reads ein vollständig offenes Gate sowie Block- und Löschstatus; eine bestehende Blockierung verhindert zusätzlich neue Chats.
- Matching: Das Dashboard schrieb positive Interaktionen nach `klar_interactions_nachricht`, die Lernlogik las jedoch `klar_interactions_like`. Der kanonische Schlüssel wird jetzt tatsächlich ausgewertet; der alte `like`-Schlüssel bleibt ausschließlich als Migrationslesepfad erhalten. Manipulierte oder unbegrenzt wachsende LocalStorage-Historien werden defensiv gefiltert und auf 200 Interessen begrenzt.
- Nachweis: neue Regressionen in der bestehenden Firestore-Rules-Suite sowie fokussierte Unit-Tests für das Interaktionslernen. CI-Ergebnisse sind erst nach Ausführung auf dem Fix-Branch als Evidenz zu werten.
- Issue #27 / Phase 1c ist zusätzlich modularisiert: `handleGateStatus` und `handleGateAnswer` wurden aus `klarCore.ts` in das dedizierte Modul `src/server/gate.ts` verschoben; Router und Persistenztests verwenden ausschließlich dieses Modul. Die Extraktion ändert keine Gate-Zähler- oder Transaktionssemantik.

# Project status


**Aktueller P0-Arbeitsstand:** [Excel-Abgleich, KYC, Verträge, Löschung und Freigabegates](P0_RELEASE_BLOCKERS_2026-09-28.md). Produktionsfreigabe ist nicht bestätigt.

Update 28 September: [incremental audit](AUDIT_2026-09-28.md) on `feat/global-readiness-2026-09-27`, dependent on PR 51. Adds transactional payment fulfillment, distributed AI reservations, deterministic matching explanations and typed locale persistence. PR [52](https://github.com/veselin8606-source/Klar-App/pull/52) has 16 successful browser tests at code commit `7bfceddc0eb49bb06c0575c9f624926050629022`; Enterprise CI passed with 574 tests in 88 files, Functions/security checks, production routing, build and container; documentation CI also passed. No production release.

Baseline from 27 September 2026. Prior review candidate: [PR 51](https://github.com/veselin8606-source/Klar-App/pull/51), branch `fix/audit-2026-09-27`, baseline main `a2a37cda1431000101a6e56a25f174e2ff55d065`. Not merged or deployed by this audit.

## Delivered in the candidate

Authentication destination validation; public-profile minimization and migration tooling; removal of fake identity and audio success; consent withdrawal settings; analytics validation and optional consent; Storage rules and retention; explicit Frankfurt Functions with required database selection; chat router extraction; bounded cleanup; stricter CI, dependency gates, production smoke and release evidence.

## Evidence and limits

See [the dated audit](AUDIT_2026-09-27.md) for commit-specific CI results and [the inventory](evidence/component-inventory.csv) for all inventoried source modules. Static import references do not establish execution coverage. Automated checks do not establish full WCAG conformity, legal compliance or production readiness.

## Open release gates

- Independent code review and protected main with mandatory checks. The branch API reported `protected: false` during this audit.
- Reviewed cleanup of legacy public-profile documents; the migration defaults to dry run.
- Deployment evidence for named database, Storage bucket, Frankfurt region, scheduler permissions, retention backlog and failure alerting.
- Real backup restoration, rollback drill, IAM review, load and cost measurements, SLO alert delivery.
- Manual keyboard, screen reader, reflow and mobile testing across authenticated journeys.
- Review of moderate dependency findings: verified snapshot root 7 total / 2 production and Functions 6 production; successor updates reduce the local full root scan to 5 and Functions production scan to 2. See [dependency review](DEPENDENCY_REVIEW_2026-09-27.md).
- Distributed AI reservations are implemented in PR 52; production load/retention validation and distributed analytics rate limiting remain required before multi-instance activation; analytics and chat archival remain disabled by default.
- Provider integration for identity, audio persistence, music icebreaker caller and complete payment/offline journeys remain incomplete or unproven.

Issue #27 remains open. Issues #35–38 have code mitigations in PR 51; cloud acceptance and merge status must be verified before closing them. Upstream Firebase issues are not resolved by application workarounds.

### 2026-10-08 — Typecheck remediation round 2

The subsequent exact-head-adjacent CI run `37802236002` reduced the earlier Firestore cascade to concrete server/UI contracts. Server-side release-relevant findings were repaired on commit `671e2798cf2b92d7c9516b698e1f6076ad3dfd5e`: consent input is narrowed to the canonical `Einwilligung` contract; launch density uses the canonical `LaunchCity` union; the AI route uses `GenerateContentParameters`; authenticated audit access is explicitly guarded; and smart-audit prompt parts are typed to permit only text or bounded inline image data.

The branch remains **NO-GO**. CI run `37802545060` was running on an earlier head while these fixes were applied; only the next completed run for the new exact head is authoritative. Tests, build, production smoke and browser acceptance remain blocked until Typecheck passes.
