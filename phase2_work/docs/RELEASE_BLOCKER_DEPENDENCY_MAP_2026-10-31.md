# Release-Blocker-Abhängigkeitskarte — 31.10.2026

**Basis:** GitHub `main` `2808dc1cbb485f70b403681c108cea5a3361d950` (aus PR-Basereferenz; keine Behauptung, dass dies nach dieser Aufnahme noch die neueste Spitze ist).  
**Entscheidung:** **BLOCKED / NO-GO**. Dies ist ein Quell-/PR-Metadaten-Snapshot, kein Produktions- oder CI-Audit. Keine Deployment-, Merge-, IAM-, Scheduler- oder Datenoperation.

## Unabhängige Freigabestränge

| Risiko | Beobachtetes Artefakt | Unabdingbarer Nachweis vor Abschluss |
|---|---|---|
| **P0: biometrische Foto-Retention** | [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [Draft #243](https://github.com/Veselin-Takev/Klar-Dating/pull/243) (stacked) | Entscheidungen statt bloßem Uploadalter; alle Writer und Scheduler; Admin-SDK-/IAM-Grenzen; idempotente generation-sichere Löschung; vollständige Receipt-/Audit-Reconciliation, lokale Emulator-Negativtests und Staging-Nachweise |
| **P0: B2B Conversion-Vertrauen** | [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [Draft #246](https://github.com/Veselin-Takev/Klar-Dating/pull/246) → [Draft #247](https://github.com/Veselin-Takev/Klar-Dating/pull/247) (stacked) | Signatur allein beweist keinen Kauf: serverautorisierte Käufer-/Order-Verknüpfung, Chargeback/Refund, Consent, Missbrauch, parallele Claims; vertraglich belastbare Evidenz und Finance/AppSec/DPO-Review |
| **P1: Storage Adult-Gate** | [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204), [Draft #248](https://github.com/Veselin-Takev/Klar-Dating/pull/248) | echtes Rules-/Firestore-Emulator-Gate plus tatsächliche IAM/Ruleset-Identität; Block-/Erasure-Policy; Kompatibilität. Zwei Rules-Firestore-Lookups ersetzen keine vollständige Betrachterautorisierung |
| **P1: widerrufbare Bildlinks** | [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206), [Draft #244](https://github.com/Veselin-Takev/Klar-Dating/pull/244) | tokenlose bzw. revokierbare Bildlieferung, Altlink-Rotation, Cache/CDN-Prüfung und Staging-Negativnachweise. Diagnose-Redaktion allein schließt #206 **nicht** |
| **P1: KYC-Profilrefresh** | [#237](https://github.com/Veselin-Takev/Klar-Dating/issues/237), [Draft #238](https://github.com/Veselin-Takev/Klar-Dating/pull/238) | exakter CI-Commit und unabhängige Review für `/api/kyc/status` / `approved`-Only; ersetzt keine P0-Retention-Abnahme |
| **Governance** | [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73), [Draft #245](https://github.com/Veselin-Takev/Klar-Dating/pull/245) | echte CODEOWNERS-Branch-Protection und verfügbare unabhängige fachliche Reviewer nachweisen, nicht bloß Quelldatei-Zuordnung |

## Sequenzregel

1. **Nicht blind zusammenführen.** Stacked PRs nur entlang ihrer exakten Elternbasis nach separatem Review integrieren. Andere PRs unabhängig gegen die danach gültige Baseline neu validieren.
2. **CI-Nachweise sind SHA-gebunden.** Der kombinierte Commit-Status-Endpunkt lieferte bei den stichprobenartig abgefragten Draft-Heads #238 (`a74e5db1db87e0dca8b7e5773b95781b99b8e5f5`), #243 (`82640fe87463e7332789b20443d31248b4a3226d`), #247 (`92350b8a3b51881130915d72a096fcb493944a21`) und #248 (`a98fa67324825b1357b466a497cfaa10a941a410`) **keine Status-Einträge**. Dies bedeutet **nicht**, dass keine GitHub Checks/Actions existieren oder fehlgeschlagen sind: Checks API, Workflow-Runs und signierte Log-Artefakte sind separat abzurufen. Hier wurde kein vollständiger CI-PASS nachgewiesen.
3. **Vor formaler Freigabe:** Security, Datenschutz/Legal, Operations/SRE, Finance (bei B2B), Product und Release Owner prüfen die exakten relevanten SHAs; Host-Logs und signierte Prüfsummen der Pflicht-Gates, Rollback, Cloud-IAM/Rulesets, Live-Scheduler/Retention und Staging-Tests müssen vollständig verifiziert vorliegen.
4. **Berechtigungsgrenze:** kein direkter `main`-Commit, kein automatischer Merge, kein Deployment, keine produktive Bild-/Token-Löschung. Ein Dokumentations-PR ist niemals eine Production-GO-Autorisierung.

## Nachführung

Bei jeder relevanten Integration erst GitHub-PR/Issue-Zustand, geänderten Head-SHA, CI-/Checks- und Artefaktbelege erneut abrufen; diese Karte als historisch datierten Snapshot behandeln. Veröffentlichte Prüfergebnisse immer mit Testtyp, Host/Umgebung, UTC-Zeit, SHA und PASS/FAIL/BLOCKED dokumentieren. **Ungeprüft ≠ PASS.**
