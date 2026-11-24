# P0 #56 — Source-grounded partner dataflow, tracking-token and Art. 17 retention inventory

**Snapshot / source baseline:** 2026-11-24; `main@49574881affc29033145fbbc08a9fe062c89d57a`; tree `38a64aa561317e79868f5db7f20eac804aaf61da`.
**Issue:** [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56) — OPEN.
**Status:** engineering source inventory only; no legal opinion, consent certification, operational attestation or production authorization. `productionApproved=false`; release **NO-GO**.
**Method:** offline inspection of repository source at the immutable baseline above. No live project, Cloud, IAM, Firestore, Storage, partner endpoint, production dataset or real person was accessed. No real identifiers, partner names, tokens, signed URLs or PII are reproduced.

## 1. Executive finding

The source contains a server-authoritative partner/referral subsystem with separate partner-consent state, HMAC-derived referral tokens, HMAC-pseudonymous ledger references, transaction-time consent/deletion checks, signed partner webhooks, and an Art. 17 account-deletion cascade. The source also documents a critical external boundary: for eligible tracked clicks, the stable owner-derived referral token is appended to the external partner destination as the `klar_referral` query parameter. It can therefore enter recipient-side URL, browser, proxy, CDN and analytics logs outside Klar's control.

The source does **not** establish the legal basis, controller/processor allocation, partner contracts, downstream log retention, third-country transfers, effective partner-side revocation/deletion, legally approved retention periods for conversion/financial evidence, or actual TTL activation. Hashing/HMAC pseudonymization does not make linkable records anonymous.

This inventory does not propose or implement a new token exchange. Any such change is approval-dependent and requires a separate compatibility/security design.

## 2. Partner and referral dataflow inventory

