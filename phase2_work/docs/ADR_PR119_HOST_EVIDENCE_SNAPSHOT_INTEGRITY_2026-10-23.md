# ADR: Stable snapshot and hardlink boundary for PR #119 host evidence

**Date:** 2026-10-23  
**Status:** Accepted for isolated audit-tooling branch only; not an application production approval  
**Scope:** `seal-host-gate-evidence.mjs`, `verify-host-gate-evidence.mjs`, their standalone Node tests and authorized-host handoff runbook.

## Context and threat model

Technical host outputs are untrusted until checked. A SHA-256 digest of a file *before* interpreting its contents does not bind the bytes subsequently parsed: a concurrent writer may replace the pathname. Symlink-only protections do not block same-filesystem hardlinks into a quarantined results directory, which could expose unrelated sensitive host data. An empty gate log with a matching checksum and a claimed exit code 0 is insufficient evidence of a complete executed gate. Readdir enumeration and manifest publication must also use an immutable/closed evidence-directory assumption.

## Decision

1. Require `O_NOFOLLOW`, regular files, and `nlink === 1` for both readers and sealer. Verify stable device/inode, size, mtime and ctime snapshots before and after reading/hash streaming, including the final pathname identity. Reject replacement, mutation and link-count changes.
2. While parsing trusted small metadata (`gates.tsv`, runtime/checkout and exit-code files, optional approval receipts), compare SHA-256 of the *actual parsed bytes* with the sealed manifest entry, not merely a prior pathname hash. Keep the semantic-read limit at 2 MB. Hash full logs as streams without truncating them.
3. Require all 15 gate log files to be nonempty; maintain exact gate-command and exit-code policy. Sealing a failed gate still succeeds as archival evidence; screening it fails closed.
4. Before publishing a new manifest, recheck the directory entry-name set against the initial enumeration. Never overwrite an existing `SHA256SUMS`.
5. Preserve the prior two-stage governance model: independently signed provenance and all four human approvals are separate requirements, and tools must **never** auto-authorize GO or trigger a job, merge or deploy.

## Testing and limits

39/39 targeted local Node 22.16.0 regression tests PASS: 35 prior tests and four new adversarial fixtures (hardlinks in sealing and scanning, zero-byte gate logs with matching hashes, oversized semantic metadata). No true authorized host run, 15 release-qualified gates, runner signature or four independent approvals are supplied. The checks cannot prove a hostile privileged operator did not tamper with the host, that command output is genuine, or that an externally untrusted checksum comes from the asserted issuer. Release status remains **NO-GO / HARD STOP**. There is no change to application APIs, schema, dependencies, migrations or production data; N−1 application rollback is unchanged. To roll back this audit-tooling change, revert the isolated tooling commit without changing PR #119 or main.

## Alternatives considered

- **Only SHA-256 check before parsing:** rejected; has an unchecked read-use interval.
- **Ignore hardlinks because `O_NOFOLLOW` exists:** rejected; `O_NOFOLLOW` does not block hardlinks.
- **Treat self-reported SHA256SUMS and reviewer receipts as sufficient for GO:** rejected; neither proves independent provenance or signer identity.
- **Execute an unauthorized GitHub Actions audit run:** rejected; must not bypass release governance and cost authorization.
