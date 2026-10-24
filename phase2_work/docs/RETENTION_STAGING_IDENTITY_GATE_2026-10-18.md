# Firestore TTL staging project identity preflight — 2026-10-18

**Status: NO-GO.** This is an additional guard on draft P0 #70, not legal retention approval, live TTL activation evidence, or full production readiness.

## Additional requirements for staging-only apply
- `KLAR_PROJECT_ID` and `KLAR_DATABASE_ID`: explicit target.
- `KLAR_APPROVED_STAGING_PROJECT_ID`: independently reviewed, exact target project ID.
- `KLAR_PRODUCTION_PROJECT_ID`: explicit production ID; must differ from target.
- `KLAR_ENVIRONMENT=staging`, `KLAR_APPLY_RETENTION=true` and `KLAR_CONFIRM_RETENTION=project/database`.
- `KLAR_RETENTION_LEGAL_APPROVED=true` and `KLAR_RETENTION_INVENTORY_APPROVED=true`.
- A read-only live `gcloud projects describe` must return a project label `environment=staging`. An absent label or inaccessible project denies all TTL mutations.

**Approval risk:** All environment variables remain operator assertions; cloud project labels can be changed by authorized IAM principals. Actual IAM least-privilege, approved immutable inventory, legal-hold exceptions and human sign-off are mandatory independent controls. The test mocks gcloud, **not** actual Firestore policy activation.

## Verification
From `phase2_work`: `bash scripts/test-retention-project-identity.sh`. The mock verifies zero cloud mutations in dry-run and denial cases, and 13 intended updates for explicit approved staging. Require exact-commit full security gates, review of scripts and actual project metadata, a staged no-data-loss inventory and per-policy ACTIVE evidence before closure.

## Rollback and compatibility
The change adds checks to the existing staging-only activation path; default dry-run remains unchanged and existing production flows should never call this staging script. Disabling a TTL policy cannot restore data already removed by it. Review the deletion plan, legal holds, backups and orphaned subcollections before approval. No deployment performed.
