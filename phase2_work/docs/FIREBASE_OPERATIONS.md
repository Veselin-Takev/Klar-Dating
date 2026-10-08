# Firebase operations and upstream references

Updated 28 September 2026. Applies to PRs 51 and 52; no production deployment is implied.

## Local and CI isolation

Install with the lockfile: Firebase CLI 15.31.0, Node 22.23.3 and Java 21 in CI. Use demo-prefixed projects for Auth, Firestore and Storage. The Storage test bucket is explicitly `demo-klar.appspot.com`; do not let SDK defaults create a second implicit test bucket. Port checks cover 3000, 4000, 4400, 4500, 5001, 8080, 9099, 9199 and 9150. Stop only processes you own. File-level emulator tests run serially, while deliberate transaction-race tests remain concurrent. Every CI run starts a fresh emulator process.

## Named database and Frankfurt deployment

All three scheduled jobs have explicit `europe-west3` region and global region defaults. `npm run check:functions` inspects compiled endpoint metadata. `FIRESTORE_DATABASE_ID` is a required Functions parameter and must equal the API database ID, including for named databases. `KLAR_STORAGE_BUCKET` is also required and must name the exact API bucket, without `gs://`. Never replace a missing database configuration with `(default)`. Functions uses `KLAR_STORAGE_BUCKET` because Firebase reserves `FIREBASE_` names. This is distinct from the Express API configuration name `FIREBASE_STORAGE_BUCKET`; both values must identify the same bucket. The build gate validates all declared parameters with the installed Firebase CLI validator. See [reserved environment names](https://firebase.google.com/docs/functions/config-env#reserved-environment-variables).

Before activation, record project, database, bucket, deployed function region, scheduler service account, least-privilege IAM and trigger state. Validate with synthetic records in the target environment. CI metadata checks do not prove deployed configuration. Do not deploy or migrate production as part of an audit without a reviewed release record.

## Retention and erasure

Photo cleanup scans the `verification/` prefix in pages of 200, at most ten pages per invocation, with a persisted cursor. Objects older than 30 days are deleted with a generation precondition; held objects are skipped. Missing metadata fails visibly. Daily scheduling and bounded work mean deletion is not guaranteed at the exact 30-day boundary. Monitor oldest eligible object, backlog, failures and held-object exceptions; increase reviewed capacity if arrival rate exceeds processing capacity. Record a legally approved maximum deletion delay before activation.

The same job removes at most 400 expired analytics documents per invocation. Configure and verify Firestore TTL or sufficient cleanup capacity before enabling analytics; timestamps alone do not delete data. Analytics stays off by default. Chat archival stays off by default and processes at most 50 chats per run, 200 messages per transaction. Archived content remains personal data and participates in account erasure.

Account erasure also removes verification/profile Storage prefixes, archived messages, analytics and activation records. The static deletion catalog is an engineering cross-check, not proof of legal retention or complete production deletion. DSA, billing, backup and legal-evidence exceptions need approved retention rules.

## Legacy public profiles

`scripts/sanitize-public-profiles.ts` defaults to dry run. Review counts, backup/recovery evidence and the exact target database before an approved `--apply` run. The script replaces documents with an allowlisted projection or removes ineligible records. Current API projection prevents returning legacy private fields, but existing directly readable Firestore documents require this separate migration. Do not log document payloads or UIDs in audit evidence.

## Upstream applicability

| Reference | Applicability | Local action |
|---|---|---|
| [11020](https://github.com/firebase/firebase-tools/issues/11020) | Parameterized Firestore trigger region; scheduled jobs differ | Explicit regions and compiled endpoint guard |
| [10467](https://github.com/firebase/firebase-tools/issues/10467) | VPC connector region deployment failure | Validate deployed region and connector configuration |
| [7580](https://github.com/firebase/firebase-tools/issues/7580) | Older RTDB emulator region issue; no matching RTDB trigger here | No speculative downgrade |
| [11160](https://github.com/firebase/firebase-tools/issues/11160) | Concurrent Firestore emulator writes fail | Serial test files, isolated data lifecycle |
| [11124](https://github.com/firebase/firebase-tools/issues/11124) | Emulator WebChannel thread leak | Fresh bounded process per CI run |
| [10518](https://github.com/firebase/firebase-tools/issues/10518) | Lock timeout and subsequent permission failures | Avoid parallel reset of shared emulator state |
| [7946](https://github.com/firebase/firebase-tools/issues/7946) | Closed older Storage rules report | Current real emulator allow/deny tests |
| [8448](https://github.com/firebase/firebase-tools/issues/8448) | Go Storage upload report, different client stack | No unsupported claim of direct causality |

| [10866](https://github.com/firebase/firebase-tools/issues/10866) | Closed upstream; swapped positional secret-resolution arguments in 15.25.0 | Installed 15.31.0 uses named options including `isEmulator`; no workaround that exposes live secrets to demo tests |
| [10755](https://github.com/firebase/firebase-tools/issues/10755) | Open upstream; a failed first Functions update can leave a token waiter unresolved | Installed 15.31.0 has `withToken`/`abort`; regression test exercises failure plus a concurrent waiter. This is not a real deployment proof |

The above four relevant issues #11160, #10518, #10866 and #10755 were rechecked through the GitHub API on 28 September. #11160 and #10518 remain open. Do not convert emulator permission denials into successful authorization or suppress failing tests. CLI version alone does not prove absence of emulator contention. For deployments require target function state, revision and smoke-test evidence; an exit code of zero alone is insufficient. The current CI builds and tests but does not deploy production.

These are mitigations or applicability assessments, not fixes to Firebase upstream. Reproduce an upgrade with the regression suite before changing the pinned CLI.
