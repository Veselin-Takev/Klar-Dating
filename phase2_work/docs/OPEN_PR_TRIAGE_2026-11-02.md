# Offene PRs: Abhängigkeitsinventar und Merge-Gates (2026-11-02)

> **BLOCKED / NO-GO** – Nur Bestands- und Abhängigkeitsprüfung. Das Dokument ist weder Code-Review noch Merge-Freigabe; `productionApproved=false`.

## Verifizierte Baseline

- Repository: [Veselin-Takev/Klar-Dating](https://github.com/Veselin-Takev/Klar-Dating); `main` SHA: `96c3857c53f5ced31fe1394895185f42c75bc716`.
- GitHub REST `pulls?state=open`, **beide Seiten** (100 + 52 Ergebnisse): **152 offen, 152 Draft**. **41 PRs zielen direkt auf `main`**, **111 auf andere Branches**.
- 108 von 111 Nicht-main-Basen entsprechen dem Head eines anderen offenen PR; 3 Basen haben **keinen** Head in der offenen PR-Liste (dies belegt nicht, dass der Branch fehlt). **16 PRs** sind dadurch ohne belegte durchgängige offene-PR-Kette zu main. Längste beobachtete Kette: Tiefe 35 (main-basierter PR = Tiefe 0).
- Die Zuordnung per `titleArea` ist eine **heuristische Titelkategorie**, keine individuelle P0/P1-Triage. Die SHA-Bindung ist im [maschinenlesbaren Inventar](./OPEN_PR_INVENTORY_2026-11-02.json) enthalten.

## Priorisierte, reviewpflichtige Integrationswellen

| Welle | Gegenstand und Beispiel-PRs | Voraussetzung vor Merge |
|---|---|---|
| 0 – Governance | [#251](https://github.com/Veselin-Takev/Klar-Dating/pull/251), Ruleset #25756841 | Unabhängiges Approval, CODEOWNERS-Pflicht, Stale-Review-Entwertung und Thread-Resolution durchsetzen; derzeit sind **0 Approvals** vorgeschrieben. Keine P0-Merges davor. |
| 1 – Foto-Löschung / P0 #202 | [#160](https://github.com/Veselin-Takev/Klar-Dating/pull/160), [#203](https://github.com/Veselin-Takev/Klar-Dating/pull/203), [#231](https://github.com/Veselin-Takev/Klar-Dating/pull/231), [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) und abhängige Ketten | Überschneidungen/Ersetzungen nach **Diff** dokumentieren; generation-bound GCS-Receipt, Moderationsentscheidung/Legal Hold, Idempotenz, Negativtests, echte Löschbelege. |
| 2 – Mandantentrennung / P0 #254 | [#253](https://github.com/Veselin-Takev/Klar-Dating/pull/253), [#268](https://github.com/Veselin-Takev/Klar-Dating/pull/268), [#311](https://github.com/Veselin-Takev/Klar-Dating/pull/311) | Legacy-Migration, Tenant-Claims, Storage/Firestore BOLA/IDOR, Art.17, API und End-to-End-Negativtests; kein isolierter Inventarcheck als Live-Cutover behandeln. |
| 3 – Partner und Datenschutz | [#246](https://github.com/Veselin-Takev/Klar-Dating/pull/246), [#192](https://github.com/Veselin-Takev/Klar-Dating/pull/192) | Partner-Conversion unabhängig belegen; Replay/Buyer-Identität, DSGVO-Rechtsgrundlage, Consent, Tracking und Löschung prüfen. |
| 4 – Sichtbarkeit/TTL/Betrieb | [#248](https://github.com/Veselin-Takev/Klar-Dating/pull/248), [#244](https://github.com/Veselin-Takev/Klar-Dating/pull/244), [#312](https://github.com/Veselin-Takev/Klar-Dating/pull/312), [#127](https://github.com/Veselin-Takev/Klar-Dating/pull/127) | Adult-Policy-Tests, widerrufbare Medienzugriffe, echte ACTIVE 20/20 TTL-Nachweise, RTO/RPO, Rollback und Observability. |
| 5 – Doku und Freigaben | [#313](https://github.com/Veselin-Takev/Klar-Dating/pull/313), [#314](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | Exact-SHA Evidenz, Vercel-Preview-Automatik, Node-Version und Regions-/Datenflussprüfung; unabhängige Security-/DPO-/Legal-/SRE-/Release-Owner-Unterschriften. |

**Wichtig:** Die Wellen sind eine Prüf-Reihenfolge, **kein** Auftrag, die genannten PRs ungeprüft zu mergen. Abhängigkeiten können zunächst andere atomare Code-PRs oder eine Neuaufteilung erfordern.

## Regeln pro PR (fail-closed)

1. **Triage zuerst:** aktuellen Head-SHA, Base-SHA, Draft-State, Mergeability und exakte Diff-Dateien erfassen; Konflikte, Stacks, überholte oder redundante PRs markieren.
2. **Abhängigkeiten auflösen:** zunächst Root-PRs, dann die daran hängende Kette topologisch; 3 nicht zuordenbare Base-Branches sowie ihre Nachfahren vor jeder Integration gesondert prüfen.
3. **Sicherheitsreview:** zwei Paar Augen, bei Sicherheits-/Datenschutzcode unabhängig vom Autor; CODEOWNERS-Spezialreviews; kein Selbst-Approval; offene Threads und veraltete Reviews blockieren.
4. **CI exakt am zu mergenden SHA:** Typecheck, Lint, Tests, Firebase Emulator Rules/Negativtests, Secret-/Dependency-Scans, gegebenenfalls Playwright, Performance-/Security-Gates; grün auf vorgelagertem Stack-SHA ist unzureichend.
5. **Merge jeweils einzeln:** Feature-Branch neu gegen aktualisierten `main` integrieren, erneut validieren, Merge erst nach bestätigtem Review. Danach `main`-Checks und Regressionen verifizieren; bei Fehler Stopp.
6. **Ältere PRs schließen** nur mit dokumentiertem Ersatz-/Supersession-Link und Nachweis, dass deren notwendige Änderungen tatsächlich enthalten sind; niemals ohne Prüfung pauschal schließen.
7. **Produktions-GO:** unabhängig von PR-Anzahl, nur mit vollständiger E3/E4-Betriebsnachweisführung und E5-Sign-offs auf dem integrierten Release-SHA.

## Aktuelle Besonderheiten

- [#163](https://github.com/Veselin-Takev/Klar-Dating/pull/163) war bei der zuletzt detaillierten Prüfung `mergeable_state=dirty`, [#166](https://github.com/Veselin-Takev/Klar-Dating/pull/166) `unstable`; vor Maßnahmen frisch abrufen.
- Das bestehende Ruleset #25756841 fordert `validate`, aber `required_approving_review_count=0`, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `required_review_thread_resolution=false` (API geprüft).
- [#314](https://github.com/Veselin-Takev/Klar-Dating/pull/314) hat eine Dokumentationskorrektur zur **automatisch durch einen GitHub-Commit erzeugten** Vercel-Preview erhalten. Ein `READY`-Build beweist keine funktionsfähige Express-API.
- Die bereits vorhandene stündliche Automation **Klar Enterprise Freigabe-Watch** wurde wieder aktiviert; keine zweite Automation erstellt.

## Offene Evidenz

Alle 152 Diffs, Mergeability-Zustände und PR-Reviewverläufe sind **nicht** individuell geprüft. Vor einem ersten Merge: aktuelle E2-Logs/Review-Evidenz und E3-Emulator-/E4-Staging- oder Live-Befunde für den konkret betroffenen Integrationsschritt nachreichen. Keines der 152 Drafts erhielt mit diesem Bericht eine Merge-Freigabe.
