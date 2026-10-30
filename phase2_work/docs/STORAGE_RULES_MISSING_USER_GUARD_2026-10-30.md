# Storage Rules absent-user guard — 2026-10-30

**Status: DRAFT / PRODUCTION NO-GO; validation PENDING.**

## Evidence and risk
- Exact ancestor PR #208 head: `ee12d1a8beee19e225b43bcf41b14153999181dc`, built on draft #207, #205, #203. All remain unmerged drafts at observation.
- CI workflow [41016453582](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41016453582), job 123933776535, completed/success and exercised live local Firebase Auth + Firestore + Storage emulators; 197 test files passed.
- Log emitted twice: `EvaluationException: Error: storage.rules line [32], column [14]. Null value error`. Source at line 32 performed `firestore.get(...).data.isAdult` without an explicit missing-document check. **Candidate explanation**, not proven log-to-test attribution.
- The narrow patch adds `firestore.exists(...)` prior to the protected-field lookups, using short-circuit AND; absent target/requester document should deny. This does not alter an existing adult+active user's successful path and does not solve bearer URL token revocation.
- Storage Rules document-read quotas, pricing and evaluation differences must be checked via real emulator and staging. Avoid assuming test-model behavior reflects actual deployed rules.

## Acceptance evidence required before merge
- [ ] Exact branch-head CI: static policy gate, Typecheck, Functions build, complete tests, browser acceptance.
- [ ] Real Storage + Firestore emulator with owner missing, reader missing, pending age, deleted/suspended status, unauthenticated/anonymous; assert `permission-denied`, **no exception** for missing user docs. Preserve positive adult-active cross-profile reads and owner image writes/deletes.
- [ ] Confirm whether the original two CI warnings disappear under identical tests; if not, isolate remaining source and document expected denial path.
- [ ] Verify firestore.exists/get cross-service rule quotas, IAM, billing, approved policies and actual environment configuration in controlled staging.
- [ ] Independent Security/DPO/SRE review and approved rebase/merge plan across #203 -> #205 -> #207 -> #208 -> this patch. No merge/deploy/token rotation until human release GO.
- [ ] Update issue #204 / #206 and release #8 only with exact artifact links and qualified signoffs.

## Change control
No production cloud, customer records, secrets, Rules deployment, live tokens or main branch changed by this patch. Existing frozen PR #119 and RC R2 remain untouched. The draft fix is **not** an approved release and no pass is claimed without new evidence.

## Exact-head CI verification — 2026-10-30
- PR #209 HEAD `881d0981d4ff7a1ade8a440180ec1b4ad810a6fd` — [CI run 41018751334](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41018751334) **completed/success**, job `validate` ID `123940966675` also success. Mandatory Enterprise static gates, typecheck, Functions build, automated tests, build, smoke and browser acceptance succeeded. Browser failure-diagnostics upload skipped normally.
- Reviewed raw workflow job log: **197 test files passed**. Searches of the returned job log found **no** `Null value error` or `EvaluationException` strings, unlike prior run #41016453582. This is an observed log difference, **not definitive proof** the exact missing-user negative scenario was tested, nor proof of deployed Rules.
- Toolchain gate reported Node 22.23.3 and Bun 1.4.4. `check-profile-storage-authz` explicitly states **source only; live policy unverified**.
- Remaining acceptance: add explicit missing requester/owner document denial regression; validate short-circuit semantics with real Storage/Firestore emulator and check quotas; independent review and controlled staging. **NO-GO**, unmerged draft; no manually dispatched CI jobs.
