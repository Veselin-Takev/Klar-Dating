# Current audit status — 8 October 2026

**Current candidate:** PR #1 / `security/v149-autonomous-consolidation` (latest remediation commit recorded in the active CI evidence below).

## Current authoritative status

- Critical Multi-Instance rate limits are now backed by the shared Firestore transaction boundary for account/consent changes, billing checkout, device-token writes, launch/referral flows and Trust-&-Safety writes.
- The Cloud Run deployment template permits up to 10 instances; process-local counters were therefore insufficient as the sole abuse control on those critical paths.
- A dedicated `check:rate-limit-distribution` Enterprise gate prevents the critical modules from silently reverting to local counters.
- The Chat `/api/chats` N+1 mitigation is implemented via deduplicated Firestore bulk reads; runtime traces remain required to close the P1 with measured read/latency evidence.
- The latest Exact-Head CI run must still pass Typecheck, Tests, Build, Production Smoke and Browser Acceptance on the final head before technical release gates are green.
- **Production release remains NO-GO / NOT CONFIRMED.**

## Latest remediation — distributed critical rate limits

- `src/server/distributedRateLimiter.ts` provides atomic Firestore-backed counters with bounded identities, fail-closed 503 behavior on unavailable limiter storage, and RateLimit/Retry-After metadata.
- Critical state-changing and cost-sensitive routers use the distributed middleware. Authenticated paths are UID-scoped; unauthenticated requests fall through to the existing global authentication/rate-limit controls.
- The global API limiter and lower-risk read/anonymous limiters remain local by design and are not treated as authoritative cross-instance enforcement.

### 2026-10-08 — Final P1 consolidation

- Chat list access is now evaluated in one bounded Firestore read transaction across the candidate set, replacing the per-chat transaction/profile RPC pattern while preserving fail-closed block, account-deletion and example-profile semantics.
- Critical multi-instance rate limits are now enforced with shared Firestore counters for account/consent, billing checkout, device-token writes, launch/referral and Trust-&-Safety flows. Cloud Run maxScale evidence is 10.
- A deterministic cross-instance limiter regression test and Enterprise topology gate protect the new control.
- The remaining local limiters are lower-risk read/anonymous controls and are not treated as authoritative cross-instance abuse protection.

## Release evidence rule

A static gate PASS does not compensate for a failed, skipped, cancelled, queued or otherwise incomplete dynamic gate. Only exact-head evidence from the release candidate is authoritative.

### 2026-10-08 — Exact-head CI 37829759159: strict test fixtures aligned with production contracts

Exact-head Enterprise CI run `37829759159` on base candidate `60c7767a17a26741627375812a9cecda95d65006` passed dependency-lock preflight, dependency installation and all Enterprise static gates, then failed at Typecheck. The remaining diagnostics were isolated to five stale enterprise test fixtures: accessibility evidence omitted the required environment field; two Firestore mock calls in the age/consent cascade tests crossed the `Firestore` boundary without the established test-only cast; recovery evidence still referenced removed rollback fields from an isolated-restore fixture; and the final Stripe persistence assertion accessed nullable Firestore snapshot data without narrowing.

The remediation keeps production contracts strict and changes only test fixtures at their boundaries: fixtures now satisfy the version-2 accessibility schema, mock Firestore objects are explicitly cast only at the test boundary, the recovery regression test now asserts rollback evidence only for production evidence, and persisted Stripe data is narrowed before field access. No compiler relaxation or production `any` escape hatch is introduced.

Production remains **NO-GO / NOT CONFIRMED**. The next exact-head CI run must prove Typecheck, Tests, Build, Production Smoke and Browser Acceptance before technical release gates can advance.

### 2026-10-08 — Exact-head CI 37830946345: test phase exposed two classes of blockers

Exact-head Enterprise CI run `37830946345` passed Typecheck on candidate `a7780d28a9a19c87d83bdc9069f2fcde2e66ce73`, then failed in the Tests stage with 54 failing cases. Trace analysis separated the failures into two classes: lightweight HTTP test doubles did not implement the mandatory distributed rate-limit transaction surface, and the real Firestore emulator returned native `DocumentReference` values from query snapshots that the Durable transaction adapter rejected with `Durable transaction reference is not backed by Firestore.`