| Flow / boundary | Source symbols and paths | Inputs | Outputs / persisted data | Evidence limits |
|---|---|---|---|---|
| Client consent and referral UI | `phase2_work/src/components/PartnerReferralWidget.tsx`: `loadLinks`, `changeConsent`, `recordInteraction`, `copyLink`, `shareLink`, `openPartner`, QR generation | Authenticated `authFetch`; boolean consent choice; campaign IDs; local copy/share/QR interaction | GET consent and links; POST consent/interaction/open; link displayed/copied/shared or QR rendered locally | UI wording is not proof of informed, freely given, purpose-specific or legally valid consent. Privacy-notice/version copy and UX/legal review: **[TO VERIFY]**. |
| API routing and identity | `phase2_work/server.ts`: imports and mounts `createPartnerReferralPublicRouter` and `createPartnerReferralRouter`; `phase2_work/src/server/routes/partnerReferrals.ts`: `createPartnerReferralPublicRouter`, `createPartnerReferralRouter`, `optionalVisitorUid`, `requirePartnerAccount`, `requireStrictPartnerAdmin` | Authenticated user context; freshly verified Firebase bearer for visitor attribution; webhook payload/headers; campaign inputs | Routes under `/api/partner/*`; public click/webhook endpoints; private consent/referral/admin APIs | Public click and webhook endpoints are intentionally outside ordinary auth middleware but rate-limited and separately validated. Effective proxy/CDN header behavior: **[TO VERIFY]**. |
| Campaign administration | `phase2_work/src/server/partnerReferralService.ts`: `createPartnerCampaign`, `updatePartnerCampaign`, `softDeletePartnerCampaign`, `listPartnerCampaignsForAdmin` | Strict campaign schema, HTTPS destination, admin actor | `partner_campaigns`, `partner_campaign_slugs`, HMAC-signed campaign ledger events; soft-delete status/version; pseudonymous admin refs | Campaign verification field records a manual domain/relationship review; it is not itself a signed partner agreement. Actual contracting party and brand/domain review: **[TO VERIFY]**. |
| Consent and link issuance | `partnerReferralService.ts`: `getPartnerConsentState`, `setPartnerConsent`, `listPartnerReferralLinks`, `ensureReferralForCampaign` | Account ID, adult state, consent boolean and version/epoch, campaign ID, token secret | User consent fields; referral document; signed ledger event; Klar redirect URL containing derived token | Transaction checks are source evidence only; emulator/staging concurrency and deployed writer inventory: **[TO VERIFY]**. |
| Tracked click and external recipient | `partnerReferralService.ts`: `recordPartnerClick`, `trackedDestination`, `directDestination`; route `GET /api/partner/click/:token` | 64-hex token, method/UA/purpose hints, fresh visitor identity, owner/visitor consent and epochs, deletion barriers, campaign state/destination | Click counters and signed ledger; 302 to validated HTTPS destination; eligible tracked redirect adds `klar_referral` query value | Token is disclosed to the external partner on this path. Partner access logs, browser history, CDN/proxy logs, analytics, onward sharing and deletion propagation: **[TO VERIFY]**. |
| Owner opening an offer | `partnerReferralService.ts`: `openPartnerReferral`; `POST /api/partner/open/:campaignId` | Authenticated owner, adult/consent/epoch, deletion state and active campaign | Validated direct destination; ledger event marks `tokenForwarded:false` | Owner-open does not issue or forward an attribution token; this does not remove the visitor tracked-click disclosure above. |
| Conversion assertion | `partnerReferrals.ts` webhook route; `partnerReferralCore.ts`: `PartnerConversionPayloadSchema`, `verifyPartnerWebhookSignature`; `partnerReferralService.ts`: `recordPartnerConversion` | Partner slug, signed event ID, referral token and transient buyer account reference; timestamp/signature | HMAC-derived conversion event ID and buyer-claim ID; `partner_referral_conversions`, `partner_referral_buyer_claims`, signed ledger; pending-verification status | Signature proves possession of configured webhook secret, not a real sale or settlement. Provider purchase truth, buyer identity source, contracts and finance evidence: **[TO VERIFY]**; P0 #55 remains OPEN. |
| Firestore client boundary | `phase2_work/firestore.rules`: explicit default-deny matches for partner campaign, slug, referral, ledger, conversion, buyer-claim and rate-limit collections | Firebase client reads/writes | Client access denied; server Admin SDK remains privileged | Admin SDK bypasses Firestore Rules. IAM/service-account least privilege and actual deployed Rules version: **[TO VERIFY]**. |
| Account erasure | `phase2_work/src/server/trustAndSafety.ts`: `purgeAccountData`; `phase2_work/src/server/partnerReferralDeletion.ts`: `quarantineOwnedPartnerReferral` | Account-deletion job, owner identity, worker lease/slice checkpoints | Referral quarantine, dependent buyer-claim deletion, parent referral deletion, HMAC-reference sweeps, campaign admin-reference scrubbing | Source sequence exists; complete real-emulator, retry/crash, staging and operational receipts: **[TO VERIFY]**. |
| TTL and scheduled cleanup | `phase2_work/scripts/configure-retention.sh`, `scripts/check-retention-active-evidence.mjs`, `functions/src/deleteExpiredPhotos.ts`, `functions/src/archiveInactiveChats.ts` | `expiresAt` fields, explicit project/database/approval flags, scheduler invocation | TTL policy plan; scheduled funnel cleanup; archive processing | Repository configuration is not proof of active TTL policies or deployed scheduler state. Project/database identity, ACTIVE evidence and deletion latency: **[TO VERIFY]**. |

### Cross-system boundary notes

- Partner campaign data is held server-side; Firestore client Rules deny all client reads/writes to the named partner collections.
- The public click endpoint sets `Cache-Control: private, no-store`, `Pragma: no-cache` and `Referrer-Policy: no-referrer`. These headers do not erase URL data already received by the partner, browser, proxy or logging infrastructure.
- The route passes user-agent/purpose hints to click classification. In the inspected partner click implementation these hints are used to suppress automated clicks; the partner ledger does not persist raw IP, user-agent, referrer or provider email/customer ID. A repository-wide logging/redaction proof and infrastructure log inventory are **[TO VERIFY]**.
- `phase2_work/src/App.tsx` separately reads a generic `ref` query parameter and stores a validated short referral code in user-scoped client storage. This is not the HMAC `klar_referral` partner token. Its complete consumer/retention/erasure mapping is **[TO VERIFY]** and must not be conflated with the partner subsystem.

## 3. Tracking-token lifecycle

