# Cloud account ownership and unauthorized-cost control review — 2026-11-07

**Status:** SECURITY REVIEW OPEN. **No breach or unauthorized charge established.** Google Cloud authenticated project/billing IAM and audit data not directly available in this session. This is screenshot and repository evidence only; no production or billing changes performed.

Tracking: [Linear VES-13](https://linear.app/takev/issue/VES-13) and [VES-12](https://linear.app/takev/issue/VES-12). Project `klar-admin` remains release NO-GO while VES-5 / VES-11 are unresolved.

## Screenshot-evidenced inventory (Cloud Billing > My projects, filter No organization)

| Project ID | User recognition | Visible billing status | Identity/creator |
| --- | --- | --- | --- |
| `prime-casing-48f9p` | Unknown | Linked to **Google DeepMind -> Gemini API Tenant Sandbox -> Pool 025**, not the personal billing account chosen for Klar | **Not established** |
| `klar-admin` | User-approved staging | Linked to **Mein Rechnungskonto** | Existing project and billing choice user-verified |
| `gen-lang-client-0274270850` | To review | Billing disabled | **Not established** |
| `tough-cipher-440709-r5` | To review | Billing disabled | **Not established** |

This view may exclude projects in other organization contexts or accessible through other accounts; not an account-wide list. Do not copy exposed billing IDs or personal/payment information into repository issues.

GitHub source search of `Veselin-Takev/Klar-Dating` for `prime-casing-48f9p`, `gen-lang-client-0274270850`, `tough-cipher-440709-r5` and `Gemini API Tenant Sandbox` found no references. **This does not establish project provenance or absence of external API usage.**

Google AI Studio documentation states that for some new users it can create a default project and API key following Terms acceptance; this is only a **possible explanation**, NOT a confirmed creator for `prime-casing-48f9p`. The billing-pool name itself cannot prove who is legally charged.

## Unresolved budget issue (same user screenshot)

Budget table under `Mein Rechnungskonto` shows **name `10`**, **monthly**, project **Klar Admin**, warning thresholds **50%, 90%, 100%**, and spend/target **`0,00 € / 0,00 €`**. Budget *name* is not an amount. **EUR 10 target has NOT been established**, and 80% alert is not configured as requested. Before any cloud resource enablement, inspect budget's **specified amount**, EUR currency, effect of credits/discounts, project scope and actual-cost alert thresholds; correct to EUR 10, 50/80/100 where appropriate and verify saved summary. Alert-only budgets do not guarantee a spending stop.

## Read-only evidence collection sequence

1. Open Cloud Resource Manager **Manage resources** with each applicable organization context and Google account. Collect IDs, numeric project numbers, parent organizations, creation timestamp, lifecycle state and authorized owners (redacted).
2. In `prime-casing-48f9p` inspect IAM permissions, service accounts, API keys **metadata only** and enabled APIs. In Logs Explorer search Admin Activity logs for `cloudresourcemanager.v3.projects.create` (or older `v1.projects.create`), examine timestamp and `protoPayload.authenticationInfo.principalEmail` after redaction. If no results, account for log scope/age/access before concluding anything. Google Support / AI Studio support may be needed to determine creation provenance.
3. Open Google AI Studio **Dashboard > Projects** and API key metadata. Check association with project ID. Do not expose actual keys in screenshots or GitHub. Do not disable keys before impact analysis unless active compromise is confirmed.
4. On **every** billing account including `Mein Rechnungskonto` and `My Billing Account`: inspect **linked projects**, Billing Reports / invoices, anomalous spend, and Billing IAM principals; compare payer vs Google-managed Gemini billing pool. Do not claim the user is billed for third-party pool until invoice/charge ownership is proved.
5. Check Google Account Security: strong phishing-resistant 2-step verification / passkey, recent sign-ins, recovery, linked third-party apps. Examine project IAM `Owner/Editor` and Billing IAM `roles/billing.admin`, `roles/billing.user`, `roles/billing.creator`; review resource creation permission `resourcemanager.projects.create`. Remove unknown permissions only after recording evidence and confirming no breakage.
6. Apply least-privilege restrictions in the appropriate **organization scope** where supported; standalone/no-organization projects and consumer accounts do **not** offer a universal user-confirmation prompt for every new project and charge. Restrict API keys and service-account keys. Configure budget alerts/usage anomaly notifications for **each** relevant billing account. Consider project-level service-specific spend caps when supported; these do not act as a guaranteed whole-billing-account EUR 10 limit.
7. Protect Klar's `main` and cloud environments with change approval and no production auto-deploy. Cloud OIDC/WIF staged only after explicit IAM review and billing budget verification.

## Operational instruction

**Do not** delete or move `prime-casing-48f9p`, change its billing link, close a payment account or blindly revoke service accounts without first confirming ownership, dependencies, audit logs and payer. None of these controls has been applied through this document. Risk and attribution remain **OPEN**, not fixed.

Official references:
- https://docs.cloud.google.com/resource-manager/docs/audit-logging
- https://ai.google.dev/gemini-api/docs/api-key
- https://docs.cloud.google.com/billing/docs/how-to/grant-access-to-billing
- https://docs.cloud.google.com/billing/docs/how-to/view-linked
- https://docs.cloud.google.com/docs/authentication/api-keys-best-practices
- https://docs.cloud.google.com/billing/docs/how-to/budgets
