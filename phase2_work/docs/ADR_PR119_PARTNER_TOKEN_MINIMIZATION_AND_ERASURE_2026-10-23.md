# ADR — P0 #56 external referral-token minimisation, partner recipient and erasure governance (2026-10-23)

**Status: PROPOSED / UNAPPROVED. Production: NO-GO/HARD STOP.** Target original PR119 `7fdf29010c85f16a9b38e5c93186f32e92192f3a`.

## Background

`partnerReferralService.ts` forwards a deterministic, stable HMAC-derived 64-hex owner/campaign/consent-epoch handle in the external partner destination URL as `klar_referral`. A `Referrer-Policy: no-referrer` header does not conceal this deliberately transmitted URL query. The existing consent controls rotate authorization epochs on withdrawal, and the source contains owner/buyer ledger/claim erasure. They do **not** prove partner recipient handling, buyer/purchase legitimacy, legal basis, Art.17 completion, data subject notice or retention clearance.

HMAC/SHA-256 pseudonyms can remain GDPR personal data if linkable with auxiliary data. The external partner may capture the handle in web, CDN or analytics logs; those inventories have not been inspected.

## Options needing Product, Security, DPO/Legal and partner approval

- **A — Preserve current stable token** only after independent purpose/minimisation assessment, documented legal basis, partner recipient/processor obligations, logs/analytics/transfer inventory, revocation handling and privacy acceptance. Correlation exposure remains wider.
- **B — Evaluate short-lived single-use opaque exchange intent (preferred design candidate).** Klar issues a random short-lived token only after authenticated consent-bound action, server-binds it to consent epoch, partner, campaign, expiry and nonce; partner receives an opaque, limited-audience handle rather than a reusable owner pseudonym or raw UID. Require one-use redemption, replay resistance, route/log controls, migration/rollback and partner contract versioning. **Not approved or implemented.**
- **C — Disable third-party attribution during pilot** and forward only directly to validated partner destinations, suppressing unsupported referral rewards. Requires separate Product/Legal permission and customer communication; not enacted.

## Decision dependencies and release qualification

- DPO/Legal: per-event VVT, GDPR Article 6 basis, Article 9 and Article 35 risk screening as appropriate, ePrivacy, information notices, consent choice, recipient/subprocessor and cross-border transfer, retention and legal holds.
- Product/Partnerships/Finance: partner reward promises (only Klar+ periods), purchase proof and reversal/chargeback reconciliations (#55/#57), accepted external data flow.
- Security/SRE: token recipient + referer/log behavior, key theft/rotation, post-withdrawal suppression, Firestore Emulator stage concurrency/deletion and processor-side erasure attestation.
- Release Owner: versioned contract decision, separately authenticated Security/DPO/SRE/Release approvals, exact source SHA and all required host gates.

## Evidence and rollback boundary

The original source subset matched **10/10** Git blobs from the immutable PR119 tree. A read-only locally tested structural screen reported ten expected controls with **30/30 local tests PASS under nonqualified Node.js 22.16.0**. It does not authenticate a source checkout or prove live legal or technical compliance, and was **not integrated in this commit**. All source patterns could pass while legal approval remains absent.

No staging or production system, product behavior, API, TTL setting, paid CI or cloud resource changed. Revert this **audit-only documentary change** for rollback. Additional application remediation needs separate authorization because the earlier production-correction cycle exhausted its governance allowance. P0 #56 stays OPEN, qualified host gates **0/15**, final signoffs **0/4**, **NO-GO**.
