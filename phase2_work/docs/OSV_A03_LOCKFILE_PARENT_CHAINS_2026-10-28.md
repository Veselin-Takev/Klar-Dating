# A-03: exact Bun lockfile parent chains (2026-10-28)

**Evidence-only / BLOCKED / Production NO-GO.** Companion to [OSV_A03_VERSION_TRIAGE_2026-10-28.md](OSV_A03_VERSION_TRIAGE_2026-10-28.md). No vulnerability has been waived or fixed by this file.

## Source and method

- PR #167 source HEAD `80da116410ab700ab9c0e86c4b46f840fe488575`; subsequent docs-only PR #168 initially at `2c166551ca4d2ec22938398d872e6c5a05318f2d`.
- Inspected **both** `bun.lock` and `phase2_work/bun.lock` via authenticated GitHub reads at that exact source SHA; both contained identical 396,695-character JSONC text. Existing SHA-256 hashes are recorded in the companion triage.
- Parsed JSONC with trailing commas removed; traversed the lockfile `packages` dependency and optional-dependency edges, resolving the nearest nested Bun package key first. Root seeds were the app workspace's `dependencies` versus `devDependencies`. This is **static dependency graph evidence**, not an installed-node_modules trace, SBOM, production bundle reachability proof, or security signoff.
- Cross-referenced the 13 affected **name+version coordinates** reported by failed OSV run [40654066786](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40654066786) (artifact `12800058883`). All 13 were found, represented by **14 lockfile package keys**, because `undici@8.10.2` occurs under both `jsdom` and `node-gyp`.

## Exact shortest dependency paths

`runtime graph` means reachable from a declared **production dependency root**, not confirmed exploitable in production. `dev graph` means reachable from a declared **dev dependency root**. Both may occur for the same package.

| Affected coordinate | Root and shortest path | Graph classification |
|---|---|---|
| `deepmerge@4.3.1` | `@sendgrid/mail → @sendgrid/helpers → deepmerge` | **runtime graph** |
| `ip-address@10.7.2` | `express-rate-limit → ip-address` | **runtime graph** (also dev graph via Firebase tools) |
| `uuid@9.0.1` | `firebase-admin → @google-cloud/storage → gaxios → uuid` | **runtime graph** (also dev graph) |
| `@modelcontextprotocol/sdk@1.30.0` | `firebase-tools → @modelcontextprotocol/sdk` | dev graph |
| `@opentelemetry/core@1.30.1` | `firebase-tools → @google-cloud/pubsub → @google-cloud/pubsub/@opentelemetry/core` | dev graph; nested 1.x distinct from root 2.12.0 |
| `hono@4.13.8` | `firebase-tools → @modelcontextprotocol/sdk → hono` | dev graph |
| `js-yaml@5.2.3` | `markdownlint-cli → markdownlint-cli/js-yaml` | dev graph; nested 5.x distinct from root 4.3.2 |
| `katex@0.16.47` | `markdownlint-cli → markdownlint → micromark-extension-math → katex` | dev graph |
| `markdown-it@14.3.2` | `markdownlint-cli → markdown-it` | dev graph (also `typedoc` parent) |
| `smol-toml@1.7.2` | `markdownlint-cli → smol-toml` | dev graph |
| `undici@6.28.1` | `firebase-tools → undici` | dev graph |
| `undici@8.10.2` | `jsdom → jsdom/undici`; also `firebase-tools → superstatic → re2 → node-gyp → node-gyp/undici` | dev graph, **two nested keys** |
| `zod@3.25.76` | `puppeteer → chromium-bidi → chromium-bidi/zod` | dev graph; distinct from directly declared runtime `zod@4.6.6` |

## Prioritized actionable remediation

1. **Runtime dependency graph first:** `deepmerge` through SendGrid helpers (no patched version was confirmed in the earlier advisory review), `ip-address` through `express-rate-limit`, and `uuid@9` through Firebase Admin/Storage/gaxios. Obtain exact advisory fixes, compatibility checks and production reachability evidence. Do **not** remove or override packages without API and regression testing.
2. **Development tooling still matters:** `firebase-tools` brings MCP SDK, Hono, undici 6.x and nested OpenTelemetry 1.x; `markdownlint-cli` brings js-yaml 5.x, smol-toml and markdown-it. Upgrade parents and regenerate both Bun locks with pinned Bun rather than hand-editing integrity strings.
3. Verify nested `undici@8.10.2` for **both** `jsdom` and `node-gyp`; replacing only one nested coordinate does not clear the OSV finding.
4. Run dependency resolution/lockfile reproducibility, full Enterprise CI, OSV, and relevant integration/emulator tests on the **new exact source SHA**. Archive the updated advisory/version inventory, CI logs, SHA-256 and reviewer attestations. Do not carry forward CI PASS from older SHA or conflate a PR merge-ref checkout with head-tree proof.

## Remaining release blockers

Production remains **NO-GO**: unresolved OSV findings, TTL ACTIVE on all 20 collection groups and legal holds, staged GCS generation races and Didit deletion evidence, 14 mandatory gates, 13 integration proofs, independent Security/DPO/Legal/SRE/Release signoffs and signed EVV. No merge or production/cloud/TTL changes; locked PR #119 untouched. `RELEASE_MANIFEST.json` must retain `releaseGovernance.decision=NO-GO` and `productionApproved=false`.
