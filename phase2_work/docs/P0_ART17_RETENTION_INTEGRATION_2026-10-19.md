# P0 #70 + Art. 17 staged integration — 2026-10-19

**Status: DRAFT / NO-GO.** Not an approved release or deployment.

## Provenance
- Base (unchanged): Draft PR #118 Art. 17 branch commit `9e886c67c97201602cd969fc57dfc9bf2d019c90`.
- TTL source: Draft PR #116 commit `fdcc8403bccb51a29f504c3100b31d6ddce9089d`.
- Copied only TTL-provisioner, 6 TTL regression/evidence scripts and 6 retention-specific documentation files. Both existing Draft PRs and `main` remain unchanged.
- `npm run check:retention-p0` executes the TTL matrix, ACTIVE-evidence negative fixtures, staging-only dry run and project-identity tests. It is wired into `npm run check:enterprise` directly after Art. 17 audit.

## Executed verification
On integration commit `e88268adc11eec11d6cb73140cf13f327a659f79` in an isolated remote source checkout with Node 20.20.2:
1. `node scripts/check-retention-matrix.mjs`: PASS for canonical 13-group matrix.
2. `node scripts/test-retention-matrix.mjs`: PASS for 6 fail-closed mutations.
3. `node scripts/test-retention-active-evidence.mjs`: PASS for valid read-only evidence plus 9 negative mutations.
4. `bash scripts/test-retention-gate.sh`: PASS for 13 plan rows, default dry run and denial of unapproved/prod apply.
5. `bash scripts/test-retention-project-identity.sh`: PASS using mocked gcloud; 13 gated staging updates and zero production calls.

**Still unverified:** Full combined enterprise pipeline on exact final commit, Node 22.23.3 check, Java-enabled Firestore Emulator tests, actual staging gcloud TTL ACTIVE evidence with project/database scope, retention/legal-hold signoff, supply-chain audit, TypeScript, E2E, build, independent Security/DPO/Legal approval and GitHub CI.

**Safety:** No TTL policies have been changed; the tests simulate only CLI mutations with a fake gcloud executable. No prod data, deployment, or main merge.


## Executed combined proof — 2026-10-19

**Exact verified code commit:** `c85efca453d8c022c6c11b738c63220134af7d19`.

Official SHA-256-verified Node `v22.23.3` was used on a complete GitHub source archive. The following commands returned exit 0:

- `npm run check:art17-deletion-audit` (seven storage tests, twelve Art. 17 source mutations, seven in-memory quarantine contracts, eighteen Emulator harness/preflight safety cases).
- `npm run check:retention-p0` (13-group matrix, six negative matrix mutations, nine negative read-only TTL ACTIVE evidence mutations, staging dry-run and mock project-identity tests).
- `node scripts/check-secrets.mjs`, `node scripts/check-auth-boundary.mjs`, `node scripts/check-public-firestore-rules.mjs`, `node scripts/check-ai-pii-sanitizer.mjs` (all PASS).

The complete archive contained **1,269 ZIP entries**, passed CRC check and had SHA-256 `cb33306921de4d585c87975f1ae267474b6d22d5e20077a2961d3150ae5033dd`.

**Unverified / NO-GO:** The isolated low-memory environment crashed while attempting to launch the actual Java-based Firestore Emulator, so none of the four real transaction scenarios passed. No live staging/prod Firestore TTL ACTIVE evidence was obtained. The full enterprise typecheck/Vitest/Playwright/build/npm audit and independent DPO/Security/Legal approval remain missing. No TTL mutation, production database access, merge or deployment took place.

---

## 2026-10-19 — P0 #70 evidence collection path added

