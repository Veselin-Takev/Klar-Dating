# Enterprise GO Claim Audit — 2026-10-19

## Decision

**NO-GO, 15 open GitHub issues, P0/P1 partial, no official production approval.** Current PR119 base at the audit outset: `45d3e95c435101a746e3b4cf80934290d45b8a94`, Draft and unmerged. The externally provided GO PDF has **no verifiable release provenance, no actual CI job attestation, no Firestore emulator result log and no independent governance signoffs**. The PDF's own release SHA `9e886c67c97201602cd969fc57dfc9bf2d019c90` does not establish that all its statements were executed or merged. It is a proposal, not a trusted test log.

## Five-cycle implementation and evidence matrix (targeted iteration)

1. **Analysis/Threat model:** Verified GitHub PR/issue state, read PDF, checked release.yml invocation, current NO-GO manifest and Go-Live checklist, and official Firebase documentation on non-recursive deletions and TTL. Identified an actual env-only production release gate bypass.
2. **Atomic correction:** New pure `release-go-evidence.mjs` checks explicit final release manifest, 14 gate receipts and 13 integration receipts for the exact release SHA plus 4 independent signoffs and zero High/Critical advisories; CLI checker loads repository artifacts fail-closed. `check:enterprise` and release workflow source guards now test it. All code stays on Draft branch.
3. **Gates:** Focused synthetic positive/negative release-guard tests pass under pinned Node22.23.3. The real NO-GO manifest is *expected* to fail the production-release-approval command, even if an environment variable claims approval. The full 14-gate sequence, Firestore SDK/Rules tests, full E2E/browser, Gitleaks, Semgrep and Bun/Functions scans must still pass on the immutable final commit. Root `npm audit` without npm lock reports ENOLOCK under enforced Bun-only policy; it is not a clean supply-chain scan.
4. **Fail and retry:** Hard stop at three local iterations; do not start GitHub Actions manually or modify production settings. No silent state changes or fabricated PASS.
5. **Docs/Governance:** This evidence register, updated GO checklist, status, runbook, release manifest, ADR and N-1 rollback are synchronized. No `GO` and no merged code.

## Outstanding P0/P1

- **P0 #70:** 20-group TTL read-only/mock validators are present; independent live staging all-ACTIVE configuration, legal holds, deletion inventory and DPO/Legal/SRE approvals are absent.
- **P0 #55/#56:** Provider-independent partner buyer proof and genuine concurrent Firestore Art.17 deletion/integrity evidence incomplete. Parent delete alone leaves child documents.
- **CI platform:** Historical `ubuntu-latest` job had runner_id=0/0 steps; GitHub repository Actions variables list empty, so no custom override. Actual billing or platform allocation root cause unresolved.
- **Supply chain:** Prior root Bun scan found Critical/High advisories, and full CI dependency installation, npm Functions audit, Gitleaks, Semgrep, TypeScript, Vitest, Playwright and build are not currently independently signed off.
- **EU AI Act / GDPR:** Source PII-sanitizer boundary exists, but formal Articles 5/50, Art.9 applicability and meaningful human review cannot be established by checklist text alone.

## Required GO evidence and rollback

See `docs/ADR_RELEASE_GO_EVIDENCE_2026-10-19.md`. The positive validator result tests receipt schema only. Independently verify the linked actual workflow runs, artifact hashes, staging read-only TTL capture, Cloud/SDK emulator logs, protected environment approval, package advisories, registry provenance and legal signoffs. No Firestore data/index migration. Release-gate-only backward compatibility intentionally fails closed for older unaudited manifests. **NO-GO** until separately approved.


### 2026-10-19 — Reproduzierbare Release-Guard-Validierung, weiterhin NO-GO

Unter SHA-256-verifiziertem Node v22.23.3 wurden **45** fail-closed Release-Evidenztests und die Release-Workflow-Quellprüfung erfolgreich ausgeführt. Das reale `check-production-release-approval.mjs` verweigert bei gesetztem Test-Flag `KLAR_PRODUCTION_RELEASE_APPROVED=true` weiterhin die Produktion, solange das GitHub-Manifest NO-GO und fehlende echte Gate-Evidenz meldet. Dies ist das **korrekte erwartete Scheitern**, nicht eine fehlgeschlagene Regression. Der vollständige 14-Gate-Testdurchlauf meldete **5 PASS / 9 FAIL oder blockiert**: Enterprise/TypeScript-Modul fehlt; Root-npm-audit=ENOLOCK wegen Bun-only; Gitleaks/Semgrep fehlen; tsc/Vitest/firebase-tools/Playwright/Vite nicht vorhanden. **Kein GO, keine geschlossene Issue-Liste, keine unabhängigen Legal/DPO/Security/SRE-Signoffs.**

Der unveränderte `bun.lock` darf nicht durch `npm ci` oder ein neues npm-Lockfile umgangen werden. Umfassende Sicherheits- und Integrationsbelege bleiben Pflicht. Weitere Details in `docs/GO_CLAIM_AUDIT_2026-10-19.md`.
