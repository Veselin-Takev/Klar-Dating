# P0 #70 + Art. 17 staged integration — 2026-10-19

**Status: DRAFT / NO-GO.** Not an approved release or deployment.

## Provenance
- Base (unchanged): Draft PR #118 Art. 17 branch commit `9e886c67c97201602cd969fc57dfc9bf2d019c90`.
- TTL source: Draft PR #116 commit `fdcc8403bccb51a29f504c3100b31d6ddce9089d`.
- Copied only TTL-provisioner, 6 TTL regression/evidence scripts and 6 retention-specific documentation files. Both existing Draft PRs and `main` remain unchanged.
- `npm run check:retention-p0` executes the TTL matrix, ACTIVE-evidence negative fixtures, staging-only dry run and project-identity tests. It is wired into `npm run check:enterprise` directly after Art. 17 audit.

## Executed verification
On integration commit `e88268adc11eec11d6cb73140cf13f327a659f79` in an isolated remote source checkout with Node 20.20.2:
1. `node scripts/check-retention-matrix.mjs`: PASS for canonical 13-group matrix.
2. `node scripts/test-retention-matrix.mjs`: PASS for 6 fail-closed mutations.
3. `node scripts/test-retention-active-evidence.mjs`: PASS for valid read-only evidence plus 9 negative mutations.
4. `bash scripts/test-retention-gate.sh`: PASS for 13 plan rows, default dry run and denial of unapproved/prod apply.
5. `bash scripts/test-retention-project-identity.sh`: PASS using mocked gcloud; 13 gated staging updates and zero production calls.

**Still unverified:** Full combined enterprise pipeline on exact final commit, Node 22.23.3 check, Java-enabled Firestore Emulator tests, actual staging gcloud TTL ACTIVE evidence with project/database scope, retention/legal-hold signoff, supply-chain audit, TypeScript, E2E, build, independent Security/DPO/Legal approval and GitHub CI.

**Safety:** No TTL policies have been changed; the tests simulate only CLI mutations with a fake gcloud executable. No prod data, deployment, or main merge.


## Executed combined proof — 2026-10-19

**Exact verified code commit:** `c85efca453d8c022c6c11b738c63220134af7d19`.

Official SHA-256-verified Node `v22.23.3` was used on a complete GitHub source archive. The following commands returned exit 0:

- `npm run check:art17-deletion-audit` (seven storage tests, twelve Art. 17 source mutations, seven in-memory quarantine contracts, eighteen Emulator harness/preflight safety cases).
- `npm run check:retention-p0` (13-group matrix, six negative matrix mutations, nine negative read-only TTL ACTIVE evidence mutations, staging dry-run and mock project-identity tests).
- `node scripts/check-secrets.mjs`, `node scripts/check-auth-boundary.mjs`, `node scripts/check-public-firestore-rules.mjs`, `node scripts/check-ai-pii-sanitizer.mjs` (all PASS).

The complete archive contained **1,269 ZIP entries**, passed CRC check and had SHA-256 `cb33306921de4d585c87975f1ae267474b6d22d5e20077a2961d3150ae5033dd`.

**Unverified / NO-GO:** The isolated low-memory environment crashed while attempting to launch the actual Java-based Firestore Emulator, so none of the four real transaction scenarios passed. No live staging/prod Firestore TTL ACTIVE evidence was obtained. The full enterprise typecheck/Vitest/Playwright/build/npm audit and independent DPO/Security/Legal approval remain missing. No TTL mutation, production database access, merge or deployment took place.

---

## 2026-10-19 — P0 #70 evidence collection path added

`scripts/verify-retention-staging-live.sh` provides a deterministic read-only query of the explicitly approved Staging project and Firestore database, validates the fetched JSON using the existing 13-group ACTIVE evidence validator, and can export a new private JSON snapshot without overwriting a prior record. `npm run check:retention-p0` now additionally tests 12 failure scenarios using a deliberately fake `gcloud`. No live project was accessed. This does not close Issue #70 until independent Cloud state and the approved retention/legal-hold matrix are verified. **NO-GO.**