| Stage | Implemented source behavior | Remaining uncertainty |
|---|---|---|
| Derivation | `partnerReferralCore.ts:derivePartnerReferralToken` computes HMAC-SHA256 over a domain-separated owner account reference, campaign ID and positive consent epoch using a configured secret. | Secret custody, production key inventory, rotation/backup and historic-key retention: **[TO VERIFY]**. |
| Document key | `partnerReferralDocumentId` hashes a domain-separated token to form the `partner_referrals` document ID. | Hash-derived identifiers remain pseudonymous if linkable; no anonymity claim. |
| Persistence | `ensureReferralForCampaign` stores owner reference, campaign ID/slug, version, status, counts and timestamps; it does not persist the raw token field. | Firestore backup/export copies and retention/erasure completeness: **[TO VERIFY]**. |
| Client delivery | `listPartnerReferralLinks` returns a Klar click URL containing the token; the widget displays, copies, shares and encodes that URL into a locally generated QR code. | Clipboard, OS share sheet, screenshots, QR recipients and browser history are outside the server-side deletion boundary: **[TO VERIFY]**. |
| Redirect and partner egress | `recordPartnerClick` validates token-to-owner/campaign/version binding, owner and visitor consent epochs, adult state, deletion state, campaign state and destination; eligible requests increment counters and append a signed ledger record. `trackedDestination` appends `klar_referral` to the external URL. | Partner-side retention, URL logging/redaction, referrer handling, onward recipients, processor/subprocessor list and international transfers: **[TO VERIFY]**. |
| Revocation | `setPartnerConsent(false)` increments the version on normal withdrawal, invalidating older tokens. Corrupt/exhausted epoch withdrawal sets consent false and quarantine while preserving the old version; already-denied repeat withdrawal is idempotent. Re-grant from quarantine is blocked. | This invalidates future Klar attribution only; it cannot recall copies already disclosed to partners or third parties. Partner notification, downstream purge and cache/log deletion: **[TO VERIFY]**. |
| Conversion replay | HMAC-derived event and buyer-claim document IDs provide idempotency; transaction checks current campaign/referral/consent/deletion state. | Provider-side event completeness, historical-event reconciliation and real transaction replay proof: **[TO VERIFY]**. |
| Erasure | HMAC-pseudonymous owner/buyer/actor references are queried and removed by the account-erasure flow. | Secret rotation could make historical pseudonyms unresolvable unless an approved migration preserves lookup; backup, partner-side and delayed webhook remnants: **[TO VERIFY]**. |

**Important:** the stable referral token remains a bearer-like attribution identifier at the recipient boundary. The source code's HMAC and SHA-256 derivations reduce direct identifier exposure but do not make a token anonymous or prevent recipient correlation.

## 4. Collection and event retention matrix

This table separates (a) explicit source/documented retention intent, (b) code-level deletion, and (c) actual TTL provisioning. A TTL `expiresAt` writer is not evidence that a TTL policy is ACTIVE; Firestore TTL is asynchronous and is not a substitute for immediate Art. 17 erasure.

### Partner-specific collections

| Collection / event | Source purpose and identifiers | Source retention / deletion behavior | Operational/legal status |
|---|---|---|---|
| `partner_campaigns` | Campaign text, destination, status, aggregate click/conversion counters, HMAC admin refs | Soft-delete preserves campaign record and slug; account erasure scrubs admin refs but keeps campaign text and aggregate counts | Contract/business record retention duration, controller allocation and lawful basis: **[TO VERIFY]**. No approved period inferred. |
| `partner_campaign_slugs` | Reserved campaign slug and status | Slug reservation retained after campaign soft-delete | Indefinite retention rationale and expiry policy: **[TO VERIFY]**. |
| `partner_referrals` | Owner-to-campaign personalized attribution, owner reference, epoch/version and counts | Owner account erasure quarantines active referral, removes linked buyer claims, then deletes parent referral | No TTL; intended immediate cascade. Emulator/staging completion and backup/partner copies: **[TO VERIFY]**. |
| `partner_referral_conversions` | HMAC event ID; pseudonymous owner/buyer refs; campaign/referral refs; status | Account erasure queries and deletes by ownerRef and buyerRef | Contract/financial evidence exceptions and legally required minimum/maximum duration: **[TO VERIFY]**. |
| `partner_referral_buyer_claims` | HMAC buyer claim key and referral link | Deleted by referralId before parent referral removal and by buyerRef during buyer erasure | Replay/dedupe window and legal/finance exception policy: **[TO VERIFY]**. |
| `partner_referral_ledger` | Signed event type/time, pseudonymous actor/owner/buyer refs, campaign/referral refs | Account erasure deletes records matching actorRef, ownerRef and buyerRef | Ledger retention, dispute/finance evidence and permitted exception scope: **[TO VERIFY]**. |
| `partner_referral_click_rate_limits` | Short-lived IP-derived limiter key; no raw IP intended | `expiresAt` window documented as 60 seconds | TTL policy must be ACTIVE in each target environment; no live proof: **[TO VERIFY]**. |
| `partner_referral_webhook_rate_limits` | Campaign + IP-derived limiter key | `expiresAt` window documented as 60 seconds | TTL policy must be ACTIVE; no live proof: **[TO VERIFY]**. |
| `partner_referral_user_rate_limits` | Account-bound limiter | Targeted deletion in account erasure; 60-second TTL is in retention matrix | Both direct deletion and TTL provisioning/effectiveness: **[TO VERIFY]**. |
| `partner_referral_admin_rate_limits` | Admin-bound limiter | Targeted deletion in account erasure; 60-second TTL is in retention matrix | Both direct deletion and TTL provisioning/effectiveness: **[TO VERIFY]**. |

