# Release-Blocker-Abhängigkeitskarte — 31.10.2026

**Basis:** GitHub `main` `2808dc1cbb485f70b403681c108cea5a3361d950` (aus PR-Basereferenz; keine Behauptung, dass dies nach dieser Aufnahme noch die neueste Spitze ist).  
**Entscheidung:** **BLOCKED / NO-GO**. Dies ist ein Quell-/PR-Metadaten-Snapshot, kein Produktions- oder CI-Audit. Keine Deployment-, Merge-, IAM-, Scheduler- oder Datenoperation.

## Unabhängige Freigabestränge

| Risiko | Beobachtetes Artefakt | Unabdingbarer Nachweis vor Abschluss |
|---|---|---|
| **P0: biometrische Foto-Retention** | [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [Draft #243](https://github.com/Veselin-Takev/Klar-Dating/pull/243) (stacked) | Entscheidungen statt bloßem Uploadalter; alle Writer und Scheduler; Admin-SDK-/IAM-Grenzen; idempotente generation-sichere Löschung; vollständige Receipt-/Audit-Reconciliation, lokale Emulator-Negativtests und Staging-Nachweise |
| **P0: B2B Conversion-Vertrauen** | [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [Draft #246](https://github.com/Veselin-Takev/Klar-Dating/pull/246) → [Draft #247](https://github.com/Veselin-Takev/Klar-Dating/pull/247) (stacked) | Signatur allein beweist keinen Kauf: serverautorisierte Käufer-/Order-Verknüpfung, Chargeback/Refund, Consent, Missbrauch, parallele Claims; vertraglich belastbare Evidenz und Finance/AppSec/DPO-Review |
| **P0: Member-Referral Zero-Trust** | [#48](https://github.com/Veselin-Takev/Klar-Dating/issues/48), gestapelte Drafts u. a. [#228](https://github.com/Veselin-Takev/Klar-Dating/pull/228) | Fachliche Reward-/KYC-/Consent-Regeln, UID-Vertrauen, Anti-Sybil, Idempotenz, Revocation/Expiry, Art.-17-Cascade und Staging-/Race-/Recovery-Belege; kein Gleichsetzen mit B2B-Konversionen |
| **P0: B2B Datenschutz / Tracking** | [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56) | Rechtsgrundlage/Verarbeitungsverzeichnis, Einwilligungswiderruf, Drittanbieter-Token, Partner-Verträge, vollständige Aufbewahrungsfristen, Betroffenenrechte, Erasure und Legal-Hold-Nachweise durch DPO/Legal |
| **P0: TTL-Policy & Zielumgebung** | [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70), [configure-retention.sh](https://github.com/Veselin-Takev/Klar-Dating/blob/main/phase2_work/scripts/configure-retention.sh) | Aktueller `main`-Quelltext plant 20 Groups inklusive Dry-Run, explizitem Projekt/DB-Kontext, Staging-/Approval-Schutz und ACTIVE-Preflight; **der ursprüngliche Vier-Gruppen-Quellbefund ist nicht mehr aktuell**. Nachzuweisen sind freigegebene Rechts-/Hold-Matrix sowie **LIVE ACTIVE TTL** pro Zielumgebung, Audit/Erasure und signierte Freigaben |
| **P0: Operative Produktionskontrollen** | [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8), [GO_LIVE_CHECKLIST.md](https://github.com/Veselin-Takev/Klar-Dating/blob/main/GO_LIVE_CHECKLIST.md) | Cloud-Run-IAM/Secrets, Alarmzustellung & On-Call-Acknowledgement, OTLP/P95, Replay/Rollback/Canary, Staging, Build-Provenance und Release-Owner-Entscheidung mit verifizierbaren externen Belegen |
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


## Nachtrag: GitHub Actions Workflow-Runs (31.10.2026)

Die ergänzende Abfrage der **PR-getriggerten GitHub Actions Runs nach exaktem Commit-SHA** liefert folgende Workflow-Metadaten. Damit wird die obige vorsichtige Aussage über leere *Commit-Status*-Einträge nicht zu einem generellen Fehlen von CI-Nachweisen umgedeutet:

| Draft PR | Exakter Head-SHA | Workflow | Run-ID | Beobachteter Zustand |
|---|---|---|---|---|
| [#243](https://github.com/Veselin-Takev/Klar-Dating/pull/243) | `82640fe87463e7332789b20443d31248b4a3226d` | Klar Enterprise CI | [41191871749](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41191871749) | completed / success |
| [#247](https://github.com/Veselin-Takev/Klar-Dating/pull/247) | `92350b8a3b51881130915d72a096fcb493944a21` | Klar Enterprise CI | [41195934570](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41195934570) | completed / success |
| [#248](https://github.com/Veselin-Takev/Klar-Dating/pull/248) | `a98fa67324825b1357b466a497cfaa10a941a410` | Klar Enterprise CI | [41204001572](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41204001572) | completed / success |
| [#249](https://github.com/Veselin-Takev/Klar-Dating/pull/249) | `073581672d26fe69973f0127f96827ff0f2e7620` | Klar Enterprise CI | [41205603173](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41205603173) | in_progress bei Abfrage; Ergebnis offen |

**Evidenzgrenze:** Nur Workflow-Metadaten wurden abgefragt; keine vollständige Job-/Gate-Matrix, signierte Logs, Runner-Attestierungen oder deployte Cloud-Konfiguration validiert. Der SHA von #249 bezieht sich auf den Stand *vor diesem Dokumentationsnachtrag*. Der Nachtrag erzeugt einen neuen Head-SHA und benötigt eine erneute vollständige CI-Prüfung. Keine PR ist allein durch `conclusion: success` zur Produktion freigegeben. Insbesondere #243/#247 bleiben gestapelte Teiländerungen mit ungeprüfter Integrationsbasis.
