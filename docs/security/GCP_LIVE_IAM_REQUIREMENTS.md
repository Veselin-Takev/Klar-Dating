# GCP Live-IAM Collector — access and execution specification

**Status: TEMPLATED & READY FOR CREDENTIALS. Release gate: WAITING FOR IAM CREDENTIAL BINDING; production NO-GO.**
The user confirmed project ID `klar-admin`. Region, Cloud Run service, bucket and
the read-only collector service account still need an approved binding. No live
IAM export has been captured. This specification grants no access by itself.

## Identity and required role

Provision a dedicated **collector** service account, separate from `klar-runtime`.
Grant **`roles/iam.securityReviewer`** on the approved application project, plus
**`roles/run.viewer`** on the target Cloud Run service/project and a bucket-scoped
approved custom metadata-reader role containing **`storage.buckets.get`**.
Security Reviewer alone does not grant `run.revisions.get` or `storage.buckets.get`
in the current official role tables. If organizational policy permits the predefined
Beta role `roles/storage.bucketViewer`, it is an alternative for bucket metadata;
it does not replace the separate IAM-policy read grant. No role is created or
bound by this template. Ensure
the same identity can read each ancestor folder/organization policy returned by
`gcloud projects get-ancestors`. A project binding does **not** grant access upward
to a parent. The infrastructure owner must provide scoped parent read grants, or
explicitly approve a Security Reviewer binding at a common ancestor and its wider
inherited metadata access. A limited custom ancestor role can grant only the
applicable `resourcemanager.folders.getIamPolicy` or
`resourcemanager.organizations.getIamPolicy` permission at the respective parent.

The exact collector permission surface is below. Check effective grants, IAM
Conditions, Deny and principal boundaries before execution; a role name alone is
not proof that a resource is readable. Missing required reads abort collection.

| Read operation | Required resource permission | Binding scope |
|:---|:---|:---|
| Project ancestry lookup | `resourcemanager.projects.get` | Approved project |
| Project allow policy | `resourcemanager.projects.getIamPolicy` | Approved project |
| Each folder allow policy | `resourcemanager.folders.getIamPolicy` | Each returned parent folder |
| Organization allow policy | `resourcemanager.organizations.getIamPolicy` | Returned organization, if any |
| Cloud Run service configuration | `run.services.get` | Service/project |
| Cloud Run invoker policy | `run.services.getIamPolicy` | Service/project |
| Every serving/tagged revision configuration | `run.revisions.get` | Revisions/project |
| Bucket metadata | `storage.buckets.get` | Target bucket/owning project |
| Bucket allow policy | `storage.buckets.getIamPolicy` | Target bucket/owning project |
| Firestore database inventory | `datastore.databases.list` | Approved project |
| Runtime service account allow policy | `iam.serviceAccounts.getIamPolicy` | `klar-runtime@GCP_PROJECT_ID.iam.gserviceaccount.com` |
| Custom `klarRuntimeAuth` role definition | `iam.roles.get` | Approved project |

Security Reviewer supplies policy and inventory reads; the supplementary roles
above supply the required configuration reads. Do not add Datastore
Viewer or Storage Object Viewer just to collect metadata. The collector does not
need document reads, object bytes, Auth-user access, Secret Manager payload access,
IAM write permissions or deployment privileges. For a cross-project bucket,
provide the two bucket permissions in its owning project or a bucket-scoped
custom role; project access in `klar-admin` does not cover another project's bucket.

Authenticate with a short-lived workload identity or approved gcloud credential
profile. For service-account impersonation, the **source operator identity** needs
`roles/iam.serviceAccountTokenCreator` on the **collector service account only**;
this is not a role for the collector or application runtime. WIF-to-service-account
bindings use `roles/iam.workloadIdentityUser` for the approved external subject.
If a separate quota project is configured, the identity may additionally need
`roles/serviceusage.serviceUsageConsumer` on that quota project. These are
credential/quota prerequisites, not application-resource grants.

## Environment contract

| Variable | Required value / purpose |
|:---|:---|
| `GCP_PROJECT_ID` | `klar-admin`, confirmed by user; verify actual resource ownership |
| `GCP_REGION` | Approved Cloud Run region; no inferred default |
| `STORAGE_BUCKET_NAME` | Exact approved bucket name without `gs://` |
| `CLOUD_RUN_SERVICE` | Exact service name in that project/region |
| `GCP_COLLECTOR_SERVICE_ACCOUNT` | Dedicated collector SA email; may belong to an approved tooling project |
| `GCP_EXPECTED_BUILD_SHA` | Reviewed 40-character SHA of the clean checkout being captured |
| `GCP_EVIDENCE_DIRECTORY` | Existing absolute external directory, owned by executing user, mode 0700; reviewed vault ACLs |
| `CLOUDSDK_CONFIG`, `CLOUDSDK_ACTIVE_CONFIG_NAME` | Credential-bound gcloud profile selectors, when supplied by the environment |
| `CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT` | Optional impersonation target, exactly the declared collector SA |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional ADC selector for other SDK operations; **alone does not bind this gcloud collector** |