### Adjacent retention and deletion events

| Collection / event | Documented intended window or trigger | Source mechanism / boundary | Open evidence |
|---|---|---|---|
| `messages` | 90 days after message creation | `expiresAt` writer and Firestore TTL; archive path must preserve original expiry | Writer coverage, ACTIVE TTL and archive timing: **[TO VERIFY]**. |
| `archived_messages` | Same expiry as original message; archive must not extend it | `archiveInactiveMessagesCron` is scheduled; source comments state archive activation depends on approved policy | Scheduler deployment, source timestamp preservation, ACTIVE TTL: **[TO VERIFY]**. |
| `ki_zwischenspeicher` | 36 hours | `expiresAt` + TTL policy intent | Writer coverage and ACTIVE TTL: **[TO VERIFY]**. |
| `age_attempts` | 24 hours | `expiresAt` + TTL policy intent | Writer coverage and ACTIVE TTL: **[TO VERIFY]**. |
| `funnel_events` | 30 days | `deleteExpiredPhotosCron` currently deletes expired `funnel_events`; TTL also listed | Scheduler deployment and TTL state: **[TO VERIFY]**. |
| `ai_budget` | 30 days | `expiresAt` + TTL policy intent | Writer coverage and ACTIVE TTL: **[TO VERIFY]**. |
| `kyc_events` | 30 days after receipt; removed immediately during account erasure | `expiresAt` + deletion cascade | Provider reconciliation and TTL/erasure evidence: **[TO VERIFY]**. |
| `account_deletions` | 30 days after successful completion; open/manual-review jobs have no TTL | Durable deletion barrier/job; TTL only after successful completion | No TTL for pending/manual_review is intentional; actual ACTIVE TTL and barrier lifecycle: **[TO VERIFY]**. |
| `deletion_log` | 30 days after final control run; aggregate counters/status/schema/timestamps only | Final deletion accounting record with `expiresAt` | Schema/content audit, ACTIVE TTL and no personal identifier leakage: **[TO VERIFY]**. |
| `verification_events` / Storage verification objects | 30 days after a recorded moderation decision, not upload time | Decision-aware purge route/engine; old upload-age photo deletion path is disabled in source; scheduler entry remains for funnel cleanup | Actual deployed scheduler, purge flag, IAM/generation/hold guards and Staging test: **[TO VERIFY]**; P0 #202 remains OPEN. |
| `contract_requests`, `subscription_events` | No approved duration in source; statutory/contractual evidence may apply | Retained as contract/termination evidence category | Applicable statutory duration, data minimization, legal hold and DPO/Legal decision: **[TO VERIFY]**. |

### TTL matrix integrity finding — P0 #70

At this baseline, `phase2_work/scripts/configure-retention.sh` defines **20** collection groups with `expiresAt`: `messages`, `archived_messages`, `ki_zwischenspeicher`, `age_attempts`, `funnel_events`, `ai_budget`, `kyc_events`, `account_deletions`, `deletion_log`, the four partner rate-limit groups, `password_reset_rate_limits`, `verification_mail_rate_limits`, `account_deletion_rate_limits`, `kyc_start_rate_limits`, `kyc_reconciliation_events`, `chat_message_rate_limits`, and `chat_gate_answer_rate_limits`.

