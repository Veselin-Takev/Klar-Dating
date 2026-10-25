# Owner partner opens: no attribution token (2026-10-25)

Status: implemented engineering mitigation for #56; #56, #55, #70 and #8 remain OPEN. Production NO-GO. Base: main c5c4ec5dc323d13213643a090460a41cf5bad981.

## Finding and decision

An authenticated member opening their own partner offer previously received the stable owner/campaign/consent-version HMAC in the external URL even though no qualified visitor click was counted. Listing all referral links also created link records solely to open the offer. Neither action is required for a non-attributed owner visit.

POST /api/partner/open/:campaignId keeps its response shape {url}, authentication, separate partner-consent requirement, rate limit and no-store/referrer headers. The service now reads the user, account-deletion marker and current campaign in a single Firestore transaction, validates adult status, explicit active non-quarantined consent and positive safe consent version, validates the current verified active campaign and HTTPS destination, and writes the signed referral_open_link audit entry atomically. The audit states tokenForwarded:false and does not contain a referral ID. Only the configured validated destination is returned; no referral token is generated, no referral documents are created and no click/conversion counters change.

The destination is resolved from the transactional snapshot, rather than from a preflight read before a separate authorization transaction. Invalid/reserved query keys and fragments still fail closed. Ordinary safe query parameters are preserved. Missing snapshots, deleting accounts, ineligible members and inactive campaigns fail without an open audit entry.

## Scope and compatibility

Copy/share/QR links and an eligible other visitor's attributed click remain separate flows. recordPartnerClick still forwards the stable token when that visitor's authentication, consent and transactional gates pass. This change therefore does not eliminate partner token disclosure globally or revoke copies already held by recipients. Consent can change after a completed transaction/response; the transaction is a point-in-time authorization decision, not a guarantee of revoking an already returned URL.

Existing clients continue receiving {url}. Partners must not rely on an owner's self-visit for attribution, purchaser proof or rewards. No database migration, deletion, TTL configuration, payment, reward, production deployment or approval is performed. Legal bases, recipient retention/logging, short-lived exchange protocol, actual Art.-17/TTL environment evidence and independent privacy review remain outstanding.

## Verification and rollback

Targeted service suite: 35/35 PASS locally with Node 24.22.1 and Vitest 5.0.5. Tests use the existing in-memory Firestore fixture and an isolated FieldValue adapter, not a live Firestore emulator. Coverage includes token absence, no referral issuance/counter mutation, valid signed audit, operation without token/public-origin configuration, invalid consent/epoch/adult state, and deletion, unsafe destination, inactive campaign and withdrawn consent at transaction time. Full pinned-runtime CI, emulator and browser gates must pass on the published head.

Rollback should preserve token-free owner destinations; reverting to stable token forwarding reopens the documented disclosure. No emergency production rollback is authorized by this document.