The production root cause is fixed at the Durable Firestore boundary: transaction references may now be either adapter-wrapped references or native Firestore `DocumentReference` instances returned by real queries. Native references are accepted only after strict structural identification; no fallback, fail-open path, or compiler relaxation was introduced.

The remaining HTTP test-double failures are a separate fixture-alignment task and are not being masked by weakening distributed rate-limit enforcement.

---

---

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

### 2026-10-08 — Typecheck remediation round 3

The candidate was reduced from broad strict-TypeScript cascades to concrete persistence/UI contracts. The current remediation includes typed Trust & Safety, consent, risk, age-gate, AdMob, DSA and privacy-export Firestore boundaries; safe validation of production-control JSON structures before nested property access; strict Stripe API/event typing without weakening compiler checks; bounded traceparent parsing in observability; runtime guards for persisted diary, mood, calendar and profile data; typed Recharts callback payloads and profile component contracts; versioned onboarding translations through the declared i18next object contract; removal of stale/unused client imports and dead state; and removal of synthetic fallback trait selection from the Weekly-Vibes view so missing user evidence cannot be presented as observed traits.

The active candidate head is 96fd51fb098ff01b7b3392807220519921f92429. CI run 37805740362 is registered for this head but has not started its job yet. No dynamic PASS is inferred from a queued run.

**Production remains NO-GO / NOT CONFIRMED.** Exact-head Typecheck, Tests, Build, Production Smoke and Browser Acceptance must all pass, followed by the independent operational/governance release evidence.

### 2026-10-08 — Exact-head CI status refresh

The release candidate advanced beyond the earlier type-contract remediation. Current PR head: c8b6bb87d3c8189a88d7c20d19339ff037699863. The corresponding Enterprise CI run is 37805805516 and is currently in progress; dependency installation has completed only partially in the latest job snapshot, so no Typecheck/Test/Build/Smoke/Browser result is inferred yet.

The candidate remains **NO-GO / NOT CONFIRMED**. Static gates are necessary but never sufficient for production promotion, and queued/in-progress CI is not release evidence.


### 2026-10-08 — CI typecheck remediation: distributed rate limiter imports

Exact-head Enterprise CI run #166 (37814479762) passed all Enterprise static gates but failed at Typecheck before Tests/Build/Production Smoke/Browser Acceptance. The concrete diagnostics were: missing ipKeyGenerator import in the account router; an incorrect relative module import in the distributed-rate-limiter regression test; and an unused Vitest vi import.

These issues are corrected on candidate head c47dea5dacc4832e354373226c88d43ee333c702. The correction preserves the IPv6-safe ipKeyGenerator policy and the cross-instance limiter regression coverage without weakening compiler strictness.

No PASS is inferred yet: the new head has not produced an authoritative workflow result at documentation time. Production remains NO-GO / NOT CONFIRMED until the exact current head completes Typecheck, Tests, Build, Production Smoke and Browser Acceptance, followed by independent operational/governance evidence.


### 2026-10-08 — CI typecheck remediation: server tsconfig declaration boundary

Exact-head Enterprise CI #170 (`37815141084`) passed dependency installation and all Enterprise static gates but failed at the separate server Typecheck project because `src/types/express.d.ts` was not part of `tsconfig.server.json`. This caused the global Express `Request` augmentation (`user`, `session`, `nutzer`, `istGast`) to disappear from the server compilation context.

The server TypeScript project now explicitly includes `src/**/*.d.ts` on candidate `deb5722030a6974caf97ae592e29bf6229174036`. No casts or compiler relaxations were introduced. Production remains **NO-GO / NOT CONFIRMED** pending a successful exact-head dynamic gate sequence.


### 2026-10-08 — Chat read-path regression gate

The implemented Chat list optimization is now protected by a deterministic Enterprise gate. `check:chat-read-path` requires `/api/chats` to use the bounded `loadChatListAccess` path, exactly one transaction and one `tx.getAll` in that loader, and no asynchronous per-entry profile reads. This blocks regression to the former N+1 access pattern without claiming production trace evidence.


