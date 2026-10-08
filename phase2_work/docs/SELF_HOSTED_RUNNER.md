# Self-hosted GitHub Actions runner

Klar can route repository CI to a dedicated self-hosted runner without changing check names or weakening workflow steps.

## Trust model

- The repository is private, but pull-request jobs still execute repository code. Treat the CI runner as disposable infrastructure.
- Use a dedicated custom label such as `klar-ci`; do not reuse a workstation or a machine containing personal credentials.
- Prefer an ephemeral/JIT runner image that is destroyed after a job. If a persistent runner is used temporarily, run it in an isolated VM with no ambient cloud credentials and reset the workspace between jobs.
- Do not put production deployment credentials on the PR CI runner.
- Production release uses a separate variable and should use a separate runner/identity: `KLAR_RELEASE_RUNNER`.

## Required runner software

The CI runner must provide:

- Linux x64
- Docker with permission for the runner user to build containers
- Node.js can be installed by `actions/setup-node`
- Java can be installed by `actions/setup-java`
- enough disk for npm, Firebase emulators, Playwright Chromium and Docker build layers

`actions/setup-node`, `actions/setup-java`, `actions/checkout` and the pinned artifact actions remain part of the workflows.

## Repository routing

The workflow fallback is intentionally GitHub-hosted:

- `KLAR_CI_RUNNER` unset -> `ubuntu-latest`
- `KLAR_CI_RUNNER=klar-ci` -> jobs target a self-hosted runner carrying the custom `klar-ci` label
- `KLAR_RELEASE_RUNNER` is independent and must not point to the PR runner unless an explicit security review approves that trust boundary

Do not set `KLAR_CI_RUNNER` before at least one online repository runner advertises the exact label. Otherwise PR jobs will remain queued.

## Registration sequence

1. Provision a clean Linux VM/container host under infrastructure control.
2. Create a repository-level self-hosted/JIT runner registration in GitHub Settings > Actions > Runners.
3. Assign the custom label `klar-ci`.
4. Start the runner and verify it appears `online` and `idle`.
5. Set repository Actions variable `KLAR_CI_RUNNER` to `klar-ci`.
6. Re-run one documentation job first, then Playwright, then Enterprise CI.
7. Only after all three succeed on the same PR head should issue #76 be considered technically unblocked.

## Hardening checklist

- no SSH keys, browser profiles, personal tokens, `.npmrc` credentials, Docker registry logins or cloud service-account files baked into the image;
- runner user is non-root; Docker access is limited to the isolated VM;
- outbound network access is limited where practical;
- workspace and Docker state are removed after every job;
- OS, runner binary and Docker are patched regularly;
- runner registration tokens/configuration are treated as short-lived secrets and never committed;
- monitor runner status and disk pressure; offline/busy state must not silently replace required CI evidence.

GitHub documentation:

- https://docs.github.com/actions/hosting-your-own-runners
- https://docs.github.com/actions/security-guides/security-hardening-for-github-actions
