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
