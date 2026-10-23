# ADR — CODEOWNERS static policy must reject unsupported GitHub override patterns (2026-10-19)

**Status:** Proposed on Draft PR #119 only. **Production:** NO-GO.

## Security finding (AI semantic code review)

The previous `scripts/check-codeowners.mjs` implements only literal repository-root patterns, a trailing slash directory prefix and the default `*`. GitHub CODEOWNERS supports globs and unanchored patterns, and **the last matching line wins**. Appending `/phase2_work/** @klar/engineering`, `** @klar/engineering`, `/phase2_work/src/server/*.ts @klar/engineering` or `authorization.ts @klar/engineering` would replace a specialist code owner in GitHub while the old local parser incorrectly returned zero failures. The real reproduction demonstrated four such cases accepted by the old checker despite existing six green tests. A semantic AI reviewer also found that directory patterns **without** a trailing slash must match descendants, and that a file-specific engineering owner does not substitute a repository-wide default.

## Correction and tests

1. The static checker now denies all unanchored patterns and any unsupported wildcard syntax (`*`, `?`, brackets, backslash) except the sole `*` default. A future more expressive policy requires a dedicated GitHub-compatible parser and a reviewed ADR before introduction; unsupported patterns are never silently treated as safe.
2. Exact anchored directory patterns match their own directory and its descendant paths with a path-segment boundary. This prevents a later `/phase2_work/src/server @other` rule overriding specialist owners without detection, while avoiding matching `serverish`.
3. Require an explicit repository-wide `* @klar/engineering` default and syntactically valid `@user` or `@org/team` reviewer identifiers. This is structural syntax verification, **not** proof the account exists or has GitHub write permissions.
4. The local Node regression suite now covers 24 cases including four original accepted wildcard bypasses, other glob/unanchored variants, missing global default, invalid team name, directory without trailing slash, owner overriding order, comments, safe prefix boundary and invalid path inputs. Full test command: `npm run check:codeowners`. A separate semantic AI review of checker and complete tests reported PASS within this constrained source scope. This is not a claim of an independent human security approval.
5. Preserve existing `check:enterprise` linkage without adding queue/Redis/logging packages purely to fulfill a library checklist. The actual `package.json` contains `zod@4.6.5`; the root app does **not** declare `pino`, `ioredis` or `bullmq` in dependencies. Any such infrastructure addition needs an ADR, actual requirement and full SCA/test gates.

## Mandatory AI review & evidence limits

- **Semantic AI source review:** PASS for the two changed executable files only, following two review-and-correction rounds; it covered injection, privilege boundaries, missing fail-closed paths, performance, maintainability and error handling.
- **Static lint command:** `npx --no-install eslint . --max-warnings=0` returned a nonzero exit in the isolated source ZIP because dependencies/CLI resolution were unavailable. Therefore **the overall mandatory AI-Code-Review is NOT PASS**. Do not record a global AI PASS or release GO.
- **GitHub integration:** `@klar/security`, `@klar/finance`, `@klar/engineering` are inherited role identifiers in a personal-user-owned repository; live teams, write permissions, CODEOWNERS parse errors, base-branch enforcement and independent reviews are **not verified**. GitHub's official documentation requires visible teams with repository write access and evaluates CODEOWNERS on the PR base branch.
- **Non-goals:** No Firestore TTL changes, schema/index migration, production-cloud operations, queue/Redis changes or deployment; full Firestore Rules Emulator, supply-chain, Playwright and TypeScript tests still require the full pinned toolchain.

## Rollback / N-1

No persisted schema, Firestore rules, API models, token semantics or migrations changed; N-1 application data compatibility remains intact. The code-review-policy contract is intentionally more restrictive: unsupported glob patterns cause a static gate failure until separately reviewed. Rolling back this guard would reopen the reproduced reviewer-bypass issue and requires independent Security approval. Live Cloud TTL deletions are not undone by reverting Git commits.

References: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners .
