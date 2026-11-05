# Klar v149 – Repository Integrity & Documentation Preservation

**Audit date:** 2026-11-05. **Scope:** read-only GitHub verification of reachable Git history, v149, frozen R2 and dedicated governance branch. **Release:** NO-GO; `productionApproved=false`.

## Immutable baseline pointers

| Reference | SHA | Tracked blobs |
| --- | --- | ---: |
| v149 consolidation (`security/v149-autonomous-consolidation`) | `0042bbff95e2092c804407fd8559aa6d8e3d37ed` | 1,034 |
| Frozen RC R2 candidate | `286a991e776885199bb1028d380e239821de88ac` | 1,070 |
| Protected `main` | `96c3857c53f5ced31fe1394895185f42c75bc716` | 1,311 |
| Dedicated documentation branch baseline | `e7907d494d9fa3e2383110893182dc252cd8c18a` | 1,175 |

All v149 (1,034) and R2 (1,070) file **paths** were present at the verified main commit. This does not imply unchanged file bytes. Git preserves reachable historical blob versions.

## Governance document SHA and branch-only evidence

`phase2_work/docs/P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md` exists on this dedicated documentation branch at original Git blob SHA `f82ea61e5baf2516000916baba2d53478c675bef` (size 32,796 bytes). It is deliberately absent from main. This is **not** lost: the file remains recoverable on the documentation ref. The complete tree comparison found 15 governance documents on the dedicated branch absent from main, while no v149 baseline path was absent from this dedicated branch.

The dedicated branch baseline contains 155 `phase2_work/docs/` files and 221 `phase2_work/scripts/` files. These are committed Git-tree counts, not an inspection of local developer working directories. Future changes to documentation and scripts must be reviewed against the fixed baseline and must not silently remove or rewrite evidence.

## Git history integrity evidence

[Read-only full-history GitHub Action #3](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42117812311) verified 18,939 reachable Git objects, 0 missing, a clean `git fsck`, and 1,694 distinct historical paths. 383 historical paths were absent from the `main` tip, including 10 found only in historical commits but still recoverable. No Git tags were present in the audited fetched refs.

Machine-readable JSON and Markdown inventories: [Evidence artifact](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42117812311/artifacts/13458075150). Retain independent evidence before the GitHub Actions artifact expires.

An added [PR #326 provenance guard](https://github.com/Veselin-Takev/Klar-Dating/pull/326) checks the exact v149/R2 file-path sets against main and the P0 evidence Git blob against the dedicated documentation ref. It also compares baseline documentation/script paths against the latest documentation branch, without overwriting them. Review the exact SHA CI result before treating this additional control as verified.

## Known external provenance limits

Both `Klar_Enterprise_Final_15.09.2026.SHA256SUMS` files reference **the same** `/mnt/data/Klar_Enterprise_Final_15.09.2026.zip` with expected SHA-256 `36b2a3ac3953cecc0bbfecbf7ca7f7cc2dd0e39f118820a51591bcce97725aac`. This archive is not found among the still-reachable Git-tracked files; its external recovery and checksum remain open in Linear VES-10. The first reachable Git root is dated 2026-10-06, so pre-Git, ignored, force-push-unreachable and uncommitted local assets cannot be certified from GitHub.

## Open release gates

1. Independent owner classification of the 15 documentation-branch-only files and the 10 historical-only paths. Preserve historical evidence; never force-push or prune refs automatically.
2. Evidence artifact durable archiving; validate immutable hashes and owner attestations.
3. Original ZIP proof (VES-10), independent AppSec/SRE/release owner review, full GitHub CI for the final PR #326 SHA.
4. P0 VES-5 Firestore/GCS All-Writer-Fencing remains unresolved: no production purge activation, no merge of security Draft PR chain; `productionApproved=false`.

**Conclusion:** Reachable Git history and the original v149/R2 file paths are intact. Full existence of every asset since development inception is **not proven** without external records.
