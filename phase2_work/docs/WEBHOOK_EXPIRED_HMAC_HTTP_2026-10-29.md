# Signed but expired webhook timestamp — HTTP regression (2026-10-29)

**DRAFT / PRODUCTION NO-GO.**

## Regression
An Express HTTP-level negative test constructs a schema-valid conversion body and computes a **correct HMAC** using the configured campaign secret, but supplies a timestamp 600 seconds in the past. The webhook must reject the expired timestamp with HTTP 401 and `invalid_partner_signature`, preserving no-store and no-referrer response policies. This distinguishes malformed signatures from genuinely signed but expired requests. Rate limiting uses a Firestore transaction double.

## Evidence boundaries
Code and test have been committed but the exact new HEAD has not been verified yet. This is not a production replay test: valid in-window replay, durable deduplication, cross-partner event identity, webhook positive conversion proof and buyer provenance still require independent security/emulator tests and partner integration evidence. Reviewers must also inspect the tolerance window and clock synchronization policy.

## Release status
Stacks on draft #196 and ancestors #195 → #192. No duplicate merges, no deployment, independent Security/DPO/SRE plus release owner GO required. P0 #55, #56, #70, #8 remain open. **BLOCKED / NO-GO.**
