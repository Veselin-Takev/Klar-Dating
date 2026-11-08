# RC1 security, technical compliance and end-to-end audit — 2026-11-08

**Decision: BLOCKED / production NO-GO. `productionApproved=false`.**

## Immutable scope and method

Audited source: [04e80e803ff64b4d7d51f599e5e54ad79c4033e2](https://github.com/Veselin-Takev/Klar-Dating/tree/04e80e803ff64b4d7d51f599e5e54ad79c4033e2), canonical PR [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358), targeting `release/v0.1.1-rc1`.
This is the integrated review candidate, not deployed main. The release-to-main proposal #355 still points to `4a3acd90adfa6e781ce92990589fe01585c4b1e5`.
No merge or deployment was performed. Existing baseline certification remains a narrower source/test claim, not production clearance.

Methods: targeted source/authorization review, fresh local builds and native-emulator tests, browser/API/data-flow tests, fresh locked dependency advisory queries, GitHub CI log/step verification, and review-policy inspection. Synthetic data only; project `demo-klar`, loopback endpoints. No production credentials, cloud writes, external-provider transactions, or live-data deletion were used.

Node 22.23.3, Bun 1.4.4 and Java 21.0.13 were used. Initial dependency installation/early npm scripts used environment npm 11.9.0; npm 10.9.2 was then installed for subsequent runs. App and Functions lockfiles were unchanged. Direct sandbox network and child-process restrictions were reproduced; affected checks were repeated successfully outside that sandbox. Failed initial attempts remain in the local logs rather than being silently counted as PASS.

## Confirmed findings and acceptance criteria

### A01 — HIGH: direct profile Storage reads bypass the application's age gate

[storage.rules lines 16 and 34–38](https://github.com/Veselin-Takev/Klar-Dating/blob/04e80e803ff64b4d7d51f599e5e54ad79c4033e2/phase2_work/storage.rules#L34) allow profile reads for any authenticated default-tenant identity. The rule does not consult reader/owner eligibility, account existence, blocking or deletion status.

**Reproduced:** a synthetic anonymous account and an identity whose authoritative `tenants/default/users/{uid}` record has `isAdult:false` both obtained a download URL for a different owner's known profile object. Unauthenticated and foreign-Firebase-tenant identities were denied as negative controls. This establishes access to a known object, not enumeration of unknown production paths or an actual data breach. Broad anonymous reads may also affect intended guest-preview policy; an explicit product/privacy decision is needed rather than treating authentication as adult eligibility.

**Closure:** define the permitted audience, enforce authoritative eligibility at the media boundary, and add allow/deny tests for minor/missing/deletion-pending reader and owner, plus supported guest policy. Review existing bearer download URLs and their lifecycle separately. Owner: AppSec + privacy/product + Storage maintainers. Related existing work: #204/#206; unmerged proposals do not remediate this audited SHA.

### A02 — HIGH: pending erasure does not fence direct verification uploads

[storage.rules lines 27–30](https://github.com/Veselin-Takev/Klar-Dating/blob/04e80e803ff64b4d7d51f599e5e54ad79c4033e2/phase2_work/storage.rules#L27) permit an authenticated non-guest owner to create/update verification images without reading an account-deletion tombstone.

**Reproduced:** after inserting `tenants/default/account_deletions/{owner}` with `status:pending`, the owner's synthetic Storage principal successfully uploaded a new verification image. This is a rule evaluation proof, not a claim that Firebase Auth revocation was bypassed in production: the test principal is constructed by the emulator harness. The rule itself provides no deletion fence for otherwise accepted credentials or in-flight requests.

[deleteAccountPhotos lines 61–99](https://github.com/Veselin-Takev/Klar-Dating/blob/04e80e803ff64b4d7d51f599e5e54ad79c4033e2/phase2_work/functions/src/retention.ts#L61) correctly refuses verification-photo deletion and performs a second inventory, but an inventory cannot fence later writers.

**Closure:** deny writes under authoritative deletion/hold state at every client and server writer, independently verify the all-writer protocol and token/in-flight races, and retain accurate pending/manual-review state. Keep destructive verification purge disabled until those proofs and DPO review exist. Owner: AppSec + backend/Storage + DPO. This is an unresolved existing containment boundary, not a newly introduced regression.

### A03 — HIGH advisory: vulnerable dependency remains in the production graph

Fresh `bun audit --production --json` reports [GHSA-gg6h-894w-4m9c](https://github.com/advisories/GHSA-gg6h-894w-4m9c) for `re2js@2.8.6`; reported affected range is `>=2.2.0 <2.8.7` (quadratic-time regex denial of service). `bun why re2js` confirms `firebase@12.19.0 -> @firebase/firestore@4.17.2 -> re2js@2.8.6`; [bun.lock line 2162](https://github.com/Veselin-Takev/Klar-Dating/blob/04e80e803ff64b4d7d51f599e5e54ad79c4033e2/phase2_work/bun.lock#L2162) pins that version.

The production audit has 6 advisory entries across 6 packages: 1 high, 4 moderate, 1 low. The full app graph has 35 entries across 17 packages, including 15 high entries; there are 30 unique advisory URLs, so entries must not be described as distinct vulnerabilities. Functions npm audit reports 6 moderate vulnerable packages, 0 high/critical. Advisory-query exit 1 is a finding result, not a network failure.

**Closure:** remediate the affected locked versions through reviewed dependency updates, assess actual runtime reachability and all moderate findings, then rerun production/full-graph and Functions scans plus regression tests. No remote exploit of Klar was demonstrated. The inspected active CI/release workflows do not execute an advisory audit; a lockfile-consistency check and zero Semgrep findings do not replace SCA. Owner: dependency/security maintainers.

### A04 — HIGH governance gap: independent review is not enforced

Live main ruleset `25756841` requires strict `validate`, PRs, no deletion/non-fast-forward and no bypass actors, but requires 0 approving reviews, no CODEOWNER review, no stale-review dismissal and no review-thread resolution. The #358 reviews endpoint returned an empty list. Technical ownership by the sole CODEOWNER does not establish independent AppSec/DPO/SRE approval.

**Closure:** identify independent reviewers, obtain SHA-bound approvals, and implement an explicitly reviewed protection-policy change. Do not invent reviewers or infer approval from CI. The ruleset was read only.

### A05 — MEDIUM: operative TTL evidence instructions contradict the enforced matrix

[DATA_RETENTION.md lines 83, 85, 115, 121](https://github.com/Veselin-Takev/Klar-Dating/blob/04e80e803ff64b4d7d51f599e5e54ad79c4033e2/phase2_work/docs/DATA_RETENTION.md#L83) still direct operators to verify 13 groups; provisioner and evidence validator require 20. The source gate prints that documentation aligns because it checks named group markers rather than these four operative count claims. Fresh matrix and negative tests pass despite this discrepancy.

**Closure:** reconcile those four instructions with the 20-group matrix, retain explicit independent legal/inventory approval for the seven additions, and add negative assertions for the operative claims. Inspect existing #312 before duplicating its proposed fix. No TTL policy was changed and no live policy status is inferred.

### A06 — MEDIUM evidence gap: release manifest and end-to-end scope overstate completeness if read alone

The scoped RC manifest still lists mandatory gates as NOT RUN and mentions Bun 1.4.2, while current package/CI pin 1.4.4 and current baseline evidence records successful gates. Preserve history but reconcile the current operational status.

The 26 browser tests cover age/onboarding, export of music preferences, consent withdrawal, chat persistence/authorization/blocking/recovery, public accessibility, localization and contract forms. They contain no complete browser-driven account-erasure/final-sweep/provider-deletion journey. Dedicated lower-layer account-erasure tests are valuable but do not fill that whole-system proof.

**Closure:** synchronize the current RC evidence and add an isolated synthetic end-to-end erasure/pending/recovery journey with receipts. Real provider deletion, final-sweep timing and legal exceptions require separately authorized staging evidence, not production experiments.

## Technical compliance assessment

| Control | Evidence assessed | Remaining production requirement |
|---|---|---|
| Age/access boundaries | API/browser negative paths; direct Storage proof A01 | Align media authorization with approved adult/guest policy |
| Consent and withdrawal | Browser grant/withdrawal and API gating; consent persistence tests | DPO-approved purposes/legal bases, processor contracts and production configuration |
| Access/export (Art. 15) | Onboarding browser export plus API/unit suites | Complete inventory reconciliation across providers and live storage |
| Erasure (Art. 17) | Durable jobs, pending/manual-review logic, native emulator tests, containment | A02 writer fencing; real provider receipts, retry/deadline/escalation and DPO-approved exception handling |
| Retention/storage limitation | 20-group offline policy and negative tests | A05 corrections; fresh scoped ACTIVE policies, timestamps/legal-hold inventory and independent approvals |
| Integrity/confidentiality (Art. 32) | Default-tenant denial, current-source secret scan, CI Semgrep, source IAM contracts | Effective deployed IAM/service identity, deployed Rules, credentials lifecycle, backup/restore and isolation evidence |
| Legal transparency/accessibility | Text-presence and automated browser checks | Verify actual controller/contact/legal text and manual accessibility with qualified reviewers |

No live IAM, ACTIVE TTL, deployment identity, data-cutover, third-party erasure, backup/restore or legal-signoff proof was obtained. The environment exposes no cloud identities/secrets for those checks; the source itself states those gates remain open. Missing evidence is NOT VERIFIED, not proof that a deployed control is absent or violated. This technical assessment is not a legal compliance certification.

## Execution evidence

Fresh local execution completed on the audited SHA:

| Gate | Result |
|---|---|
| Typecheck; app build; Functions build | PASS |
| Native-emulator Vitest | 1,524 PASS / 206 files |
| Enterprise Node | 86 PASS |
| Chromium browser/API/data journeys | 26 PASS |
| Separate Firestore Rules (repeated subset) | 118 PASS |
| SDK anti-bypass; IAM/collection regressions | 12 PASS + 10 PASS |
| TTL matrix and evidence negative checks | PASS, offline only |
| Built production-server smoke | PASS, loopback emulators only |
| Current-tree secret pattern scan | PASS, 1,305 files; not history |
| Dependency advisory scans | FINDINGS, exit 1; see A03 |
| Additional Storage adversarial reproduction | GAPS REPRODUCED; see A01/A02 |

The distinct main-suite total is **1,636** (1,524 + 86 + 26). No repeated Rules or supplemental checks are added to that total.

See [machine-readable results](RC1_AUDIT_2026-11-08.json) for commands, counts and local log hashes. Fresh local results are kept distinct from prior CI. Repeated Rules tests and launch tests are not added to the main-suite count.

Existing [CI 42505817983](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42505817983) is bound to the exact audited head. Run metadata, job steps and decoded log were inspected: 1,524 Vitest, 86 Enterprise Node, 26 browser; all relevant steps completed/success. Its strict repository Semgrep output reports 616 rules / 1,154 targets / 0 findings. The Semgrep artifact contents were not downloaded again in this audit; no new full Semgrep execution or full-history gitleaks scan is claimed. The fresh current-source secret pattern check passed over 1,305 files.

The [Storage reproduction](audit-2026-11-08/storage-access-repro.mjs) asserts the observed vulnerable behavior. Exit 0 means the gap was reproduced, **not** a passed security acceptance gate. Run only in an isolated checkout from `phase2_work/` with Node 22 and locked dependencies:

```bash
node_modules/.bin/firebase emulators:exec --project demo-klar --only firestore,storage \
  'node docs/security/audit-2026-11-08/storage-access-repro.mjs'
```

It requires loopback emulator variables and uses only synthetic records. Do not run alongside other suites sharing that emulator database. No production secrets or raw runtime logs are committed.

## Remediation order and release decision

1. Address A01/A02 on reviewed branches; prove denial before broadening media access or enabling purge.
2. Resolve A03, introduce a reviewed advisory gate, and verify the updated integrated lockfiles.
3. Correct A05/A06 and rerun the affected negative tests and complete candidate CI.
4. Complete synthetic full-story erasure/recovery, live read-only control evidence and independent AppSec/DPO/SRE/legal review.
5. Reaudit the resulting integrated SHA. Production remains NO-GO; any merge/promotion requires its separate explicit authorization.

This audit changes evidence files only. It does not modify application authorization, Storage/Firestore Rules, dependency locks, IAM, TTL, release flags, or production data.
