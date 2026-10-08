## Revalidation 1 October 2026

PR #96 refreshes the dependency graph after new September 30 advisories. The remediation does **not** weaken `npm audit --audit-level=high` or add an audit ignore. Patched root resolutions include the affected gRPC, brace-expansion and undici lines. Because Firebase 12.19.0 / Firestore 4.17.2 still declares nested `@grpc/grpc-js ~1.9.0`, npm's root override mechanism is used narrowly as `@firebase/firestore@4.17.2 -> @grpc/grpc-js 1.13.6`. Version-qualifying the parent is deliberate: once Firestore is upgraded, this workaround no longer applies implicitly and must be reassessed rather than silently carried forward.

Registry-backed GitHub Actions on the candidate resolution passed dependency installation, static security checks, TypeScript, the API/Firebase emulator suite, production build, production-routing smoke test and container build. Audit evidence from that run measured:

| Audit scope | Findings |
| --- | --- |
| Root, full graph | 12 total: 1 low, 11 moderate, **0 high, 0 critical** |
| Root, production only | 6 total: 1 low, 5 moderate, **0 high, 0 critical** |
| Functions, production only | 2 moderate, **0 high, 0 critical** |

Moderate findings remain tracked; a passing high/critical gate is not a blanket risk acceptance. The override must be removed or reevaluated when Firebase/Firestore publishes a compatible dependency update. Every release must continue to retain the audit JSON and rerun root full, root production and Functions production audits.

# Dependency review 27 September 2026

This is an engineering assessment, not an approved risk exception. Preserve the lockfiles and repeat the audit on every release.

## Measured change

Verified CI snapshot `98ca107` reported seven moderate findings in the root graph (two production) and six in the Functions production graph. Successor `9ba1a87` updates Firebase CLI from 15.30.2 to exactly 15.31.0 and Functions Firebase Admin from 14.2.0 to exactly 14.5.0. Local post-update audits report five root findings and two Functions production findings, with no high or critical findings. Typecheck and Functions compilation/Frankfurt endpoint inspection pass locally. The successor CI passed all 547 unit/integration tests, 14 browser tests, production smoke and container build: runs 36320935207 and 36320935300. CI confirms the same dependency counts.

The [official CLI release](https://github.com/firebase/firebase-tools/releases/tag/v15.31.0) documents the release; the reduction in findings was measured with npm audit, rather than inferred from its release notes. Emulator isolation remains required after this update.

## Remaining findings

| Path | Finding | Assessment and action |
|---|---|---|
| Firebase CLI → Pub/Sub → OpenTelemetry core | [Unbounded W3C Baggage allocation](https://github.com/advisories/GHSA-8988-4f7v-96qf) | CLI development/deployment graph. Do not expose emulator endpoints publicly. Review a compatible upstream update; no blanket exemption. |
| gaxios → uuid, present in root and Functions | [Missing bounds checks for v3/v5/v6 with supplied buffer](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | The installed gaxios source uses `uuid.v4()` without a caller-supplied buffer for multipart boundaries. No triggering use was found in this inspected call. This is narrower than a whole-graph non-exploitability proof. |

Five affected-package entries do not mean five independent vulnerabilities: parent packages are included by npm's propagation model. npm suggested an older CLI major release for some remaining paths; this was not applied. Do not force a major uuid replacement into dependencies without their compatibility evidence.

Before production approval, the security owner must confirm reachability across all deployed dependency paths, record an expiry for any accepted exception, and track compatible upstream fixes. Re-run root full and production audits plus the separate Functions production audit. Retain their JSON output with the release evidence; a high/critical threshold passing does not erase moderate findings.
