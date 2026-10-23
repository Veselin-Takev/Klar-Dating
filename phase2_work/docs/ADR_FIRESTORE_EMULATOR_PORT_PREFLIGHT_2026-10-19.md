# ADR — Emulator test port profiles and fail-closed local bootstrap (2026-10-19)

**Status:** Proposed / Draft feature branch only. **Release decision: NO-GO.**

## Context and verified defect

The older `scripts/check-emulator-ports.mjs` probed a fixed set of ports 3000/4000/4400/4500/5001/8080/9099/9199/9150. The isolated Rules/Art.17 profile in `firebase.pruefung.json` actually configures **8085 (Firestore), 4405 (hub), 4505 (logging)**. Consequently, the old preflight could report success while an actual Rules/Art.17 emulator port was already occupied. In addition, the Rules bootstrap instructed operators to `npm ci`, contradicting the enforced root **Bun-only `bun.lock`** policy.

## Decision

1. A pure `portsFromEmulatorConfiguration()` reads precisely the approved `firebase.json` or `firebase.pruefung.json` profile. Active explicit ports must be valid, unique integers from 1 through 65535; missing Firestore port, duplicate ports and unknown profile paths are rejected. Disabled UI ports are excluded.
2. The default CI/app-emulator profile also checks port 3000 for the local web server. No running process is ever killed.
3. Every Rules and partner-Art.17 emulator test invocation checks ports from `firebase.pruefung.json` **before** `firebase emulators:exec` starts. Existing Node/Java/Firebase CLI preflight remains mandatory; an invalid production environment or `KLAR_ALLOW_DURABLE_DB_FALLBACK=true` is rejected. Bootstrap guidance is `bun ci`, never an unauthorized root npm lockfile.
4. Eight deterministic Node tests cover both profiles, disabled services, duplicate or invalid port, occupied loopback socket, traversal/profile rejection, production/fallback refusal, and Bun lockfile/command contracts. These are mandatory under `check:enterprise` through `check:emulator-profile`.

## Non-goals and limits

An isolated Java21/Firestore Emulator 1.20.2 process was started with **actual** `firestore.rules` and the demo-only project; however, the constrained sandbox crashed before integration assertions executed. No test result for Rules authorization or Art.17 Firestore transaction concurrency is claimed. The true SDK test suite needs Node 22.23.3, Java 21+, `bun ci` dependencies and sufficient persistent RAM/disk; the Firebase Rules SDK must test authenticated and unauthenticated access. Real staging TTL policy state and GitHub runner provisioning cannot be proven from a source checkout.

## Runner classification (separate operational control)

A historical [automatic CI job](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/39233636752/job/117997339276) used **`ubuntu-latest`**, had **`runner_id=0`**, **no steps** and failure conclusion; the repository currently exposes **zero Actions repository variables**, so `KLAR_CI_RUNNER` is not overriding `runs-on`. This is a runner-allocation/Billing/Actions service investigation, not a failed application test and not a demonstrated YAML label mistake. Do not change runner labels or rerun billed Actions without administrator evidence and authorization.

## Rollback / N-1 and isolation

No Firestore schema, collection, TTL policy, index, data or network-side operation is changed by this patch. Old client/backend data contracts remain N-1 compatible. Reverting only the new preflight after an approved code review changes CLI test startup checks; it does not revert cloud resources or delete documents. Prefer fixing a failed port conflict by stopping only the owning local test instance, never force-killing unrelated processes. Live TTL activation/deactivation requires a separately approved change and real state evidence.

References: https://firebase.google.com/docs/firestore/security/test-rules-emulator ; https://firebase.google.com/docs/firestore/ttl ; https://docs.github.com/en/actions/how-tos/troubleshoot-workflows .
