# Runtime IAM module — review before apply

This module creates a dedicated klar-runtime identity in an explicitly supplied
application project. No project, bucket or secret is guessed. No resources have
been applied by this repository change. Plan/apply and deployed IAM verification
require separate cloud authorization and a reviewed plan.

- Firestore roles/datastore.user is project-wide data access. It cannot enforce
  document-prefix tenancy. Use a dedicated application project; separate tenant
  databases/projects and identities are required for hard IAM tenant separation.
- Auth is a custom role for the listed runtime user operations; it is not Owner,
  Editor or the full Firebase Auth Admin role. Final permissions must be checked
  against the approved workload and provider API support before apply.
- Storage grants object-user on one explicitly supplied bucket. Bucket metadata
  permission and holds/retention IAM must be evaluated independently before any
  productive deletion is authorized; no project-wide Storage admin is granted.
- Secret accessor is granted only for explicitly enumerated secrets; default none.
- No service-account keys, Token Creator, deployer impersonation, Scheduler
  identity, Functions maintenance identity or production release approval is
  created here. Those principals have separate authorization boundaries.

After provisioning, set approved release variables KLAR_RUNTIME_PROJECT_ID and
KLAR_RUNTIME_SERVICE_ACCOUNT from the Terraform output. Release rendering rejects
missing identity, default compute identities, cross-project addresses and accounts
other than klar-runtime. Source templates intentionally contain null identity;
only rendered artifacts may contain an executable serviceAccountName.

Do not set either tenant migration-ready flag before reviewed data copy/cutover.

Local verification: Terraform 1.13.5 init (backend disabled), validate and fmt
completed successfully against the committed provider lock. This validates the
configuration schema, not API permission existence, binding effectiveness or a
cloud plan. No terraform apply was run.
