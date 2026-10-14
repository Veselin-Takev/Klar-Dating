# Local Firebase ADC preflight — 2026-10-13

## Incident and root cause
Running `node --import=tsx server.ts` outside Firebase emulators with no Google Application Default Credentials can raise `Could not load the default credentials`. Project selection in `src/server/firebaseRuntime.ts` does not authenticate the Admin SDK. Firestore's credential discovery can also emit metadata lookup warnings before failing. Disabling security or enabling a production durable fallback is **not** a remediation.

## Development (no production credentials)
1. Use Node 22.23.3 and install dependencies with the checked-in lockfile.
2. From `phase2_work`, start the emulators using `npm run dev:lokal`. This command uses project `demo-klar` and Auth, Firestore and Storage emulators.
3. Use `npm run check:local-firebase-adc` to check emulator variables or local ADC presence before starting a server manually.
4. Never run local UI against live Firestore unintentionally. Do not put service account JSON in the repository or logs.

## Authorized Google Cloud environment
Use workload identity / attached service identity in Cloud Run. For approved local administration only, `gcloud auth application-default login` can install user-based ADC. The preflight checks *only whether a local ADC file path exists*; this is not proof of validity, permission scope, project access, successful Firestore connection or release readiness. It never prints tokens or reads key payloads. If `GOOGLE_APPLICATION_CREDENTIALS` is provided, the preflight checks for an existing absolute path, not file validity.

## Verification and limitations
`npm run test:local-firebase-adc` (currently `node --test scripts/localFirebaseAdc-check.mjs`) exercises the deterministic pure preflight. `npm run check:local-firebase-adc` inspects the *current process* environment. Emulator configuration loaded only by `firebase emulators:exec` is deliberately not inferred by a separate shell preflight invocation. To test the emulator configuration directly, run that check inside the emulator command. A preflight PASS does not replace integration tests.

## Release status
Issue #8 stays **NO-GO** until evidence from actual production controls, exact-SHA CI, rotation, alert delivery, canary/rollback and accountable human approval is recorded. This local developer-experience change neither authorizes production secrets nor certifies Cloud Run.

## CI regression correction (2026-10-14)

The Node built-in `node:test` regression suite is located at `scripts/localFirebaseAdc-check.mjs`, not in `tests/`. Vitest's CI discovery collected the previous `tests/localFirebaseAdc.spec.mjs` file and attempted to bundle the `node:test` builtin, failing suite initialization in Actions run [38462426972](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38462426972). Run `npm run test:local-firebase-adc` to execute the six Node tests independently; standard Vitest CI remains free to discover only Vitest suites. No emulator bypass or ADC credential fallback was introduced. **Production NO-GO**.
