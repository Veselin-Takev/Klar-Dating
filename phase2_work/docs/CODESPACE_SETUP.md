# Klar Enterprise Codespaces — pinned local validation setup

## Scope and provenance

This setup adapts only the useful runtime/Firebase prerequisites from `Klar_Node_Firebase_Fix_2026-10-05.zip`. The earlier patch's npm root lockfile and Node 22.23.0 policy are **not** applied. Current application dependencies are installed from `phase2_work/bun.lock` with **Bun 1.4.4**, Cloud Functions from `phase2_work/functions/package-lock.json` using `npm ci`, and Node is pinned to **22.23.3**. Java **21** runs Firebase emulators.

The GitHub Codespaces devcontainer runs `bash phase2_work/scripts/setup-codespace.sh` after creation. This script loads nvm if necessary, installs exact Node 22.23.3 and Bun 1.4.4, checks Java 21, verifies lockfiles, installs both dependency graphs without modifying the lockfiles, and checks the local Firebase CLI. It fails immediately if prerequisites are unavailable.

## In a new Codespace

Open a fresh Codespace with the checked-out development branch, or rebuild the devcontainer after updating its configuration. Run in the repository root if post-create setup did not finish:

```bash
bash phase2_work/scripts/setup-codespace.sh
```

**Requirements:** outgoing access to nvm's Node downloads, the npm registry, Bun's platform package, and package registries; permissions for the nvm-scoped global npm prefix; Java 21 feature installed by devcontainer; Node/Bun/Java versions must be checked by the script. This configuration has **not** been executed in a real Codespace from the current assistant environment.

After setup, check out a **separately approved exact full SHA** in a clean checkout, then run:

```bash
cd phase2_work
export KLAR_EXPECTED_SHA='<approved-full-40-character-commit-sha>'
bun run verify:local
```

The local preflight also requires compatible Firestore/Auth/Storage emulator prerequisites and Playwright system libraries; it installs its Chromium browser binary. A report is written once outside the checkout. Preserve that report with its SHA, toolchain identity, test outcomes, and independent reviewer. **Do not use a placeholder or merely derive the expected SHA from an unchecked local checkout for an official signoff.**

## Release constraints

This setup is a developer-environment provisioning change **on the development branch only**. It is not present in the frozen R2 candidate `286a991e776885199bb1028d380e239821de88ac`. The script and its installer commands require validation in an actual network-enabled Codespace; a successful shell syntax check alone is not a runtime acceptance test. Before issuing a new candidate, run the complete pinned-toolchain suite. GitHub Actions spending remains constrained to the user's **100 additional minutes** cap. Real production IAM, alert delivery, secret rotation, observability, privacy controls, canary and rollback, and accountable human approval in issue #8 are still required. **Production NO-GO.**
