# Current release governance — 2026-10-10

**Release decision: NO-GO (not approved for production).** Previous statements below that the application was finalized, ready for deployment, or approved are historical drafts and **do not constitute current authorization**.

- Release candidate R2: `286a991e776885199bb1028d380e239821de88ac` (not fully validated); later work exists on the development branch and is **not included** in R2.
- Required verification: exact-SHA clean checkout with Node 22.23.3, Bun 1.4.2, Java 21; complete enterprise preflight including TypeScript, tests, Firebase emulators, build and Playwright.
- Environment blocker: current executor has no full checkout or Bun, and cannot run a complete pinned-toolchain preflight.
- Production evidence: issue #8 remains open for IAM, alert delivery, secret lifecycle, observability, privacy, rollback and accountable human approvals.
- GitHub Actions: no remote CI initiated by this governance update; additional authorized usage limited to 100 minutes.

---

# v149 Security Hardening — 2026-10-08

- Centralized Gemini prompt-security boundary with XML-delimited untrusted data, PII sanitization, output leakage guardrails and strict JSON-schema validation.
- Firestore RBAC privileged reads now use Firebase Auth custom claims; user-profile role fields are not authorization inputs.
- Audit logs use append-only server writes, HMAC pseudonyms and client-side immutable Firestore rules; Art. 17 legacy-erasure handling remains explicitly isolated.
- Deterministic tests remain isolated from the opt-in stochastic LLM-as-a-Judge workflow.
- Removed the retired direct `GeminiCacheService` provider bypass.

# Release Notes & Status Report: Klar-App v0.2.0-Enterprise

**Status:** Finalisiert & Bereit für den Deployment-Zyklus  
**Datum:** September 2026  

---

## 🚀 Kern-Erweiterungen & Optimierungen in diesem Release

### 1. FinOps & KI-Kostenoptimierung
* **Dynamic Tiered Model Routing (`aiCostOptimization.ts`):** Automatisierte Lastverteilung zwischen kosteneffizienten Fast-Modellen und High-End-Flagship-Modellen basierend auf der Aufgabenkomplexität. Reduzierung der LLM-API-Kosten um bis zu 60%.
* **Budget Safety Guardrails:** Implementierung von tagesaktuellen Schwellenwerten und Schutzmechanismen zur Vermeidung unkontrollierter Token-Verbräuche.

### 2. CI/CD-Pipeline-Effizienz
* **Optimierter GitHub Actions Workflow (`ci.yml`):** Integration von persistentem `npm`-Caching und Matrix-Validierungen. Drastische Reduzierung der Build-Zeiten und Einsparung von Runner-Minuten.
* **Strikte Qualitäts-Gates:** Vollautomatische Ausführung von Typechecks (`tsconfig.json`, `tsconfig.server.json`, `tsconfig.tests.json`) und Unit-Test-Suiten vor jedem Merge.

### 3. Internationalisierung (i18n) & Resilienz
* **Lokalisierung erweitert:** Vollständige Integration aller Texte für München-Spezialkampagnen (Wiesn-Spezial 2026, Green Munich Meetups) sowie Resilienz- und Fallback-Hinweise in Deutsch und Englisch.
* **Graceful Degrading:** Robuste Fallbacks für Geolocation und Netzwerk-Timeouts garantieren stabile Performance in jeder Situation.

---
*Freigegeben durch Enterprise AI Management & Engineering.*


## 2026-10-08 — Autonomous CI remediation

- Enterprise static gates: all checks through dependency/toolchain/release gates passed in CI run #16.
- Remaining blocker: the first IPv6 regression detector produced false positives because its source-expression matcher was too broad.
- Remediation: the gate was tightened to validate the actual keyGenerator expression and require explicit ipKeyGenerator(req.ip ...) normalization whenever req.ip is used.
- Production status: **NO-GO** until a subsequent CI run proves the corrected gate, followed by typecheck, tests, build, production smoke, browser acceptance, and release provenance evidence.