`scripts/verify-retention-staging-live.sh` provides a deterministic read-only query of the explicitly approved Staging project and Firestore database, validates the fetched JSON using the existing 13-group ACTIVE evidence validator, and can export a new private JSON snapshot without overwriting a prior record. `npm run check:retention-p0` now additionally tests 12 failure scenarios using a deliberately fake `gcloud`. No live project was accessed. This does not close Issue #70 until independent Cloud state and the approved retention/legal-hold matrix are verified. **NO-GO.**


### 2026-10-19 — Read-only staging TTL collector verified on pinned Node 22.23.3

**Tested code commit:** `6331cf918443b930f130a0672d37392567096724`. The complete GitHub source archive of this commit was CRC-valid (1,271 entries; SHA-256 `1e22c3026120c50452f4ab812a70e726c005733e381537a2842b764d1c7e3802`). With **Node 22.23.3**, the following ran and returned exit code **0**:

- `npm run check:art17-deletion-audit` — static and contract tests PASS; **not** genuine Firestore Emulator integration.
- `npm run check:retention-p0` — includes **13 TTL collection groups**, six matrix negatives, nine JSON ACTIVE-evidence negatives, staged provisioning tests, plus a positive read-only collector fixture and **12 fail-closed mock-gcloud collector scenarios**.
- `node scripts/check-secrets.mjs`, `node scripts/check-auth-boundary.mjs`, `node scripts/check-public-firestore-rules.mjs`, `node scripts/check-ai-pii-sanitizer.mjs` — all PASS.

**Evidence limitation:** The collector was exercised using a *fake* gcloud command. No real Cloud project was queried, no live TTL ACTIVE state was attested, and no TTL settings were changed. The actual Firestore Emulator scenario suite, full TypeScript/Vitest/Playwright/build/npm-audit, review of legal holds, partner buyer-binding and independent DPO/Legal/Security approvals are still pending. Draft PR #119 stays unmerged; production decision **NO-GO**.


## 2026-10-19 — Evidence of seven additional expiry writers

The earlier 13-group retention matrix omitted seven source-backed `expiresAt` groups: password reset, verification mail, account deletion, KYC start, KYC reconciliation, chat messaging and chat gate answers. The staging-only plan now includes **20 groups** with an additional explicit “20-group revision approved” guard; stale approvals cannot activate new TTL policies. This change is only a source-level candidate. All production, LIVE ACTIVE, legal hold, DPO and TypeScript/Emulator/full CI gates remain **NO-GO**. Consult the per-source mapping in `docs/DATA_RETENTION.md`.


### 2026-10-19 — TTL expiry writer branch-specific regressions

The existing 20-group staging-only TTL source guard previously checked that a module contained *some* `expiresAt` value. That could accept a limiter where the create branch retained its expiry date but the update branch silently stopped storing it (or vice versa), and could accept an unrelated KYC expiration as evidence of `kyc_reconciliation_events` expiry.

The guard now checks **each individual transaction set/update write** for all four previously omitted rate-limit writer families, both operations of the shared chat limiter, and the exact KYC reconciliation write. It requires a `new Date(...)` timestamp rather than merely an `expiresAt` spelling elsewhere in the file. The executable offline mutation test contains **20 fail-closed mutations** (including 11 single-write expiry field removals), rather than the earlier 9 source-name-only mutations. This is source-based coverage, **not** a running Firestore integration test or proof that all historical records contain valid timestamp fields.

Firebase documents that TTL requires a timestamp field, deletion is asynchronous, and TTL does not recursively delete subcollections: https://firebase.google.com/docs/firestore/ttl. Actual 20-group Staging ACTIVE state, review of historical timestamps/holds, independent Legal/DPO approval and true Art. 17 cascade execution remain prerequisites for release. **NO-GO**.


### 2026-10-19 — P0 #70: Undokumentierte zusätzliche TTL-Policies strikt ablehnen