The script defaults to **DRY RUN ONLY** and its apply path has staging/project/approval preconditions. `check-retention-active-evidence.mjs` requires exactly those 20 approved groups in supplied evidence, each with `ttlConfig.state=ACTIVE`. The source document `DATA_RETENTION.md` also contains an older section describing a 13-group evidence snapshot. This historical 13-vs-20 wording must be reconciled before any evidence is accepted. Neither source file nor a passing local checker proves live ACTIVE configuration. All actual project/database identity and read-only staging TTL evidence: **[TO VERIFY]**. No TTL command was executed for this inventory.

The seven additional groups have no specific duration stated in the inspected retention policy text; their per-writer expiry windows and data purpose require reconciliation against their source writers: **[TO VERIFY]**.

## 5. GDPR Art. 17 erasure, tombstones and exceptions

### Source behavior observed

1. `phase2_work/src/server/trustAndSafety.ts:purgeAccountData` runs as a repeatable, bounded deletion slice with deletion accounting/checkpoints.
2. For each owner referral in `partner_referrals`, it calls `quarantineOwnedPartnerReferral` before dependent claim cleanup. That helper in `partnerReferralDeletion.ts` validates the canonical root collection path, verifies the owner reference inside a Firestore transaction and changes status to `deleting`. Conversion transactions require an active referral and read the same document.
3. The deletion worker removes all `partner_referral_buyer_claims` for that referral ID before deleting the parent referral. It checks the deletion slice/lease before parent removal so a resumed slice can repeat safely.
4. It then deletes conversion records matching HMAC-pseudonymous `ownerRef` and `buyerRef`, buyer claims matching `buyerRef`, and ledger entries matching `actorRef`, `ownerRef` and `buyerRef`.
5. It deletes account-bound partner user/admin rate-limit documents by a deterministic hash key and scrubs `createdByRef`, `updatedByRef` and `verifiedByRef` from retained campaign records.
6. Firestore Rules treat `account_deletions/{uid}` as an authentication barrier; partner collections are denied to Firebase clients. Partner service methods check deletion documents and consent/quarantine state before creating new links, clicks or conversions.

### Boundaries and exceptions not established by code alone

- **[TO VERIFY]** DPO/Legal decision whether any conversion/ledger/contract record may be retained for statutory accounting, dispute, fraud prevention or legal claims; exact category, purpose, fields, access, end date and balancing test.
- **[TO VERIFY]** Legal-hold process, authorized decision-maker, scope, periodic review, expiry, audit trail and release procedure. No hold exception is inferred or invented here.
- **[TO VERIFY]** Data-subject access/export coverage for partner records and a complete recipient/partner copy inventory.
- **[TO VERIFY]** Partner notification and deletion/withdrawal propagation SLA, proof of partner-side deletion, CDN/proxy/browser/analytics log expiry and delayed webhook handling.
- **[TO VERIFY]** Actual Firebase Emulator proof of transaction contention, crash/restart between claim batches and parent deletion, idempotent retry, concurrent conversion denial, and residual-record census.
- **[TO VERIFY]** Staging run evidence, IAM least privilege, deployed Rules, backup/export lifecycle and restoration controls preventing erased data resurrection.
- **[TO VERIFY]** Consent and legal audit integrity after `CONSENT_AUDIT_SECRET` rotation. Rotation must not make historic pseudonymous references unresolvable; no key rotation is authorized by this inventory.

This artifact does not prescribe deletion of records that may be subject to a lawful retention exception. It requires an approved, field-level decision before any such exception is implemented.

## 6. Legal, privacy and partner governance register

Every item below remains **[TO VERIFY]**; this inventory does not simulate approval:

