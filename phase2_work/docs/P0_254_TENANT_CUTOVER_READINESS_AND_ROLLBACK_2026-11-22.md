# P0 #254 — Tenant cutover readiness and rollback evidence gate

**Package:** 6 — offline cutover-readiness / rollback evidence.  
**Baseline:** `main@6f0457c1b12967415ee02a12669c94999ac8ec8b` (tree `95692d6af3db1012dca2319c9960ce47f03e007d`).  
**Decision invariant:** `productionApproved=false`; production **NO-GO**; P0 #254 **OPEN**.

## Purpose and verdict

This package supplies a deterministic local-file-only evidence validator for a future independent tenant-isolation cutover review. It is not a migration utility, runtime route guard, Rules publisher, deployment tool, activation switch or release approval. It performs no network, database, Firebase, Cloud, IAM, Storage, bucket or deployment operation.

The only verdicts are `BLOCKED` and `ELIGIBLE_FOR_INDEPENDENT_REVIEW`. Eligibility means only that supplied local evidence satisfies declared structural predicates and checksums. It is not independent AppSec/DPO/Legal/SRE approval, cutover authorization or production GO. No code path activates anything.

## Six mandatory evidence requirements

1. **Exact code and Rules baseline.** Pin separate exact 40-hex Git SHAs for code and active Firestore/Storage Rules baseline; provide both independently to the CLI. Every evidence artifact has a unique opaque ID, manifest-relative path and SHA-256 digest. Recompute all digests; missing files, malformed digests, symlinks, path traversal, duplicate IDs, oversized files and mismatches block. Each evidence group references verified artifact IDs.
2. **Complete owner/participant/mapping evidence.** Account for every in-scope record; the reviewed count must equal the manifest row count. Explicitly review owner and participant evidence, including unresolved states. A `MAPPED` row is allowed only with clear classification, explicit tenant ID, verified owner and complete verified participant set. Client fields, roles, routing hints, UID conventions, email, pair IDs and provider IDs are not authority.
3. **No automatic assignment and preserved quarantine.** Require `automaticTenantAssignmentUsed:false` and `assignmentMode:REVIEWED_EVIDENCE_ONLY`. `AMBIGUOUS`, `CONTRADICTORY`, `ORPHANED` and `DUPLICATE` rows remain tenantless `UNMAPPED`, quarantined, reason-coded and backed by checksum-verified quarantine evidence. No fallback tenant or silent omission.
4. **GDPR Art. 17 cascade, retention, legal hold and Storage graph.** Document and test deletion cascade; document retention and test expiry; document legal-hold scope and test precedence; inventory and reconcile Storage objects, generation/metageneration, metadata, token references, derived media and document/object relationships. An independent named reviewer must record `PASS` bound to the exact code SHA. Legal holds are narrow, reviewed and not blanket retention exemptions; deletion exceptions stay restricted and recorded.
5. **Tested rollback and Default-OFF.** Bind rollback test to the exact code SHA. Prove server-owned literal `enabled === true` only; when disabled return HTTP-style `503` before verifier, tenant resolver, policy or store; record zero resolver and store calls. Include at least two named/actionable stop conditions and named Incident Commander, Backend/SRE, DPO/Legal and Release Owner.
6. **Four SHA-bound attestations.** Require unique `APPSEC`, `DPO_LEGAL`, `BACKEND_SRE`, `RELEASE_OWNER` attestations, each explicitly `APPROVED`, named signer, timestamp, checksum-bound evidence reference and exact `baseline.codeSha`. Missing, duplicate, stale, rejected, malformed or mismatched attestations block. Validator checks declared fields; human reviewers must establish authority, independence and substance.

## Tenant isolation boundaries

A future cutover review must prove signed tenant claims plus active server-side membership are authoritative. `X-Tenant-ID`, hostname, subdomain, body, query and routing metadata are equality hints only. Every read/write must be tenant-scoped and object-authorized. Owner and participant relationships require independent evidence; no role, including admin/super_admin, bypasses object-level policy. Any cross-tenant BOLA/IDOR, tenant mismatch, orphan object, unreviewed legacy row or incomplete participant set stops the change.

