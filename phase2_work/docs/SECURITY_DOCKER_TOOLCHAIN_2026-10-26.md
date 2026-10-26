# Security checkpoint: Docker toolchain consistency — 2026-10-26

**CI-Nachtrag 26.10.2026:** PR #134 ist nach vollständiger erfolgreicher [CI 40379168480](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40379168480) integriert. Getesteter Head: cfd9ed4920a64cc37069e2a6c3208373e90da101. Die untenstehenden lokalen/pending-Angaben dokumentieren den früheren Prüfzeitpunkt. Aktueller Befund-/Freigabestatus: [Auditstatus](SECURITY_AUDIT_STATUS_2026-10-26.md). Produktion bleibt **NO-GO**.


Status: 12 local regression tests and policy checks passed; exact-head full CI pending.
Production: **NO-GO**.

## SEC-07 technical correction

The active `phase2_work/Dockerfile` build stage now uses Bun 1.4.2, matching both
package-manager declarations, CI/release workflows and the root Dockerfile. The
immutable build image digest is:

`sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895`

On 2026-10-26 the Docker Registry v2 endpoint for `oven/bun:1.4.2` returned that
Docker-Content-Digest. No credential was stored or published. The existing Node
22.23.3 bookworm-slim runtime digest is unchanged. This aligns approved toolchains;
it does not claim that all dependency vulnerabilities are resolved.

The existing enterprise toolchain gate now validates both repository Dockerfiles.
It requires exactly the literal approved Bun build stage followed by the final
approved Node runtime stage, with immutable digests. Variable image indirection,
extra/missing/duplicate/reordered stages, wrong versions and missing/wrong digests
fail the gate. An intentional future toolchain upgrade must update the approved
pins and relevant repository policies together.

`node --test scripts/docker-toolchain.test.mjs`: **12 local tests passed**. They run
through `check:toolchain-policy` in the existing enterprise CI gate. The policy,
dependency-lock and whitespace checks pass locally. These are source/pin checks,
not a claim of a completed container build, image scan or deployed runtime audit.
Local verification used Node 24.22.1; full pinned CI is required before integration.

## Storage review: compatibility constraint remains open

Review of SEC-01 confirmed that active application configuration selects a named
Firestore database. Firebase documents that Storage rules can consult only the
[default Firestore database](https://firebase.google.com/docs/storage/security/rules-conditions).
A proposed direct cross-service adult check was therefore withheld before publication:
passing demo/default-database tests would not establish compatibility with this setup.
No Storage rule, IAM permission, live data or deployed service was changed by this PR.

The Storage finding remains open. Further remediation must cover a named-database
compatible authorization/delivery design, download-token behavior and revocation,
actual rules and negative tests, then isolated staging validation. No implicit database
migration, new access grant or production deployment is authorized by this checkpoint.

## Other audit and release evidence

PR #133 passed full CI 40354560343 and merged as
91b66c9985a358ec4d64ce59f8bf3f73490ce355. SEC-05 stream-limit remediation is integrated.
Remaining SEC-01/02/04/06 and actual environment evidence remain open; SEC-07 pin
drift is corrected here subject to CI, with container execution evidence separate.
Independent Security/Privacy/Finance acceptance and genuine isolated live staging /
rollback evidence remain missing. There is no separate staging project. Production
remains **NO-GO** until the protected official release process is satisfied.