- Processing purpose and Article 6 lawful basis per click, referral-link issuance, visitor attribution, conversion assertion, ledger, fraud prevention and campaign reporting.
- Whether Article 9 special-category data is involved in any partner flow, and the separate Article 9 condition if applicable. No Article 9 basis is presumed.
- Controller, joint-controller and processor roles per partner and per data flow; controller contact, instructions and responsibility allocation.
- Partner contract / data-sharing agreement / DPA as applicable; purpose limitation, onward recipients, subprocessors, security, breach cooperation, data-subject requests and deletion obligations.
- Third-country transfer locations, transfer mechanism, transfer impact assessment and supplementary measures where required.
- Consent UX, granular purposes, policy version, proof record, withdrawal ease, re-consent, and behavior after withdrawal.
- DSFA screening and documented rationale whether a full DPIA is required; no DPIA determination is made here.
- Privacy notice, partner notice, cookie/tracking treatment, access/export, objection/withdrawal and complaint workflows.
- Binding retention periods for campaigns, conversions, buyer claims, signed ledger, contract/financial evidence and partner-side logs; legal holds and end-of-hold deletion.
- Secret custody, token lifetime/minimization, external URL leakage and partner-side redaction.
- Operational emulator/staging evidence and independent AppSec, DPO/Legal, Finance and SRE review.

## 7. Evidence and validation status

| Evidence class | Status |
|---|---|
| Exact source baseline and code paths | Inspected at `main@49574881affc29033145fbbc08a9fe062c89d57a` |
| Source-level HMAC, consent epoch, click and webhook checks | Present in inspected source; not legal approval |
| Source-level Art. 17 referral cascade | Present in `purgeAccountData`; not a completed emulator/staging receipt |
| Client Firestore Rules deny partner collection access | Present in checked-in `phase2_work/firestore.rules`; deployed Rules/IAM **[TO VERIFY]** |
| TTL matrix source | 20 groups in provisioning script and evidence checker |
| Actual ACTIVE TTL policies in approved Staging | **[TO VERIFY]** |
| Partner contracts, lawful bases, roles, transfers and retention schedule | **[TO VERIFY]** |
| Partner-side URL/log retention and token revocation/deletion | **[TO VERIFY]** |
| Emulator concurrency/restart/erasure proof and residual census | **[TO VERIFY]** |
| Independent DPO/Legal, AppSec, Finance and SRE sign-off | **[TO VERIFY]** |
| Production authorization | **NO-GO; productionApproved=false** |

## 8. Non-goals and change boundary

This is a documentation-only inventory. It does not change runtime code, client behavior, auth boundaries, Firestore/Storage Rules, TTL configuration, retention guards, Art. 17 deletion, secrets, dependencies, lockfiles, workflows, Vitest configuration, Firebase indexes, or cloud resources. No real partner name, personal identifier, UID, token, external URL, webhook secret or live data is included.

No live Cloud/IAM/Firestore/Storage/bucket/scheduler/TTL query, mutation, deployment, token rotation or production action was performed.

## 9. Source manifest

All paths below were inspected at the immutable base commit `49574881affc29033145fbbc08a9fe062c89d57a` unless otherwise noted:

- `phase2_work/src/components/PartnerReferralWidget.tsx`
- `phase2_work/src/App.tsx`
- `phase2_work/server.ts`
- `phase2_work/src/server/routes/partnerReferrals.ts`
- `phase2_work/src/server/partnerReferralCore.ts`
- `phase2_work/src/server/partnerReferralService.ts`
- `phase2_work/src/server/partnerReferralDeletion.ts`
- `phase2_work/src/server/consentAudit.ts`
- `phase2_work/src/server/trustAndSafety.ts`
- `phase2_work/firestore.rules`
- `phase2_work/docs/DATA_RETENTION.md`
- `phase2_work/docs/PARTNER_REFERRAL_SYSTEM.md`
- `phase2_work/docs/PARTNER_TOKEN_DATAFLOW_ART17_GATES_2026-10-14.md`
- `phase2_work/docs/ART17_PARTNER_REFERRAL_QUARANTINE_2026-10-18.md`
- `phase2_work/functions/src/retention.ts`
- `phase2_work/functions/src/deleteExpiredPhotos.ts`
- `phase2_work/functions/src/archiveInactiveChats.ts`
- `phase2_work/scripts/configure-retention.sh`
- `phase2_work/scripts/check-retention-active-evidence.mjs`
- `phase2_work/scripts/loeschkaskade.mjs`

**Indexes:** no Firestore index manifest was found at the two expected paths `firestore.indexes.json` or `phase2_work/firestore.indexes.json` on this baseline (404). Query/index deployment and any alternate configured index path are **[TO VERIFY]**; no live index inventory was performed.
