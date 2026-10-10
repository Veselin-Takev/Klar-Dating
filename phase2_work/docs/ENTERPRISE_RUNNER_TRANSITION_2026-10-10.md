# Klar Enterprise — Authorized Runner Transition (2026-10-10)

**Release decision:** NO-GO. **Frozen R2:** `release/candidate-preflight-2026-10-10-r2` at `286a991e776885199bb1028d380e239821de88ac`. This document is written only on the development branch. No CI job, merge, tag movement or deployment is authorized by this plan.

## A. Controlled transition prerequisites

1. Appoint a named platform owner and security reviewer. Choose a **network-enabled, isolated, non-production** Linux runner with write access only to its ephemeral workspace. Use least-privilege read-only GitHub checkout credentials. The runner must not have production GCP write credentials or deployment permissions during preflight.
2. Network/DNS: resolver must resolve `github.com`, `api.github.com`, `codeload.github.com`, `objects.githubusercontent.com`, `registry.npmjs.org`, `nodejs.org`, `github.com/oven-sh/bun` release downloads (or an approved internal mirror), and Playwright Chromium download endpoints `cdn.playwright.dev` plus documented redirects/CDN hosts. Resolve and permit `ghcr.io`, `mcr.microsoft.com` and Docker registries if building the devcontainer; allow Firebase CLI/emulator JAR download hosts as recorded in installer logs, or supply checksum-pinned internal mirrors. Allow HTTPS TCP/443 outbound; DNS TCP/UDP 53 only to organization resolvers. Avoid broad wildcard egress and unexpected access to production networks. Validate actual redirect destinations rather than assuming these hostnames exhaust all dependencies.
3. **Versions:** Node **v22.23.3** (exact), Bun **1.4.2** (exact), Java **21**, npm version according to checked-in runtime policy (Functions `npm ci`), Chromium as pinned by the committed Playwright dependency. Retain `phase2_work/bun.lock` and `phase2_work/functions/package-lock.json`; do not create a root `package-lock.json`.
4. Verify base image, tool download origin and integrity according to company supply-chain policy. Use pinned CI actions/digests where applicable, no floating `latest` tags. Install only through approved package registries and restrict runner tokens/secrets.

## B. Preflight procedure (operator must execute)

From a **fresh, clean, non-production runner** with approved network access:

```bash
set -euo pipefail
getent hosts github.com api.github.com registry.npmjs.org nodejs.org
git ls-remote https://github.com/Veselin-Takev/Klar-Dating.git HEAD
node --version
bun --version
java -version
```

If any command fails, **STOP** and record the failure, DNS resolver, firewall change ticket, command, timestamp and runner identity. Do not bypass corporate egress controls.

An authorized operator obtains the exact candidate SHA **independently** from an approved release record; do not silently equate a branch name or `HEAD` with approval. For frozen R2 only, the expected SHA is `286a991e776885199bb1028d380e239821de88ac`. If validating newer development fixes, obtain a **separately approved SHA and candidate designation**; never move R2.

```bash
git clone --filter=blob:none https://github.com/Veselin-Takev/Klar-Dating.git klar-release-acceptance
cd klar-release-acceptance
git fetch --no-tags origin 286a991e776885199bb1028d380e239821de88ac
git checkout --detach 286a991e776885199bb1028d380e239821de88ac
test "$(git rev-parse HEAD)" = "286a991e776885199bb1028d380e239821de88ac"
test -z "$(git status --porcelain)"
cd phase2_work
test "$(node --version)" = "v22.23.3"
test "$(bun --version)" = "1.4.2"
java -version
KLAR_EXPECTED_SHA=286a991e776885199bb1028d380e239821de88ac bun run verify:local
```

**Important:** `--filter=blob:none` needs server support and a functional network; if the project policy requires a full, non-partial clone, instead use `git clone` without the filter. The exact full working tree (including all test fixtures and lockfiles) must be present, and the working tree must be clean. The preflight enforces provenance and runs enterprise static/type gates, Functions build, Firebase-backed tests, production smoke checks and Playwright, according to the pinned candidate's scripts. Run outside production.

Save provenance-checked reports in a restricted **external** evidence folder, with immutable object storage/versioning and checksums; never commit production-sensitive audit JSON, secrets, user data, or credentials. Document runner OS/image digest, action/version pins, complete exit codes, SHA and timestamps, failed tests, Firebase emulator versions, Playwright browser version, and artifact hashes. No one may mark `NOT_RUN` as `PASS`.

## C. Production security and release governance

After an exact-SHA complete local PASS, request approval for a **minimal** remote CI run. Hard budget: **100 additional GitHub Actions minutes maximum**, inclusive of unsuccessful/canceled/retried runs, accounting for parallel runners. Inspect live usage before triggering; stop before hitting the cap. No background automation, workflow dispatch or automatic PR-run should be initiated without monitoring budget and authorization.

Independent security and operations owners must verify, in the real intended project: Cloud Run service revision and **deployed image provenance** against the reviewed source SHA, IAM/service account least privilege, restricted secret access and actual rotation, alert routing/delivery and on-call acknowledgment, OTLP/SLO/P95, privacy/consent/deletion and retention, customer-safe smoke tests, backup/rollback exercise, release attestation/SBOM, and protected environment approvals. A source checkout SHA or green static audit alone cannot prove a deployed revision. Record restricted evidence links and human signatures in Issue #8 and release manifests. **GO** only after every required gate and authorized human signoff; otherwise **NO-GO**.

## D. Known current state and handoff owner checklist

- Node pin persists across Codespaces sessions via `nvm alias default 22.23.3` on the development branch (commit `51455df8abf25cc9628e499d2f282bef9a2e9b62`).
- Current assistant executor: Node v22.16.0, Java 21, Bun not installed, no complete repository checkout, github.com DNS resolution failed. Local isolated diagnostics: 21 PASS / 0 FAIL, **not** aggregate application tests.
- R2 does **not** incorporate later Codespaces modifications or this document. Do not treat them as validated in R2.
- Blocking issue: #8. Runner owner must record provisioning ticket, tested DNS reachability, exact repository SHA, full preflight log, failures, CI minutes consumed, and independent reviewer approval before any status transition.
- If runner prerequisites remain unavailable, **NO-GO**; no fabricated check results or auto approval.
