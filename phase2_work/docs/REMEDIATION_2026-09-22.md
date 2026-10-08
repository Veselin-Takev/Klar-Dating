# Trust, chat and deployment remediation

Baseline: `b73b1bfef558a28a60b66f4dca95bad2402c124c` on main. PR 13 is merged; its final Enterprise and Playwright runs completed successfully. The follow-up review findings remain valid despite those earlier checks.

## Changes under verification

- P1-08: profile authorization comes from a server read, never legacy localStorage or a previous account. Failed reads clear authorization. Live server snapshots apply downgrades and withdrawals. Age and consent UI require a persisted record instead of synthesizing success.
- P1-09: explicit diagnostic paths share one session-consent boundary. Automatic error events remain subject to payload minimization. Browser metrics and tracing are removed from helper paths. Raw API details and persistent client error logs are not collected.
- P1-10: ambiguous root deployment files are replaced by source templates without an image. The release workflow generates both deployable manifests from its Buildx digest and inspects that exact registry reference. CI rejects reintroduced placeholders, mutable references and malformed templates. An actual production release artifact still needs operator verification.
- P1-11: chat gate failures, invalid payloads and old responses cannot open the composer. The user can retry the status check. Questions have explicit labels and failures are announced.
- Additional security finding: the message endpoint previously lacked membership, block and gate checks. It now checks them in the same Firestore transaction as persistence. Browser writes cannot set gate counters. Message retries with the same client ID are idempotent.
- Chat delivery now retains failed drafts, renders persisted messages and reloads recent history. Sending preserves the original text; it no longer automatically sends it to the translation service. The history subscription is bounded to 100 recent messages; older-history pagination remains separate work.

## Validation

Local TypeScript and targeted regression checks are being run. Emulator-backed transaction and browser journeys must pass on the candidate commit before these findings are marked closed. The final evidence record and report will be added after those checks complete.

## Release boundaries

This change is not a production deployment or a full Enterprise/WCAG approval. Manual accessibility, complete product coverage, production IAM and branch/environment controls, moderate dependency review, load/cost measurements, archive/key-rotation controls and restoration drills remain tracked in [PROJECT_STATUS.md](PROJECT_STATUS.md).
