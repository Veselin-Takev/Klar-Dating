# P1 #372 — Deterministic recommendation pagination

**Status:** Draft implementation; independent review and hosted gates pending.
**Base:** `main@4956fb09f81a9bf6e9686dd8abded577b7aff8b5` (Tree `4106ab148b7b34043a0afbb3069956e1f010ed3a`).
**Scope:** pagination only; no eligibility-policy expansion.

## Query and bounded scan

Candidate predicate: `public_profiles.location == normalizedLaunchCity`.
Stable ordering: `orderBy(FieldPath.documentId())` ascending.
Cursor: `startAfter(lastPageDocumentSnapshot)`.
Page size: `limit(min(100, remainingScanBudget))`.
Hard scan ceiling: 5,000 candidate documents. At the ceiling, the same predicate/order with `startAfter(lastPageDocumentSnapshot).limit(1)` is used as look-ahead. Any further document causes `Recommendation scan budget exceeded`; results are not silently truncated. Duplicate document IDs across pages fail closed.

Existing block queries remain `blocks.blockerUid == viewerUid` and `blocks.blockedUid == viewerUid`, each in pages of 200 and a 50-page fail-closed ceiling. Existing candidate filters remain unchanged: viewer exclusion, adult/example/active/verified flags, both block directions, authoritative user lifecycle, deletion barrier, public-projection lifecycle compatibility, age range and last-active-within-seven-days.

## Consent / Art. 9 boundary

No explicit Consent-Eligibility-Filter is currently wired into `getRecommendations()` or the `/recommendations` route. P1 #372 does not add, infer or modify Consent / Art. 9 behavior. This is **OUT_OF_SCOPE_FOR_P1_372 / SEPARATE_DPO_APPSEC_REVIEW_REQUIRED**. `consentEngine.ts` and the recommendation route are not modified.

## Firestore index prerequisite — no deployment

No `firestore.indexes.json` is checked into the repository. Composite-index availability for the city equality predicate plus document-ID ordering/cursor remains **OPEN / [TO VERIFY]** and must be validated in the Firestore Emulator and an independently approved staging environment. No index was created, modified or deployed.

## Required validation before merge

Hermetic Vitest tests cover >500 profiles with the first 500 ineligible; stable cursor retry/repeatability and no duplicates/skips; an eligibility mutation during multi-page traversal; existing block/deletion/age/adult/verification/activity exclusions; and scan-budget fail-closed behavior. Hosted Klar Enterprise CI and Audit Gate for this PR's final exact HEAD are **[TO VERIFY]**. Firestore Emulator query/index validation, bounded staging load test using approved synthetic data, and independent AppSec/QA review remain prerequisites.

No cloud, IAM, Firestore, Storage, index, deployment or production mutation. PR remains Draft/Open/Unmerged; P0 issues remain OPEN; `productionApproved=false`; release **NO-GO**.
