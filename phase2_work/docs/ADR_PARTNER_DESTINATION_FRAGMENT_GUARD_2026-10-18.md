# P0 #56: Browser-visible partner URL fragment guard — 2026-10-18

**Decision:** Fail closed; DRAFT / **NO-GO**.

## Threat
PR #83 already rejects pre-seeded `klar_referral` query keys in external partner destinations. A URL fragment (`#...`) is not sent to the HTTP server but is visible to the destination page's browser JavaScript. Fragment state may be parsed repeatedly by partner single-page applications, so selective filtering of known token spellings cannot establish a reliable egress boundary.

## Change
`validatePartnerDestinationUrl` rejects **all nonempty URL fragments** in configured campaign destinations, at creation/update and on existing redirect resolution. Ordinary query parameters remain allowed, except the existing reserved `klar_referral` key. This protects the direct/non-attributed redirect path and prevents preconfigured fragment tracking identifiers from being handed to partner scripts.

## Operational and compatibility constraints
Existing partner URLs depending on hash navigation or SPA hash-based routing will fail closed. Export a non-sensitive inventory, request partner-approved query/path equivalents, have Privacy approve any link changes, and modify campaign URLs through the audited admin flow; do not automate destructive migration. Test the partner's browser navigation after correction. Roll back only after a separate risk decision since old behavior can reveal identifiers.

The code does NOT prove GDPR legal basis, consent validity, token linkability, partner contracts, retention, or independent purchase provenance; Issues #55/#56/#8 remain open. Test `npx vitest run tests/partnerReferralCore.spec.ts` with pinned Node 22.23.3 and all full mandatory gates on the exact integrated head. No production/cloud writes or CI charges initiated.
