# Partner conversion — Firestore emulator concurrency test (2026-10-29)

**Draft / Release BLOCKED / PRODUCTION NO-GO.**

## Scenario
Four simultaneous `recordPartnerConversion` calls with the same signed provider assertion use a **real local Firestore Emulator**. Expected result: exactly one new assertion, three idempotent duplicates, no increment to the qualified-conversion metric; a conflicting buyer for the same event ID returns `partner_event_id_conflict`.

## Safe execution
From `phase2_work` (Node >=22.23.3 and Java/Firebase CLI installed):
```sh
node scripts/check-emulator-ports.mjs --config firebase.pruefung.json
firebase emulators:exec --project demo-klar --only firestore --config firebase.pruefung.json "node scripts/run-partner-conversion-concurrency-emulator.mjs"
```
The dedicated runner validates localhost-only `FIRESTORE_EMULATOR_HOST` and the port from `firebase.pruefung.json`, project `demo-klar`, disabled durable fallback and non-production environment. It exits nonzero on misconfiguration. Running the Vitest file directly without emulator skips rather than passing as emulator proof; **only the dedicated runner's exit code and logs count as evidence**.

## Evidence boundaries / follow-up
New test and runner are committed, **not executed in a verified Firebase emulator yet**. The in-repo general CI may skip this integration test; a successful general CI is not proof of its concurrency assertions. Obtain an independently archived local/emulator log, required Node/Java versions, exact SHA and SHA256 checksums. Emulator transaction performance is not production concurrency or provider purchase provenance. Review possible emulator lock delays and delete test-created records after proof collection. Security/DPO/SRE and release owner signoff still required; P0 #55, #56, #70, #8 remain open. No merge/deploy.

## Typecheck remediation — 2026-10-29

- Baseline PR #200 HEAD: `5534149516ca84199551f71af7052bc290295d1c`; Enterprise-CI run `40927111058` failed TypeScript `TS2532` for unchecked indexed Firestore refs in this test. Other gates after typecheck were not established by that run.
- Isolated fix branch `fix/200-concurrency-fixture-typecheck-20261029`: replace indexed access with named references and retain a fixed tuple for cleanup. This is a source-level correction, **not a verified test PASS**.
- Required evidence before integration: exact-HEAD typecheck; dedicated `demo-klar` Firestore emulator runner with nonzero-on-failure exit and full logs; cleanup of test-created event/ledger/claim records; independently reviewed replay and buyer-conflict results.
- Do not infer production purchase authenticity, Cloud Firestore safety, legal approval, or GO from a green generic CI. #55, #56, #70 and #8 remain blocked. No merge, deployment, or release approval.

## CI follow-up — run 40928192396

Enterprise CI on HEAD `c73ff255adfbf3d0284ac2b75a67c87488e97779` failed at the Tests step, **not typecheck**: 193 Vitest files passed and the emulator-concurrency suite failed during import with `partner_conversion_emulator_unsafe_target` (line 16). The test had `describe.skipIf(!FIRESTORE_EMULATOR_HOST)` but a module-level guard also ran when only `KLAR_REQUIRE_FIRESTORE_EMULATOR` was set, before skip could take effect. Follow-up commit `baff95d318b0e42995f3a3dada2359450b4082fd` limits that target check to an actually configured emulator host; when host is present, loopback/port/project/nonproduction/fallback restrictions remain enforced. This is not a verified PASS. Dedicated emulator runner evidence remains mandatory. Do not equate a skipped test with a passing concurrency test. Production NO-GO.
