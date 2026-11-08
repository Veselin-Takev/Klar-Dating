# Gate 0 — v0.1.1-rc1

Status: BLOCKED / RED. baselineFixed=false; productionApproved=false.

## Inventory and scope

The complete tracked-file inventory at `4a3acd90adfa6e781ce92990589fe01585c4b1e5`
is in BASELINE_INVENTORY.json: 1,315 files hashed, 248 test filenames,
202 explicit TypeScript AST AnyKeyword nodes (198 in phase2_work),
16 identical code/config content groups. Zero TODO/FIXME/HACK lines were
found in the scanned code/config extensions. This does not prove absence of
unfinished behavior, dead paths, orphaned mocks or implicit any.
Reproduce using TypeScript 5.8.2 and:
`node phase2_work/scripts/audit-baseline-inventory.mjs /tmp/inventory.json`.
The optional KLAR_AUDIT_TYPESCRIPT variable accepts an isolated TypeScript module path.

## Architecture and confirmed contradictions

- Active GitHub CI is rooted at .github/workflows; application commands run
  in phase2_work. Root copies of config/manifests retain historical context.
  Their presence is not evidence that both trees are tested.
- Express server.ts mounts public webhook/internal signed routes before
  authenticated API boundaries. Account age/preferences use Zod safeParse.
  Thirteen source files import Zod; that is not universal input validation.
- Firebase Functions use Admin SDK and bypass client rules. Verification-photo
  deletion is contained by the RC source veto; distributed fencing remains open.
- Storage /profiles reads require signedIn only, and /verification writes use
  UID ownership without a tenant namespace. Complete tenant isolation cannot
  be certified from these predicates; changing discoverability needs the
  approved product/privacy policy and adversarial tenant tests.
- Strict TypeScript is enabled but permits explicit any. The requested
  Zero-any condition fails, especially in test doubles and Enterprise suites.
- Root/application RELEASE_MANIFEST.json contain historical candidate evidence.
  Both now carry the same current gate0 record; historical provenance remains
  explicitly historical, not a current PASS.

## Implemented consolidation

Three identical DateHistoryEntry interfaces in DataExportWidget,
DateRatingChartWidget and DateSuccessTrendWidget now import one shared type.
Other similarly named interfaces differ in fields and have not been falsely
merged. Type-only extraction changes no render, hook or storage behavior.

All 19 tests/enterprise/*.spec.ts files use node:test. Vitest excludes them,
and the previous separate command selected only platform.spec.ts; CI did not
invoke that command. The Enterprise command now selects all 19 and CI runs it.
The test-separation gate rejects loss of the command or CI invocation.

## Verification boundaries and remaining work

Full CI for the changed code is required. Earlier RC run 42471258530 failed
2 tests with a listener startup/teardown race; the selected RC base already
contains the readiness fix. No prior branch's 1,539-test count is inherited.
Counts for Vitest, Node tests and Playwright must be reported separately;
repeated launch tests are not additional unique tests.

Gate 0 remains open until all tests (including separately configured Rules
and diagnostics), explicit/implicit any, runtime schemas, dead-code review,
external writers and cross-tenant authorization are covered. Static inventory
and a green CI alone cannot establish those properties. No new features,
merge, RC tag or production activation is authorized by this audit report.

Three explicit any escapes in non-test src code were also removed: analytics now uses the declared Firestore return type, checklist authentication accepts Express Request, and the checklist UI passes its already compatible key directly. Test/config any nodes remain open.