Legacy records stay `UNMAPPED` until exact reviewed row-level evidence justifies classification. Quarantine is an access restriction and evidence-preservation control, not deletion or permission to expose records through legacy paths. The future inventory must include every writer, reader, background job, SDK actor, API path, Rules boundary and object relationship.

## Rollback runbook (future, separately authorized change only)

**Before any separately approved change:** verify exact code and Rules SHAs, all artifact checksums, six evidence groups and four sign-offs; confirm monitoring, access restrictions, backup/restore assumptions, writer inventory, operational owners and tested rollback rehearsal. Production remains Default-OFF absent a separately approved activation record.

**Stop conditions:** any baseline drift; missing/corrupt evidence; unresolved row not quarantined; automatic assignment; missing/contradictory membership or owner/participant evidence; cross-tenant access; incomplete Art. 17 or Storage graph; legal-hold conflict; Default-OFF not returning 503 before downstream calls; unexpected resolver/store/write activity; or missing/withdrawn/stale sign-off. Incident Commander freezes progression and records the trigger. Backend/SRE preserves Default-OFF and evidence. DPO/Legal assesses legal hold, deletion and notification implications. AppSec assesses security impact. Release Owner maintains NO-GO.

**Rollback sequence, if later authorized:** (1) Incident Commander declares stop and freezes progression. (2) Backend/SRE preserves/restores server-owned Default-OFF through an approved change and verifies 503 plus zero resolver/store calls. (3) Stop/reconcile in-flight writers and queued work without blind retries, tenant inference, destructive cleanup or rewriting partial records. (4) Preserve immutable before/after evidence, object-version metadata and audit records; unresolved rows remain quarantined. (5) DPO/Legal assesses exposure, Art. 17, retention, legal hold and notification duties; AppSec assesses isolation impact. (6) Release Owner records rollback outcome and keeps NO-GO pending new independent approval. Package 6 executes none of these steps.

## Independent sign-offs

| Role | Minimum assessment |
|---|---|
| AppSec | Threat model, tenant boundaries, BOLA/IDOR, fail-closed behavior, secrets and residual risks |
| DPO / Legal | Art. 17 cascade, lawful basis, retention, legal holds, Storage graph, exceptions and minimization |
| Backend / SRE | Complete reader/writer inventory, operational dependencies, Default-OFF proof, stop and rollback rehearsal |
| Release Owner | Exact baseline, evidence set, dependency closure, change authorization and NO-GO preservation |

The validator checks declared fields and SHA binding only. Independent functions must assess evidence and signer authority; cross-role self-approval is unacceptable.

## Offline invocation

From `phase2_work`:

```sh
node scripts/check-tenant-cutover-readiness.mjs \
  --manifest ./cutover-evidence/manifest.json \
  --expected-code-sha <40-hex-commit> \
  --expected-rules-baseline-sha <40-hex-commit>
```

The manifest directory is the evidence root. The validator reads only the manifest and listed local files, uses Node.js built-ins, and imports no network/database/Cloud SDK. Exit 0 means only `ELIGIBLE_FOR_INDEPENDENT_REVIEW`; exit 2 means `BLOCKED`. Evidence belongs in a governed access-controlled location; fixtures must be synthetic. Never include secrets or raw personal data.

The manifest uses `schemaVersion:1`, `baseline`, `evidenceArtifacts`, `ownerParticipantMappingEvidence`, `art17Evidence`, `rollbackEvidence` and all four `signoffs`. See the synthetic fixtures in `check-tenant-cutover-readiness.test.mjs`. A successful local result cannot prove factual completeness, legal sufficiency or human signer authority.

## Explicit exclusions

No production route import/mount; `server.ts` and Package 5 compliance-storage 503 interlock unchanged. Candidate Firestore/Storage Rules stay inactive; active `firestore.rules`, `storage.rules` and `firebase.json` unchanged. Tenant context, repository, legacy mapping and route-guard adapter untouched. No workflows, dependencies or lockfiles changed. No network/DB/Firebase/Cloud/IAM/Firestore/Storage/bucket/deployment calls; no migration, tenant assignment, real PII, live/staging scan, rollback execution or activation.

**Release invariants:** `productionApproved=false`; production **NO-GO**; P0 #254 **OPEN**. Any later implementation, cutover, Rules activation, migration, rollback or deployment needs separate explicit authorization, change plan and independent review.