### 2026-10-08 — Chat read-path gate integration repair

Exact-head Enterprise CI #173 (`37816110016`) failed during dependency installation because the newly added Chat regression gate was committed with literal escaped newline sequences inside `package.json` and its `.mjs` source. The implementation itself was not evaluated by CI. The package entry and gate script were corrected on the subsequent candidate lineage (`7afb93dd7e304fa096c5a9716bb3c5b7a0050457` and `2a3b3bc7cf3666e46afb696f990f9f64573e5322`).

The correction restores valid JSON and normal JavaScript source newlines; no application runtime behavior or compiler relaxation was introduced. A new exact-head Enterprise run is required. Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Chat read-path gate regex hardening

Exact-head review of the Chat read-path regression guard found a repository-integration defect in its regular-expression literals: word-boundary assertions had been persisted with an extra escape level, so the intended structural matcher was not reliably expressed. The gate was corrected on candidate commit `02c9c7e2516f763301615a14d6e4061ae21bf45f` without changing application runtime behavior.

The release candidate remains **NO-GO / NOT CONFIRMED** until the new exact-head Enterprise CI run proves the corrected gate and completes Typecheck, Tests, Build, Production Smoke and Browser Acceptance. A static source inspection is not substituted for CI evidence.


### 2026-10-08 — Chat gate final regex normalization

A second source-level review identified remaining double escaping in the Chat regression guard's regex literals. The gate has now been rewritten with canonical JavaScript regular-expression literals for word boundaries, member-access dots and whitespace matching on candidate commit `555a2b89a23fc4449b5c2679be91f26db3d9c1a9`. This is CI/test infrastructure only; application runtime code is unchanged.

**Evidence policy:** no release credit is assigned until the exact candidate head is executed by Enterprise CI and all dynamic gates complete successfully. Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Release-governance and CI surface consolidation

The release candidate exposed an integration gap in its own Enterprise gates: the branch referenced a production `.github/workflows/release.yml` contract, but that workflow was absent. The candidate now restores a tag-only, protected-environment release-evidence workflow with immutable GHCR image digests, maximum Buildx provenance, SBOM generation, exact commit/tag identity checks, Functions build identity, deployment-manifest rendering, container-attestation verification and a complete SHA256 checksum ledger. Production promotion remains separate from artifact publication and still requires the outstanding operational/governance evidence.

The deployment manifest validator was also removed from its historical `veselin8606-source` registry-owner assumption; it now validates the repository owner supplied by the release environment while retaining strict immutable-digest validation.

The CI toolchain-pin gate now discovers the actual workflow surface rather than failing on obsolete hard-coded filenames. Deterministic tests remain separated from stochastic LLM security evaluation; the latter now has an explicit manual, opt-in workflow guarded by `KLAR_RUN_LLM_EVAL`.

Current candidate remains **NO-GO / NOT CONFIRMED** until the new exact-head Enterprise CI completes Typecheck, Tests, Build, Production Smoke and Browser Acceptance, followed by independent operational and governance evidence.


### 2026-10-08 — Release artifact assertion tightened

The release-evidence workflow now explicitly asserts the generated `release/deploy/*.json` manifests before checksum verification. This closes a gate-to-artifact naming mismatch without changing deployment semantics.


### 2026-10-08 — Signed container provenance attestation

Supply-chain hardening was extended from Buildx provenance/OCI metadata to a GitHub-signed container provenance attestation. The production release workflow now grants only the required `id-token: write` and `attestations: write` permissions and invokes `actions/attest@v4` against the immutable `ghcr.io/<repository-owner>/klar-app@sha256:<digest>` subject. The release workflow gate requires this exact digest-bound attestation configuration before release evidence can pass.

This follows current GitHub guidance that provenance generation must be accompanied by verification and that container attestations should be bound to the image name and immutable digest. citeturn0search2turn0search0

Production remains **NO-GO / NOT CONFIRMED** until the exact candidate head passes dynamic CI and the independent production approval/operational evidence is present.


