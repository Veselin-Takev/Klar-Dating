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

### Typecheck correction — 2026-11-03

CI run `40927111058` on `5534149516ca84199551f71af7052bc290295d1c` stopped at Typecheck with five TS2532 diagnostics on indexed document references. The four eagerly constructed references are now a readonly tuple (`as const`), preserving the known indices under strict indexed-access checking. This changes only TypeScript inference: setup, assertions, cleanup and emulator targeting remain unchanged. No non-null assertions, compiler-option relaxation or test skips were added. A new exact-head CI must validate the complete type graph; local syntax checking is not a full typecheck or emulator execution. The dedicated emulator evidence remains outstanding.

New test and runner are committed, **not executed in a verified Firebase emulator yet**. The in-repo general CI may skip this integration test; a successful general CI is not proof of its concurrency assertions. Obtain an independently archived local/emulator log, required Node/Java versions, exact SHA and SHA256 checksums. Emulator transaction performance is not production concurrency or provider purchase provenance. Review possible emulator lock delays and delete test-created records after proof collection. Security/DPO/SRE and release owner signoff still required; P0 #55, #56, #70, #8 remain open. No merge/deploy.
