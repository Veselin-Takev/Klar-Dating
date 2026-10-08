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
