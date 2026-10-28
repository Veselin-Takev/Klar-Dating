# A-03 OSV dependency triage — 2026-10-28

**DRAFT / BLOCKED / Production NO-GO.** This evidence is not a waiver or independent security approval.

## Exact provenance

- Base PR #167 head: `80da116410ab700ab9c0e86c4b46f840fe488575`.
- Enterprise CI run [40654067080](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40654067080): completed SUCCESS, associated with that head; pull-request merge-ref checkout is not equivalent to proving the head tree was tested.
- Dependency scan [40654066786](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40654066786): completed FAILURE due to actionable findings. Artifact `12800058883`, `klar-dependency-findings`, expiring 2026-11-04.
- Scanner reported **1,439 unique npm version coordinates; 13 affected versions and 25 distinct advisory IDs** after the sharp 0.35.4 → 0.35.5 fix. Do not infer scan PASS from Enterprise CI PASS.
- Artifact SHA-256: `4d2bd10064f304a9e72ad5054d3e8e65f4104425ddcb7a140f0549995599916e`.
- Root and app `bun.lock` SHA-256: `ec856e6672fe0ac69b049d4e70367e1574d3c915426f12938f0e9223d3da1fd6` (identical).
- Functions `package-lock.json` SHA-256: `e14340c72a565280d130f4f92cb736bafb2659b8c6122eec5f0a27faf3197292`.

## Priority remediation

1. For `undici` (multiple affected versions), `@modelcontextprotocol/sdk`, `hono`, `js-yaml`, `smol-toml`, `deepmerge` and remaining affected coordinates, record exact parent dependency chains, whether reachable in production, fixed-version availability, and package owner. Never blanket-ignore or assume transitive packages are unreachable.
2. Upgrade one bounded dependency family at a time; regenerate and compare Bun lockfiles with the pinned toolchain, and regenerate Functions npm lockfile if changed. No manual integrity edits.
3. Run full enterprise CI, actual emulator/integration tests and fail-closed OSV scanner on the **new exact commit**. Verify checkout tree and no skipped mandatory steps.
4. Independently review Security, DPO/Privacy, Legal, SRE/Ops and Release approval. Retain P0 blocks for TTL ACTIVE on 20 groups, legal holds, GCS generation races, Didit deletion, 14 mandatory gates and 13 integration evidences.

## Governance

This is an evidence-only documentation change, not a remediation of vulnerable packages. PR #119 is locked and must not be touched. No merge, production deployment, Cloud/TTL mutation, or production GO without independent evidence. `RELEASE_MANIFEST.json` stays `NO-GO` and `productionApproved=false`.