### 2026-10-08 — Attestation action immutability hardening

The GitHub container provenance attestation introduced in the previous release-hardening step is now pinned to the reviewed full commit SHA `7d8b1cacecb65f487779b3b98fd5296a018d1a1b` instead of the mutable `v4` tag. The release workflow gate requires this immutable reference. This closes the remaining mutable third-party-action reference introduced by the attestation control and preserves the repository-wide full-SHA policy.

GitHub documents full-length commit-SHA pinning as the immutable-release control for Actions and recommends it for supply-chain protection. citeturn0search2turn0search8

Production remains **NO-GO / NOT CONFIRMED** pending dynamic exact-head CI and independent operational/governance evidence.


### 2026-10-08 — Artifact metadata permission aligned with current Attest contract

The production release workflow now grants the additional `artifact-metadata: write` permission required by the current `actions/attest` container-registry attestation contract. The permission remains scoped to the release job and is enforced by the release-workflow static gate, preventing a future regression to an incomplete attestation permission set.

GitHub's current Attest documentation lists `id-token: write`, `attestations: write`, and `artifact-metadata: write` for attestation generation, with `packages: write` required for container registry publishing. citeturn0search1turn0search2

Production remains **NO-GO / NOT CONFIRMED**. Dynamic exact-head CI and actual attestation verification are still required before release approval.


### 2026-10-08 — Exact-head CI static-gate failure remediated

The reported Klar Enterprise CI run `37818737668` failed in the `Enterprise static gates` step before typecheck, tests, build, smoke, or browser acceptance. Root cause analysis identified a malformed workflow-file discovery regex in `scripts/check-ci-toolchain-pins.mjs`: the escaped pattern matched the wrong literal form and therefore could resolve to an empty workflow surface. The gate was corrected to the canonical `/\\.ya?ml$/` regex.

During the same fail-closed review, the release attestation permission condition in `check-release-workflow.mjs` was corrected from an operator-precedence-sensitive expression to an explicit OR check requiring all three permissions: `id-token: write`, `attestations: write`, and `artifact-metadata: write`. This prevents a future regression from being masked by JavaScript boolean precedence.

The failing run's application validation stages were skipped because the static gate failed first; therefore no claim is made about typecheck/test/build status from that run. A fresh exact-head CI run is required for release evidence.

Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Enterprise static gate failure: release inspect assertion corrected

The follow-up CI run `37819483838` reached dependency installation successfully but failed again in `Enterprise static gates`, with Typecheck, Tests, Build, Production smoke, and Browser acceptance skipped. Root-cause review of the exact-head workflow found a false-negative in `scripts/check-release-workflow.mjs`: the gate required a literal fully expanded `docker buildx imagetools inspect ghcr.io/...:<tag>` command, while the release workflow intentionally constructs and reuses the validated `$image` variable. The gate has been corrected to require the repository-scoped image assignment and the equivalent `imagetools inspect "$image"` command, preserving the immutable digest/tag-binding contract without coupling the test to shell interpolation syntax.

This is a CI-gate correctness fix only; no application runtime behavior was changed. A fresh exact-head run is required before any downstream test or release evidence is considered valid.

Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Exact-head CI 37820349100: stale release-workflow assertions remediated

Fresh exact-head CI run `37820349100` reached the Enterprise static gates and failed only in `check-release-workflow.mjs`. The reported failures were (1) the attestation assertion and (2) the semver tag-to-digest assertion. Runtime inspection showed that the production workflow already contained the intended controls, but the static gate had stale text assertions that did not match the actual variable-bound Buildx command form.

The release gate was corrected to assert the canonical workflow contract actually used by the release job: the digest-bound GitHub Attest configuration and the tag inspection command operating on the explicitly constructed `$image` variable. No application runtime code was changed. Because typecheck, tests, build, smoke, and browser acceptance were skipped after the static gate failure, those stages remain unproven until a fresh run executes them.

Production remains **NO-GO / NOT CONFIRMED** pending the next exact-head CI run and subsequent independent release/operational evidence.


### 2026-10-08 — CI root-cause: duplicate nested workflow tree removed

