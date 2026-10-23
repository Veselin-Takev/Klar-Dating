# ADR — GO checklist must not silently ignore unchecked task markers (2026-10-19)

**Status:** Proposed, unmerged feature branch. **Production Release:** NO-GO.

## Threat model and confirmed source gap

`release-go-evidence.mjs` previously tested `GO_LIVE_CHECKLIST.md` only with a single pattern `^\s*-\s*\[\s\]`. This **did not detect** an empty/title-only checklist, GitHub Flavored Markdown task-list markers using `* [ ]` or `+ [ ]`, numbered task lists such as `1. [ ]`, and whitespace-extended tasks such as `- [  ]`. Given an otherwise synthetically complete set of GO attestation fields, these unchecked tasks could be silently ignored by this independent production release check. This does not prove that the other release gates or protected GitHub environment were bypassed; it is an independently confirmed weakness in the checklist boundary.

Official source: https://github.github.com/gfm/#task-list-items-extension .

## Decision and isolation

1. Require a **nonempty list of parsed checklist tasks**. Any missing, unchecked or malformed task marker results in a release error.
2. Recognize unordered Markdown bullet markers (`-`, `*`, `+`) and numeric ordered markers (`1.`, `2)`), including nested indentation and multiple whitespace characters. Only exact `[x]` and `[X]` task states qualify as checked; all other states fail closed.
3. Preserve the existing 14 commit-bound mandatory gate receipts, 13 integration/compliance receipts, zero High/Critical SCA, Release Manifest GO, and four independent Security/DPO/Legal/SRE signoffs. The source-only synthetic PASS fixture tests this schema and **cannot authenticate** a linked run, artifact provenance, digital signature, reviewer or real cloud evidence.
4. Extend `test-release-go-evidence.mjs` with **10 new negative fixtures**, including empty/title-only checklists, list-marker variants, numbered list markers, malformed state, and mixed complete/incomplete tasks. Total offline Node release structural regressions: **55 PASS** under SHA-256-verified Node v22.23.3 on the patch workspace.

## Risk / limitations

This validation scans task-list syntax, not the meaning or truthfulness of text. An attacker who has write access to the manifest and release checklist can still fabricate a plausible-looking checked task; this must be prevented by GitHub protected branches, independent CODEOWNERS, immutable CI provenance and review of actual linked evidence. The repository remains owned by a personal GitHub User while `@klar/...` CODEOWNERS team permissions are unverified (Issue #73). Real Firestore Emulator tests, live TTL ACTIVE evidence and formal release approvals remain pending. This is not an authorization to publish containers or deploy.

## Rollback and N-1 compatibility

No Firestore schema, index, TTL policy, data, storage objects, API payloads or OAuth session handling change. Application and Firestore N-1 are backward-compatible. The **release-control format** intentionally becomes stricter: previous empty/ambiguous checklists are denied until completed. Rollback would reopen a confirmed checklist-validation gap; require an extraordinary independent security approval and a new negative-test proof before considering any rollback. Existing cloud TTL deletions are not reversible through code rollback.

**Current decision: NO-GO.**