**Quellbefund:** `scripts/check-retention-active-evidence.mjs` ignorierte bisher mit `if (!required.includes(group)) continue` jede TTL-Policy einer nicht in der genehmigten 20er-Matrix enthaltenen Collection-Group. Da `gcloud firestore fields ttls list` sämtliche konfigurierten TTL-Felder der gewählten Datenbank auflistet, konnte ein erfolgreicher 20/20-ACTIVE-Nachweis gleichzeitig eine **zusätzliche, potenziell rechtswidrige Löschrichtlinie verschweigen**.

**Korrektur:** Die Read-only-Evidenzprüfung bricht jetzt bei **jeder** unerwarteten TTL-Policy sofort ab, auch bei `CREATING` und alternativen Feldnamen. Zusätzliche Richtlinien müssen zuerst in der vollständigen Matrix erfasst, auf Rechtsgrundlage, Aufbewahrung und Legal Holds geprüft und gesondert genehmigt werden; der Validator bietet absichtlich keine automatische `ignore`-Ausnahme. `test-retention-active-evidence.mjs` enthält nun **12** Negativmutationen statt 9. Das Mock-Staging-Skript verweigert zusätzlich eine unautorisierte aktive Policy (**13** Fail-Closed-Szenarien statt 12). Vor der Korrektur hätte der Validator die unautorisierte ACTIVE-Policy akzeptiert.

**Wichtige Grenze:** Das sind lokale JSON-/Mock-/Quellcode-Tests, **kein** realer Google-Cloud-Abruf. Diese Änderung aktiviert/deaktiviert/löscht keine TTL-Policies. Für eine GO-Entscheidung fehlen insbesondere die unabhängig genehmigte *vollständige* 20er-Policy-Matrix, die Auswertung **aller** tatsächlich vorhandenen Policies im freigegebenen Staging, Bestands-/Legal-Hold-Nachweise, echte Firestore-Emulator-Transaktionen und die vollständigen Enterprise-Release-Gates. Produktionsfreigabe **NO-GO**.

Google-Cloud-Dokumentation: https://docs.cloud.google.com/sdk/gcloud/reference/firestore/fields/ttls/list und https://firebase.google.com/docs/firestore/ttl


## 2026-10-19 — Integration der SLO-Korrektur aus Draft-PR #77 (Issue #71)

Der ursprünglich auf `main` gemeldete P95-Widerspruch ist in diesem **separaten Integrationszweig** korrigiert: `src/server/observability.ts` importiert den kanonischen Zielwert `api-latency-p95-ms` aus `ops/slo.json` (aktuell **300 ms**) und setzt `klar_http_p95_slo_breach` ab `p95 > API_P95_SLO_MS`, nicht erst oberhalb von 1500 ms. Die bestehende statische Prüfung `scripts/check-observability.mjs` wurde ebenfalls von ihrer **historischen 1500-ms-Annahme** befreit; diese war im ursprünglichen Draft-PR #77 nicht korrigiert und hätte den `check:enterprise`-Pfad nach dem Import blockiert. `check:observability` führt nun zwingend zusätzlich `scripts/test-slo-policy.mjs` aus, einschließlich der tatsächlichen Metrik-Ausdrucksgrenzen 299/300/301/1500 ms. Die Korrektur verwendet die bereits in PR #77 geprüfte minimale Änderung, belässt diese Draft-PR jedoch eigenständig und ungemergt.

**Wichtige Messgrenzen:** Die exporterinterne P95-Berechnung erfolgt aus höchstens 15 Minuten lokaler Trace-Latenzen, und die ausgegebene Metrik ist ein einzelner Gauge. Daraus folgt **kein** 30-Tage-SLO für alle Serverinstanzen, keine aggregierte Prometheus-Histogramm-Verteilung, keine gültige Error-Budget-/Burn-Rate-Ableitung und kein verifizierter Pager. Solche Flotten-Quantile sollten separat aus aggregierbaren Histogramm-Buckets mit `histogram_quantile()` berechnet werden; Prometheus warnt ausdrücklich vor dem Aggregieren von quantile-Gauges. Ein SLO-GO braucht daher bestätigte SLI-Filter, Produktions-/Staging-Telemetrie, 30-Tage-Fenster, Alert-Delivery und unabhängige SRE-Freigabe. **Issue #71 bleibt offen / Produktionsfreigabe NO-GO**.

