# PR #119 — Authorized host verification and evidence handover

**Release status: NO-GO / HARD STOP.** Target SHA: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`.

## Separation of duties

- **Release Owner:** provides written scope-limited authorization for a *read-only audit*, selects the immutable candidate and authorizes any eventual workflow/production change separately. This document does **not** lift the existing application correction hard-stop.
- **Infrastructure/SRE:** provisions a disposable Linux x64 host, Docker and approved network access, approved pinned Node v22.23.3 and Bun 1.4.2, isolated nonproduction credentials only, digest-pinned container base and approved scanner versions. Checks resource/cost quotas and wipes host afterwards.
- **Audit operator:** runs exactly the 15 mandatory gates on the exact SHA, captures command/exit code/log, timestamps, checkout SHA, runtime versions, SHA256SUMS and signed runner/build attestations. Worktree changes invalidate results.
- **Security, DPO/Legal, Operations/SRE, Release Owner:** independently review the same final commit and sign off only on real evidence. Organizational provenance and signatory identity must be verified outside the bundle.

## Audit prerequisites

1. Written audit authorization and an approved image digest, scanner version set, lockfile/audit strategy, and hardened runner identity; validate network/registry and disk before invoking commands.
2. Verify exact immutable checkout (`git rev-parse HEAD` equals SHA), do not use local modified ZIPs or fetch mutable branch HEAD for official test.
3. Fresh `results/` directory; do not overwrite a preexisting run. Keep source checkout read-only except deterministic dependency provisioning; audit and hash the tracked tree before/after.
4. Zero production credentials on the runner, tightly controlled artifact visibility and retention. CI, test, build and scanner logs may contain sensitive data; restrict upload access and redact only to **a separately labeled derivative**, never by altering original evidence.
5. Resolve known root lockfile `npm audit`/`ENOLOCK` issue through a separately reviewed decision; do not waive one of the mandatory gates or claim GO using a substitute without explicit governance approval.

## Required result contract

The host handoff must include the original `gates.tsv` with **exactly 15 rows** and `number, command, exit_code, status, log_sha256`, plus `gate-01.log` through `gate-15.log` and `gate-01.exit-code` through `gate-15.exit-code` (zero for success). Additional receipts: `SHA256SUMS`, `baseline.txt` (`commit`, `node`, `bun`), `host-preflight.txt` (`target_sha`), `container-toolchain.log`, `install.log`/`install.exit-code`, `docker-build.log`/`docker-build.exit-code`, `docker-run.log`/`docker-run.exit-code`, `container-toolchain.exit-code`, host/runner stdout/stderr. Must also contain SHA-bound independent approval receipts or have them separately attached as an immutable, signed approval bundle cross-referenced to the host attestation. If any gate is skipped or fails, record **NO-GO** with the exact RC, do not invent zero.

Structural offline screening (on an isolated workstation) uses the optional `node scripts/verify-host-gate-evidence.mjs --dir /secure/quarantined/results --commit <full-sha>` and never returns GO by itself. Inspect the JSON error list. Reject any missing, tampered or self-asserted evidence; independently verify host attestations and reviewer identity. A synthetic test fixture **does not constitute** application evidence.

## Go/no-go sequence and handover

1. SRE secures and transfers unmodified artifacts to the authorized custodian; SHA256 checks and external attestation are validated independently.
2. Release Governance ensures **all 15 original mandatory gates PASS with exit code 0** and all prerequisites match one commit.
3. Security/Legal/SRE/Owner individually sign attestations for that commit with trusted signatures/review links, not just editable JSON fields.
4. Check production/operational constraints: active TTL collection-group policy inventory, GDPR Art.17/9 evidence and legitimate holds, EU AI Act obligations, deployed CSP, SLO/P95, AI budget, N−1 rollback drills, security reviews, CODEOWNERS/rulesets, critical/high vulnerabilities and emergency stop procedures.
5. Recompute final decision **only with written human authorization**. A clean host scan does not automatically lift the three-cycle correction hard-stop, close 15 GitHub issues or permit merge/deploy.

## Current known result (2026-10-23)

GitHub PR #119 remained Draft/unmerged with exact HEAD SHA; 15 open issues, no identified PR119 check/workflow runs, and no qualifying signed host evidence/approvals. Local previous candidate: 23 targeted dashboard tests PASS under Node 22.16.0, mandatory diagnosis 5 PASS / 6 FAIL / 4 BLOCKED, not qualified. **Final release decision: NO-GO.**

## Evidence sealing ordering (mandatory)

Close all processes writing `host.stdout.log`, `host.stderr.log`, `runner.stdout.log`, `runner.stderr.log` and Docker-run logs **before** generating the final `SHA256SUMS`. In particular, avoid printing additional status messages into hashed logs after the manifest is calculated. Validate the finalized manifest in a separate read-only step and publish or externally sign its SHA-256 digest using a trusted channel. The previously prepared host launcher used `tee` while hashing its own stdout; it must be reviewed and fixed on the authorized host before accepting final evidence. A self-consistent checksum proves only integrity, not authenticity.