Exact-head CI run `37820930237` checked out synthetic merge commit `a6ca144…` and failed in the release-workflow static gate even though the repository-root release workflow contained the expected controls. Root-cause analysis showed that the CI job runs with `phase2_work` as its working directory, while `check-release-workflow.mjs`, `check-ci-toolchain-pins.mjs`, and `check-test-separation.mjs` previously resolved `.github/workflows/*` relative to that working directory. A legacy duplicate workflow tree at `phase2_work/.github/workflows` therefore shadowed the authoritative repository-root workflows.

Remediation: all three gates now resolve the active workflow directory from `import.meta.url` and the repository root, independent of the current working directory. A new `check-workflow-layout.mjs` gate enforces a single workflow source of truth. The seven historical nested workflow files under `phase2_work/.github/workflows` were removed. The active GitHub Actions surface is now exclusively `.github/workflows` at repository root.

This is intentionally a governance/control-plane fix, not an application workaround. It eliminates path ambiguity and prevents stale CI/release definitions from silently becoming release evidence inputs.

Production remains **NO-GO / NOT CONFIRMED** until a fresh exact-head CI run passes all deterministic validation stages and the independent release/operational approval evidence is verified.


### 2026-10-08 — Exact-head CI dependency-lock gate path/topology fix

Exact-head CI run `37822007081` passed dependency installation but failed in `check-dependency-locks.mjs` because the gate still attempted to read the removed nested `phase2_work/.github/workflows/auto-version.yml`. After the workflow-shadow cleanup, the authoritative Actions surface is repository-root `.github/workflows`, and `auto-version.yml` is no longer present.

Remediation: `check-dependency-locks.mjs` now resolves all paths from the repository root and treats `auto-version.yml` as an optional policy surface: when present it is validated, when absent it cannot become a false blocker. The active GitHub and GitLab dependency-install contracts remain explicitly verified. No dependency versions were changed and no lockfile regeneration was accepted as a substitute for a deterministic policy fix.

Production remains **NO-GO / NOT CONFIRMED** until a fresh exact-head run reaches and passes all subsequent deterministic validation stages.


### 2026-10-08 — Dependency lock preflight moved before installation

The next exact-head CI failure was in `check-dependency-locks.mjs`: the gate required the active CI/release workflow to run the lock verification before the Functions dependency graph was installed. The repository's GitHub workflows previously satisfied the policy only indirectly through the later Enterprise static-gate bundle.

Remediation: both repository-root `.github/workflows/ci.yml` and `.github/workflows/release.yml` now execute `node scripts/check-dependency-locks.mjs` as an explicit preflight step before `bun ci` or `npm ci --prefix functions`. The lock gate also remains part of the Enterprise static-gate bundle as defense-in-depth. No dependency versions or lockfile contents were changed.

This makes the release/CI control order deterministic: validate lockfile policy first, then materialize dependency graphs, then execute security/type/test/build stages.

Production remains **NO-GO / NOT CONFIRMED** pending a fresh exact-head CI run through all remaining deterministic stages and independent operational release evidence.


### 2026-10-08 — GitHub Actions Node 20 runtime warning remediated

The preceding CI logs emitted a GitHub Actions warning that the pinned `actions/setup-node` revision targeted the deprecated Node 20 action runtime. Current `actions/setup-node` v7 runs on Node 24 while remaining capable of installing the project's pinned application runtime (Node `22.23.3`). The three active repository-root workflows (`ci.yml`, `release.yml`, and `llm-evaluation.yml`) were therefore upgraded to the verified immutable `actions/setup-node@820762786026740c76f36085b0efc47a31fe5020` revision, with the enterprise toolchain-pin gate updated to require the same SHA.

This changes only the GitHub Action's execution runtime; the Klar application/toolchain contract remains Node `22.23.3` and Bun `1.4.2`. GitHub's current setup-node documentation shows the action running under `node24`, and the current v7 line documents Node 24 usage. citeturn174539search6turn174539search1

Production remains **NO-GO / NOT CONFIRMED** until the next exact-head CI run completes all deterministic gates and independent production approval/operational evidence is verified.


