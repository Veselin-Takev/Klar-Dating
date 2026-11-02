# Offene PRs: Abhängigkeitsinventar und Merge-Gates (2026-11-02)

> **BLOCKED / NO-GO** – Nur Bestands- und Abhängigkeitsprüfung. Das Dokument ist weder Code-Review noch Merge-Freigabe; `productionApproved=false`.

## Verifizierte Baseline

- Repository: [Veselin-Takev/Klar-Dating](https://github.com/Veselin-Takev/Klar-Dating); `main` SHA: `96c3857c53f5ced31fe1394895185f42c75bc716`.
- GitHub REST `pulls?state=open`, **beide Seiten** (100 + 53 Ergebnisse): **153 offen, davon 152 Draft und 1 nicht-Draft**. **42 PRs zielen direkt auf `main`**, **111 auf andere Branches**.
- 108 von 111 Nicht-main-Basen entsprechen dem Head eines anderen offenen PR; 3 Basen haben **keinen** Head in der offenen PR-Liste (dies belegt nicht, dass der Branch fehlt). **16 PRs** sind dadurch ohne belegte durchgängige offene-PR-Kette zu main. Längste beobachtete Kette: Tiefe 35 (main-basierter PR = Tiefe 0).
- Die Zuordnung per `titleArea` ist eine **heuristische Titelkategorie**, keine individuelle P0/P1-Triage. Die SHA-Bindung ist im [maschinenlesbaren Inventar](./OPEN_PR_INVENTORY_2026-11-02.json) enthalten.

- **P0 #202:** [Review- und CI-Entscheidungsmatrix zu den konkurrierenden Root-PRs](./P0_202_MERGE_READINESS_2026-11-02.md): #269 als enger erster Review-Kandidat, aber weder Merge-GO noch Cloud-Abnahme.

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

## Belegte Dateikollisionen: P0 #202 (Read-only-Patch-Review)

Es wurden für [#160](https://github.com/Veselin-Takev/Klar-Dating/pull/160), [#203](https://github.com/Veselin-Takev/Klar-Dating/pull/203), [#231](https://github.com/Veselin-Takev/Klar-Dating/pull/231) und [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) die vollständigen geänderten **Dateinamen** und die GitHub-File-Patches von `phase2_work/functions/src/deleteExpiredPhotos.ts` sowie `phase2_work/functions/src/retention.ts` überprüft (nicht der gesamte PR-Diff).

- **Alle vier PRs ändern beide aktiven Legacy-Dateien.** Gemeinsame geänderte Dateien je PR-Paar: #160/#203 **7**, #160/#231 **8**, #160/#269 **6**, #203/#231 **8**, #203/#269 **6**, #231/#269 **7**. Eine parallele oder blinde Merge-Welle ist dadurch ungeeignet.
- Die geprüften `retention.ts`-Patches von #160, #231 und #269 ersetzen `deleteExpiredPhotoPage` durch einen fail-closed Fehler; die Fehlermeldungen und begleitenden Tests unterscheiden sich. #203 verändert stattdessen auch den autoritativen Löschpfad und die Metadatenverarbeitung.
- Alle vier Patches zu `deleteExpiredPhotos.ts` entfernen oder unterbinden die altersbasierte Verifikationsfoto-Löschung und erhalten eine begrenzte `funnel_events`-Bereinigung. **Diese Code-Absicht ist kein Beleg für ein sicheres, aktives Cloud-Scheduler-Deployment oder funktionierende generation-gebundene Löschbelege.**
- **Merge-Entscheidung offen:** Testmatrix/Diff-Vergleich der vier Kandidaten, ein autoritatives Integrationsziel, ergänzende statt duplizierte Negativtests, gesondertes SRE-Deployment-/Rollback-Gate, unabhängige Reviews. Andere PRs nur nach dokumentiertem Supersession-Nachweis schließen.

**CI-Prinzip:** Historische erfolgreiche `validate`-Runs gelten nur für die jeweilige SHA. Aktueller P0-Review-Kandidat #269 hat auf integriertem Commit `895aaa3da2056d7799f887596b89c09207699925` [CI 41527555204](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41527555204) vollständig bestanden; er bleibt ohne unabhängiges Review Draft und ohne Merge-Freigabe. Der Audit-Draft #313 hatte auf Head `f4c619574f6b2c0d3f8f4ac1849db515cc334b15` [CI 41527711443](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41527711443) erfolgreich abgeschlossen; jede weitere Dokumentationsänderung verlangt frische exakte CI. Das offene Governance-Draft #251 wurde ohne Dateienkonflikt mit `main` synchronisiert und ist weiterhin ohne independent Reviews; siehe [Release-Regel-Review-Gate](https://github.com/Veselin-Takev/Klar-Dating/pull/251).

## P0 #202: zweite, getrennte Löschpfad-Abnahme (02.11.2026)

Die generation- und entscheidungsgebundene Implementierung aus [Draft #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) wurde anhand von Quelltext und vorhandenen Tests geprüft. [Sicherheits-/Race-/Retry-Prüfmatrix](./P0_202_DECISION_PURGE_RACE_REVIEW_2026-11-02.md) dokumentiert Intent, Firestore-Lease, GCS-Generation, `404`-/`412`-Recovery, Legal Holds und Cross-Service-Race. #203 ist auf SHA `09baf8910c812d664457a908f9f2d991b87aa664` CI-grün, aber Draft, drei `main`-Commits veraltet und ohne unabhängige Reviews; es darf nicht blind mit dem quellenbasierten Kill-Switch #269 gemergt werden. Alle Evidenzstufen und tatsächlichen operativen Löschbelege bleiben getrennt. Weiterhin `productionApproved=false`, **NO-GO**.

Governance-Draft [#251](https://github.com/Veselin-Takev/Klar-Dating/pull/251) wurde nach erfolgreicher CI auf dem vorherigen Head `e6d8b841...` um einen fail-closed-Guard gegen Wildcard-Branch-Ausschlüsse und vier Negativtests erweitert. Der neue Code-Review-Head bedarf eigenständiger exakter CI und unabhängiger Freigaben; eine aktive Änderung des GitHub-Admin-Rulesets wurde nicht vorgenommen.

## Änderung seit dem vorherigen 152er-Inventar – neuer PR #315 (2026-11-02)

[Dependabot-PR #315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) ist der **einzige nicht-Draft** unter den nun **153 offenen PRs**. Sein Head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d` ändert nur den `actions/attest`-Commit in `.github/workflows/release.yml`. [Enterprise CI 41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) ist **FAIL**: `check:release-workflow` verlangt noch den alten festen attest-Pin. Das erzwungene Fail-Closed-Verhalten darf nicht durch Auskommentieren des Checks umgangen werden. Der neue SHA `4d7d407517fe0a9f57ab8ca277dfd2efb1188c7f` wurde im offiziellen `actions/attest`-Repository als Commit verifiziert; dies ersetzt keine unabhängige Supply-Chain-Prüfung.

**Konsolidierung statt blindem Merge:** Im bereits bestehenden [Governance-Draft-PR #251](https://github.com/Veselin-Takev/Klar-Dating/pull/251), neuer Head `89f0e744fa31d4f6dfb487acce8a9f4c2e4f8d8e`, wurden der Release-Workflow und der gepinnte Validator **atomar** auf denselben neuen SHA abgestimmt; Provenance-, Digest-, SBOM- und GO-Prüfungen bleiben erhalten. [CI 41533779126](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41533779126) auf neuem Head war zuletzt **in progress**. Noch ausstehend: unabhängiges Action-/Security-Review, human approvals, aktivierte Ruleset-Anforderungen, erfolgreiche exakte CI. Erst wenn die genehmigte Änderung tatsächlich in `main` ist, darf #315 mit Nachweis des enthaltenen Pins als superseded eingeordnet werden. #315 bleibt offen/ungeprüft, kein Auto-Merge.

**Bestandsschutz:** Die JSON-Liste ist nun mit allen 153 aktuellen PR-Head-SHAs synchronisiert. 108 der 111 abhängigen Base-Branches zeigen auf Head-Branches anderer offener PRs; 3 sind nicht zugeordnet. Die erste 152er-Zählung ist historisch und keine aktuelle Freigabe-Evidenz. `productionApproved=false`, **NO-GO**.

## Vercel-Demo-Stilllegung und aktuelle Governance-CI (02.11.2026)

Das überflüssige Vercel-Projekt `login-page-prototype` (`prj_kfJ06pJHn3neZAkrtasYKezxuprF`) wurde vom Eigentümer gelöscht. Verifizierung: zweimaliger Vercel-API-404 für Demo-Projekt bzw. projektspezifische Deployments, Team-Projektliste mit nur einem verbleibenden Projekt `klar-dating`; letzteres weiterhin intakt. [Nachweis mit Grenzen](VERCEL_LEGACY_PROTOTYPE_RISK_2026-11-02.md). Kein Widerruf externer Datenbank-Credentials nachgewiesen; Provider-Nachprüfung bleibt offen.

[Governance-/Supply-Chain-Draft #251](https://github.com/Veselin-Takev/Klar-Dating/pull/251) SHA `89f0e744fa31d4f6dfb487acce8a9f4c2e4f8d8e`: [CI 41533779126](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41533779126) jetzt **completed/success**. Weiterhin Draft und ohne unabhängig qualifizierte Reviews; aktives GitHub-Ruleset #25756841 fordert noch immer 0 Approvals. [P0-Kill-Switch #269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) bleibt ebenfalls CI-grün, aber Draft/unreviewed. Dokumentationsänderungen in Audit-PR #313 müssen auf ihrer neuen exakten SHA erneut durch CI laufen. `productionApproved=false`.
