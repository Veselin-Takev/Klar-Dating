# Firestore emulator prerequisites — 2026-10-13

The historic `Klar_Node_Firebase_Fix_2026-10-05` ZIP targets **another repository** (`veselin8606-source/Klar-App`), and pins Node 22.23.0. Do not apply its patch, lockfile, devcontainer or package files to `Veselin-Takev/Klar-Dating`: this project pins Node **22.23.3** in `.nvmrc`, CI and Docker.

## Adapted improvement
The local Firestore rules commands (`npm run test:rules`, `npm run test:rules-diagnose`, `npm run test:rules-sprache`) now run a preflight checking Node 22.23.3+, locally installed `firebase-tools`, and Java 21+. A failure terminates before attempting to spawn the emulator, with an actionable diagnostic.

From `phase2_work`:

```sh
nvm use
node -v
npm ci
java -version
npm run test:rules
```

Prefer `npm ci` only when enough memory is available; never overwrite working-tree modifications or regenerate the lockfile to treat memory-exhaustion failures. The existing Firebase CLI pin and lockfile are unchanged by this fix.

## Limitations / release
The archived ZIP reports rule-test success on Node 24.19.0 for its *own* original repository, **not** evidence for Klar-Dating or the pinned Node 22.23.3 runtime. The preflight script only checks prerequisites; it does not validate credentials, Firestore authorization semantics, rule correctness, or the whole release. Run rule/emulator tests and complete CI on the exact PR head. The user's Codespace `security/v149-autonomous-consolidation` is not modified. Go-live Issue #8 remains **NO-GO**.

## CI follow-up (2026-10-13)
GitHub CI exposed a test-runner integration issue: `node:test` in a `tests/*.test.mjs` file is discovered by Vitest and fails Vite bundling. The regression suite on this branch now imports `test` and `expect` from `vitest`. Validate via `npx vitest run tests/firebaseRulesPreflightPolicy.test.mjs` and run the full CI suite at the new head SHA. Earlier CI results do not apply to this updated commit.