### 2026-10-08 — Continuous dependency-update coverage added

Supply-chain hardening now includes an automated maintenance path in addition to immutable action pins. A repository-root `.github/dependabot.yml` was added for weekly GitHub Actions, Bun, Firebase Functions npm, and Docker dependency monitoring. A dedicated `check-dependabot-config.mjs` Enterprise gate verifies the file, supported directories, version 2 configuration, and weekly schedules. This prevents the immutable-pin policy from becoming stale without an automated update mechanism.

Current GitHub documentation lists Bun and GitHub Actions as supported Dependabot ecosystems and requires `.github/dependabot.yml` in the default-branch `.github` directory. citeturn111071search0turn111071search2turn111071search10

Production remains **NO-GO / NOT CONFIRMED** pending the next exact-head CI run through all deterministic stages and independent production approval/operational evidence.


### 2026-10-08 — Autonomous CI monitoring budget guardrail

The repository work is now paired with an explicit execution-budget guardrail requested for the ongoing PR validation: autonomous GitHub Actions execution is capped at **300 minutes**. No unnecessary workflow runs or blind reruns are permitted. Once the 300-minute ceiling is reached, further GitHub Actions execution must stop and explicit approval for up to an additional 200 minutes must be obtained before continuing.

A scheduled CI-monitoring automation was created for PR #1 to inspect completed validation runs, diagnose concrete failures, apply repository fixes, and keep this status document synchronized. The automation does not treat the absence of a CI result as success and retains the existing fail-closed production rule.

Production remains **NO-GO / NOT CONFIRMED**.


### 2026-10-08 — Exact-head CI 37825579777: Dependabot gate parser fixed

The exact-head CI run `37825579777` reached the new Dependabot control and failed because `check-dependabot-config.mjs` used an over-escaped schedule regex. The repository configuration itself was valid; the gate incorrectly rejected all four weekly schedules.

Remediation: the gate now parses each `package-ecosystem` block deterministically and asserts the literal `interval: weekly` contract, while retaining explicit ecosystem and directory checks. No dependency configuration or versions were changed. This is a test-infrastructure correction only.

The same run confirmed the prior dependency-lock preflight is now passing. Typecheck, tests, build, smoke, and browser acceptance were again skipped because the static gate failed first.

Production remains **NO-GO / NOT CONFIRMED** pending a fresh exact-head run that reaches all dynamic stages.

### 2026-10-08 — Exact-head CI 37826645943: release evidence contract made explicit

Exact-head Enterprise CI run `37826645943` completed after the Dependabot remediation and passed the dependency-lock preflight plus the surrounding Enterprise controls. The only remaining static failure was `check-release-workflow.mjs`, which rejected workflow contracts that were semantically present but not explicitly asserted as concrete release artifacts.

Remediation on candidate commit `f6a6a4fcef61db17ca7ff85a93f3b3c2c5aeb539`: the tag-to-digest deployment-manifest render now uses the repository-scoped `github.repository_owner` expression, and the workflow explicitly verifies the generated application build identity, Firebase Functions build identity, container tag-binding evidence, and CycloneDX SBOM identity before the checksum ledger and artifact upload. This keeps the gate fail-closed while making the release evidence chain directly auditable.

The release workflow remains tag-only and protected-environment gated. No production deployment is inferred from artifact publication alone. Production remains **NO-GO / NOT CONFIRMED** until a fresh exact-head CI run completes Typecheck, Tests, Build, Production Smoke and Browser Acceptance and the independent operational/governance evidence is verified.

### 2026-10-08 — Release manifest owner binding corrected

A final source-contract review found that the release manifest render command still interpolated the repository owner through the shell environment even though the enterprise checker requires the owner to be bound through the GitHub repository context. Candidate commit `7c2b7bb378ec5988220be5dd44b69c24b91ec9d7` now passes `github.repository_owner` directly into the immutable `@sha256` image reference used for generated deployment manifests.

This is a control-plane hardening change only. The release remains tag-only, protected-environment gated, digest-immutable and fail-closed; no production deployment or release approval is inferred from static checks. A fresh exact-head CI result is required after this change.

