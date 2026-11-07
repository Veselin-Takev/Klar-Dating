# Klar Staging Project Identity and Read-Only Cloud Verification — 2026-11-07

**Status: UNVERIFIED / NO-GO**. No Firebase/GCP resource creation or production mutation is authorized by this document. Corresponds to Linear [VES-12](https://linear.app/takev/issue/VES-12).

## Existing evidence (not proof of cloud ownership)
- Linear VES-12 recorded user-reported Firebase and GCP ID **`klar-admin`** (2026-11-06), with Firestore and Cloud Run reportedly not yet created; Firebase/GCP project number, IAM, billing and Firebase activation are unverified.
- Current `main`: `phase2_work/.firebaserc` sets default **`striped-antler-500815-e6`**; `phase2_work/firebase-applet-config.json` also selects this **different project** and a named Firestore database `ai-studio-remixklarcl-ee70d0d2-a8cd-49f4-9bbe-2f0f90fbf1e3`. **DO NOT** apply these defaults to `klar-admin` or copy this web configuration to a staging deployment.
- Backend `phase2_work/src/server/firebaseRuntime.ts` selects `GCLOUD_PROJECT`/`GOOGLE_CLOUD_PROJECT` and `FIRESTORE_DATABASE_ID` overrides. Frontend and Admin SDK must agree on exact project/database identity before enabling authenticated tests.
- Vercel `klar-dating` is a hosting project, **not** independent evidence of Google Cloud project existence or ownership.
- No Google Cloud or Firebase authenticated read-only inventory access was available for this review. An existing repository string or Console URL never proves project identity.

## One-time user-assisted identity attestation (NO secret material)
1. Sign into the **intended Google account**. Open `https://console.cloud.google.com/home/dashboard?project=klar-admin`; verify the active project selector shows exact **Project ID** `klar-admin`, capture **Project number** (numeric) and project **name**. If absent, STOP; do not create a duplicate.
2. Open `https://console.firebase.google.com/project/klar-admin/settings/general` using the **same Google account**. Confirm exact Firebase **Project ID** and **Project number**. If Firebase reports the project has not been added, classify it as GCP-only and STOP before adding Firebase.
3. Confirm both immutable project numbers are **identical**. Check Google Cloud project label `firebase:enabled` and Firebase provisioning status, owner/parent organization and accessible IAM roles. Do not paste user emails, tokens, client secrets, or private IAM membership in tickets.
4. Read Cloud Billing > Budgets & alerts for the **project-scoped** monthly EUR 10 target, currency, billing account attachment and 50/80/100% notification thresholds (5/8/10 EUR). A normal alerts-only budget **does not cap spending**. No billing changes or resources created before explicit approval.
5. Read-only check Firestore databases (IDs, locations, editions), Cloud Run services, Cloud Scheduler jobs and Cloud Storage buckets/retention metadata. No document bodies, biometrics or user profile data. Record absence as *user-verified* rather than assumed.

## Minimal redacted evidence record

```text
Attestation time UTC:
Google Cloud project ID:
Google Cloud project number:
Firebase project ID:
Firebase project number:
Same numbers? yes / no / not available
Firebase enabled? yes / no / unknown
Billing attached? yes / no / unknown
Budget amount / currency / project scope verified?:
Databases (ID / region only):
Cloud Run / Scheduler / Storage exist? yes / no / unknown
Verifier role (not email):
Review signoff:
```

## Post-attestation autonomous verification path (requires independent setup approval)

- Prefer scheduled **GitHub Actions** with a Google Cloud **Workload Identity Federation OIDC** provider bound to the unique numeric GitHub repository and repository-owner IDs, specific protected ref/environment and restricted workflow identity. Use short-lived credentials only; no exported permanent service-account keys and no sharing credentials in chat.
- Create dedicated *read-only* attestation identity scoped to `klar-admin`. Grant only metadata/configuration read permissions needed for Project, IAM policy inventory, Firestore database metadata, Cloud Run, Scheduler, Storage bucket settings and audit logs; no Firestore document payload/Storage object download, secrets or IAM mutations.
- Set workflow permissions to `id-token: write` and `contents: read`, restrict invocation/branch, and do not let untrusted PR code obtain cloud credentials. Use environment protection + trusted pinning for workflows and Actions dependencies.
- First run checks only project-number matching, Firebase activation, billing budget policy, database/region identities, IAM least privilege, configured TTL/holds/Scheduler and deployed routes. Export timestamped **redacted JSON summaries** and exact Git SHA / workflow URL as artifacts; record links in VES-12, VES-8 and release register.
- Separate *synthetic-data* staging integration role and environment, created only after explicit approval and budget/IAM checks. Firestore emulator suites do not establish live Firestore/GCS race proof. Destructive cross-service tests must be isolated to disposable named test resources with signed AppSec/DPO/SRE authorization. Never enable production photo-purge flags.
- Fail closed on mismatching `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, `FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID` or Web SDK project/database identity; no automatic main/prod re-point.
- Keep project cost controls, logs without DOB/PII, authentication/App Check and cloud-asset ownership verified independently. GO requires VES-5 and VES-11 remediation, exact-SHA CI, staging evidence and independent signoff.

## Authoritative documentation
- Firebase/Cloud project relationships: https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project
- Firebase project ID/number: https://firebase.google.com/docs/projects/learn-more
- GitHub Workload Identity Federation: https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- Budgets and alerts: https://docs.cloud.google.com/billing/docs/how-to/budgets

**Do not** treat this planning artifact as a cloud attestation, or set `productionApproved=true`.
