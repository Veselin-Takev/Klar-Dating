# P0 #55 / #56 — Buyer consent epoch binding for partner conversion replay (2026-10-18)

**State: DRAFT / NO-GO.** Stacked on PR #96 (including #81/#93–#95).

## Finding
The conversion retry gate re-checked buyer consent as a boolean, but did not require the **same consent version** under which the original provider assertion was accepted. If a buyer withdrew partner consent and later gave consent again, the old pending provider event could be acknowledged as a valid duplicate. That is inappropriate for a new authorization period.

## Change
On first receipt, the service records `buyerConsentVersion` in both the event document and buyer-claim document. The number is read from the current buyer profile within the Firestore transaction (legacy missing version has the existing default epoch 1). On replay it requires both persisted versions to equal the buyer's current version; a mismatched event returns 409 `partner_event_inconsistent`, and a mismatched claim returns 409 `partner_claim_inconsistent`. Consent withdrawals and account deletions still fail before duplicate acknowledgement. A new assertion does **not** independently prove a purchase or identity and no reward is credited.

## Tests and limitations
An in-memory Vitest regression simulates an initial claim, withdrawal, re-consent in epoch 2, and denial of the old replay. Another case denies legacy event documents lacking buyerConsentVersion. Current and historical provider events from before this change must be reconciled rather than silently updated. There is no migration that retroactively rewrites signed ledger events.

**Important:** This guards existing event **retries**; it cannot prove the provider event was created during a legitimate consent epoch, prevent old provider events being submitted as entirely new event IDs, or detect a direct unauthorized database edit. Persisting the version assumes consent updates increment the same `partnerReferralVersion` atomically; separately verify that invariant and account deletion/retention policy in the real Firestore Emulator. Future buyer consent re-grant flows require explicit user communication and data-sharing review.

Run `npx vitest run tests/partnerReferralService.spec.ts` under Node v22.23.3 with installed dependencies, and test Firebase Emulator concurrency and webhook HTTP signatures, including legacy records. Complete mandatory security, Privacy, Legal, Finance, Playwright and build gates before any GO. No production or CI write executed.
