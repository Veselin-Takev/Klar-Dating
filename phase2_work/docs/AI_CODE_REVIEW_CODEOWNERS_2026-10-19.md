# Required AI Code Review — scope and evidence (2026-10-19)

**Production decision: NO-GO. Global AI-Code-Review: NOT PASS (ESLint prerequisite missing).**

## Files examined

- `scripts/check-codeowners.mjs`: effective GitHub review owner resolution for active app paths, unanchored/glob and directory-pattern precedence, invalid team rule handling, error behavior and performance.
- `scripts/test-codeowners.mjs`: all 24 regression tests for the above invariants.
- `CODEOWNERS`: actual role strings and path contract inspected (no change to role accounts).
- Documentation, Go-Live checklist and release manifest: reviewed only for consistency and fail-closed NO-GO; an independent legal review is not claimed.

## Semantic reviewer findings / remediation

**Initial independent reviewer verdict: FAIL**, finding a real directory-prefix-without-slash bypass and unverified team roles. After fixing the directory/prefix parser, a second review found a missing global default and overly permissive team identifiers; these were corrected. An earlier review of a truncated test-file excerpt reported a syntactic error; this was a truncation artifact, contradicted by actual Node test execution and not repeated on the complete file. The final bounded semantic reviewer reported **PASS for checker source and complete updated test code**, limited to static logic. Tests were also executed independently with 24/24 green locally. This is a structured AI review of specified changed files only, not a PR approval or security attestation.

## Independent automated and integration controls

- `npm run check:codeowners`: 24/24 Node tests PASS in the isolated workspace under Node 22.23.3.
- `npx --no-install eslint . --max-warnings=0`: **FAIL / not executable** due to missing local tooling; do not silently run an unpinned npx auto-install or claim lint PASS.
- Complete mandated Enterprise, TypeScript, Vitest, emulator, SAST, supply-chain, Playwright and Build gates must pass on the identical commit, plus independent Security, Finance, Legal, DPO and SRE governance approval. A syntactically valid CODEOWNERS role is not proof of actual write access or enforced review routing.
- Libraries: `zod@4.6.5` declared; `pino`, `ioredis`, `bullmq` absent from root declaration. Do not add dependencies without a justified architecture decision, locked provenance and passing dependency scans.

## Review decision

**Semantic source-only AI review: PASS.** **Mandatory combined AI-Code-Review: NOT PASS.** **Production GO: NOT AUTHORIZED.**
