# VES-5: mandatory Firestore fence emulator preflight

Release status: **NO-GO**, `productionApproved=false`.

## Confirmed gap and correction

Reviewed parent #336 at `01143fdd26728a7d7591490f201897346a09c9e0`.
`verificationPurgeFirestoreFence.spec.ts` previously required an emulator only
when `KLAR_REQUIRE_FIRESTORE_EMULATOR=1`. General CI could therefore silently
skip every transaction scenario if its emulator host was missing.

The suite now rejects a missing endpoint when `CI=true` or
`GITHUB_ACTIONS=true`, before initializing Firebase. The dedicated flag still
selects `firebase.pruefung.json` (port 8085); general CI still selects
`firebase.json` (port 8080). CI enforcement must not select the dedicated port.
Local developer runs may continue skipping integration scenarios without an
emulator. Existing loopback, project, production-runtime and fallback checks
remain enforced.

Fifteen dependency-free regression cases execute the actual suite preflight,
including both profiles, missing CI endpoints, independent GitHub Actions
sentinel, remote hosts, mismatched projects, production runtime and durable
fallback. Sentinel-removal mutations demonstrate that the missing-endpoint
regression would catch either removal. The regression command is mandatory
through `check:retention-p0`, already included by `check:enterprise`.

## Validation and limits

On 2026-11-07 with Node v24.22.1:

- `npm run check:retention-p0`: PASS, including all 15 new preflight cases.
- Combined preflight/event-writer/Storage-writer regressions: 45 PASS, zero skips.
- Both writer inventory commands and dependency lock gate: PASS.
- `git diff --check`: PASS.

These checks execute no Firebase SDK, emulator transaction or GCS operation.
Full exact-commit Enterprise CI, native Firestore transaction scenarios,
typecheck and deployed control-plane evidence remain outstanding. Local Node
is not the pinned CI Node v22.23.3; do not substitute local results for CI.

## Next release gates

1. Verify full CI on this branch's exact commit and inspect that the fence
   transaction scenarios actually executed, with no skips.
2. Independently review the stacked #317 through #336 changes before integration.
3. VES-5: complete external/Admin SDK writer adoption, tenant isolation,
   account-erasure coordination, real Firestore/GCS race and crash tests,
   IAM/hold proof and AppSec/DPO/Legal/SRE/Release Owner sign-offs.
4. VES-11: approved pinned backend, authenticated preview API smoke and
   Firebase/Auth/App Check/Rules evidence. READY hosting alone is insufficient.
5. VES-8/VES-12: verify staging identity, live Scheduler/IAM/TTL inventory and
   cost controls; VES-10 requires the original external archive and hash proof.

Read-only Vercel project inspection on 2026-11-07 returned project `klar-dating`
(`prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`), Vite, Node `26.x` and latest deployment
`dpl_Dyw84HKaTpsbXpWxmQdKpiao1CRz` with `READY`, target null, project
`live=false`. This is not production approval, backend-health evidence or an
environment-variable inventory. No Vercel configuration was changed.

The private Release Desk is a status surface, not an independent sign-off.
No merge, production activation or purge approval is supplied by this change.
