# ADR — Isolated enterprise host evidence screening for PR #119 (2026-10-23)

**Status:** documentation and independent screening tool on a dedicated audit feature branch. **Release decision: NO-GO / HARD STOP ACTIVE.** This ADR does not authorize a new application correction cycle, a merge or a deployment.

## Baseline and scope

- Immutable PR #119 HEAD: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`; PR #119 stays Draft and unmerged.
- GitHub release evidence queried on 2026-10-23: **0 workflow runs and 0 check runs** associated with this exact SHA. No remote authenticated host evidence has been supplied.
- The earlier three **local application correction cycles are exhausted**. Their local dashboard regression results do not prove readiness for PR #119, which has a different tree.
- This branch adds **an optional offline evidence screen and its isolated Node core regression tests**, without modifying application source, workflow trigger configuration, production credentials or the original PR #119 branch.

## Threat model and invariants

Host audit artifacts are untrusted inputs. A malicious, outdated or incomplete ZIP may claim PASS, invent an exit code, reference another commit, omit a failing log, replace checksums, point to an outside file via a symlink or present self-issued approvals. ZIP-CRC and a plain SHA256SUMS file establish internal consistency, **not provenance or independent authorization**.

A trusted release decision therefore needs **all** of:

1. Full immutable checkout, `git rev-parse HEAD` equals the expected 40-character SHA; host/container identities logged and independently attested.
2. Node.js **v22.23.3**, Bun **1.4.2**, deterministic dependency install; a separately approved image digest and runner identity.
3. Exactly **15 mandatory gates**, each with the expected command, output log, separate exit-code receipt **0**, TSV status **PASS** and hash matching the sealed evidence manifest.
4. All evidence files, including Docker/build/install logs, included in a complete `SHA256SUMS`; hash mismatches, extra files, symlinks and wrong or duplicate gate entries fail closed.
5. Independently authenticated sign-offs for **Security, Datenschutz/Legal, Operations/SRE, Release Owner**, each bound to the **same final commit**; human validation against trusted external approval systems is mandatory.
6. Existing repo production controls (release manifest and governance decision, checklist, live TTL/Art.17, SLO, consent, AI budget, protected environment, rollback drill) independently met. A successful offline screen **never** overrides any blocker.

## Decision

Add `scripts/verify-host-gate-evidence.mjs` and `scripts/verify-host-gate-evidence.test.mjs`. The verifier is **read-only**, uses Node built-ins only, and writes its JSON result to stdout. It requires explicit `--dir` and `--commit` arguments and does **not** start Docker or any mandatory gate itself. It validates SHA256SUMS, key runtime/host receipts, exact 15-gate TSV, individual gate logs and exit files, and the structure of four approval receipts. It never returns release GO; `release_decision` is always `NO-GO`, and `approvals_identity_verified` is always `false` until a separate independent procedure authenticates the signers.

Use from `phase2_work` on an **already received**, quarantined, read-only extracted host evidence directory:

```bash
node --test scripts/verify-host-gate-evidence.test.mjs
node scripts/verify-host-gate-evidence.mjs \
  --dir /path/to/quarantined/results \
  --commit 7fdf29010c85f16a9b38e5c93186f32e92192f3a \
  > /secure/evidence-screen-result.json
```

A zero exit code only means **structural evidence screening** passed, not that source provenance, signatures, external approvals or production readiness passed. Before unblocking release, verify signatures or trusted GitHub reviews against organization-controlled identities; ensure reviewer independence and protected-branch policies; compare image/runner provenance and checksum manifest against an independently signed attestation. If signed approvals are stored outside the host evidence archive, an authorized team must normalize/seal their receipts and hashes **without altering the original immutable host archive**.

## Operational blockers and production boundary

- The **previous** host-handoff Dockerfile uses `node:22.23.3-bookworm-slim` by mutable tag; provenance/digest has not been reviewed or pinned.
- The **previous** host-handoff uses `bun install --frozen-lockfile`, but the repository CI uses `bun ci` plus `npm ci --prefix functions`, and required `npm audit` previously returned `ENOLOCK` for the root Bun-only lockfile. Do not silently rewrite the frozen lock, omit this mandatory audit, substitute `bun audit`, or call the container PASS until governance accepts an equivalent attested scanner policy or remediates the lock governance.
- The previous handoff's `npx gitleaks`, `npx semgrep` and `npx eslint` prerequisites must be sourced from approved, pinned tooling. `npx` downloading unreviewed versions at execution time would invalidate toolchain provenance.
- Previous evidence logs do not demonstrate signed host identity, full Firestore emulator pass, deployed TTL ACTIVE, payment failure tests, real P95 or an N−1 rollback drill.

**No live runner could be executed in the available environment:** Docker absent locally and on the connected Composio shell; local Node was v22.16.0; Bun 1.4.2 was unavailable; GitHub DNS was unavailable in the local sandbox.

## Test evidence (unqualified, local)

Twenty-two dependency-free regression cases were executed successfully under Node **v22.16.0**: a structurally complete **synthetic** set; absent evidence; wrong abbreviated SHA; tampered/missing log; nonzero gate; substituted command; wrong runtime; wrong commit; missing/invalid approval; extra file; symlink; path traversal; dropped TSV row; and refusal to turn self-issued approvals into release GO. **22/22 PASS** is only the screening-tool test suite, **NOT** a release gate PASS. Full pinned-runtime, Docker and enterprise scanning are not completed.

## Rollback / N−1

Remove the four newly added verifier/test/ADR/runbook files from the separate audit branch to roll back this tooling. No application bundle, Firestore schema/index/rules, credentials, deploy config, production data or network endpoint is changed. Release gate policy remains NO-GO in both versions. Review this ADR and test receipts before merging tooling into any protected branch; no merge is authorized by this document.

## Additional audit-tool hardening (2026-10-23)

The local audit verifier now opens candidate evidence files with `O_NOFOLLOW` and validates the opened descriptor with `fstat` to avoid following a symlink substituted between directory listing and file access. Five additional regression tests cover incorrect Docker exit receipts, missing runtime logs, mismatched gate manifest hashes, symlinked mandatory logs and incorrect host target metadata. This hardens the **offline screening tool only**, not the external runner nor the release gates. The specific tests ran on Node 22.16.0, which is not the pinned release toolchain. Original evidence must be acquired through a trusted, separately authorized host and independently attested.