### 2026-10-08 — Release artifact uploader path assertion corrected

Exact-head release-gate review identified a false-negative in `check-release-workflow.mjs`: GitHub Actions steps with a `phase2_work` working-directory still execute action inputs such as `upload-artifact.path` relative to the workspace root. The authoritative release workflow therefore correctly uploads `phase2_work/release/`, while the checker incorrectly required the ambiguous `release/` path.

Candidate commit `aa5613095712c1ca706ec079535a8c4e766ed1ad` aligns the static gate with the actual action path semantics. The release artifact path itself is unchanged. This preserves fail-closed packaging while removing a checker-only false positive.

Production remains **NO-GO / NOT CONFIRMED** pending a fresh exact-head Enterprise CI result through Typecheck, Tests, Build, Production Smoke and Browser Acceptance plus independent operational/governance evidence.

### 2026-10-08 — Exact-head CI 37827690046: strict test typecheck remediation

Exact-head Enterprise CI run `37827690046` passed all Enterprise static gates and the dependency-lock preflight, then failed in the dedicated `tsconfig.tests.json` typecheck. The failure surface contained 58 diagnostics across accessibility, operational evidence validators, Firestore-backed platform tests, DSA appeals, offline queue tests, and several nullable Firestore/Auth snapshots.

Remediation was performed without weakening strict TypeScript:
- accessibility, load/cost, operational-control and recovery fixtures were migrated to their current validator schemas and trusted context arguments;
- Firestore test doubles are now explicitly isolated at the test boundary instead of widening production function contracts;
- the DSA appeal API now exposes overloads with a typed transactional `DsaAppeal` result, while its in-memory test transaction contract is declared locally;
- the offline queue tests use the user-scoped `clearQueueForUser` API instead of a stale global clear helper;
- Vitest's `vi` spy API and Firebase emulator response/profile snapshots are explicitly typed;
- nullable Firestore snapshots in persistence tests are narrowed before field access.

Candidate `08e8c42227651bdb5bd2ae8cc668d82e7a416519` contains the complete remediation lineage. Static source review found the previously reported stale calls removed. A fresh exact-head CI result remains required; no success is inferred from source inspection alone.

Production remains **NO-GO / NOT CONFIRMED** pending green Typecheck, Tests, Build, Production Smoke and Browser Acceptance on the same exact head, followed by independent operational/governance evidence.

### 2026-10-08 — Offline queue test-boundary runtime correction

The strict-test remediation exposed one additional environment-boundary defect in `clearQueueForUser()`: the function correctly scoped memory cleanup by authenticated owner UID, but its IndexedDB cleanup path was unconditional and therefore rejected in Node-based enterprise tests where IndexedDB is unavailable.

Candidate `6c5e639b989f715424dd80912467e2d9f166b0ac` now preserves the user-scoped memory cleanup and invokes the persistent IndexedDB cleanup only when `indexedDB` is available. This is a defensive runtime-boundary correction; it does not introduce a global queue-clear capability and does not alter browser behavior.

Production remains **NO-GO / NOT CONFIRMED** until fresh exact-head CI proves Typecheck, Tests, Build, Production Smoke and Browser Acceptance and independent operational/governance evidence is verified.

### 2026-10-08 — Exact-head CI 37829119764: DSA test parser defect corrected

Exact-head Enterprise CI run `37829119764` again passed dependency-lock preflight and all Enterprise static gates, then failed in the test TypeScript compilation with three parser errors at `tests/enterprise/dsaAppealEngine.spec.ts:15`. The source review showed a literal `\\n` sequence had been persisted before the newly introduced mock interface.

Candidate `b09fc7e87620b418b529f8001b3742c70d53a9e5` removes that literal escape and restores valid TypeScript source. A repository-wide inspection of the recently touched strict-test remediation files found no further matching literal-newline defects.

Production remains **NO-GO / NOT CONFIRMED**. The next exact-head CI run must still prove Typecheck, Tests, Build, Production Smoke and Browser Acceptance before release evidence can advance.
