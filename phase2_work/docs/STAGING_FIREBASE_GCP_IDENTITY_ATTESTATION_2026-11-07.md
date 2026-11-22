# Klar Staging Project Identity and Read-Only Cloud Verification — 2026-11-07

**Project identity: SCREENSHOT-CONFIRMED (2026-11-07); authenticated cloud API attestation still pending. Production: NO-GO.** No Firebase/GCP resource creation or production mutation is authorized by this document. Corresponds to Linear [VES-12](https://linear.app/takev/issue/VES-12).

## New user-provided Console evidence — 2026-11-07

Two screenshots of the signed-in Google Cloud project dashboard and Firebase project settings show the same project identity:

| Source | Project name | Project ID | Project number |
| --- | --- | --- | --- |
| Google Cloud project information | Klar Admin | `klar-admin` | `999168390318` |
| Firebase project settings > General | Klar Admin | `klar-admin` | `999168390318` |

**Assessment:** The user-visible Console pages show a consistent Google Cloud/Firebase project identity. There is no need to create another project named `klar-admin`. Firebase Settings currently shows the **Spark/free plan**, **zero registered Firebase apps**, and environment type **Unspecified**. These screenshots do **not** establish any deployed Firestore database, storage bucket, IAM policy, Cloud Run service, Scheduler, billing-account attachment, or a real EUR 10 project budget; these remain to be inspected.

Evidence sensitivity: source screenshots were supplied in the chat and include account UI. Do **not** publish or embed unredacted screenshots or personal account/email fields in GitHub. This document records only non-secret project metadata. A direct, independently authenticated read-only API inventory remains outstanding.

**New 2026-11-07 Firestore console evidence (user-supplied screenshot):** The `klar-admin` Firebase console currently displays the **Cloud Firestore introductory screen with "Create database"**, consistent with **no Firestore database provisioned yet through this Firebase project UI**. No database ID, region, or edition is shown. This is screenshot-based evidence, not a direct GCP database-list API inventory; confirm with authenticated inventory before declaring definitive cloud-wide absence. **Do not click Create** until Firestore location, security rules, region availability, Spark/Blaze cost eligibility and backend/web SDK database identity have been reviewed. Proposed staging target (pending confirmation): Firestore Native `(default)` in `europe-west3` where available and compliant. No user data, biometric uploads or production connections.

**Next user-assisted step:** Confirm project Billing/Budgets read-only (amount, currency, scope and active plan) and verify the Firebase/GCP database inventory/region options without creating resources. Then scope least-privilege GitHub WIF/OIDC for scheduled read-only metadata inspections. In parallel, inspect Cloud Billing > Budgets & alerts and identify whether an active project-scoped budget for `klar-admin` actually exists; do not conflate the Firebase Spark plan with an independently verified spend cap.

## Existing evidence (not proof of cloud ownership)
- Linear VES-12 previously recorded user-reported Firebase and GCP ID **`klar-admin`** (2026-11-06). New 2026-11-07 Console screenshots now support matching project IDs and numeric project numbers, but IAM, billing and cloud-service inventories remain unverified.
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

## New 2026-11-07 Billing Console screenshot evidence

A user-provided Google Cloud **Billing > My billing accounts** screenshot shows **two active billing accounts** (one organization-scoped and one without a listed organization) and each account displaying **EUR 0 spent in the last 30 days**. This account-level list does **not** establish whether the staging project `klar-admin` is linked to either billing account, whether billing is enabled for that project, or whether any **project-scoped EUR 10/month budget** exists. The screenshot also contains account identifiers; **do not preserve or republish raw billing account IDs or payment information**.

**Next read-only verification:** In Billing > **My projects** (German: *Meine Projekte*), locate `klar-admin` and record only whether a billing account is linked and the account's non-sensitive display name (redact billing-account ID). Then open the relevant account's **Budgets & alerts** and check a monthly, EUR 10, specifically `klar-admin`-scoped budget and its 50/80/100% alerts. An alerts-only budget is **not** a hard spending limit. Do not change association, create a new billing account or enable billable resources from this observation.

## Organization-parent console evidence — 2026-11-07

A user-provided Google Cloud **IAM & Admin > Settings** screenshot for project `klar-admin` shows the text that **Access Transparency is unavailable for projects not associated with an organization**. Together with the earlier Billing > My Projects display under **No organization**, this supports that **`klar-admin` currently has no organization parent**. The similarly named `klar-app-admin-org` seen as an organization associated with one available billing account does **not** automatically make it the project's Resource Manager parent. Independently authenticate and inspect the project parent before treating this as an API-certified inventory item.

**Decision: do not migrate by default.** A move from a standalone project into an organization can change inherited organization policies and effective IAM; this requires a deliberate move analysis and owner approval, and is not a prerequisite for emulator-based tests.

**Billing remains disabled.** The identity-and-automation plan is staged: (A) continue free, isolated emulator tests and read-only console inspection, without Cloud mutations; (B) before creating the recommended Google Cloud Workload Identity Pool/Provider for scheduled GitHub OIDC cloud API scans, obtain explicit approval for enabling scoped project billing, confirm monthly alerts and cost-risk controls, then grant minimal identity access. Google Cloud's Workload Identity Federation setup guide explicitly asks that billing be enabled for the pool project. Neither the screenshot nor the current repo proves any WIF pool or read-only cloud service account already exists.

Sources:
- https://docs.cloud.google.com/resource-manager/docs/project-migration
- https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines

## User-selected staging option B — 2026-11-07 (planning, not a billing authorization)

The user has selected **B: controlled cloud-staging verification with a EUR 10/month target**. This authorizes preparing the setup, **not** choosing a billing account, attaching billing, enabling APIs, creating IAM identities/databases or deploying services without a deliberate confirmation of the precise settings and costs.

### Billing/Blaze change control

1. Existing Console screenshot: `klar-admin` is under *No organization*, Billing > My projects reports **billing disabled**, and Firebase uses **Spark**. Two active billing accounts exist; **no particular account was selected**. Do not assume the similarly named `klar-app-admin-org` account is the correct payer or infer organization ownership.
2. Inspect the intended active billing account **display name, billing currency, payer/legal owner and permitted access** before picking it. Do not capture payment details or publish billing-account IDs. User must affirm the selected account before attachment.
3. Linking an active billing account to the underlying Firebase GCP project **automatically upgrades Spark to Blaze**; this allows pay-as-you-go charges. It does **not** imply an automatic EUR 10 cap.
4. Immediately after linking (if specifically approved), create a **EUR 10/month, `klar-admin`-only alerts-only budget**, notification thresholds 50%/80%/100% (EUR 5/8/10), and confirm email recipients. No chargeable resources/API rollout until project scoping and alerts are verified.
5. Google Cloud now documents **spend cap budgets** for eligible single-project **single-service** workloads, including Cloud Run, Cloud Run functions and certain AI services; they **do not provide an all-service EUR 10 project cap** and do not cover Firestore by this list. Check eligibility and configuration separately for relevant services; limits may be exceeded due to enforcement latency. Preserve low quotas and isolated staging regardless.
6. If the currency differs from EUR, do not enter "10" and misrepresent it as EUR; confirm exchange-rate policy/target before setup. A budget alert is not a spend limit; avoid automated billing disable without impact review.
7. Proceed only after user shares a redacted view of available account selection (or the intended account display name/currency), and verifies the correct payer. No payment details, credentials, or service-account JSON are needed.

### After budget evidence

- Apply a dedicated, minimal-trust GitHub Actions OIDC/WIF reader to the attested **project number `999168390318`**, with trusted refs and identity attribute restrictions. First read **metadata only**: resource names, DB IDs/locations, role bindings (redacted), Cloud Run/Scheduler/bucket retention and budget state. Do not read customer document contents, photos, secrets or PII.
- For integration and adversarial Firestore/GCS tests, obtain **additional** approval for isolated synthetic resources. VES-5 destructive operation tests stay off production.
- Record exact SHA, time, role and outputs in VES-12/VES-8; keep VES-5/VES-11 and overall production **NO-GO** pending independent signoff.

Official sources:
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://docs.cloud.google.com/billing/docs/how-to/verify-billing-enabled
- https://docs.cloud.google.com/billing/docs/how-to/budgets
- https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps
- https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines

## Further billing-account view (2026-11-07, screenshots only)

The user opened the Overview page of a billing account displayed as **Mein Rechnungskonto**. The page indicates a **Free Trial billing account**, approximately **EUR 269 remaining trial credit** and **89 days remaining**, with **EUR 0 November costs** in the current period. It is **NOT** the `klar-admin` project's **Change billing** dialog. These figures are account-level and time-sensitive, not project allocation, not a guaranteed monthly 10-EUR limit, and not evidence that `klar-admin` has been linked. No raw billing-account ID or payment details are retained here.

Next action: Return to **Cloud Billing > My Projects**, select `klar-admin` row → three-dot menu → **Change billing**; inspect offered billing account names, payer/currency and Free Trial vs Paid status **without clicking Set account**. Do not click the Free Trial **Upgrade** button for this inspection. Separately authorize any actual billing association after choosing an account and confirming its cost implications. Google official guides: https://docs.cloud.google.com/billing/docs/how-to/modify-project and https://docs.cloud.google.com/free/docs/free-cloud-features.

## Billing selection dialog — user screenshot 2026-11-07

The **Billing > My Projects > Change billing** dialog for `klar-admin` is now visible. It offers two selectable managed account display names: **Mein Rechnungskonto** and **My Billing Account**. The former was separately observed in a Free Trial account overview with approximately EUR 269 credit and 89 days remaining. **Neither has yet been selected or linked in the project** based on the supplied screenshot; currency, payer authorization and availability of promotional credits for this target project require confirmation. Other projects in the same view are unrelated and must not be affected.

**Next manual control:** Select **Mein Rechnungskonto** in the chooser to inspect the resulting confirmation text, **without clicking the final Set account / Confirm button**. Confirm the intended account and the charges/Blaze implications with the user, and then perform a separate explicit approval of the actual billing linkage. Once linked, independently verify `billingEnabled=true` for `klar-admin`, create and confirm EUR 10 project-scoped monthly alerts at 50/80/100% **before any new billable resources or staging CI cloud access**. A trial credit is not a universal hard spend cap; do not click Upgrade simply to select a billing account.

## Billing account selected in project-link confirmation (2026-11-07)

A new user-provided Google Cloud screenshot shows the **Klar Admin** project billing selection confirmation with **Mein Rechnungskonto** selected. The prominent final action is **Konto festlegen** (Set account); it is not shown as completed. The UI states the project charges will be billed to the selected account and warns about possible effects on previously reserved-use commitments/discounts. Prior screenshot of this account showed an active Free Trial and approximate credit/balance at the time, but **credit application to this project and current billing state have not been independently reverified**.

The user previously selected Option B as an **implementation preference**, not evidence that a billing-link operation has occurred. The next step is an explicit user-side **Konto festlegen** action, only if the user accepts pay-as-you-go billing, the Spark-to-Blaze plan upgrade and that the 10-EUR target is **not** an enforced total-project cap. No deployment, Firebase database, IAM role or API should be enabled before checking the resulting project association and creating/verifying a scoped monthly EUR 10 alerts-only budget (50%/80%/100%) immediately afterwards. Do not publish unredacted account details.

Official docs: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans ; https://docs.cloud.google.com/billing/docs/how-to/modify-project ; https://docs.cloud.google.com/billing/docs/how-to/budgets

## Billing linkage confirmed by user console — 2026-11-07

The user-provided **Cloud Billing > My Projects** screenshot now shows the `Klar Admin` project, ID `klar-admin`, with billing account display name **`Mein Rechnungskonto`** in its row. The console toast reports successful account change. **Project-to-account linkage: confirmed from Console screenshot.** Billing account numeric IDs, personal identities, and payment details have not been reproduced. No direct authenticated Billing API receipt has been collected.

The screenshot does **not** confirm a EUR 10 project budget, notification thresholds, current trial-credit eligibility, Firebase Blaze confirmation in the Firebase console, or any service deployments. Per Firebase pricing documentation, linking a Cloud Billing account from Google Cloud automatically upgrades the underlying Firebase project to **Blaze**; the new Firebase plan display should be checked separately.

**Next gate (before enabling any new billable resources):** Under linked billing account **Mein Rechnungskonto** open **Budgets & alerts / Budgets und Limits**, create an **alerts-only** monthly budget explicitly scoped to the *single project* `klar-admin`, fixed amount **EUR 10** (verify billing currency first), with **actual-cost** alerts at 50% (EUR 5), 80% (EUR 8), 100% (EUR 10). Verify alert emails enabled and inspect resulting budget summary including exact project scope. The Google default 50/90/100 thresholds must be adjusted if 80 is desired. Budget emails and cost reporting may lag and are not a hard cap. The user's choice of a billing account does not imply approval to create Firestore, Cloud Run, Workload Identity pools, or production services.

References: https://docs.cloud.google.com/billing/docs/how-to/budgets ; https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## User screenshot: budget edit form partially configured (2026-11-07)

The user supplied a Cloud Billing **Budgets & alerts > Edit budget** screenshot for billing account **Mein Rechnungskonto**. The form shows:
- **Alerts-only** budget mode selected; **monthly** period; current budget name **`10`** (not yet the recommended descriptive name).
- The **Projects** multi-select expanded with **`Klar Admin / klar-admin`** and another project. **`klar-admin` is not visibly checked** in the screenshot. It is not yet verified that only the staging project will be included. Do not choose *All projects* or include unrelated resources.
- Specified-amount budget type is visible, but its **numeric target (EUR 10)** and the configured **50/80/100 actual-cost thresholds and email recipients** are not in view and cannot be asserted.
- The screenshot shows **Edit budget**, not **Create budget**; check whether this budget was previously used for a different project before repurposing it. Do not silently change existing project-wide or other-project budget coverage.
- **Other savings** is checked in the displayed form; alert calculations may be affected by discounts, credits or savings. Review scope and cost baseline, and consider separately monitoring gross/pre-credit costs when free-trial credits may mask underlying usage.
- No screenshot of Save/Finish or the resulting budget summary has been supplied. **Budget status: not verified / not yet accepted as the EUR 10 staging gate.**

Next user verification: select **only** `Klar Admin / klar-admin` in the project dropdown and confirm; rename `10` to `Klar-Staging-10EUR` if it is indeed the intended staging budget; inspect the specified target, currency and actual-cost 50/80/100 thresholds and email alerts before saving. If the existing budget serves other projects, cancel edits and create a new dedicated project-scoped budget instead. No Cloud/Firebase/production operations are authorized by this screenshot.

Official reference: https://docs.cloud.google.com/billing/docs/how-to/budgets

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
