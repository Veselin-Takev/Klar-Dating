# Wave 2 closure — source migration verified

33 additional files from the original 50-candidate register now use the closed tenant repository. The exact inventory is `LEGACY_ADMIN_ACCESS.json`: seven remaining infrastructure/utility candidates, 43/50 source migrations. Billing and the partner quarantine adapter were migrated as coupled integrations; they do not inflate the original 50-file denominator.

C/D/E read/write paths now share the supported tenant namespace. Native emulator tests retain deliberate root/foreign fixtures. Existing endpoint/domain tests use the real repository over SDK doubles; these adapters are test-only. Production migration flags remain OFF and no live data, IAM or provider operation was executed.

The initial 35 SAST results involved supply-chain cooldowns, workflow interpolation, process invocation, request mass assignment, HTML serialization, logging and regex construction. The 41 diagnostics came from two patch artifacts incorrectly named as TypeScript, JSX text ampersands and ambiguous import type syntax. Fixes preserve patch contents and rendered JSX text; no finding suppressions were added. Registry-selected auto rules remain mutable; pinned constructor-boundary fixtures are a separate gate. CI now runs the repository-wide auto scan with `--strict --error` and uploads its JSON evidence.

Final source `7e61fadb2614593f2a725a8c3072043e2b0e3305` passed [full CI](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42500036161): 1505 Vitest + 86 Enterprise Node + 26 Playwright = **1617 main-suite tests**. Dedicated Rules: 118 repeated PASS, excluded from addition. Typecheck, Functions/App build, production smoke and strict repository SAST passed. The 26-test local Chromium run is additional corroboration, not an extra count. `baselineFixed=false`, `productionApproved=false`. Cross-service verification-photo fencing and effective deployed IAM remain open; no production deletion certification is claimed.


## Coupled client and browser closure

The profile subscriber and live-chat message reader now use the same `tenants/default` namespace as the server. Client Rules preserve owner-only profile updates, reject protected fields and tenant-claim collisions, enforce erasure markers, and keep chat/message writes server-only. Scoped chat reads require adult participants, membership, completed gate answers and both block directions. The statutory form serializer preserves the no-JavaScript workflow, title, language-link spacing and accessible labels; escaped receipt serialization is regression-tested.

## Remaining original candidates

- `phase2_work/functions/src/firestoreRepository/nativeDatabase.ts`
- `phase2_work/server.ts`
- `phase2_work/src/server/aiBudget.ts`
- `phase2_work/src/server/durableStore.ts`
- `phase2_work/src/server/firestoreRepository/nativeDatabase.ts`
- `phase2_work/src/server/inMemoryStore.ts`
- `phase2_work/src/server/zwischenspeicher.ts`

Two entries are native infrastructure factories; their final classification is part of Wave 3. No global wrapper-adoption or production-isolation certification is claimed. The certification command deliberately continues to refuse an empty-inventory certification. Latest Vercel preview is account-rate-limited; production build and emulator smoke are verified.
