# Frontend bundle budget

`npm run build` and `npm run build:lokal` enforce [ops/bundle-budget.json](../ops/bundle-budget.json) after Vite. The same gate therefore runs in PR CI, release verification and the production container build. `npm run check:bundle` can recheck an existing build without rebuilding it.

## What is measured

The checker reads Vite's generated `.vite/manifest.json`, follows static imports from `index.html`, and counts each initial JavaScript or CSS asset once. Dynamic imports count toward the total/largest JavaScript budgets, not the static entry budget. It measures real file bytes and gzip bytes using Node's default gzip compression. Missing manifests, missing referenced chunks, invalid limits and files escaping the build directory fail rather than produce a zero-byte success.

| Metric | Limit, bytes | Purpose |
|---|---:|---|
| Initial static JavaScript, gzip | 470,000 | Limit entry transfer growth |
| Initial static CSS, gzip | 29,000 | Limit entry stylesheet growth |
| All emitted JavaScript, gzip | 1,280,000 | Prevent growth hidden behind lazy loading |
| Largest JavaScript chunk, gzip | 240,000 | Bound a single chunk's transfer |
| Largest JavaScript chunk, uncompressed | 960,000 | Bound compressed-but-large parse/compile inputs |

The initial ceilings are approximately 10–12% above the measured 22 September candidate, rounded for reproducibility. The local baseline with manifest output measured 423,392 initial JavaScript gzip bytes, 25,851 initial CSS gzip bytes, 1,156,935 total JavaScript gzip bytes and 871,147 bytes for the largest raw chunk. The successful preceding Node 22 CI build showed the same scale: about 503 kB index, 871 kB Firebase and 568 kB Dashboard. Small build/runtime differences are expected; the CI report is the candidate's authoritative measurement.

## Evidence and changes

The checker writes `dist/bundle-report.json` with per-asset sizes, initial dependencies, limits and pass/fail results. CI uploads it as the `bundle-budget` artifact for 14 days, including a measured budget failure. Releases preserve it with the SBOM and checksums. It contains build metadata, not user traffic or application payloads.

Keep the limits fixed during ordinary feature changes. If a regression is intentional, explain the user value, alternatives, measured increase and owner in the PR before changing the budget. A smaller baseline should lead to a tighter budget when the reduction is stable. Frontend maintainers review exceptions as part of normal independent code review.

These are regression limits, not performance targets or evidence of WCAG conformance. Browser preloading, runtime imports, images/fonts, network and device CPU affect real page performance. Measure route-level transfer, LCP/INP and user tasks on representative devices separately. Backend cold starts, Firestore operations, external-provider cost and cost per successful transaction remain part of the operational load/TCO gate.