Offizielle Quelle: https://prometheus.io/docs/practices/histograms/ .


## 2026-10-19 — P0 #70: Read-only preflight before any staging TTL update

**Confirmed source gap (base commit `7adc5c1e0320cfd9826136f2f206bb78ea3dd749`):** `scripts/configure-retention.sh` gated the staging target, environment label, DPO/legal inventory approval and 20-group matrix revision, but issued 20 sequential `gcloud firestore fields ttls update` operations **without first reading the database's existing TTL policies**. Thus an unapproved pre-existing policy, nonzero expiry offset, alternate field, or unfinished `CREATING` operation could go unnoticed until after writes had started. The separate ACTIVE evidence checker did not prevent this scenario because it ran only when the operator deliberately requested evidence afterward.

**Correction:** Before any “update” call, the script now runs the read-only, explicit-project-and-database `gcloud firestore fields ttls list --format=json` command. It uses `check-retention-active-evidence.mjs --mode preflight` to permit only a subset of the **approved 20 “expiresAt” policies**, each already ACTIVE with zero/default expiration offset. An empty policy list is safe for the preflight; unknown groups/fields, wrong scope, duplicates, nonzero offset, `CREATING`, malformed JSON or cloud-list failure abort **before the first write**. Full final ACTIVE evidence still requires all 20 groups in the separate standard validator mode; preflight must never substitute for after-activation independent proof.

**Offline negative proofs:** The mock `gcloud` stage test asserts **zero TTL update calls** for an unapproved existing policy, an unfinished policy and a failing list command, and exactly 20 updates for a safe mocked empty list after all approvals. The source-matrix gate also enforces that the read-only list/validation precedes the first update and has three mutation regressions against a removed/bypassed preflight. The checker accepts an empty or approved existing subset and rejects seven malicious existing-policy fixture types. **No cloud TTL settings have been read or modified during these tests.**

**Residual risk:** The preflight is a snapshot and cannot rule out changes by a concurrent administrator after it completes (TOCTOU); a protected change window, least-privilege Cloud IAM and independent change approval are still necessary. Since policies are applied sequentially, an operational error after the first write could result in **partial activation**, which must be independently reconciled. Existing expired-data and legal-hold review is mandatory because activating TTL can trigger deletion of historical records. Firestore TTL deletion is asynchronous, non-recursive, and billable. No production deploy/merge and no human GO authorized.

Sources: https://firebase.google.com/docs/firestore/ttl and local scripts/tests described above. **PRODUCTION NO-GO**.


### 2026-10-19 — TTL staging idempotence and mandatory 3-iteration NO-GO review

The staging TTL provisioner now uses the existing fail-closed scoped policy preflight to retrieve validated ACTIVE group identifiers and skips already ACTIVE policies. Mocked GCP tests show **20/18/0 update requests** when **0/2/20 policies** were already ACTIVE, and unsafe policy fixtures still cause zero writes. Three additional static matrix mutations cover an omitted skip or ID-validation step; the regular full-20 ACTIVE evidence check remains unchanged. See `docs/ADR_TTL_STAGING_IDEMPOTENCE_2026-10-19.md` and `docs/ENTERPRISE_REVIEW_3_ITERATIONS_2026-10-19.md`.

The mandatory tests cannot yet all pass in the isolated checkout: root Bun-only lock policy forbids npm package-lock, `npm audit` exits ENOLOCK, and the full TS/Vitest/Playwright/Emulator/build toolchain is absent. Do not fabricate zero vulnerabilities or GO from static checks; the final third-iteration result is recorded in the associated Draft PR description. **NO-GO.**
