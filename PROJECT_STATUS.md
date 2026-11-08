## Welle 2 Abschluss — Verifikation läuft

33 weitere Legacy-Kandidaten wurden auf das geschlossene Tenant-Repository umgestellt: **43/50**, sieben Infrastruktur-/Utility-Dateien verbleiben. C/D/E sind im Quellcode umgestellt; ihr Abschluss ist bis zum erneuten vollständigen Test- und Semgrep-Lauf **nicht zertifiziert**. Die früheren Testzahlen und CI-SHAs unten sind historische Nachweise, keine Bestätigung des neuen Arbeitsstands.

Einzelprüfungen: 129 gezielte HTTP-/Security-Tests und 86 Enterprise-Tests PASS; Produktions-Build PASS. Der abschließende Gesamtlauf und repositoryweite SAST-Lauf sind noch offen. `baselineFixed=false`, `productionApproved=false`; keine produktive Migration oder Freigabe.

# Klar project status

Canonical current status: [phase2_work/docs/PROJECT_STATUS.md](phase2_work/docs/PROJECT_STATUS.md).

Gate 0 v0.1.1-rc1: **BLOCKED**, baselineFixed=false, productionApproved=false.
See [audit](phase2_work/docs/releases/v0.1.1-rc1/GATE0_AUDIT.md) and RELEASE_MANIFEST.json gate0. Historical releaseGovernance fields describe earlier candidates.

Latest scoped verification: 1,527 PASS on 4dc39cd5; full tenant certification remains open. See canonical status and gate0.isolationClosure in both manifests.

Finalizing evidence: 1,536 PASS on f8f6fa59; lead PR #358 supersedes #356/#357. baselineFixed=false, productionApproved=false. Full Admin SDK/IAM certification remains open.

Admin repository: implemented and under verification; 50 legacy consumer files still require coordinated migration. IAM documented, effective deployed privileges unverified. baselineFixed=false.

Verified Admin wrapper checkpoint: 1,549 PASS on b0dca22c plus 1 static negative test. Fifty legacy consumer files and unverified effective IAM prevent certification; baselineFixed=false.

Legacy migration: 50/50 not complete. SDK factory confinement and Semgrep implemented; missing IAM identities/bindings prevent conformity verification. baselineFixed=false.

Latest verification: 1,549 PASS and Semgrep 119 files / zero findings on 9a93f02a. Tenant migration remains incomplete; static IAM conformity blocked. baselineFixed=false; PR #358 DRAFT.

Batches A/B: 2/50 consumers migrated in source; 48 remain. IAM module and render-enforced dedicated runtime identity implemented, not provisioned. Cutover flags remain disabled outside synthetic tests. baselineFixed=false.

Verified batch checkpoint: 2/50 migrated, 48 open; 1,552 main-suite PASS plus 6 IAM checks on 84575f87. IAM render enforcement implemented, no provisioning/cutover. baselineFixed=false. Stopped for batch review.

Wave 1 C/D: source progress 5/50, 45 open; C and D IN PROGRESS. Auth/Payments cutovers remain OFF outside synthetic CI. Current-wave tests pending; baselineFixed=false.

Wave 1 verified on bd3c9f70: 1,561 PASS, Semgrep 0 findings; 5/50 source files migrated, 45 open. C/D overall IN PROGRESS. baselineFixed=false; stopped for Wave 2 instruction.

Wave 2 source checkpoint: **10/50 migrated, 40 open**. KYC, contracts/refund
ledger, subscription reads and two Functions plus compliance processing are scoped.
C/D/E remain IN_PROGRESS; coordinated readers/writers and account erasure/mail still
block closure. Current full CI pending. Repository-wide auto Semgrep has 35 open findings plus 41 diagnostic warnings independent
of the pinned anti-bypass rule (0). baselineFixed=false; productionApproved=false.
See [Wave 2 evidence](phase2_work/docs/security/MIGRATION_WAVE2.md).

Wave 2 verified on **fff55a97**: **1,574 PASS** (1,462 Vitest + 86 Enterprise
Node + 26 Playwright), full CI 42490475690 SUCCESS; Rules 92 repeated PASS.
Progress remains **10/50 source candidates, 40 open; C/D/E IN_PROGRESS**.
Pinned Semgrep: 0 findings. Repository-wide auto: 35 findings + 41 warnings, FAILED.
Both manifests and the batch register retain baselineFixed=false and
productionApproved=false. PR #358 DRAFT; stop for Wave 3 review.