The wrapper maps `GCP_PROJECT_ID` → `KLAR_PROJECT_ID`, `GCP_REGION` → `KLAR_REGION`,
`STORAGE_BUCKET_NAME` → `KLAR_STORAGE_BUCKET`, and `CLOUD_RUN_SERVICE` →
`KLAR_SERVICE`. Conflicting existing aliases are rejected. It owns
`KLAR_IAM_PRIVATE_OUTPUT` and `KLAR_IAM_SUMMARY_OUTPUT` and points both into a fresh
private staging directory. Do not prepopulate those output paths.

Configure gcloud authentication **before** running the wrapper, using the approved
environment connection/profile or an operator-configured WIF credential file.
The wrapper selects the declared direct SA or validates the configured impersonation
target, and checks credential availability without printing tokens. It does not run
interactive login, create keys, modify IAM, enable APIs or deploy resources. Keep
credential files outside Git and supply secret values only through environment settings.

Prerequisites: Linux, Bash, GNU coreutils (`stat`, `mktemp`, `mv`, `timeout`), Git,
Node **22.23.3**, the repository's locked dependencies/`tsx`, and Google Cloud CLI.
Required APIs must already be enabled by the infrastructure owner. Permit HTTPS
to Cloud Resource Manager, IAM, Cloud Run, Cloud Storage and Firestore APIs;
authentication can require STS, IAM Credentials and OAuth endpoints as appropriate.

## Execute after credential binding

Set the approved values in the runner's environment; the example leaves unknown
resource values unset deliberately. From the repository root:

```sh
export GCP_PROJECT_ID=klar-admin
# Bind GCP_REGION, STORAGE_BUCKET_NAME, CLOUD_RUN_SERVICE,
# GCP_COLLECTOR_SERVICE_ACCOUNT, GCP_EXPECTED_BUILD_SHA and
# GCP_EVIDENCE_DIRECTORY in the runner/environment settings.
bash scripts/collect-live-iam-evidence.sh
```

`GCP_EXPECTED_BUILD_SHA` is a reviewed input, not an automatic assertion that the
current HEAD has been approved. Commit this template before a real run; a dirty
checkout or mismatched SHA is rejected before authentication.

## Atomic publication and handover

The wrapper executes the existing TypeScript collector unchanged. All provider
reads and output validation happen in `.iam-pending.*` under the external evidence
directory. Output hashes, source SHA, scope and runtime identity must match. Missing
credentials, denied reads, wrong runtime identities or malformed evidence prevent
publication. Staging is removed on failure; credentials and raw provider errors are
not printed. Authentication preflights have a 60-second bound; each resource read
retains the collector's 30-second bound. Exit 0 means a complete capture was
published, **not** a least-privilege or production approval.

A single same-filesystem rename publishes a unique `iam-<sha-prefix>-<suffix>/`
directory. A pre-existing bundle is never overwritten. Atomicity applies to local
bundle publication; GCP reads are sequential snapshots, not a distributed policy
transaction. Freeze policy/deployment changes during capture and repeat it if they
change. Abrupt host/power failure may leave a private pending directory: inspect
and remove stale pending directories only after confirming no collector runs remain.

The published directory contains:

- `iam-private.json`: raw service configuration and policies; keep in the restricted vault.
- `live-iam-evidence.json`: minimized live summary; status `LIVE_CAPTURED_REVIEW_PENDING`.
- `toolchain.json`: captured Google Cloud CLI version information.
- `HANDOVER_MANIFEST.json`: build/scope/artifact hashes, pending reviews, Draft and `productionApproved=false`.
- Private diagnostic logs, which may contain sensitive configuration; retain with the raw capture.

The wrapper never overwrites the repository's current **UNVERIFIED** status file.
After an independent reviewer checks the raw export and hashes, copy only the
approved minimized summary into `docs/security/live-iam-evidence.json` and record
the controlled raw-export link, reviewer, time and exact SHA in the release bundle.
Do not commit the private bundle. This step is separately reviewable in the PR.

## Remaining release gates

**Infrastruktur-Verifikation: AUSSTEHEND — finales GCP-Credential-Binding und Live-Run.**
On successful capture, infrastructure still needs human least-privilege review,
including group membership, conditional/inherited grants, Deny, principal
boundaries, cross-project access, custom roles and impersonation paths. Existing
Auth/media migration, privacy/Legal Hold, retention, edge and operational evidence
gates remain open. Complete those gates before requesting final Legal and Tech
signatures. PR #360 remains Draft; production remains NO-GO throughout preparation.

## Primary references

- [IAM roles and permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/iam)
- [Cloud Run permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/run)
- [Cloud Storage permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/storage)
- [Firestore permissions](https://docs.cloud.google.com/iam/docs/roles-permissions/firestore)
- [Project ancestor lookup](https://docs.cloud.google.com/sdk/gcloud/reference/projects/get-ancestors)
