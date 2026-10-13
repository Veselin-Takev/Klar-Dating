# Scoped TypeScript core gate — 2026-10-13

## Why
An attached historic TypeScript diagnostic reported 796 errors in 120 files, including `unknown` database transactions, missing `JsonObject`, and unsafely accessed persistence fields. Inspection of current `main` shows `ageGateEngine` and `consentEngine` already use strongly typed Firestore transactions; `db.getDb` returns Firestore, `types/strict` exports `JsonObject`, and audit export narrows unknown values. The historic log is not reliable evidence of defects remaining on the latest SHA.

## Scope and invocation

From `phase2_work` run:

```sh
npm run typecheck:core
```

This uses `tsconfig.core.json`, extending the existing strict server TypeScript options. Entry points:
- `src/server/db.ts`
- `src/server/platform/ageGateEngine.ts`
- `src/server/platform/consentEngine.ts`
- `src/server/platform/auditComplianceExport.ts`
- `src/types/strict.ts`

**Important:** TypeScript follows imports transitively. This is a **bounded entry-point graph**, not an artificial assurance that only five files can report errors. No `skipLibCheck` relaxation beyond the existing server policy, `@ts-ignore`, `any` migration, or global `tsconfig` weakening is added.

## Next sequential batches

1. **Core**: Firestore transaction typing, consent ledger and audit serialization; fix confirmed current errors using typed SDK interfaces, runtime narrowing and minimal regression tests.
2. **Boundary**: `contactEngine`, `dsaAppealEngine`, `riskEngine` and input schemas. Require `unknown` validation before property access; avoid `as unknown as T`.
3. **Routes**: `routes/chat`, `routes/launch`, `trustAndSafety`, and the Firestore deletion/transaction paths. Enforce authenticated UID, permissions and callback transaction types.
4. **Client**: UI payloads, chart events, i18n keys and network input shapes.
5. **Full gate**: `npm run typecheck` (all three projects), targeted Vitest, `npm run test:rules`, Playwright and `npm run build`; exact immutable head CI and release evidence.

Record **before/after** diagnostic count and exact commit SHA for each batch. Prioritize by *root cause and risk*, not number of compiler messages. Gate failures are not fixed by suppressions. No merge solely because scoped check passes; the full enterprise CI remains mandatory.

## Verification status
This PR introduces the targeted check but no local full dependency checkout was available here for running `tsc`. The 796 historical errors have **not** been reproduced on current `main`. Exact-head CI pending; production approval remains **NO-GO**, subject to open operational gates in Issue #8. No manually dispatched GitHub Actions runs.

## 2026-10-13 — First verified core defect: malformed audit receipt timestamp

Source inspection confirmed that `anonymizeContractRequest` called `new Date(dateInput(receipt.receivedAt)).toISOString()` without checking date validity. Historic imported Firestore documents containing malformed receipt dates could throw `RangeError: Invalid time value`, aborting a §312k anonymized export. The audit engine now checks `Number.isFinite(date.getTime())` and uses the already normalized request-received timestamp if confirmation time cannot be parsed; the receipt is never fabricated or silently marked as delivered. A targeted regression was added in `tests/complianceAuditExport.spec.ts`. This is a resilience fix based on source evidence, **not proof that the historical 796 TypeScript errors remain on main**. Exact-head CI and targeted test execution still await verification. Production NO-GO.
