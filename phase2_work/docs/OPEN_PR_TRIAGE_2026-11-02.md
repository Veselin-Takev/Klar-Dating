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

## P0 #254 – Tenant-FQDN-Subdomain-Hint gegen Claim durchsetzen (02.11.2026)

[Multi-Tenant-Foundation-Draft #253](https://github.com/Veselin-Takev/Klar-Dating/pull/253) auf `feature/multitenant-zero-trust-foundation-20261031` wurde ohne Dateikollision mit `main=96c3857c53f5ced31fe1394895185f42c75bc716` synchronisiert (Merge-Commit `df7af111fe51ff04eaab9a6f8ea95996f0417886`; `ahead=8,behind=0`, neun PR-Dateien). Ein **konkreter Routing-Hint-Validierungsfehler** wurde isoliert behoben: `hostname=tenant-two.klar.example.` mit gültigem DNS-Root-Punkt wurde vorher nicht als abweichender Subdomain-Tenant erkannt. Jetzt normalisiert `tenantAuth.ts` genau einen Root-Punkt vor dem vertrauenswürdigen Suffix-Vergleich, verweigert mehrere Root-Punkte mit 403 und behält signierte JWT-/Tenant-/Membership-Checks bei. Vitest enthält einen positiven FQDN-Fall und mehrere negative Mismatch-/Fehlformfälle.

**Exakter PR-Head nach Tests/Dokumentation:** `036ee313747a7beb2ab926e721e3bef958304447`, [CI 41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) zuletzt **pending**. Kein claim eines Test-PASS für diese SHA. [Vollständige Quell-/Grenzen-Dokumentation](https://github.com/Veselin-Takev/Klar-Dating/blob/feature/multitenant-zero-trust-foundation-20261031/phase2_work/docs/MULTITENANT_FOUNDATION_2026-10-31.md). Noch **kein** aktivierter Tenant-Middleware-Cutover, keine Legacy→Tenant-Datenmapping-Evidenz, keine Art.-17/BOLA-/Firestore-/Storage-Rules-Migration und keine unabhängige Security-/DPO-/SRE-Abnahme. Die FQDN-Korrektur ist keine Produktionsfreigabe; `productionApproved=false`, **NO-GO**.

**Andere exakte CI:** #203 `ee79035116fe9880517086f488b03abf7ec19e97` [41536146230](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41536146230) inzwischen `completed/success`; #313 auf früherer SHA `76c6b71f74ccfe718936c4ba94f8fe12e8b2e038` [41536232759](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41536232759) ebenfalls `completed/success`. Neue Dokumentationscommits auf #313 brauchen eigene exakte CI. Alle bleiben Drafts ohne menschliche Reviews; GitHub Ruleset #25756841 erzwingt weiterhin 0 Approvals.

## Live-CI-Checkpoint — 2026-11-02, 22:49 UTC (Read-only-Abfrage)

GitHub-Connector-Readback der exakten PR-Head-SHAs; diese Momentaufnahme ist keine unabhängige Security-Abnahme und kein Nachweis eines aktuellen Cloud-Produktionszustands:

| PR | Exakter Head | PR-Zustand | GitHub Actions (PR-Commit) | Ergebnis |
| --- | --- | --- | --- | --- |
| [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | `895aaa3da2056d7799f887596b89c09207699925` | Draft | [41527555204](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41527555204) | completed/success |
| [#251](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | `89f0e744fa31d4f6dfb487acce8a9f4c2e4f8d8e` | Draft | [41533779126](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41533779126) | completed/success |
| [#253](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | `036ee313747a7beb2ab926e721e3bef958304447` | Draft | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) | in_progress; nicht PASS |
| [#313](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | `80207d4e1075039dd171ba9c5a13f704f5308f99` | Draft | [41540168620](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41540168620) | in_progress; nicht PASS |
| [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) | `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d` | Nicht-Draft | [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) | completed/failure; kein Merge |

Die separaten Commit-Status-Contexts melden für diese SHAs teils `Vercel: success`; sie belegen **nicht**, dass der GitHub-Enterprise-Workflow oder die Produktions-Gates bestanden wurden. Für den **vorliegenden Dokumentations-Commit** muss der neue exakte Head erneut geprüft werden, bevor irgendein CI-PASS für ihn behauptet werden darf.

**Weiteres Vorgehen:** CI #253 und #313 bis zum Terminalzustand verifizieren; für #315 Pin-/Validator-Konsistenz nur nach unabhängiger Supply-Chain-Prüfung und freigegebener Integration von #251 erneut bewerten. Zuerst das unabhängige Reviewer-/Ruleset-Gate schließen, danach #269 und #203 sequenziell unter getrennter Privacy-/Race-Abnahme; #254 und reale #8-Betriebsevidenz bleiben eigenständige P0-Gates. Keine Freigabe durch Zeitablauf, CI-Status oder Dokumentation allein. `productionApproved=false`; **BLOCKED / NO-GO**.

## Follow-up CI verification — 2026-11-02

Read-only exact-SHA GitHub Actions recheck: PR #253 head `036ee313747a7beb2ab926e721e3bef958304447` run [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) now **completed/success** (previously in progress). Audit PR #313 head `8b96dc54de1a8c706f818cdd73c61cf5415e0b77` run [41540679206](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41540679206) is **in_progress**, not PASS. PR #269 and #251 remain completed/success on their recorded SHAs; #315 remains completed/failure. This documentation change creates another audit HEAD that must itself be revalidated. All release approvals and live tenant isolation, retention and operations evidence remain outstanding; `productionApproved=false`, **NO-GO**. No merge or deployment authorized.

## Exact-SHA CI follow-up — 2026-11-03

GitHub PR-commit workflow readback: audit Draft [#313](https://github.com/Veselin-Takev/Klar-Dating/pull/313) head `0c524ff5f9cbf0cda1b21ba852ef26d593573f01` had [run 41541779167](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41541779167) `completed/success`. Draft [#253](https://github.com/Veselin-Takev/Klar-Dating/pull/253) head `036ee313747a7beb2ab926e721e3bef958304447` had [run 41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) `completed/success`. Draft #269 head `895aaa3da2056d7799f887596b89c09207699925` had run 41527555204 success; Draft #251 head `89f0e744fa31d4f6dfb487acce8a9f4c2e4f8d8e` had run 41533779126 success. Dependabot [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d` had run 41531498018 `completed/failure`.

These results apply **only to the exact checked SHAs**, not this documentation commit. No independent AppSec/DPO/SRE/release approval, production deployment, active retention TTL, scheduler state or tenant-isolation live evidence was verified in this check. Required next steps: independent reviewer governance (#73/#251), staged #269 then #203 safety verification, #254 tenant BOLA/Art17 migration evidence, #315 pin validation, and #8 real operational controls. No merges, deployments, or production mutations authorized. `productionApproved=false`; **BLOCKED / NO-GO**.

## Independent-review gate verification — 2026-11-03

Live GitHub GraphQL review submissions for PRs #313, #269, #203, #251, and #253 returned **empty review arrays (0 reviews each)**. Exact-commit CI success does not satisfy independent AppSec, DPO/Legal, SRE or Release Owner approval. Audit PR #313 prior HEAD `2b9b3ad07efaf90b781f0dcca8108dff863027fe` passed [CI 41543116970](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41543116970) (`completed/success`). Other exact-head CI successes: #269 run 41527555204, #203 run 41536146230, #251 run 41533779126, #253 run 41539994863. #315 run 41531498018 remains `completed/failure`.

**Fail-closed decision:** no draft promotion, merge, production deployment or live tenant/storage mutation. Before any integration, independently validate code owners and enforced branch rules (#73), request qualified reviewer signoffs, then verify P0 photo-retention races and deployed scheduler, tenant BOLA/IDOR and Art. 17 evidence, supply-chain pin integrity and production controls (#8). The new documentation commit will need its own exact-head CI. `productionApproved=false`; **NO-GO**.

## CI recheck and no-approval guard — 2026-11-03

Exact-HEAD GitHub Actions readback for Audit Draft #313 at `e2c151de0bbad80f7c642a383da8dcd39e7e2e52`: [run 41544111396](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41544111396) **in_progress** at check time. No PASS is claimed for this SHA. Other unchanged Draft heads and successful PR workflow runs: #269 `895aaa3da2056d7799f887596b89c09207699925` / 41527555204; #203 `ee79035116fe9880517086f488b03abf7ec19e97` / 41536146230; #251 `89f0e744fa31d4f6dfb487acce8a9f4c2e4f8d8e` / 41533779126; #253 `036ee313747a7beb2ab926e721e3bef958304447` / 41539994863. Dependabot #315 `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d` / 41531498018 remains failed.

Review-submission verification previously returned zero reviews for #313/#269/#203/#251/#253; absence of independently signed AppSec/DPO/SRE/release approvals remains a hard blocker. Prioritize approval enforcement and evidence before any code merge. No production or `main` changes authorized. This documentation update itself requires exact-HEAD CI revalidation. `productionApproved=false`; **NO-GO**.

## Audit CI terminal-state verification — 2026-11-03

The exact prior audit branch HEAD `f61c0cd9415120d3bb0015bfe32df3f393f75ed3` passed [GitHub Actions run 41545265920](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41545265920) (`completed/success`). Read-only recheck confirms Draft #269 run 41527555204, Draft #203 run 41536146230, Draft #251 run 41533779126, and Draft #253 run 41539994863 completed successfully on their previously recorded exact SHAs. PR #315 run 41531498018 remains `completed/failure`.

**Release controls unchanged:** no independent approvals demonstrated, no real staging/production retention, scheduler, tenant-isolation, restore or alert evidence supplied. A passing CI does not permit merging a Draft or production deployment. Keep `productionApproved=false`, **BLOCKED / NO-GO**. This new docs commit will require its own CI; do not extrapolate the preceding run.

## Exact-commit CI confirmation — 2026-11-03 (run 41546180071)

Read-only GitHub Actions verification: audit PR #313 head `8b72def855e75928663d1eef3832aa840e94eab1` [run 41546180071](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41546180071) is `completed/success`. Unchanged exact-head results: #269 run 41527555204 PASS, #203 run 41536146230 PASS, #251 run 41533779126 PASS, #253 run 41539994863 PASS; #315 run 41531498018 FAIL. These are GitHub Actions outcomes, not independent production validation.

Do not merge drafts or deploy: reviewer signoffs and enforceable code-owner protections, photo-retention and race safety in staging, tenant migration/BOLA/Art17 evidence, supply-chain pin correction, and live operational controls remain outstanding. New documentation HEAD needs fresh CI. `productionApproved=false`; **BLOCKED / NO-GO**.

## P0 #269 code-diff review and actionable gate — 2026-11-03

Reviewed the actual changed-file patches in [PR #269](https://github.com/Veselin-Takev/Klar-Dating/pull/269), rather than relying only on CI labels. In `functions/src/deleteExpiredPhotos.ts` the legacy scheduler no longer imports `getMaintenanceBucket` or invokes `deleteExpiredPhotoPage`; the exported scheduler name and unrelated bounded `funnel_events` cleanup remain. `functions/src/retention.ts` replaces the upload-age scanner with an unconditional fail-closed throw before Storage access. Dedicated regression tests and source checks are included. This supports the source-only kill-switch design, **not** the state of deployed Cloud Scheduler/Functions or a validated decision-aware purge.

A concrete [PR #269 review-gate comment](https://github.com/Veselin-Takev/Klar-Dating/pull/269#issuecomment-6591554247) requests independent AppSec/DPO/SRE reviews, live scheduler/IAM inventory, pending-photo survival in staging, generation/404/412/legal-hold evidence, exact-SHA tests, and safe sequencing with #203. No review approval was submitted by this audit; no Draft promotion or merge. `productionApproved=false`; **NO-GO**. The new documentation SHA must pass its own CI.

## P0 #203 code-diff review and destructive-boundary gate — 2026-11-03

Reviewed changed-file patches in [Draft #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203), including `src/server/routes/complianceStorage.ts`, `verificationPurgeScan.ts`, `storageRetentionEngine.ts`, Storage rules and negative tests. Observed source controls: Storage generation metadata inspection and `ifGenerationMatch` delete precondition, temporary/event-based hold rejection, bounded 25-item/4-page scan and lease/cursor logic. These controls alone **do not** establish race-free real-cloud behavior or legal compliance.

[Actionable review comment](https://github.com/Veselin-Takev/Klar-Dating/pull/203#issuecomment-6591689401) requests independent AppSec/DPO/SRE signoff; staged 412 replacement/404 missing-object, lease recovery, retry/audit idempotency and decision/hold revalidation at the destructive boundary; exact-SHA integration with #269; deployed scheduler/IAM evidence. Audit Draft #313 prior head `0bd4e6974aea8bbc707571bc454b4e06067cd35f` had [run 41549047239](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41549047239) `in_progress` at read time, not a PASS. This documentation change needs its own CI. No merge/deployment; `productionApproved=false`; **NO-GO**.

## P0 #203 TOCTOU boundary review — 2026-11-03

Inspected exact PR #203 head `ee79035116fe9880517086f488b03abf7ec19e97` in `src/server/routes/complianceStorage.ts`. `deleteVerificationStorageFile` inspects the GCS generation, optionally runs `beforeDelete()` (Firestore authorization recheck), then invokes `file.delete({ ifGenerationMatch: generation })`. Source comment explicitly acknowledges that cross-service updates **after** the callback need operational fencing. GCS generation CAS protects against replacement, but not a same-generation concurrent Firestore decision/hold update. This is an **unproven risk requiring adversarial testing**, not a confirmed exploit.

[Follow-up PR review comment](https://github.com/Veselin-Takev/Klar-Dating/pull/203#issuecomment-6591715108) requests a deterministic pause between recheck and delete, decision/hold mutation without object replacement, documented fencing/compensation and independent AppSec/DPO acceptance. Audit PR #313 previous SHA `0e9620194d102ed14907faa0c292558b35e3189a` had [CI 41550082577](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41550082577) `in_progress` when checked; no PASS claimed. New docs commit needs fresh CI. No main change/merge/deployment. `productionApproved=false`; **NO-GO**.

## Adversarial cross-service race characterization added to #203 — 2026-11-03

Added a deterministic adversarial characterization test to [PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203), code commit `7e17baa2f27b6d96b6ed829f416d67e325e5c2ac`, file `tests/complianceStoragePurge.spec.ts`. The test pauses the mock GCS deletion after `beforeDelete` authorization, mutates the Firestore-equivalent decision from `approved` to `pending` without changing generation, then releases deletion. Its **current expectation deliberately observes deletion**, proving the test harness can expose the TOCTOU window in the existing algorithm; it does **not** claim remediation or production safety. Real Firestore/GCS concurrency and legal-hold tests remain mandatory. CI on the new PR #203 head has not been verified. Audit PR #313 prior head `a6c8dd5701f59e331f6d1f27e6e253eeb319f276` had run 41550286339 `pending` at the last read. Do not promote/merge/deploy. `productionApproved=false`; **NO-GO**.

## Adversarial test CI result and cross-service mitigation gate — 2026-11-03

PR #203 exact head `7e17baa2f27b6d96b6ed829f416d67e325e5c2ac` [GitHub Actions run 41550434817](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41550434817) completed **success** after adding the deterministic authorization-to-delete TOCTOU characterization test. **The test expects the vulnerable race behavior and therefore a green CI does not prove the race is fixed.** Direct source inspection confirms that `deleteVerificationStorageFile` executes `beforeDelete` transaction then GCS `file.delete({ ifGenerationMatch: generation })`; the surrounding code acknowledges a residual cross-service window. The existing purge intent and lease are useful controls but not atomic Firestore/GCS fencing.

Required remediation design review: explicitly define whether decision/hold updates must be rejected or queued while a purge intent is in a nonterminal state; enforce the protocol in **every** writer, include lease expiry/recovery and crash cases, verify a deterministic adversarial test now asserts **no deletion** after revocation, and secure independent AppSec/DPO acceptance. Avoid a false claim of global atomicity from GCS generation CAS alone. Audit #313 previous head `986aac37f3375c0ce52a4c61d19e577764552dda` CI 41550463587 was `in_progress` at check time. This docs commit requires fresh exact-SHA CI. No merges or deployments. `productionApproved=false`; **NO-GO**.

## All-writer fencing acceptance contract — 2026-11-03

Added an [implementation acceptance contract to PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203#issuecomment-6591994722) for the still-open cross-service TOCTOU window: enumerate **all** Firestore decision/hold/path/intent writers; enforce a shared transactional state machine; explicitly reject or defer conflicting updates while purge is in flight; fence stale lease owners; test crash/retry/404/412/audit receipt paths; require independent AppSec/DPO/SRE staged acceptance. The CI-green characterization test on #203 `7e17baa2f27b6d96b6ed829f416d67e325e5c2ac` (run 41550434817) **deliberately confirms unsafe deletion after revocation** and is not a remediation. Audit #313 prior head `6306713e281192dd4935da079329dc4a2e09cfc2` run 41551454284 was `in_progress` when checked. No new safety implementation is claimed. This documentation commit needs its own CI. No merge/deployment; `productionApproved=false`; **NO-GO**.

## Final-authorization revocation negative test — 2026-11-03

Audit PR #313 previous exact head `158830d3fd11358fd411a5cef7981fcd83b961a6` passed [GitHub Actions 41552438883](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41552438883). Added an additional negative test to [PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203), commit `5eaf88784aee333d3e9b2f2d7bb75aacd8a77927`, in `tests/complianceStoragePurge.spec.ts`: the mocked moderation decision is revoked during the metadata read, before final authorization; the callback must reject and Storage delete must not be called. This validates the **pre-callback** guard only. The previously characterized **post-callback** cross-service race is still open; all-writer fencing, real staging tests and independent approvals remain mandatory. New test and documentation SHAs require separate CI verification. No merge/deployment; `productionApproved=false`; **NO-GO**.

## Purge test CI verified; audit receipt is not deletion fencing — 2026-11-03

PR #203 exact head `5eaf88784aee333d3e9b2f2d7bb75aacd8a77927` [run 41556509748](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41556509748) completed **success**. Direct source review: after GCS deletion, the Firestore audit transaction revalidates the lease and eligibility before writing `photoPurgeProof`. That prevents some false-success receipts but cannot undo a delete that raced with a post-callback decision revocation. The new test only covers pre-callback revocation. [Follow-up review note](https://github.com/Veselin-Takev/Klar-Dating/pull/203#issuecomment-6592639449) reiterates the P0 post-callback fencing requirement. Audit PR #313 prior SHA `5eb14f5a8708ca1197f710371330ea6462bbf7a2` run 41556526889 was `in_progress` when checked. No independent security signoff, production evidence, merge or deployment. This docs commit requires its own CI. `productionApproved=false`; **NO-GO**.

## Authoritative writer inventory finding — 2026-11-03

Default-branch source inspection found `phase2_work/src/server/klarCore.ts` moderation decision transaction updates both user and verification request records, and `tx.create`s a new `verification_events` document with decision, due date and storage path. The Draft #203 purge revalidates fields of the event document. **Architecture gap to resolve:** whether later revocations/holds are authoritative in the user/request record or event snapshot, and whether all writers synchronize/fence those records. A direct mutation of event status in a mock TOCTOU test is not evidence that production writers actually mutate that field. [PR #203 comment](https://github.com/Veselin-Takev/Klar-Dating/pull/203#issuecomment-6596985778) requests canonical source-of-truth and writer inventory before fencing design. No remediation or production approval claimed; `productionApproved=false`; **NO-GO**. This docs commit requires exact-SHA CI.

## Verification state authority: code-level mapping — 2026-11-03

Read-only comparison of current default-branch `src/server/klarCore.ts` and PR #203 head `5eaf88784aee333d3e9b2f2d7bb75aacd8a77927`:

| Lifecycle operation | Source / state | Observed write or read |
| --- | --- | --- |
| Photo submission | `klarCore.ts` ~293-310 | Creates `verification_requests`, sets `users.verificationStatus=in_pruefung` and request/path |
| Moderation decision | `klarCore.ts` ~368-383 | One Firestore transaction updates `users` and `verification_requests`, **creates** a separate `verification_events` record with `entscheidung`, `storagePath`, `fotoLoeschenAb` |
| Retention eligibility | PR #203 `complianceStorage.ts` ~97-115, ~250-282 | Checks **event** decision/path/due date, lease and `photoPurgeIntent`; no user/request reread is shown in this code path |
| Destructive operation | PR #203 `complianceStorage.ts` ~37-49 | GCS metadata generation, Firestore `beforeDelete`, then generation-conditional GCS delete; no cross-service atomicity |
| Receipt | PR #203 `complianceStorage.ts` ~310-330 | Post-delete event/lease revalidation and `photoPurgeProof`; cannot reverse deletion |

**Decision required before remediation:** establish whether `verification_events` is immutable history or authoritative mutable retention state; identify which later user/request moderation and legal-hold writers may supersede it. Design a consistent state transition and conflict policy, including all writers, not just the purge worker. Test event-vs-user/request divergence and post-callback revocation with an explicit expected no-delete policy. Do not infer a real exploit solely from mocked event mutation. #203 remains Draft; #313 exact head `555bf7fe73300c34c05d0321545f974a18ea355c` run 41589714436 was `in_progress` when checked. This documentation commit needs exact-SHA CI. `productionApproved=false`; **NO-GO**.

## Retention authority ADR decision gate — 2026-11-03

Audit PR #313 exact previous head `29dcd305634177d9b1b7a4e570050ecbddcce4d1` passed [GitHub Actions 41590391720](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41590391720). Reviewed #203 current purge scan and original moderation transaction. Proposed an explicit [architecture decision review on #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203#issuecomment-6597240661): event history vs canonical mutable per-artifact authorization, versioned state transitions for **all** moderation/hold/revocation/purge writers, defined point-of-no-return and late-change policy, stale-worker fencing, crash recovery and compensating action. A GCS generation CAS plus a Firestore predelete transaction is not atomic across systems. This is a recommendation requiring owner/independent AppSec/DPO/SRE acceptance, **not an implemented fix**. No merges or deployment; `productionApproved=false`; **NO-GO**. New documentation HEAD must pass its own CI.

## P0 purge acceptance matrix — 2026-11-03

Audit #313 head `f871183021aa29d3b6412399c7ce3c90b07de36b` passed [CI run 41591621051](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41591621051). #203 remains Draft at `5eaf88784aee333d3e9b2f2d7bb75aacd8a77927` (CI 41556509748 PASS). Both PRs had no requested reviewers shown in the current PR metadata; this is **not** proof of complete review status.

| Gate | Deterministic acceptance evidence | Current evidence / result |
| --- | --- | --- |
| Authority | ADR identifies canonical current per-artifact status and immutable audit record; inventory every writer | Event snapshot vs user/request authority unresolved — **BLOCKED** |
| Writer fencing | Concurrent decision/hold mutation after purge authorization cannot cause forbidden delete; cover all writers | Characterization test observes deletion — **FAIL as security property** |
| Worker ownership | Expired lease and late worker cannot delete after successor takes ownership | Source lease checks exist; interleaving test needed — **UNVERIFIED** |
| Storage CAS | Replaced generation yields 412 and never deletes replacement; 404 does not fabricate success | Unit-level negative tests present; staging evidence missing — **PARTIAL** |
| Crash recovery | Repeated invocation and cursor/receipt are idempotent after partial failure | Source intent/receipt exists; integrated recovery evidence missing — **UNVERIFIED** |
| Cloud controls | Deployed old cron disabled, scheduler IAM, logs, alerts and restore evidence | No live evidence collected — **BLOCKED** |
| Independent release | AppSec, DPO/Legal, SRE and release owner approvals on exact SHAs | No signoffs verified — **BLOCKED** |

**Release rule:** All mandatory gates need verified evidence and independent approval; a CI-green characterization of an unsafe interleaving cannot be counted as a security PASS. No merge/deploy; `productionApproved=false`, **NO-GO**. This new documentation SHA requires separate CI verification.

## Proposed ADR: verification-photo retention authority and fencing — 2026-11-03

**Status: PROPOSED, NOT APPROVED OR IMPLEMENTED.** Exact-head verification: audit Draft #313 `1fd733b7c41dd78ee88e3b867a14e34ad8723f16` passed [Actions 41592387002](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41592387002); purge Draft #203 `5eaf88784aee333d3e9b2f2d7bb75aacd8a77927` passed [Actions 41556509748](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41556509748). Review submission arrays for both PRs are empty.

### Proposed invariants

1. `verification_events` is append-only evidence, **not** the sole mutable authorization source. A per-artifact authoritative retention record, bound to `uid`, request ID, immutable object path and object generation, carries `state`, `version`, `hold`, `leaseOwner`, `leaseEpoch`, `leaseUntil` and audit references. This is a **design proposal**, not a claim about existing schemas.
2. Every moderator, hold, revocation, Art. 17 and purge writer must transact against the same record with an expected version and explicit permitted transitions. No direct bypass via alternate endpoints, Firestore rules or admin jobs.
3. Define a point-of-no-return transition and legal policy. A conflicting hold/revocation before this point must prevent physical deletion. After that point, the API must not falsely promise that deletion can be cancelled; any later request needs an auditable conflict/compensation workflow. An in-flight GCS delete cannot be atomically rolled back through Firestore.
4. Worker fencing must reject stale lease epochs and require bounded retries; generation CAS protects against replaced objects but **does not** fence an unchanged generation against a changed Firestore decision. Crash recovery and indefinite stuck states require defined transitions and alerts.
5. Privacy minimization: never log biometric image bytes or raw sensitive payloads; persist only necessary redacted evidence, retention purpose and decision provenance. Preserve immutable audit evidence separately from deletion authority.

### Required acceptance tests (fail-closed)

- Pause immediately after final authorization, then issue a competing hold/revocation without replacing the object; verify **no forbidden delete** under the approved policy. The existing characterization test expects deletion and therefore does not satisfy this gate.
- Two workers compete for the same lease; a stale epoch must not perform a late destructive action after takeover.
- GCS 412 generation mismatch and 404 absent object must produce correct idempotent outcomes without false audit success; include retries and worker crash between delete and receipt.
- Cross-record divergence: current user/request status supersedes an old `verification_events` snapshot; verify that a stale event alone cannot authorize purge.
- Verify deployed old scheduler disabled, least-privilege IAM, alerting, rollback, data-retention policy and legal-hold enforcement in a staging environment.

**Decision owners:** Security/AppSec, DPO/Legal, SRE/Operations and Release Owner. They must approve the authority model, late-revocation policy and destructive-boundary semantics before implementation can be called production-ready. No approval, merge or deployment inferred. `productionApproved=false`; **BLOCKED / NO-GO**. The newly created documentation SHA needs its own exact-head CI verification.

## Owner-approved Dependabot #315: verified CI failure and safe integration — 2026-11-03

**Owner approval is confirmed, but CI remains failed.** [PR #315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) exact head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`, owner review `APPROVED`, no reported merge conflict, [Actions run 41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) `completed/failure`. Inspected job `validate` 125572558770: step 18 `Enterprise static gates` fails in `check:release-workflow` with provenance-attestation invariant error. The PR changes **only** `.github/workflows/release.yml`, from `actions/attest@b60c2628ab941b449db82e38ba8d500980ce8a54` to `actions/attest@4d7d407517fe0a9f57ab8ca277dfd2efb1188c7f`.

**Root cause verified:** the current `main` `phase2_work/scripts/check-release-workflow.mjs` still demands the old full SHA, while unmerged governance Draft #251 already contains the new expected SHA. The failure is a deterministic source-policy mismatch, **not proof of an upstream action defect**. The updated validator in #251 has additional governance dependencies, so blindly cherry-picking that entire file is not an approved minimal fix. [Concrete review/triage comment](https://github.com/Veselin-Takev/Klar-Dating/pull/315#issuecomment-6597644576) published.

**Safe next actions:** independently verify upstream action provenance and intended release behavior; make a minimal reviewed validator+workflow integration on a feature branch or integrate reviewed #251 first; retain exact SHA, subject digest, registry attestation and fail-closed rules; rerun GitHub Actions on the resulting **new exact head** and inspect full validation. Do not rerun the unchanged failing SHA as a substitute for remediation. Owner approval alone is not a merge authorization; #315 remains unmerged and `productionApproved=false`.

Audit Draft #313 prior exact head `59780048e223c44b7546c0af28a65bbefc7c1706` passed [Actions 41593510135](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41593510135). This documentation commit requires separate CI. No main merge, deployment or live-system mutation. **NO-GO**.

## Dependabot #315 remediation implemented as Draft #316 — 2026-11-03

Audit #313 prior exact head `290adbbddf113cef16745d09d9130e51e5050c95` passed [Actions 41594548881](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41594548881). Created dedicated feature branch `fix/attest-pin-validator-20261103` from owner-approved but CI-failed #315 head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`. On this branch, commit `b1b669ed5e80a6572dc60bdbbbc08e02650283be` changes **only** the validator's expected full SHA in `phase2_work/scripts/check-release-workflow.mjs` to `4d7d407517fe0a9f57ab8ca277dfd2efb1188c7f`. The branch also carries the single-file `release.yml` update from #315. Opened [Draft PR #316](https://github.com/Veselin-Takev/Klar-Dating/pull/316) against `main` with **two changed files**, no gate bypass. GitHub initially returned `mergeable=false` for the new PR; do not interpret this as a proven file conflict without further checks.

**Required next evidence:** exact-head CI on #316, upstream SHA provenance/security review, independent approval, and safe sequencing against overlapping Draft #251 and owner-approved #315. #315's original CI remains failed; #316 does not retroactively validate it. No merge/deployment/main mutation. `productionApproved=false`; **NO-GO**. This docs commit also requires its own CI.

## PR #316 exact-head CI successful; release approval remains blocked — 2026-11-03

Read-only exact-head GitHub validation: [Draft PR #316](https://github.com/Veselin-Takev/Klar-Dating/pull/316) commit `b1b669ed5e80a6572dc60bdbbbc08e02650283be`, [Actions 41596122104](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41596122104) **completed/success**; the `validate` job completed successfully with no failed steps. PR is currently mergeable, but review submission list is empty. Owner-approved [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) remains on old commit `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d` with Actions 41531498018 **failure** and one `APPROVED` review. Do **not** transfer #315's approval to #316 or claim #315 has been repaired in place. Audit Draft #313 prior commit `4212082b6ec53d32c673c8970e5cd5a5b557abd8` passed Actions 41596140666; no submitted reviews.

**Safe integration plan:** independent review of #316 and upstream action commit provenance; confirm digest-bound attestation works in an actual release workflow, not only the static validation; resolve overlapping changes with #251 and #315 in a single approved integration sequence; preserve all release gates and branch protections. Do not merge a Draft or deploy without those checks. New docs commit requires its own exact-SHA CI. `productionApproved=false`; **NO-GO**.

## Upstream actions/attest commit comparison — 2026-11-03

Direct GitHub upstream comparison `actions/attest` `b60c2628ab941b449db82e38ba8d500980ce8a54` → `4d7d407517fe0a9f57ab8ca277dfd2efb1188c7f`: new commit is an upstream descendant (**3 ahead, 0 behind**). Five changed files: `.github/workflows/codeql-analysis.yml`, `.github/workflows/prober.yml`, `dist/index.js` (+579/-113), `package-lock.json`, `package.json`. New head commit message describes dev-dependency bumps for nock, typescript-eslint and undici. **A changed bundled executable means ancestry alone is not a security signoff**. [PR #316 upstream review note](https://github.com/Veselin-Takev/Klar-Dating/pull/316#issuecomment-6598284160) requests independent bundle review, commit signature verification, action metadata/runtime compatibility and actual digest-bound release attestation evidence. Exact-head #316 CI 41596122104 remains PASS, Draft and without submitted reviews. Prior audit #313 commit `1dc00527f97b90e6328171ee9b9a2f5394540aaf` passed Actions 41597207287. No merge/deployment; `productionApproved=false`; **NO-GO**. New documentation SHA needs separate CI.

## Attestation release-path verification scope — 2026-11-03

Exact-head readback: [#316](https://github.com/Veselin-Takev/Klar-Dating/pull/316) `b1b669ed5e80a6572dc60bdbbbc08e02650283be`, [CI 41596122104](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41596122104) completed/success; [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) still failed on its old head. Current #313 head `cd9959abad23d023d2b26dfc61f202da74bb4b3e` had [CI 41599071795](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41599071795) `in_progress` at observation time. Draft #251 is CI-green but not integrated.

Reviewed exact #316 workflow and validator source: `.github/workflows/release.yml` uses `actions/attest@4d7d407517fe0a9f57ab8ca277dfd2efb1188c7f` with `subject-digest: ${{ env.KLAR_RELEASE_DIGEST }}`, `push-to-registry: true`, and `id-token/attestations/artifact-metadata: write`; it later calls `scripts/check-container-attestations.mjs`. `scripts/check-release-workflow.mjs` checks the presence of these literal strings and exact action SHA. This is a **static source gate**, not an execution of the production release tag path or independent verification of a GitHub-signed registry attestation. Require a controlled staging/tag release proving the actual digest, attestation predicate, subject and registry index match, with redacted evidence and reviewer signoff. Do not trigger a production release solely to satisfy this gate. No merge/deployment; `productionApproved=false`, **NO-GO**. This docs commit requires its own CI.

## Attestation authenticity gap in release verification — 2026-11-03

Exact-HEAD recheck: #316 `b1b669ed5e80a6572dc60bdbbbc08e02650283be` [CI 41596122104](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41596122104) completed/success, Draft/mergeable/unmerged. #315 remains failed/unmerged; #251 and #203 have passing CI on their exact heads but remain Draft/unmerged. #313 previous head `fd074de2236c018be5a4cf25709ce4a2c16346a5` [run 41599770946](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41599770946) was in progress at observation time.

**New verified source-scope finding:** `phase2_work/scripts/check-container-attestations.mjs` checks OCI image-index media type, runnable manifests, Docker `attestation-manifest` annotations and digest references. It does **not** perform cryptographic verification of the GitHub attestation signature, signer identity/issuer, predicate or trust chain. This is an evidence/control gap, **not proof of forged provenance**. [PR #316 security review comment](https://github.com/Veselin-Takev/Klar-Dating/pull/316#issuecomment-6598515448) requests a controlled nonproduction release verifying GitHub attestation authenticity, expected repository/workflow identity, subject digest, predicate and registry binding, plus a tamper/identity negative test. Preserve existing OCI-index validation as defense in depth. No merge/deploy; `productionApproved=false` **NO-GO**. This documentation commit needs exact-head CI.

## Current audit CI and attestation authenticity gate — 2026-11-03 09:15 CET

Audit Draft #313 exact head `5e77c290d7e90c8a426d6dc1f5868110f9609061` [CI 41600719469](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41600719469) completed/success. Attestation Draft #316 exact head `b1b669ed5e80a6572dc60bdbbbc08e02650283be` [CI 41596122104](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41596122104) completed/success. These checks establish static CI success only; no production provenance authenticity or independent signoff is inferred.

**Actionable evidence contract for release security:** in a controlled nonproduction release, record immutable image reference and digest; verify GitHub attestation cryptographically against expected repository/workflow identity, trusted issuer and predicate, ensure exact digest equality, and confirm published registry attestation references. Capture a negative test rejecting wrong digest/identity or tampered evidence. Record redacted logs, exact workflow run/SHA and independent reviewer decision. Keep existing OCI-index presence validation as an additional gate. Do not trigger production release to obtain evidence. #316 stays Draft until reviewed; `productionApproved=false`, **NO-GO**. This documentation commit requires its own CI.

## Moderation event writer inventory checkpoint — 2026-11-03

Audit #313 prior exact HEAD `788604cc356b02349af9ffc8a8eb4085bec6be03` [GitHub Actions 41601992771](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41601992771) completed/success. Examined default-branch `phase2_work/src/server/klarCore.ts`: the verification decision handler executes a Firestore transaction that updates the user and verification request, then **creates** a `verification_events` record with `entscheidung`, `decidedAt`, `storagePath`, `photoPurged: false`, and `fotoLoeschenAb` set to 30 days after decision. This is a confirmed **creation writer**, not evidence that all later mutators are enumerated or fenced. PR #203 separately updates `photoPurgeIntent` and `photoPurgeProof` during purge; the post-authorization GCS delete gap remains.

**Next implementation prerequisite:** inventory all server/Admin SDK and maintenance writers of `verification_events`, `verification_requests` and related holds (including account deletion and storage lifecycle paths); classify creation vs mutation and define immutable/allowed transitions; establish cross-writer fencing before claiming a post-callback no-delete invariant. Search was default-branch scoped and not a complete branch-aware code audit. Independent reviewers and staging concurrency tests remain required. This docs commit requires new CI. No main merge/deploy. `productionApproved=false`; **NO-GO**.

## Retention-P0: automatisiertes Writer-Inventar (03.11.2026)

Auf dem bestehenden [Draft #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203), Branch `fix/202-verification-photo-decision-retention-20261029`, wurde ein **technischer Quellcode-Gate** ergänzt:

- [Writer-Guard](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/scripts/check-verification-event-writers.mjs) inventarisiert direkte `verification_events`-Referenzen in Server- und Functions-Produktionsdateien und stoppt bei neuen, entfernten oder veränderten Referenzen.
- [Mutationstests](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/scripts/test-verification-event-writers.mjs) prüfen unbekannte Schreibdatei, zusätzlichen Zugriff, geänderte Operation und fehlende autorisierte Datei.
- `check:retention-p0` im `package.json` führt beide Prüfungen aus; `check:enterprise` ruft diesen Retention-Gate bereits auf.
- [Abgrenzung und tatsächliche vier Zugriffspfade](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/docs/VERIFICATION_EVENT_WRITER_INVENTORY_2026-11-03.md): `klarCore.ts` (Create), `datenschutz.ts` (Read), `trustAndSafety.ts` (Art.-17-Delete), `routes/complianceStorage.ts` (Purge Query/Intent/Proof).

**Branch-Head nach Dokumentation:** `0d4ee4773436c803701406c95cf39e9532bc36aa`; neuer [PR-CI-Lauf 41605092106](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41605092106) zum Prüfzeitpunkt **pending**. Voriger Code-Head `5ffb1c2bdd91c9bb7a61c6b740fb92010b1b651e` hatte [CI 41604972711](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41604972711) **in_progress**, also noch kein grüner Gate-Nachweis. Der neue Audit-Dokumentationscommit selbst benötigt anschließend exakte CI.

**Grenze:** Der Guard ist keine Laufzeit-Sperre und deckt keine dynamischen Collection-Namen, externen Admin-SDK-Jobs, Live-Scheduler oder Cloud-Policies ab. Die nachträgliche Decision-Revocation zwischen Firestore-Prüfung und physischer GCS-Löschung bleibt ein P0-Risiko. Erst ein durchgesetztes Fencing-Protokoll über **alle** Schreib-/Löschpfade, adversariale E3/E4-Tests und unabhängige AppSec/DPO/SRE-Abnahmen können den Sicherheits-Gate schließen. Weder `main` noch Produktion verändert; `productionApproved=false`; **BLOCKED / NO-GO**.

## P0-Writer-Gate: erste CI-Regression und gezielte Korrektur (03.11.2026)

Die neue [Quellcode-Grenzprüfung in Draft #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203#issuecomment-6599243926) wurde **tatsächlich durch CI ausgeführt**. [Run 41605092106](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41605092106) endete `completed/failure`: 4 von 5 Mutation-/Baseline-Tests bestanden, aber ein erklärender Kommentar in `functions/src/deleteExpiredPhotos.ts` nannte `verification_events.fotoLoeschenAb` und wurde zunächst fälschlich als zusätzlicher Zugriff erkannt. Das belegt einen Scanner-Fehlalarm, nicht einen erneut aktivierten Legacy-Delete.

Auf dem isolierten #203-Branch wurde die Prüfung auf **zitierte Collection-/Pfad-Literale** eingegrenzt und um zwei Tests erweitert: Kommentare ohne SDK-Aufruf dürfen keinen Fehlalarm auslösen; ein neues stringbasiertes Collection-Alias muss weiterhin erkannt werden. Der [genaue Code-Stand](https://github.com/Veselin-Takev/Klar-Dating/commit/dfc5a526031098b229b652de2f1f6e2bf698f167) `dfc5a526031098b229b652de2f1f6e2bf698f167` hat [CI 41605585813](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41605585813) zum Prüfzeitpunkt **in_progress**; kein PASS behauptet. [Dokumentierter Geltungsbereich](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/docs/VERIFICATION_EVENT_WRITER_INVENTORY_2026-11-03.md).

Die CI-Regel erkennt nur statische direkte Literale; dynamische/externe Admin-Zugriffe und die nachgelagerte Firestore/GCS-Race sind weiterhin nicht behoben. Kein produktiver Storage-, Ruleset- oder Release-Eingriff, kein Merge, kein `main`-Commit. `productionApproved=false`; **NO-GO**.

## P0 #202: widersprüchliche Moderationsfelder fail-closed (03.11.2026)

Im bestehenden [Draft PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) wurde eine zusätzliche, quellenbasiert begründete P0-Defensive umgesetzt: Das bisherige `entscheidung ?? status` ignorierte eine gegensätzliche `status`-Angabe, wenn `entscheidung` nicht null war. Der neue `readConsistentVerificationDecision`-Decoder prüft beide Felder unabhängig und blockiert widersprüchliche bzw. nicht als Löschfreigabe interpretierbare Werte. Er wird bei der Kandidatenauswahl **und** bei der letzten Firestore-Eligibility-Prüfung eingesetzt. Unit- und Firestore-Emulator-Negativtests prüfen Konflikte, fehlende Löschaufrufe sowie ausbleibende Intent-/Audit-Belege.

**Feature-Branch-Code und Dokumentation:** [Writer- und Entscheidungsinvarianten](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/docs/VERIFICATION_EVENT_WRITER_INVENTORY_2026-11-03.md), HEAD beim Dokumentations-Readback `4c7713325f30985ee52b229663d3ac9260b8bb8a`. **Für diese SHA noch kein bestätigter CI-PASS**. Frühere erfolgreiche PR-#203-Läufe gelten nicht als Nachweis für diesen neuen Code. Der Fehler ist ein potenzieller Fail-Open bei inkonsistenten Daten; ein konkreter produktiver Datensatz wurde nicht nachgewiesen.

**Separater aktueller Governance-Readback:** Das aktive GitHub-Ruleset `#25756841` verlangt weiterhin **0 Approvals**, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`; #203 und #313 haben bei der Abfrage **0 eingereichte Reviews**. Der eigentliche Firestore/GCS-Post-Authorization-TOCTOU-Race, Staging- und Live-Cloud-Nachweise sowie unabhängige DPO/AppSec/SRE-Freigaben bleiben offen. Nur isolierte Feature-/Audit-Dokumentationscommits, keine Merge-/Produktionsänderung. `productionApproved=false`; **BLOCKED / NO-GO**.

## P0 #202: Post-Intent-Entscheidungskonflikt im Emulator (03.11.2026)

Im isolierten [PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) wurde ein weiterer reproduzierbarer Firestore-Emulator-Test ergänzt: Auf dem zweiten Storage-Metadaten-Read wird nach gespeichertem `photoPurgeIntent` der kanonische Moderationswert auf `entscheidung='abgelehnt'` geändert, während der Legacy-`status='approved'` bleibt. Der Test verlangt, dass die finale Transaktionsprüfung den Konflikt abweist: HTTP 503, **kein** Storage-Delete, `photoPurged=false`, kein `photoPurgeProof`, Intent weiterhin nachvollziehbar. [Beschreibung und Testgrenzen](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/docs/VERIFICATION_EVENT_WRITER_INVENTORY_2026-11-03.md).

Neuer #203-Head `19959e28b890f35f729196da915756f67c67d4af`, [CI 41609087408](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41609087408) bei der Abfrage **pending**. Voriger Head `4c7713325f30985ee52b229663d3ac9260b8bb8a` [CI 41607941895](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41607941895) bei der Abfrage noch in Arbeit, ebenso der Audit-Head `774420594d41c79c1da98b17e6516bbe47f12a77` [CI 41608047494](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41608047494). **Kein Gesamt-CI-PASS für diese neuen Test-Commits bestätigt.**

Das zusätzliche Negativszenario stärkt den *Pre-Delete*-Guard, nicht die Cross-System-Atomizität. Der nach der letzten Firestore-Prüfung mögliche Statuswechsel bleibt P0-offen; unabhängige AppSec-/DPO-/SRE-Reviews, integrierter Merge-Kandidat sowie echte Staging- und Cloud-Nachweise fehlen. Kein `main`-Commit, kein Merge/Deployment. `productionApproved=false`; **BLOCKED / NO-GO**.

## P0 #202: widersprüchliche Datensätze pro Scan-Seite isoliert (03.11.2026)

Zusätzliche Code-Verbesserung im isolierten [Draft #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203): Ein fälliger Datensatz mit `entscheidung/status`-Konflikt brach bisher die komplette `docs.flatMap`-Verarbeitung ab, sodass andere valide, fristgerecht zu löschende Objekte derselben Seite nicht bearbeitet wurden. Jetzt werden **nur** bekannte `verification_photo_decision_conflict`-Datensätze lokal ausgesondert und weiterhin als `failedCount` gezählt; sonstige Exceptions bleiben fail-closed. Gültige Datensätze durchlaufen die unveränderte Storage-/Intent-/Audit-Sicherheit. Die Antwort der Seite bleibt wegen des widersprüchlichen Eintrags **HTTP 503** statt eines falschen 200-PASS.

Neu implementierter [Firestore-Emulator-Test](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/tests/verificationPurgeHttpEmulator.spec.ts): ein konflikthafter und ein gültiger Datensatz in derselben fälligen Seite → `processed=2`, `purgedCount=1`, `failedCount=1`, kein physischer Delete/Intent/Proof für den Konflikt, wohl aber Löschung samt Audit für den gültigen Datensatz. [Technisches Sicherheitsdokument](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/docs/VERIFICATION_EVENT_WRITER_INVENTORY_2026-11-03.md) aktualisiert.

Exakter vorheriger #203-Head `19959e28b890f35f729196da915756f67c67d4af` bestand [CI 41609087408](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41609087408) mit `completed/success`. Die neueste Dokumentations-SHA `6de27f14f016b041c445c044ea0269fb002134f1` hat [CI 41610502900](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41610502900) **pending** zum Zeitpunkt der Abfrage; eine ältere Code-SHA-CI wurde nach Folgecommit abgebrochen. **Kein CI-PASS für neuen Code behauptet**.

Die Firestore/GCS-Race **nach** der letzten Autorisierungsprüfung, fehlende unabhängige Reviews und Live-Cloud-/Scheduler-/Staging-Evidenz bleiben unverändert P0/P1-Freigabesperren. Kein `main`-Commit, Merge oder Deployment. `productionApproved=false` — **NO-GO**.

## P0 #202 – Default-Deny-Betriebssperre für Foto-Purge (03.11.2026)

**Neue echte Code-Änderung auf [Draft #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203):** Die signierte Route `POST /api/admin/purge-verification-storage` erhält zusätzlich zu HMAC/Lease/Storage-Generation eine **standardmäßig geschlossene Betriebs-Sperre**. Nur ein exakter serverseitiger Wert `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED=true` erlaubt, den Purge auszuführen. Bei fehlendem oder abweichendem Wert wird **503 `verification_storage_purge_disabled`** zurückgegeben, noch vor Firestore-Lease, `getDb` oder GCS; falsche HMAC-Signatur bleibt 401. Das ist eine ungemergte Sicherheitsmaßnahme zur Verhinderung versehentlicher destruktiver Aktivierung trotz offener Cross-Service-TOCTOU-Race – **kein** Nachweis vollständiger Löschsicherheit.

Ergänzt: Unit-Tests für exakt erlaubte/abgelehnte Switch-Werte; Firestore-Emulator-Test, in dem gültiger HMAC bei abgeschaltetem Interlock keine Datenbank-/Bucket-Operation auslösen darf; statischer `check:compliance-storage-purge`-Gate zur Sicherung des Interlocks. [Dokumentiertes Rollout-Verfahren](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/docs/VERIFICATION_EVENT_WRITER_INVENTORY_2026-11-03.md), aktualisierte [Retention-Policy](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/docs/DATA_RETENTION.md).

**Exakter Branch-Head beim Check:** `44661a051beed49f1d8c7253b1626e0c78c56614`, [GitHub Actions 41612527136](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41612527136) **pending**, kein CI-PASS. Nachfolgende Audit-SHA muss ebenfalls getrennt geprüft werden.

**Sicherheits-/Compliance-Grenze:** Der Default-Deny-Schalter schafft zunächst einen Löschrückstand und ist keine langfristige datenschutzrechtliche Lösung. Die aktive Retention-SLO, Backlog-Alarmierung, sichere Staging-Migration, all-writer Firestore/GCS-Fencing-Mechanik sowie unabhängige DPO/Legal-, AppSec-, SRE- und Release-Owner-Abnahmen müssen vor jeder Freischaltung belegt werden. Ohne diese Nachweise bleibt `productionApproved=false`, **BLOCKED / NO-GO**. Es erfolgte kein Merge, Cloud-Flag-Change oder Deployment.

## Signaturbindung: Raw-Body-Parservergleich und gezielter Fix (03.11.2026)

**Neuer konkret nachgewiesener Quellbefund in #203:** `src/server/routes/complianceStorage.ts` nutzte zuvor bei fehlendem `Buffer` ersatzweise `Buffer.from('{}')` als HMAC-Input. Gleichzeitig registrierte `server.ts` den globalen `express.json()`-Parser vor dem signierten Purge-Router. Ein reiner Route-`Buffer`-Zwang ohne Reihenfolge-Korrektur würde gültige Scheduler-Requests zurückweisen. Die Signatur muss stattdessen an die *tatsächlich empfangenen* Bytes gebunden werden.

**Gezielte Code-Härtung im isolierten [Draft #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203):**
- `server.ts`: Pfadspezifischer 2-kB-`express.raw`-Parser für `/api/admin/purge-verification-storage` **vor** dem globalen JSON-Parser; übrige Middleware und API-Limiter bleiben erhalten.
- `src/server/routes/complianceStorage.ts`: `Buffer.isBuffer(req.body)` vor HMAC erforderlich, sonst HTTP **415**; kein erfundener Ersatzbody. Unverändert: fehlende/ungültige HMAC → 401, Default-Deny-Deployment-Schalter → 503, bevor Firestore/GCS berührt werden.
- `tests/verificationPurgeHttpEmulator.spec.ts`: HTTP-Negativtest mit falschem Media-Type und gegen die tatsächliche Payload abweichend signiertem Body, ohne DB-/Storage-Intent-/Audit-Mutation.
- `scripts/check-compliance-storage-purge.mjs`: statischer Schutz der Parser-Reihenfolge und Verbot des HMAC-Fallbacks.
- [Details/technische Grenzen](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/docs/VERIFICATION_EVENT_WRITER_INVENTORY_2026-11-03.md).

**Neuer exakter Code-Head:** `885153dfc5bfba7d8a5ecfd41a8935c1195ab667` mit [GitHub Actions 41614325781](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41614325781) **pending** bei der Abfrage. **Nicht als PASS darstellen.** Frühere CI-Erfolge betreffen andere SHAs. Der neue Audit-Commit erfordert eigenständige CI.

Unverändert offen: Cross-Service-TOCTOU nach der letzten Autorisierung, All-Writer-Fencing einschließlich Art.-17-Kontolöschung, Live-Scheduler-/IAM-/Retention-Nachweise, unabhängige AppSec-/DPO-/SRE-/Release-Freigaben und Ruleset #73. Keine Änderung an `main`, keine Produktion, keine aktivierte Löschung. `productionApproved=false`; **BLOCKED / NO-GO**.

## Parser-Härtung #203: CI-Test-Inventar-Drift behoben (03.11.2026)

**Exakter CI-Fehler:** Code-Head `885153dfc5bfba7d8a5ecfd41a8935c1195ab667` hatte [GitHub Actions 41614325781](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41614325781) **completed/failure**. Static Gates, Typecheck und Functions Build waren erfolgreich; der Vitest-Satz meldete **1 Fehler / 1.432 Tests** (`tests/requestBodyPolicy.spec.ts:68`, `expected 15 to be 14`). Der neue Raw-Parser der HMAC-Compliance-Route erhöhte die Zahl bewusst von 14 auf 15; der alte Test war nicht aktualisiert.

**Behebung auf [Draft PR #203](https://github.com/Veselin-Takev/Klar-Dating/pull/203):** `tests/requestBodyPolicy.spec.ts` erwartet jetzt die 15. Parserregistrierung **und** kontrolliert explizit, dass genau ein auf `/api/admin/purge-verification-storage` begrenzter `express.raw`-Parser installiert ist, nach `rejectEncodedRequestBodies`, vor globalem `express.json` und vor Purge-Router. Die `inflate:false`-Prüfung bleibt für alle Parser erhalten. Keine produktive Feature-Flag-Aktivierung; keine Änderung an `main`.

**Nachweise:** [Test-Korrektur SHA 1acf3d77](https://github.com/Veselin-Takev/Klar-Dating/commit/1acf3d77e69fccc69ced15a2f370ce08cf4c57fc), [CI 41616689790](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41616689790) zum ersten Check noch **in_progress**. [Dokumentation in #203](https://github.com/Veselin-Takev/Klar-Dating/blob/fix/202-verification-photo-decision-retention-20261029/phase2_work/docs/VERIFICATION_EVENT_WRITER_INVENTORY_2026-11-03.md), Folge-Commit `52824889b5bcb4a7505d3c701ec59a1d78c40708` muss separat exact-SHA-verifiziert werden. **Kein CI-PASS für diese neuen SHAs vor finalem Workflow-Ergebnis.**

**Unverändert:** Post-Authorization-Firestore/GCS-Race P0, fehlende unabhängige Reviews, GitHub-Ruleset ohne Pflichtfreigaben, produktive TTL/Storage/Scheduler- und Multi-Tenant-Isolationsnachweise, Dependabot #315 FAILURE. `productionApproved=false`, **BLOCKED / NO-GO**.

## Exact-head production watch — 2026-11-10 09:32 UTC

**Fresh main:** `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. Its exact-head [validate run 42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488) / job `129478192916` completed **success, 33/33 steps**. This is CI evidence only; the main `phase2_work/RELEASE_MANIFEST.json` still states `decision=NO-GO` and `productionApproved=false`.

**Live Ruleset #25756841:** active on `refs/heads/main`; strict required check `validate`; required approving reviews **0**; CODEOWNER review **false**; stale-review dismissal **false**; thread resolution **false**; no bypass actors. Root `CODEOWNERS` blob `fcaacd9acc8007fa637720fb98fe50c23de7f07c` assigns all paths to `@Veselin-Takev`, not independent Security/Finance reviewers.

### Current PR inventory and stack shape

Fresh GitHub pagination returned **194 open PRs: 192 Draft, 2 non-Draft (#358 and #361)**. **50** target `main`, **144** target other branches; 141 non-main base refs match another open PR head, 3 base refs have no open parent PR, and maximum observed stack depth is **36 PRs**. The 3 unmatched bases are `docs/213-partner-concurrency-evidence-20261030`, `docs/48-atomic-referral-code-registry-adr-20261030`, and `docs/55-56-partner-trust-audit-20261030`. This replaces the 153-open-PR snapshot from 02.11.2026.

| PR | Exact current head SHA | Exact `validate` run / job | Result | Compare to fresh main | Submitted reviews |
|---|---|---|---|---:|---:|
| [#251](https://github.com/Veselin-Takev/Klar-Dating/pull/251) Governance | `7ff8b6d7350d336d2e1b4eb054f65d5f058ef91f` | 41999970921 / 127152420908 | success, 34 steps | ahead 9 / behind 2 | 0 |
| [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) Legacy purge | `fd68656957c01618c3a085e887ece504624d18b3` | 42020003801 / 127220743813 | success, 33 steps | ahead 33 / behind 2 | 0 |
| [#203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) Decision/generation purge | `1850e0a78b22e600e5add99273b84c081ffc3892` | 42017264009 / 127211414732 | success, 33 steps | ahead 57 / behind 2 | 0 |
| [#253](https://github.com/Veselin-Takev/Klar-Dating/pull/253) Multi-Tenant | `036ee313747a7beb2ab926e721e3bef958304447` | 41539994863 / 125601704190 | success, 33 steps | ahead 11 / behind 2 | 0 |
| [#313](https://github.com/Veselin-Takev/Klar-Dating/pull/313) Enterprise audit | `e7918eb4a952bdceaf55a0f489eefd4e21949d04` | 42786974334 / 129730563221 | success, 33 steps | ahead 75 / behind 2 | 0 |
| [#314](https://github.com/Veselin-Takev/Klar-Dating/pull/314) Vercel docs | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 41619572341 / 125861548924 | success, 33 steps | ahead 3 / behind 2 | 0 |
| [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) RC1 tenant migration | `1321c42ffe1c5919c1baccaada66a650ab811f93` | 42710380877 / 129478019942 | **failure** | ahead 50 / behind 0 from RC1 base | 0 |
| [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) Dependabot | `2f90d9fef013f7a7f070a3624cadd5fd62e914ff` | 42705724751 / 129461862107 | **failure** | ahead 1 / behind 2 | 0 |

All six named Draft PRs have completed successful `validate` checks on the exact SHAs shown, but all remain unreviewed and two commits behind current `main`. These are not merge approvals. PR #315 is **closed unmerged** (old head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`, run 41531498018 failed); its only APPROVED review was the repository owner's self-review, not an independent approval. #361 is the current Dependabot replacement, updating `actions/setup-java` to 6.2.0 and `actions/attest` to `badbb428b0055a04f53d6ce00bda98cf1c04e56e`.

**New non-Draft failures:**
- #358 is based on `release/v0.1.1-rc1`, not main. Its current exact-head Browser acceptance failed: `tests/e2e/privacy-settings.spec.ts:4:1` expected `Einwilligung wurde widerrufen.` but received `Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.`; 28 passed / 1 failed. The 1,636 PASS claim in its description is tied to older source SHA `951b16b243354321ca9c2c31bde8deab9e00060a`, not this current head.
- #361 fails `Enterprise static gates`: `check-release-workflow` requires a GitHub-signed provenance attestation bound to the immutable production image digest. Do not merge around this gate.

### P0/P1 source recheck on current main

- **#202 — confirmed source-level P0:** `phase2_work/functions/src/deleteExpiredPhotos.ts` blob `69c0ad42be40ac51f8aebd62741ae97bf5120f2a` schedules `deleteExpiredPhotosCron` every 24 hours and calls `deleteExpiredPhotoPage`. `retention.ts` blob `5f9014b9090042b1f501c70cb87c4a1fdeb51f0a` deletes objects when Storage `timeCreated` is older than 30 days, subject to holds and generation preconditions, but does not bind the deletion to a moderation decision or `fotoLoeschenAb`. This is main-source evidence, **not** proof that a specific Cloud Scheduler revision is currently deployed or enabled.
- **#70 — live evidence still open:** `configure-retention.sh` blob `b82be26bae598bc5acc907c91a8d31d4585392e8` now enumerates all 20 documented TTL groups and defaults to dry-run; apply is staging-only with explicit project/database/legal/inventory gates. The actual target project's **20/20 ACTIVE** policy state and approved Legal-Hold matrix were not verified.
- **#254 — tenant cutover blocked:** current main `server.ts` blob `808492df32ff4aa26958079895efae9a7c64a2b7` has no global tenant-auth/context mount; #253 remains unmerged. No complete legacy mapping, cross-tenant BOLA/IDOR or Art.17 cutover evidence.
- **#204 — source policy mismatch:** main `storage.rules` blob `b3d1e216ab9c0226ca14813799df4adb63bf7558` allows `/profiles/{uid}/{datei}` reads for any signed-in user.
- **#206 — revocable-media gap:** main `src/lib/klar.ts` blob `4c960dac7a552948df9b3ac7ea9601238d788492` persists Firebase `getDownloadURL()` in `users/{uid}.photoURL`.
- **#73 — independent review gap:** live Ruleset and root CODEOWNERS evidence above show zero required approvals and owner-only ownership. No independent reviewer is recorded.
- Issues [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70), [#254](https://github.com/Veselin-Takev/Klar-Dating/issues/254), [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8), [#73](https://github.com/Veselin-Takev/Klar-Dating/issues/73), [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204) and [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206) all remain open. #55/#56 remain legal/trust gates if partner monetization is in release scope; no new independent partner certification was obtained.

**#269/#203 integration warning:** their current diffs still overlap in exactly six paths: `phase2_work/docs/DATA_RETENTION.md`, `phase2_work/functions/src/deleteExpiredPhotos.ts`, `phase2_work/functions/src/retention.ts`, `phase2_work/package.json`, `phase2_work/tests/photoRetention.spec.ts`, and `phase2_work/tests/storageRules.spec.ts`. Do not merge independently or blindly.

### Vercel read-only recheck

Team `ves3` lists exactly one project: `klar-dating` / `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`. The old `login-page-prototype` project ID still returns **404 not_found**; no further deletion was attempted. Klar's project metadata reports `live=false` and Node `26.x`. Vercel lists a READY production-target deployment `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` bound to current main SHA `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`, and a READY **preview** `dpl_DGtK316K9tuqPYWG1vMotgaREt3a` bound to #313 exact SHA `e7918eb4a952bdceaf55a0f489eefd4e21949d04` (`target=null`). Project Node `26.x` differs from the manifest's Node `22.23.3`; reconcile with the owner before release. Neither READY state nor project existence proves live traffic or production approval. Neon/Postgres/Better-Auth provider credential rotation remains unproven.

**Decision:** `productionApproved=false`, **BLOCKED / NO-GO**. No exact integrated release SHA, independent Security/DPO/Legal/SRE/Finance/Release Owner approvals, live TTL/Cloud/Scheduler evidence or final tenant/purge/operations proof exists. This update is documentation-only on the existing audit branch; no main commit, merge, deployment, secret access, production Firebase/GCS/IAM/Scheduler/database mutation or code change was made. The new documentation head requires its own exact-head CI readback.


## 10.11.2026 – frischer Produktionsfreigabe-Watch und kontrollierte Supply-Chain-Korrektur

### Repository- und PR-Baseline

- Aktuelles main **2fa3ba223989ff248ad1abaea67f4f454f7c9f6b**. Exact-main validate Run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), Job 129478192916, completed/success (33 Schritte). Seit der alten Basis 96c3857... liegen zwei Main-Commits ausschließlich in PR-Hygiene-/Dokumentationspfaden; die sechs priorisierten Review-Branches sind weiterhin zwei Commits hinter main.
- GitHub-API-Inventar: **194 offene PRs = 192 Drafts + 2 nicht-Drafts**. Nicht-Drafts: [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) (RC1, Basis release/v0.1.1-rc1) und [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) (Dependabot, Basis main). 50 PRs zielen direkt auf main, 144 auf andere Branches; 53 Stack-Wurzeln, maximale beobachtete Stacktiefe 36. Größte Stacks: #269 (40 PRs / Tiefe 36), #317 (27 / 20), #203 (20 / 11), #253 (14 / 14), #192 (10 / 10).
- Aktives [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841): enforcement=active, strikter validate-Check und Schutz vor Löschen/Non-fast-forward; weiterhin **0 Pflichtapprovals**, require_code_owner_review=false, dismiss_stale_reviews_on_push=false, require_last_push_approval=false, required_review_thread_resolution=false, keine Bypass-Akteure. Das ist kein unabhängiger Review-Schutz.

### Exakte Head-/CI-/Review-Lage

| PR | Exakter Head-SHA | Exakter validate-Lauf / Job | Ergebnis | Reviews |
|---|---|---|---|---:|
| [#251 Governance](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | fc03f33996ccffc73e54e6b7a6fb05914cdcbc53 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / 129836618469 | **in progress**; Vercel pending | 0 |
| [#269 Legacy purge](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | fd68656957c01618c3a085e887ece504624d18b3 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / 127220743813 | success | 0 |
| [#203 Decision/generation purge](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | 1850e0a78b22e600e5add99273b84c081ffc3892 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / 127211414732 | success | 0 |
| [#253 Multi-Tenant](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | 036ee313747a7beb2ab926e721e3bef958304447 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / 125601704190 | success | 0 |
| [#313 Enterprise audit](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | 8ac4b6970f1b961da980dc3f291307392dd6a313 | [42810140008](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42810140008) / 129809201630 | success | 0 |
| [#314 Vercel docs](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | e5deab1dfd629065f3dfce3a5577eb21ac966a68 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / 125861548924 | success | 0 |

All sechs genannten Drafts bleiben unreviewed. Frühere grüne Läufe gelten nur für die exakten SHAs in dieser Tabelle; #251s neuer Head hat noch keine abgeschlossene CI. #269 und #203 überlappen weiterhin in exakt sechs Dateien (DATA_RETENTION.md, deleteExpiredPhotos.ts, retention.ts, package.json, photoRetention.spec.ts, storageRules.spec.ts); kein blinder Merge.

### Kontrollierte Remediation in #251

Dependabot [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) scheiterte auf exaktem Head 2f90d9fef013f7a7f070a3624cadd5fd62e914ff, Run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), bei Enterprise static gates: check-release-workflow erwartete noch den vorherigen actions/attest-Pin. Der neue Upstream-Commit badbb428b0055a04f53d6ce00bda98cf1c04e56e wurde im offiziellen actions/attest-Repository gelesen; GitHub meldet verification.verified=true.

Nur der bestehende dedizierte #251-Branch wurde aktualisiert (kein neues PR, kein main-Commit): unveränderlicher attest-Pin + Validator, eine fokussierte sechsfällige Positiv-/Negativ-Regressionssuite, CI-Aufruf und datierte Dokumentation, in einem Branch-Commit fc03f33996ccffc73e54e6b7a6fb05914cdcbc53. Die exakte CI [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) läuft **in progress**; kein Erfolg wird behauptet. Kein unabhängiges Supply-Chain-/Security-Review vorhanden; #361 nicht mergen oder schließen, bevor neue Branch-CI und unabhängiges Review abgeschlossen sind.

### RC1- und Dependabot-Nicht-Draft-Blocker

- [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358), Head 1321c42ffe1c5919c1baccaada66a650ab811f93, Run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877): **Browser acceptance FAIL**, 28 passed / 1 failed. privacy-settings.spec.ts erwartet nach Widerruf „Einwilligung wurde widerrufen.“, erhält aber „Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.“. Die 1.636-PASS-Angabe bezieht sich auf eine ältere SHA, nicht den aktuellen PR-Head. Keine Reviews.
- [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361), Head 2f90d9fef013f7a7f070a3624cadd5fd62e914ff, Run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751): **Enterprise static gates FAIL** wegen des nicht angeglichenen Provenance-Pins. Keine Reviews.
- [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) ist **closed/unmerged**; sein alter validate-Run 41531498018 war fehlgeschlagen. Die einzige APPROVED-Review war vom Repository-Owner selbst und ist keine unabhängige Freigabe.

### P0/P1-Belege und Betriebsstatus

- **#202 P0, im aktuellen main erneut bestätigt:** deleteExpiredPhotos.ts plant deleteExpiredPhotosCron alle 24 Stunden und ruft deleteExpiredPhotoPage auf. retention.ts listet verification/ und löscht bei timeCreated älter als 30 Tage; Hold- und Generation-Prüfungen existieren, aber keine Bindung an Moderationsentscheidung/fotoLoeschenAb. Das ist Source-Evidenz, kein Nachweis, dass eine bestimmte Scheduler-Revision aktuell live ist.
- **#70 P0:** 20 TTL-Gruppen sind im Provisionierungsskript erfasst und Apply ist kontrolliert/dry-run; 20/20 ACTIVE im Zielprojekt sowie Legal-Hold-/Art.-17-Verhalten bleiben live unbewiesen.
- **#254 P0:** Tenant-Foundation #253 bleibt ungemergt und nicht global aktiviert; Legacy-Mapping, Rules-/Storage-Migration, BOLA/IDOR und Art.-17-Cutover fehlen.
- **#73 P0 / Governance:** Live-Ruleset verlangt null Approvals; keine unabhängigen Reviewer in den priorisierten PRs.
- **#8 P0:** keine vollständigen produktiven Alert-Delivery-, Monitoring-, Backup/Restore-, RTO/RPO- und Release-Owner-Belege.
- **#55/#56 P0, sofern Partner-Monetarisierung im Release-Scope:** HMAC beweist Provider-Ursprung, nicht unabhängig Kauf-/Buyer-Authentizität; Tracking-Rechtsgrundlage, Token-Widerruf und freigegebene Retention fehlen.
- **#204/#206 P1:** Storage-Quellregel erlaubt Profilbild-Lesezugriff für jeden angemeldeten Nutzer, während das Policy-Modell Adult-Gates fordert; getDownloadURL() wird als photoURL gespeichert und bleibt ein widerrufbares Bearer-Capability-Problem. Kein Beleg für tatsächliche Live-Ausnutzung.

### Vercel read-only

Das Vercel-Projekt klar-dating (prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre) existiert weiterhin. Projektmetadaten melden live=false, Node 26.x und SSO für alle Nicht-Custom-Domains. Eine Production-target-Deployment-Revision dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w ist READY auf main SHA 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b; das beweist keinen Live-Traffic. Der aktuelle Audit-Preview dpl_3Rey2FabgTK5qhqrcS23HhTyq1CW ist READY, aber target=null. Die bestätigte Löschung von login-page-prototype wurde nicht erneut versucht; Neon/Postgres/Better-Auth-Credential-Rotation ist weiterhin nicht belegt.

**Entscheidung:** productionApproved=false, **BLOCKED / NO-GO**. Kein integrierter Release-SHA mit allen kritischen Tests, keine unabhängigen Security/DPO-/Legal/SRE/Finance-/Release-Owner-Freigaben, keine vollständigen Live-Purge-/TTL-/Tenant-/Betriebsbelege. Dieser Watch änderte ausschließlich zwei bestehende Review-Branches (#251 Remediation und #313 Dokumentation); keine Main-, Ruleset-, Secret-, Cloud-, Deployment- oder Produktionsdatenmutation.


## 10.11.2026 – exakter Nachlauf 13:28 UTC

### Frische Repository-Baseline und Stack-Inventar

- main bleibt **2fa3ba223989ff248ad1abaea67f4f454f7c9f6b**. Exakter Main-Run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), Job 129478192916: completed/success, 33 Schritte.
- Beide REST-Seiten der offenen PR-Liste ergeben weiterhin **194 offene PRs: 192 Drafts + 2 Nicht-Drafts**. 50 zielen direkt auf main, 144 auf andere Branches; 53 Stack-Wurzeln, maximale beobachtete Kettentiefe 36. 141 Nicht-main-Basen entsprechen einem anderen offenen PR-Head, 3 Basen sind nicht durch einen offenen PR-Head repräsentiert.
- Größte Stacks: #269 **40 PRs / Tiefe 36**, #317 **27 / 20**, #203 **20 / 11**, #253 **14 / 14**, #192 **10 / 10**. Das ist ein Abhängigkeitsinventar, keine Merge-Empfehlung.
- Nicht-Drafts: [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) (Release-Branch release/v0.1.1-rc1) und [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) (Dependabot gegen main). [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) ist **closed/unmerged**.

### Exakte Head-SHAs, Checks und Reviews

Alle sechs priorisierten Drafts haben einen abgeschlossenen validate-PASS auf dem jeweils unten genannten exakten Head; jeder PR hat **0 eingereichte Reviews**. Alle sechs Basen sind weiterhin **2 Commits hinter** dem frischen main-Head. Die grüne CI ersetzt weder Branch-Synchronisation noch unabhängige Reviews oder Live-Evidenz.

| PR | Exakter Head-SHA | validate / Job | Ergebnis | Vercel-Status | Reviews | Compare zu main |
|---|---|---|---|---|---:|---:|
| [#251 Governance](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | fc03f33996ccffc73e54e6b7a6fb05914cdcbc53 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / 129836618469 | success, 33 Schritte | success | 0 | 10 ahead / 2 behind |
| [#269 Legacy-Purge](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | fd68656957c01618c3a085e887ece504624d18b3 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / 127220743813 | success, 33 Schritte | success | 0 | 33 / 2 |
| [#203 Decision-/Generation-Purge](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | 1850e0a78b22e600e5add99273b84c081ffc3892 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / 127211414732 | success, 33 Schritte | success | 0 | 57 / 2 |
| [#253 Multi-Tenant](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | 036ee313747a7beb2ab926e721e3bef958304447 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / 125601704190 | success, 33 Schritte | success | 0 | 11 / 2 |
| [#313 Enterprise-Audit](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | a14d70d2b4e76c703be06cb9f4e61456301d92d6 | [42818827306](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818827306) / 129838770426 | success, 33 Schritte | success | 0 | 78 / 2 |
| [#314 Vercel-Doku](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | e5deab1dfd629065f3dfce3a5577eb21ac966a68 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / 125861548924 | success, 33 Schritte | **failure: build-rate-limit** | 0 | 3 / 2 |

- #251s Run 42818199684 ist jetzt **abgeschlossen erfolgreich**; #313 steht jetzt auf Head a14d70d2b4e76c703be06cb9f4e61456301d92d6 mit Run 42818827306 **abgeschlossen erfolgreich**. Frühere in_progress- und ältere #313-SHA-Angaben sind überholt.
- #269 und #203 überschneiden sich weiterhin in exakt sechs Dateien: phase2_work/docs/DATA_RETENTION.md, functions/src/deleteExpiredPhotos.ts, functions/src/retention.ts, package.json, tests/photoRetention.spec.ts und tests/storageRules.spec.ts. **Nicht blind oder unabhängig voneinander mergen.**

### Nicht-Draft-Fehler und Supply Chain

- [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361), Head 2f90d9fef013f7a7f070a3624cadd5fd62e914ff, Run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), Job 129461862107: **Enterprise static gates FAIL**. Der Log nennt konkret check:release-workflow: die Production-Container-Pipeline muss eine GitHub-signierte Provenance-Attestation an den unveränderlichen Image-Digest binden. Vercel-Status success; **0 Reviews**. Nicht unreviewed mergen.
- [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358), Head 1321c42ffe1c5919c1baccaada66a650ab811f93, Run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), Job 129478019942: **Browser acceptance FAIL**, 28 passed / 1 failed. tests/e2e/privacy-settings.spec.ts erwartet nach Consent-Widerruf „Einwilligung wurde widerrufen.“, erhält aber „Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.“; Timeout 5 s. Die Titelangabe 1.636 PASS ist nicht für diesen Head belegt; 0 Reviews.
- #315 bleibt closed/unmerged; sein Run 41531498018 scheiterte am attest-Pin. Die einzige APPROVED-Review stammte vom Repository-Owner und ist keine unabhängige Freigabe.

### P0/P1: aktueller Quell- und Betriebsbefund

- **P0 #202:** main enthält weiterhin den 24h-deleteExpiredPhotosCron; retention.ts löscht verification/-Objekte bei timeCreated älter als 30 Tage. Hold- und Generation-Prüfungen bestehen, aber der Pfad bindet die Löschung nicht an Moderationsentscheidung / fotoLoeschenAb. Das ist aktueller Source-Befund, **kein** Nachweis, dass genau diese Scheduler-Revision live aktiviert ist. #269/#203 sind ungemergt; #317 ist ein separater ungemergter Integrations-Stack.
- **P0 #70:** Das aktuelle Provisionierungsskript erfasst 20 TTL-Gruppen und ist standardmäßig Dry-Run-/Staging-begrenzt. Es fehlt weiterhin ein verifizierter **20/20 ACTIVE**-Nachweis im konkreten Zielprojekt/-datenbank sowie Legal-Hold-/Art.-17-Live-Evidenz.
- **P0 #254:** main mountet die neue Tenant-Middleware nicht; #253 ist Draft/unmerged. Legacy→Tenant-Mapping, Storage-/Firestore-Regel-Migration, Cross-/Same-Tenant-BOLA/IDOR und Art.-17-Cutover bleiben offen.
- **P0 #73 / Governance:** Ruleset #25756841 ist aktiv, verlangt aber weiterhin **0 Approvals**, kein CODEOWNERS-Review, keine Stale-Review-Entwertung, keine Last-Push-Approval und keine Thread-Resolution. validate ist der einzige strikte Pflichtstatuscheck.
- **P0 #8:** Produktive Alert-Zustellung/On-call-Ack, Monitoring, Backup/Restore, RTO/RPO, Canary/Rollback und Release-Owner-Belege fehlen weiterhin.
- **#55/#56:** Partner-HMAC belegt Provider-Ursprung, nicht unabhängig Kauf-/Buyer-Authentizität; Tracking-Rechtsgrundlage, Token-Widerruf und freigegebene Retention bleiben offen, falls B2B-Monetarisierung Teil des Release-Scope ist.
- **P1 #204/#206:** Storage-Regel und Adult-Policy-Engine widersprechen sich; getDownloadURL() wird als photoURL gespeichert und bleibt ein langlebiger Bearer-Link. Das sind Source-Risiken, keine Feststellung eines Live-Missbrauchs.
- Alle angeforderten Issues **#202, #70, #254, #8, #73, #55, #56, #204 und #206** sind weiterhin offen.

### Vercel read-only

- Projekt klar-dating (prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre) existiert weiterhin; Team ves3 listet genau dieses Klar-Projekt. Die Projektmetadaten melden live=false und Node 26.x (Abweichung vom Node-22.23.3-Manifest/CI-Pin; Owner-Abgleich offen).
- Produktionsziel-Deployment [dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w](https://vercel.com/ves3/klar-dating/AJRgtKhyoF4B8ypLkXBF8vMzw32w) ist READY, target=production, gebunden an aktuellen main-SHA 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b. Das beweist einen bereitgestellten Vercel-Build, nicht korrekte App-Funktion oder Live-Traffic.
- Audit-Preview [dpl_9xMYPNDg4jzHC6v2T1bY2RwRQ2QT](https://vercel.com/ves3/klar-dating/9xMYPNDg4jzHC6v2T1bY2RwRQ2QT) ist READY auf dem beobachteten #313-Head a14d70d2b4e76c703be06cb9f4e61456301d92d6, aber target=null (Preview). Die separate Projektflag-Angabe live=false bleibt zu klären.
- #314s Vercel-Status bleibt **FAILURE** (build-rate-limit); sein GitHub-validate-PASS ist davon getrennt. Die bestätigte Löschung des Altprojekts login-page-prototype wurde nicht erneut versucht; eine Rotation externer Neon/Postgres/Better-Auth-Credentials ist nicht belegt.

**Entscheidung bleibt productionApproved=false, BLOCKED / NO-GO.** Es gibt keinen integrierten Release-SHA mit allen Pflicht-Gates, keine unabhängigen Security-/DPO-/Legal-/SRE-/Finance-/Release-Owner-Freigaben und keine vollständigen Live-Purge-/TTL-/Tenant-/Betriebsnachweise.

**Änderungsumfang dieses Nachtrags:** ausschließlich Aktualisierung des Inventars und der Triage-Dokumentation auf dem bestehenden Audit-Review-Branch. Keine Code-/Teständerung, kein main-Commit, kein Merge, Deployment, Secret-Zugriff, Ruleset-, Firebase-, GCS-, IAM-, Scheduler- oder Datenbankeingriff. Der neue Dokumentationscommit erzeugt einen neuen #313-Head; die oben genannte CI auf a14d70d2... gilt ausdrücklich **nicht** für diesen neuen Head und muss erneut geprüft werden.


## Live checkpoint — 2026-11-10 17:08 CET (read-only GitHub/Vercel verification)

### Fresh repository and PR inventory

- Repository: `Veselin-Takev/Klar-Dating`, default branch `main`; fresh `main` HEAD: `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`.
- Current open PR inventory: **194 open / 192 Draft / 2 non-Draft**. Of these, **50** target `main` and **144** target other branches. **141** stacked PR base refs resolve to another currently open PR head; **3** do not (#219, #214, #213). Maximum open-PR reference-chain depth: **35**. Title-area labels remain heuristic, not severity ratings. Updated machine-readable inventory is in `OPEN_PR_INVENTORY_2026-11-02.json` (filename retained for continuity; `observedDate` updated to 2026-11-10).
- The two non-Draft PRs are #358 (RC1 branch) and #361 (Dependabot Actions group). Non-Draft status is not a merge approval.

### Exact-head CI, review and Vercel checkpoint

All six requested PRs #251/#269/#203/#253/#313/#314 still target `main` from base SHA `96c3857c53f5ced31fe1394895185f42c75bc716`; current `main` is two commits ahead of that base. Exact compare results below are `main`...PR-head:

| PR | State / exact head SHA | Compare ahead / behind | GitHub Actions exact-head result | Reviews | Vercel status |
| --- | --- | ---: | --- | ---: | --- |
| #251 Governance | Draft `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | Run [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684), job 129836618469 `validate=success` | 0 | success |
| #269 Legacy purge kill-switch | Draft `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | Run [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801), job 127220743813 `validate=success` | 0 | success |
| #203 Decision/generation-bound purge | Draft `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | Run [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009), job 127211414732 `validate=success` | 0 | success |
| #253 Multi-Tenant | Draft `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | Run [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863), job 125601704190 `validate=success` | 0 | success |
| #313 Enterprise audit | Draft `334e401ad6e3bf1d5a7971944ad17bf3880771e9` | 79 / 2 | Run [42826080280](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42826080280), job 129863614931 `validate=success` | 0 | success |
| #314 Vercel documentation | Draft `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | Run [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341), job 125861548924 `validate=success` | 0 | **failure: build-rate-limit**; no deployment record for this exact SHA |

The #269/#203 current-head diffs still overlap in exactly six files: `phase2_work/docs/DATA_RETENTION.md`, `phase2_work/functions/src/deleteExpiredPhotos.ts`, `phase2_work/functions/src/retention.ts`, `phase2_work/package.json`, `phase2_work/tests/photoRetention.spec.ts`, and `phase2_work/tests/storageRules.spec.ts`. Their separate green CI runs do not validate a combined integration. Draft #317 is the existing integration candidate (head `37c7487246303c5af1543ca1e5afe31e2cf2e0f4`): exact run [42078741460](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42078741460), job 127426427605 `validate=success`, 0 reviews, still based on the old main SHA. Do not blind-merge #269/#203 or #317.

Related supply-chain and RC PRs:
- #315 is **closed and unmerged** (`merged=false`), head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`; its old run 41531498018 failed. Its former owner approval does not transfer to another PR.
- Draft #316 remains open at `b1b669ed5e80a6572dc60bdbbbc08e02650283be`; run [41596122104](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41596122104), job 125783766115 `validate=success`, 0 reviews. It carries the prior `actions/attest@4d7d407...` validator/workflow alignment, but no independent upstream bundle/signature review or actual digest-bound release attestation.
- Non-Draft #361 is open at `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`; run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job 129461862107 **failure** at `check:release-workflow`: production container release must generate a GitHub-signed provenance attestation bound to the immutable image digest. 0 reviews; Vercel status success. Do not merge.
- Non-Draft RC1 PR #358 is open at `1321c42ffe1c5919c1baccaada66a650ab811f93` (base `release/v0.1.1-rc1`, 350 files). Run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job 129478019942 **failure**: Browser acceptance 28 passed / 1 failed in `tests/e2e/privacy-settings.spec.ts`; after consent withdrawal the test expected `Einwilligung wurde widerrufen.` but received `Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.`. 0 reviews; Vercel status success. The PR title's “1636 PASS” is not evidence for this exact head.

### Active main ruleset and issue status

Active repository ruleset [#25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) still applies to `refs/heads/main`. It requires the strict `validate` status check and prevents deletion/non-fast-forward, but `required_approving_review_count=0`, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `require_last_push_approval=false`, and `required_review_thread_resolution=false`. No independent PR review submissions were found for #251/#269/#203/#253/#313/#314/#316/#317/#358/#361.

All requested issues remain **open**: #202, #70, #254, #8, #73, #55, #56, #204 and #206.

### Fresh source and Vercel evidence

- On current `main`, `phase2_work/functions/src/index.ts` still exports both `deleteExpiredPhotosCron` and `purgeVerificationStorageCron`. `deleteExpiredPhotos.ts` calls `deleteExpiredPhotoPage`; `retention.ts` enumerates `verification/` objects and deletes when Storage `timeCreated` is older than 30 days (subject to object hold checks), without binding that legacy path to the moderation decision / `fotoLoeschenAb`. This is a current source finding, **not** proof that the legacy scheduler is enabled in production.
- `scripts/configure-retention.sh` defaults to dry-run and requires exact project/database, legal/inventory approvals and a staging-labelled project before TTL mutation. The actual target's 20/20 `ACTIVE` TTL state and legal-hold / Art.-17 behavior remain unverified.
- Current `phase2_work/server.ts` does not import/mount the draft tenant-auth middleware; `storage.rules` still permits profile reads with `signedIn()`; `src/lib/klar.ts` persists Firebase `getDownloadURL()` output as `photoURL`. These remain source-level P0/P1 concerns, not proof of live exploitation.
- Vercel read-only: team `ves3` lists exactly one project, `klar-dating` (`prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`). Project metadata reports `nodeVersion=26.x` and `live=false`. A deployment `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` is `READY`, `target=production`, and bound to current main SHA `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`; this deployment object alone does not prove real user traffic or application correctness. PR #314's Vercel check remains failed with `build-rate-limit`, and no deployment was returned for its exact head SHA.
- The old `login-page-prototype` project is not re-deleted or modified. Its earlier authenticated 404 evidence remains the recorded deletion proof; this does not revoke Neon/Postgres/Better-Auth provider credentials.

### Decision

`productionApproved=false`, **BLOCKED / NO-GO**. Missing gates include independent Security/AppSec, DPO/Legal, SRE, Finance where applicable and Release Owner approvals; exact integrated release SHA; real scheduler/IAM/GCS deletion and receipt/race evidence; 20/20 live TTL and legal-hold/Art.-17 proof; tenant migration/BOLA evidence; and production alert delivery, restore, canary and rollback evidence. No main merge, deployment, secret access/rotation, Vercel project deletion, Firebase/GCS/IAM/Scheduler/database mutation or human-attestation simulation was performed in this checkpoint.


## Live checkpoint — 2026-11-10 18:20 CET (read-only GitHub/Vercel verification)

### Fresh main, inventory and exact-head evidence

- Repository: `Veselin-Takev/Klar-Dating`; current `main` HEAD: `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. The exact main SHA has GitHub Actions run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `validate` = **completed/success**; Vercel status = success. Vercel also returns a `READY`, `target=production` deployment bound to this exact main SHA ([deployment](https://vercel.com/ves3/klar-dating/AJRgtKhyoF4B8ypLkXBF8vMzw32w)). Deployment metadata is not proof of user traffic, runtime correctness, or production approval.
- Current open PR inventory was re-read from both REST pages: **194 open / 192 Draft / 2 non-Draft**, **50** target `main`, **144** target other branches; 141 base refs resolve to another open PR head, 3 do not (#219/#214/#213), maximum open-PR reference-chain depth 35. The 2 non-Draft PRs are #358 and #361. The JSON inventory remains 194 entries; comparison with the fresh API found only one head-SHA change since its 16:08 UTC observation: PR #313. Updated `observedAt` and #313 head are recorded in `OPEN_PR_INVENTORY_2026-11-02.json`.
- All six requested active Drafts #251/#269/#203/#253/#313/#314 still target `main` from base SHA `96c3857c53f5ced31fe1394895185f42c75bc716`; current main is two commits ahead. Compare `main...PR-head`:

| PR | Exact current head SHA | Ahead / behind | Exact GitHub Actions result | Review submissions | Vercel status |
| --- | --- | ---: | --- | ---: | --- |
| #251 Governance | `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684), job 129836618469 `validate=success` | 0 | success |
| #269 Legacy purge kill-switch | `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801), job 127220743813 `validate=success` | 0 | success |
| #203 Decision/generation-bound purge | `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009), job 127211414732 `validate=success` | 0 | success |
| #253 Multi-Tenant | `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863), job 125601704190 `validate=success` | 0 | success |
| #313 Enterprise audit | `76f0157eb5c51974d2f6eb8ebb58143866107642` | 80 / 2 | **No GitHub Actions workflow run / no `validate` check on this exact head**; Vercel check only | 0 | success |
| #314 Vercel documentation | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341), job 125861548924 `validate=success` | 0 | **failure: build-rate-limit** |

- #269 and #203 still overlap in exactly six files: `phase2_work/docs/DATA_RETENTION.md`, `phase2_work/functions/src/deleteExpiredPhotos.ts`, `phase2_work/functions/src/retention.ts`, `phase2_work/package.json`, `phase2_work/tests/photoRetention.spec.ts`, and `phase2_work/tests/storageRules.spec.ts`. Separate green runs do not prove combined integration; no blind merge.
- #315 is **closed, unmerged** (`merged=false`), head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`; run [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) fails `Enterprise static gates` because `check:release-workflow` requires GitHub-signed provenance attestation bound to an immutable image digest. It has one historical APPROVED review from 03.11.; that approval does not transfer to another PR or resolve the failed gate.
- Non-Draft #361 is open at `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`, 0 reviews; [run 42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751) fails at the same release-workflow provenance-attestation gate. Vercel status is success. Do not merge.
- Non-Draft RC1 #358 is open at `1321c42ffe1c5919c1baccaada66a650ab811f93`, base `release/v0.1.1-rc1`, 0 reviews; [run 42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877) fails Browser acceptance: **28 passed / 1 failed**, `tests/e2e/privacy-settings.spec.ts`; after consent withdrawal, expected `Einwilligung wurde widerrufen.` but received `Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.`. Vercel status is success. The PR title's test count is not evidence for this exact head.

### Active Ruleset, issues and current source evidence

- Active [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) applies to `refs/heads/main` and requires strict `validate`, but currently has `required_approving_review_count=0`, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `require_last_push_approval=false`, and `required_review_thread_resolution=false`. No independent review submissions exist on #251/#269/#203/#253/#313/#314/#361/#358. Governance remains a hard release blocker.
- All requested issues remain **open**: #202, #70, #254, #8, #73, #55, #56, #204 and #206.
- Current `main` source still exports both `deleteExpiredPhotosCron` and `purgeVerificationStorageCron`. The legacy `deleteExpiredPhotosCron` is scheduled every 24 hours and calls `deleteExpiredPhotoPage`; `retention.ts` selects `verification/` objects by `timeCreated` older than 30 days (with hold checks and GCS generation precondition), not by the moderation decision / `fotoLoeschenAb`. This is a source-level finding, **not** proof that this scheduler is enabled in production.
- Issue #70 needs a more precise status: current `configure-retention.sh` now enumerates all 20 documented collection groups and defaults to dry-run; any apply is explicitly staging-only with exact project/database, legal, inventory and retention-matrix approvals. However, no scoped live `ACTIVE` readback for all 20 policies or independent legal-hold/Art.-17 evidence was obtained. Issue remains open and blocks GO.
- Current `phase2_work/server.ts` contains no tenant-auth middleware reference; #253 remains Draft/unmerged. `storage.rules` still has `allow read: if signedIn();` for `profiles/{uid}/{datei}`, and `src/lib/klar.ts` still persists Firebase `getDownloadURL()` as `photoURL`. These support source-level #254/#204/#206 concerns; they do not prove live exploitation.
- Vercel read-only: team `ves3` lists exactly one project, Klar `klar-dating` (`prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`). Its production deployment is `READY` and bound to current main SHA `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`; latest preview deployment is also `READY` on #313 head. The deleted demo project ID `prj_kfJ06pJHn3neZAkrtasYKezxuprF` still returns authenticated API 404 `not_found`; team list contains only Klar. No deletion was attempted. This does not revoke Neon/Postgres/Better-Auth credentials.

### Decision

`productionApproved=false`, **BLOCKED / NO-GO**. Required independent Security/AppSec, DPO/Legal, SRE, Finance where applicable and Release Owner approvals remain absent; no fully integrated release SHA with complete critical test, live purge/receipt/race, 20/20 TTL/legal-hold/Art.-17, tenant/BOLA, monitoring/restore/canary/rollback evidence has been established. No main merge, deployment, secret access/rotation, Vercel project deletion, Firebase/GCS/IAM/Scheduler/database mutation or human-attestation simulation was performed. This checkpoint is read-only except for this documentation-only update on the existing audit review branch.

 
## Live checkpoint — 2026-11-10 22:53 CET (read-only GitHub/Vercel refresh)

### Fresh main, PR inventory and exact-head CI

- Current main HEAD: 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b. Exact-head GitHub Actions run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job 129478192916 / validate: **completed/success**. Validation, typecheck, Functions build, tests, build, production smoke and browser-acceptance steps completed successfully. This is main CI evidence, not a signed release approval.
- Fresh REST inventory: **194 open PRs: 192 Draft, 2 non-Draft**. **50** target main, **144** target other branches; **141** base refs resolve to another open PR head, **3** do not; maximum observed open-stack depth **35**. The two non-Drafts are #358 (RC1) and #361 (Dependabot group update). The machine-readable inventory in this branch was refreshed at 2026-11-10T21:53:35Z.
- All six requested active Drafts still target main from base SHA 96c3857c53f5ced31fe1394895185f42c75bc716; current main is two commits ahead. GitHub compare main...PR-head reports behind=2 for each:

| PR | Exact current head SHA | Ahead / behind | Exact GitHub Actions run / job | Vercel | Reviews |
| --- | --- | ---: | --- | --- | ---: |
| #251 Governance | fc03f33996ccffc73e54e6b7a6fb05914cdcbc53 | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684), job 129836618469 validate=success | Preview check success | 0 |
| #269 Legacy purge kill-switch | fd68656957c01618c3a085e887ece504624d18b3 | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801), job 127220743813 validate=success | Preview check success | 0 |
| #203 Decision/generation-bound purge | 1850e0a78b22e600e5add99273b84c081ffc3892 | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009), job 127211414732 validate=success | Preview check success | 0 |
| #253 Multi-Tenant | 036ee313747a7beb2ab926e721e3bef958304447 | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863), job 125601704190 validate=success | Preview check success | 0 |
| #313 Enterprise audit | 82e413983a9d99fcc20be7c93fa54493116ed7ba | 82 / 2 | [42877363733](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42877363733), job 130044134479 validate=success | Preview deployment READY, target=null | 0 |
| #314 Vercel documentation | e5deab1dfd629065f3dfce3a5577eb21ac966a68 | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341), job 125861548924 validate=success | **failure: build-rate-limit; zero deployments for exact head** | 0 |

- Exact-head validate jobs above are green, but none of these six Drafts has a submitted independent review. A green Vercel preview comment or a green validate job does not replace Security/DPO/SRE/Release Owner review or live evidence.
- #269 and #203 continue to overlap in exactly six files: phase2_work/docs/DATA_RETENTION.md, phase2_work/functions/src/deleteExpiredPhotos.ts, phase2_work/functions/src/retention.ts, phase2_work/package.json, phase2_work/tests/photoRetention.spec.ts, and phase2_work/tests/storageRules.spec.ts. Do not merge them blindly or infer combined integration from separate CI runs.
- #315 is **closed, unmerged** (head 71743b14c66d9c5f2fdca2ed73a0fda3c137d48d); its historical failed attest gate is not a current open PR. The new non-Draft #361 is open at 2f90d9fef013f7a7f070a3624cadd5fd62e914ff, with zero reviews. Its exact run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job 129461862107, fails in **Enterprise static gates**: check:release-workflow requires a GitHub-signed provenance attestation bound to the immutable image digest. The PR proposes actions/attest commit badbb428b0055a04f53d6ce00bda98cf1c04e56e; do not merge or bypass the release gate.
- Non-Draft RC1 #358 is open on base release/v0.1.1-rc1, exact head 1321c42ffe1c5919c1baccaada66a650ab811f93, zero reviews. Exact run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job 129478019942, fails **Browser acceptance**: 28 passed / 1 failed. tests/e2e/privacy-settings.spec.ts:26 expected "Einwilligung wurde widerrufen." but received "Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.". The PR's older 1,636-pass claim is not evidence for this head.

### Active Ruleset, issues and source-level blockers

- Active [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) applies to refs/heads/main, enforces strict validate, but sets required_approving_review_count=0, require_code_owner_review=false, dismiss_stale_reviews_on_push=false, require_last_push_approval=false, and required_review_thread_resolution=false. It therefore does **not** enforce independent approvals.
- Issues **#202 #70 #254 #8 #73 #55 #56 #204 #206 all remain open**. Source evidence on current main: #202's legacy deleteExpiredPhotosCron remains scheduled every 24 hours and calls deleteExpiredPhotoPage; retention.ts still enumerates verification/ objects using Storage timeCreated and a 30-day age threshold, not the moderation decision / fotoLoeschenAb. This is a source-level release blocker, not proof that the deployed Scheduler is active.
- #70: configure-retention.sh now enumerates all 20 documented collection groups and refuses non-staging apply, but no target-environment 20/20 ACTIVE TTL readback or independent Legal-Hold / Art.-17 proof is available.
- #254: phase2_work/server.ts still does not mount the Draft tenant-auth middleware; #253 remains unmerged. #204/#206: storage.rules still allows profile-image reads for signedIn(), while src/lib/klar.ts stores Firebase getDownloadURL() in photoURL. These are source-derived access-control/privacy concerns, not proof of live exploitation.
- #8/#73 remain open; the live Ruleset still lacks mandatory approvals/CODEOWNERS enforcement. #55/#56 remain open; partner conversion authenticity, tracking consent, retention and Art.-17 evidence are not independently closed.

### Read-only Vercel state and decision

- Team ves3 currently lists exactly one project: klar-dating, ID prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre. Authenticated get_project returns 200; metadata says nodeVersion=26.x and live=false. Vercel separately returns production deployment dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w as READY, target production, bound to current main SHA 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b. This proves project/deployment records, not actual user traffic or runtime correctness.
- PR #313 has preview deployment dpl_CeRHFRsJuhN2xKigTfaA7DJbnVmh READY, target=null, on its exact head. PR #314 has no deployment for its exact head and its combined Vercel status is failure build-rate-limit. The previously confirmed deletion of login-page-prototype was not repeated or modified; no provider credentials were read, rotated or revoked.
- **Decision:** productionApproved=false, **BLOCKED / NO-GO**. No integrated release SHA has all required independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals plus live purge/receipt/race, TTL, tenant/BOLA, monitoring/restore/canary/rollback evidence. No main merge, deployment, secret access, Vercel deletion, or production Firebase/GCS/IAM/Scheduler/database mutation was performed in this checkpoint.


 
## Live checkpoint — 2026-11-10 23:21 CET (fresh read-only GitHub/Vercel refresh)

### Fresh main, open-PR inventory and exact-head CI

- Fresh main HEAD: `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. GitHub Actions check-run `validate` [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `129478192916`: **completed/success** on this exact main SHA.
- Fresh REST pull inventory: **194 open PRs: 192 Draft, 2 non-Draft**. **50** target `main`, **144** target other branches; **141** base refs resolve to another open PR head, **3** do not; maximum observed open-stack depth **35**. The two non-Drafts are #358 (RC1) and #361 (Dependabot). The previous 153/152/1 observation is stale.
- The six requested active Drafts still target `main` from base SHA `96c3857c53f5ced31fe1394895185f42c75bc716`; current main is two commits ahead. GitHub compare against current main reports behind=2 for each:

| PR | Exact pre-checkpoint head SHA | Ahead / behind | Exact GitHub Actions run / job | Vercel status | Reviews |
| --- | --- | ---: | --- | --- | ---: |
| #251 Governance/Supply-chain | `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684), job 129836618469 `validate=success` | success | 0 |
| #269 Legacy-photo kill-switch | `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801), job 127220743813 `validate=success` | success | 0 |
| #203 Decision/generation-bound purge | `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009), job 127211414732 `validate=success` | success | 0 |
| #253 Multi-Tenant | `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863), job 125601704190 `validate=success` | success | 0 |
| #313 Enterprise audit | `96cf28cf01a34dfc4a70a6a3932a2b7d79e2eab8` | 83 / 2 | [42910211274](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42910211274), job 130158605529 `validate=success` | success; preview READY, target=null | 0 |
| #314 Vercel | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341), job 125861548924 `validate=success` | **failure: build-rate-limit; no deployment for exact head** | 0 |

- The #313 row records the exact head **before this documentation-only checkpoint commit**. This update changes the existing audit branch head; run 42910211274 is not CI evidence for the new resulting SHA, which requires a fresh exact-head check.
- #269 and #203 still overlap in exactly six files: `phase2_work/docs/DATA_RETENTION.md`, `phase2_work/functions/src/deleteExpiredPhotos.ts`, `phase2_work/functions/src/retention.ts`, `phase2_work/package.json`, `phase2_work/tests/photoRetention.spec.ts`, and `phase2_work/tests/storageRules.spec.ts`. Separate green CI does not establish a safe combined integration.
- #315 is **closed, unmerged** (last head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`); its historical attest-pin failure is not a current open PR. New non-Draft #361 is open at `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`, with 0 reviews; exact run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job 129461862107, fails in **Enterprise static gates** because `check:release-workflow` requires a GitHub-signed provenance attestation bound to the immutable image digest. Do not merge or bypass this gate.
- Non-Draft RC1 #358 is open on base `release/v0.1.1-rc1`, exact head `1321c42ffe1c5919c1baccaada66a650ab811f93`, with 0 reviews. Exact run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job 129478019942, fails **Browser acceptance**: 28 passed / 1 failed. `tests/e2e/privacy-settings.spec.ts:26` expected “Einwilligung wurde widerrufen.” but received “Die Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.” The older 1,636-pass claim is not evidence for this head.

### Active Ruleset, issues and current source blockers

- Active [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) applies to `refs/heads/main`, enforces strict required status `validate`, blocks deletion and non-fast-forward, but has `required_approving_review_count=0`, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `require_last_push_approval=false`, and `required_review_thread_resolution=false`. The extra-approval-for-unattributed-changes rule is true; no live negative merge test demonstrates that this enforces independent Security/DPO/SRE approvals. Bypass actors are empty and current user cannot bypass.
- Issues **#202 #70 #254 #8 #73 #55 #56 #204 #206 all remain open**. Current-main source confirms #202: `deleteExpiredPhotosCron` is scheduled every 24 hours and invokes `deleteExpiredPhotoPage`; `retention.ts` still lists `verification/` objects and deletes by Storage `timeCreated` older than 30 days (while respecting holds/generation), not by moderation decision / `fotoLoeschenAb`. This is source-level evidence, not proof that the deployed Scheduler is enabled.
- #70: `configure-retention.sh` enumerates all 20 documented collection groups and has fail-closed staging-only apply gates, but no target-environment 20/20 ACTIVE TTL readback or independent Legal-Hold / Art.-17 evidence is available.
- #254: current `phase2_work/server.ts` contains no tenant-auth middleware mount; #253 remains Draft/unmerged. #204: `storage.rules` still allows profile-image reads on `signedIn()` alone. #206: `src/lib/klar.ts` still persists Firebase `getDownloadURL()` into `photoURL`. These are source-derived access-control/privacy concerns, not evidence of live exploitation.
- #8/#73 remain open; live Ruleset governance still does not require independent approvals or CODEOWNERS reviews. #55/#56 remain open; partner conversion authenticity, tracking consent, retention and Art.-17 evidence are not independently closed.

### Read-only Vercel state and decision

- Team `ves3` lists exactly one project: `klar-dating`, ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`. Authenticated `get_project` returns 200; metadata reports Node 26.x and `live=false`. A separate production deployment record `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` is `READY`, target `production`, bound to current main SHA `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. A READY record does not prove actual user traffic, runtime health or release approval.
- The exact pre-checkpoint #313 head has preview deployment `dpl_Cq5pR64NL46d2DnvQW5juLbdZ12h`, READY, target=null. #314 has no deployment for its exact head and its Vercel check is `failure/build-rate-limit`. The previously confirmed `login-page-prototype` deletion remains the recorded result; no further deletion was attempted and no Neon/Postgres/Better-Auth credentials were read, rotated or revoked.
- **Decision:** `productionApproved=false`, **BLOCKED / NO-GO**. No integrated release SHA has complete critical live/emulator/staging purge/receipt/race, 20/20 TTL/legal-hold/Art.-17, tenant/BOLA, monitoring/restore/canary/rollback evidence plus independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. This checkpoint performs no main merge, deployment, secret access, human-attestation simulation or production Firebase/GCS/IAM/Scheduler/database mutation. The only intended write is this documentation/inventory refresh on the existing audit review branch.


## Live checkpoint — 2026-11-11 02:13 CET (fresh read-only GitHub/Vercel refresh)

### Main, PR inventory and exact-head evidence

- Fresh `main` HEAD: `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. Exact `validate` check-run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `129478192916`: **completed/success** on this SHA.
- Fresh REST inventory: **194 open PRs — 192 Draft, 2 non-Draft** (#358 RC1 and #361 Dependabot). **50** target `main`, **144** target other branches; 141 base refs resolve to another open PR head, 3 do not; maximum observed open-stack depth 35. Head-ref prefixes: `fix` 81, `security` 55, `test` 19, `docs` 11, `integration` 10, `audit` 7, `feat` 5, `feature` 2, `dependabot` 1, `release` 1, plus one each `audit-enterprise-e2e-20261102` and `Veselin-Takev-patch-1`. Title-area counts: retention-202 79, tenant-254 26, partner-referral-56-48 21, governance-audit 17, partner-webhook-55 13, profile-media-204-206 8, ttl-70 1, other 29.

| PR | Current state | Exact head SHA | Ahead / behind main | Exact CI run / job | Review count / Vercel |
| --- | --- | --- | ---: | --- | --- |
| [#251](https://github.com/Veselin-Takev/Klar-Dating/pull/251) Governance/Supply-chain | Draft | `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684), `129836618469` `validate=success` | 0 / success |
| [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269) Legacy-photo kill-switch | Draft | `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801), `127220743813` `validate=success` | 0 / success |
| [#203](https://github.com/Veselin-Takev/Klar-Dating/pull/203) Decision/generation-bound purge | Draft | `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009), `127211414732` `validate=success` | 0 / success |
| [#253](https://github.com/Veselin-Takev/Klar-Dating/pull/253) Multi-Tenant | Draft | `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863), `125601704190` `validate=success` | 0 / success |
| [#313](https://github.com/Veselin-Takev/Klar-Dating/pull/313) Enterprise audit | Draft | `3567d74faa2b5e11f19586ef85dfb8f6d5279f62` | 84 / 2 | [42914498478](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42914498478), `130173287732` `validate=success` | 0 / success |
| [#314](https://github.com/Veselin-Takev/Klar-Dating/pull/314) Vercel | Draft | `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341), `125861548924` `validate=success` | 0 / **failure: build-rate-limit; no deployment for exact head** |

- The six requested Draft PRs remain two commits behind current `main`; all six have zero submitted reviews. The successful `validate` results above apply only to their exact listed heads, not to a future integrated SHA. #269 and #203 still overlap in six files (`DATA_RETENTION.md`, `deleteExpiredPhotos.ts`, `retention.ts`, `package.json`, `photoRetention.spec.ts`, `storageRules.spec.ts`); do not merge them blindly.
- #315 is **closed, unmerged**; its last head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d` had run [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) fail at `Enterprise static gates` because production provenance must be GitHub-signed and bound to the immutable image digest. The new open non-Draft [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) head `2f90d9fef013f7a7f070a3624cadd5fd62e914ff` also has 0 reviews and exact run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751) fails the same provenance gate; it is 1 ahead / 2 behind main. Do not merge or bypass.
- Non-Draft RC1 [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) is open on `release/v0.1.1-rc1`, exact head `1321c42ffe1c5919c1baccaada66a650ab811f93`, 0 reviews. Exact run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job `129478019942`, fails Browser acceptance: 28 passed / 1 failed. `tests/e2e/privacy-settings.spec.ts:26` expected the consent-withdrawal success message but received the generic confirmation failure; the log contains Firestore `PERMISSION_DENIED`. The older 1,636-pass claim is not evidence for this head.

### Ruleset, issues and source-backed blockers

- Active [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) applies to `refs/heads/main`, enforces strict required `validate`, blocks deletion and non-fast-forward, but requires **0 approvals**; `require_code_owner_review=false`, stale-review dismissal, last-push approval and review-thread resolution are all disabled. Bypass actors are empty. The separate branch-protection endpoint was not readable to this integration (403), so no additional protection is asserted.
- Issues #202, #70, #254, #8, #73, #55, #56, #204 and #206 are all still **open**. Current `main` source confirms #202: `deleteExpiredPhotosCron` remains exported and scheduled every 24 hours; `retention.ts` deletes `verification/` objects based on `timeCreated` older than 30 days (with hold/generation preconditions), not on the moderation decision / `fotoLoeschenAb`. This is a source finding, not proof that the deployed Scheduler is enabled.
- #70’s original “four groups only” source claim is stale: current `configure-retention.sh` enumerates 20 groups and gates apply to explicitly approved staging only. #70 remains open because no target-environment 20/20 `ACTIVE` TTL readback, legal-hold behavior or independent Art.-17/DPO/Legal sign-off is available.
- #254 remains open: `phase2_work/server.ts` has no tenant-auth middleware mount; #253 remains unmerged. #204 remains open: `storage.rules` still permits profile reads for `signedIn()` alone. #206 remains open: `getDownloadURL()` is persisted to `photoURL`. These are source-derived access-control/privacy risks, not evidence of live exploitation. #8 operations/monitoring evidence, #73 governance, and #55/#56 partner authenticity/consent/retention evidence remain unclosed.

### Vercel read-only check and release decision

- Team `ves3` lists exactly one project: `klar-dating` (`prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`). Authenticated `get_project` returns 200; metadata reports Node `26.x` and `live=false`. The production deployment record `dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w` is `READY`, target `production`, bound to current main SHA. A READY record does not prove traffic, runtime health or approval. The prior `login-page-prototype` deletion remains confirmed; no further deletion was attempted and no Neon/Postgres/Better-Auth credentials were accessed, rotated or revoked.
- **Decision: `productionApproved=false`, BLOCKED / NO-GO.** No exact integrated release SHA has the required critical live/staging/emulator purge, receipt/race, TTL/legal-hold/Art.-17, tenant/BOLA, monitoring/restore/canary/rollback evidence plus independent Security/AppSec, DPO/Legal, SRE, Finance (where relevant) and Release Owner approvals. No main merge, deployment, secret access, human-attestation simulation or production Firebase/GCS/IAM/Scheduler/database mutation was performed.
- This documentation/inventory refresh is on the existing audit review branch only. The resulting #313 commit requires a fresh exact-head CI readback; no prior SUCCESS is inherited.


## Live checkpoint — 2026-11-11 04:08 CET (fresh exact-head GitHub/Vercel refresh)

### Main and open-PR inventory

- Fresh `main` HEAD: `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. Exact GitHub Actions `validate` run [42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job `129478192916`: **completed/success**. Vercel combined status is success; the exact-SHA deployment record [dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w](https://vercel.com/ves3/klar-dating/AJRgtKhyoF4B8ypLkXBF8vMzw32w) is `READY`, target `production`.
- Fresh REST pages 1–2: **194 open PRs — 192 Draft, 2 non-Draft**; **50** target `main`, **144** target other branches; 141 base refs resolve to another open PR head, 3 do not; maximum observed open-stack depth **35**. Head-prefix stacks: `fix` 81, `security` 55, `test` 19, `docs` 11, `integration` 10, `audit` 7, `feat` 5, `feature` 2, `dependabot` 1, `release` 1, plus one each `audit-enterprise-e2e-20261102` and `Veselin-Takev-patch-1`. Title-area counts: retention-202 79, tenant-254 26, partner-referral-56-48 21, governance-audit 17, partner-webhook-55 13, profile-media-204-206 8, ttl-70 1, other 29. The previous 153/152/1 snapshot is stale.

| PR | State / exact head SHA | Ahead / behind main | Exact `validate` run / job | Reviews | Vercel |
| --- | --- | ---: | --- | ---: | --- |
| [#251 Governance/Supply-chain](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | Draft · `fc03f33996ccffc73e54e6b7a6fb05914cdcbc53` | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / `129836618469` **success** | 0 | success; preview READY, target=null |
| [#269 Legacy-photo kill-switch](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | Draft · `fd68656957c01618c3a085e887ece504624d18b3` | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / `127220743813` **success** | 0 | success |
| [#203 Decision/generation-bound purge](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | Draft · `1850e0a78b22e600e5add99273b84c081ffc3892` | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / `127211414732` **success** | 0 | success |
| [#253 Multi-Tenant](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | Draft · `036ee313747a7beb2ab926e721e3bef958304447` | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / `125601704190` **success** | 0 | success |
| [#313 Enterprise audit](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | Draft · `424fa0202f1715c7e0292adfba16f9b74e1d0638` | 85 / 2 | [42938012414](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42938012414) / `130252770570` **success** | 0 | success; preview [dpl_BXFBbmY7Vq2ibNA3nZHu6uYv1fn9](https://vercel.com/ves3/klar-dating/BXFBbmY7Vq2ibNA3nZHu6uYv1fn9) READY, target=null |
| [#314 Vercel evidence](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | Draft · `e5deab1dfd629065f3dfce3a5577eb21ac966a68` | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / `125861548924` **success** | 0 | **failure: build-rate-limit; no deployment for exact head** |

All six Drafts remain two commits behind current `main`; their green results apply only to the exact listed heads. #269 and #203 still overlap in six files: `DATA_RETENTION.md`, `deleteExpiredPhotos.ts`, `retention.ts`, `package.json`, `photoRetention.spec.ts`, `storageRules.spec.ts`. Do not combine or merge them blindly.

- [#315](https://github.com/Veselin-Takev/Klar-Dating/pull/315) is **closed, unmerged**, exact last head `71743b14c66d9c5f2fdca2ed73a0fda3c137d48d`; `validate` run [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) failed. Its single APPROVED review was by `Veselin-Takev` on that same SHA, not an independent reviewer. Replacement [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) is open/non-Draft at `2f90d9fef013f7a7f070a3624cadd5fd62e914ff`, 1 ahead / 2 behind main, 0 reviews; exact run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job `129461862107`, fails `Enterprise static gates` because `check-release-workflow` rejects the production provenance attestation pin. Do not merge or bypass.
- Non-Draft RC1 [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) remains open on `release/v0.1.1-rc1`, head `1321c42ffe1c5919c1baccaada66a650ab811f93`, 0 reviews. Exact run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job `129478019942`, fails Browser acceptance: **28 passed / 1 failed**. `tests/e2e/privacy-settings.spec.ts:26` expected the consent-withdrawal success message but received the generic confirmation failure; the log contains Firestore `PERMISSION_DENIED`. The earlier 1,636-pass claim does not attest this head.

### Ruleset and issue/source evidence

- Active [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) applies to `refs/heads/main`, has no bypass actors, blocks deletion and non-fast-forward, and strictly requires `validate`; it still requires **0 approvals**, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `require_last_push_approval=false`, and `required_review_thread_resolution=false`. The release-gate work in #251 does not change this live Ruleset; its fail-closed preflight will reject this configuration.
- Issues **#202 #70 #254 #8 #73 #55 #56 #204 #206 remain open**. Current `main` source re-read confirms:
  - **P0 #202:** [`deleteExpiredPhotos.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/main/phase2_work/functions/src/deleteExpiredPhotos.ts#L7-L20) still schedules the legacy worker every 24 hours and calls `deleteExpiredPhotoPage`; [`retention.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/main/phase2_work/functions/src/retention.ts#L10-L28) deletes `verification/` objects based on `timeCreated` older than 30 days (with hold/generation checks), not the moderation decision / `fotoLoeschenAb`. This is source evidence, **not** proof that the deployed Scheduler is enabled.
  - **P0 #70:** [`configure-retention.sh`](https://github.com/Veselin-Takev/Klar-Dating/blob/main/phase2_work/scripts/configure-retention.sh) now enumerates 20 groups and requires an approved staging project/matrix; no 20/20 target-environment `ACTIVE` readback or independent legal-hold/Art.-17 proof was available.
  - **P0 #254:** #253 remains unmerged; no approved legacy-to-tenant migration, full BOLA/IDOR negative evidence or live tenant-isolation proof.
  - **P1 #204:** [`storage.rules`](https://github.com/Veselin-Takev/Klar-Dating/blob/main/phase2_work/storage.rules#L34-L38) still permits profile-photo reads with `signedIn()` alone, inconsistent with the server policy model's adult gates.
  - **P1 #206:** [`klar.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/main/phase2_work/src/lib/klar.ts#L68-L82) still persists `getDownloadURL()` as `photoURL`; [`api.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/main/phase2_work/src/lib/api.ts#L474-L494) includes the full request URL in debug/failure diagnostics. These are source-derived privacy risks, not evidence of live exploitation.
  - #8 operational/monitoring, #73 independent governance, and #55/#56 partner purchase authenticity, consent and retention/legal evidence remain open.

### Vercel and decision

- Team `ves3` still lists exactly one project: `klar-dating` (`prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`). Authenticated project metadata reports `live=false`; a separate exact-main deployment record is `READY`, target `production`, bound to `2fa3ba223989ff248ad1abaea67f4f454f7c9f6b`. A READY record does not prove traffic, runtime health or release approval. #313 and #251 have READY previews (target=null); #314 has no exact-head deployment. The previously confirmed `login-page-prototype` deletion was not repeated; no Neon/Postgres/Better-Auth credentials were accessed, rotated or revoked.
- **Decision remains `productionApproved=false`, BLOCKED / NO-GO.** No exact integrated release SHA has complete critical live/staging/emulator purge/receipt/race, 20/20 TTL/legal-hold/Art.-17, tenant/BOLA, monitoring/restore/canary/rollback evidence plus independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. No main merge, deployment, secret access, human-attestation simulation or production Firebase/GCS/IAM/Scheduler/database mutation was performed.


## Live checkpoint — 2026-11-11 04:39 CET (fresh exact-head GitHub/Vercel refresh)

### Main, open-PR inventory and current CI

- Fresh main HEAD: **2fa3ba223989ff248ad1abaea67f4f454f7c9f6b** (signed merge of #359). Exact-main GitHub Actions [run 42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job **129478192916**, validate: **completed/success, 33/33 steps**. GitHub commit status for Vercel is success. This is exact-main CI evidence, not a production approval.
- Fresh REST inventory: **194 open PRs — 192 Drafts + 2 non-Drafts** (#358 RC1 and #361 Dependabot); **50** target main, **144** target other branches; **141** base refs match another open PR head, **3** do not; maximum observed stack depth **35**. Head prefixes: fix 81, security 55, test 19, docs 11, integration 10, audit 7, feat 5, feature 2, dependabot 1, release 1, plus one each audit-enterprise-e2e-20261102 and Veselin-Takev-patch-1. The prior 153/152/1 snapshot is obsolete.
- The machine-readable inventory below is refreshed from both REST pages at this timestamp. It updates PR #313 from the earlier head 424fa020... to its exact current head 00586288.... Counts and the previously inventoried stack structure remain unchanged.

| PR | Current state | Exact head SHA | Ahead / behind main | Exact Actions run / job | Submitted reviews |
| --- | --- | --- | ---: | --- | ---: |
| [#251 Governance/Supply-chain](https://github.com/Veselin-Takev/Klar-Dating/pull/251) | Draft | fc03f33996ccffc73e54e6b7a6fb05914cdcbc53 | 10 / 2 | [42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684) / 129836618469 validate=success | 0 |
| [#269 Legacy-photo kill-switch](https://github.com/Veselin-Takev/Klar-Dating/pull/269) | Draft | fd68656957c01618c3a085e887ece504624d18b3 | 33 / 2 | [42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801) / 127220743813 validate=success | 0 |
| [#203 Decision/generation-bound purge](https://github.com/Veselin-Takev/Klar-Dating/pull/203) | Draft | 1850e0a78b22e600e5add99273b84c081ffc3892 | 57 / 2 | [42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009) / 127211414732 validate=success | 0 |
| [#253 Multi-Tenant](https://github.com/Veselin-Takev/Klar-Dating/pull/253) | Draft | 036ee313747a7beb2ab926e721e3bef958304447 | 11 / 2 | [41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863) / 125601704190 validate=success | 0 |
| [#313 Enterprise-Audit](https://github.com/Veselin-Takev/Klar-Dating/pull/313) | Draft | 00586288d86d68177d54fa17db185d69d3bdbc41 | 86 / 2 before this documentation refresh | [42951419503](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42951419503) / 130296355120 validate=success | 0 |
| [#314 Vercel](https://github.com/Veselin-Takev/Klar-Dating/pull/314) | Draft | e5deab1dfd629065f3dfce3a5577eb21ac966a68 | 3 / 2 | [41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341) / 125861548924 validate=success | 0 |
| [#315 Dependabot attest](https://github.com/Veselin-Takev/Klar-Dating/pull/315) | Closed, unmerged | 71743b14c66d9c5f2fdca2ed73a0fda3c137d48d (last head) | — | [41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) / 125572558770 validate=failure at Enterprise static gates | 1 owner approval on that SHA; not independent |

- The previous #313 state in_progress has resolved: exact head 00586288... completed validate=success. The new audit-doc commit below creates a new SHA; this SUCCESS is not inherited by that new commit.
- Supply-chain context: [#316](https://github.com/Veselin-Takev/Klar-Dating/pull/316) remains Draft at b1b669ed5e80a6572dc60bdbbbc08e02650283be, exact run [41596122104](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41596122104), job 125783766115, validate=success, 0 reviews. It overlaps the attest pin/validator work in #251; do not merge both paths blindly.
- [#361](https://github.com/Veselin-Takev/Klar-Dating/pull/361) is the current open non-Draft Dependabot PR, head 2f90d9fef013f7a7f070a3624cadd5fd62e914ff; exact run [42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751), job 129461862107, validate=failure at Enterprise static gates; 0 reviews. Do not merge or bypass.
- [#358](https://github.com/Veselin-Takev/Klar-Dating/pull/358) is the other open non-Draft, based on release/v0.1.1-rc1, head 1321c42ffe1c5919c1baccaada66a650ab811f93; exact run [42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877), job 129478019942, validate=failure at Browser acceptance. The browser job has **28 passed / 1 failed**; tests/e2e/privacy-settings.spec.ts:26 fails the consent-withdrawal success assertion and logs Firestore PERMISSION_DENIED. The prior 1,636-pass claim is not evidence for this exact head.

### Active Ruleset and issue/source evidence

- Active [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) applies to refs/heads/main; deletion and non-fast-forward are blocked, strict required validate is enabled, bypass actors are empty. It still sets required_approving_review_count=0, require_code_owner_review=false, dismiss_stale_reviews_on_push=false, require_last_push_approval=false, and required_review_thread_resolution=false. Independent approval is therefore not enforced by the live Ruleset.
- Issues **#202, #70, #254, #8, #73, #55, #56, #204 and #206** are all still open.
  - **P0 #202:** current main source still exports a 24-hour deleteExpiredPhotosCron; retention.ts lists verification/ objects and deletes when Storage timeCreated is older than 30 days, using hold/generation preconditions but not the moderation decision / fotoLoeschenAb. This is a source finding, not proof that the production Scheduler is enabled.
  - **P0 #70:** configure-retention.sh now enumerates 20 collection groups and only applies to explicitly approved staging with project/database, legal matrix, inventory and preflight checks. No target-environment 20/20 ACTIVE readback, legal-hold behavior or independent Art.-17/DPO/Legal approval was available.
  - **P0 #254:** #253 remains unmerged; no approved legacy-to-tenant migration, complete BOLA/IDOR negative evidence or live tenant cutover proof.
  - **P0 #8 / P1 #73:** production alerts, notification delivery, restore/RTO/RPO/canary evidence and enforceable independent review are not established; the active Ruleset above still requires zero approvals.
  - **P0 #55 / #56:** partner purchase/buyer authenticity, replay/refund controls, consent/legal basis, token revocation and Art.-17 retention sign-off remain open.
  - **P1 #204:** current storage.rules still permits profile-photo reads for signedIn() alone.
  - **P1 #206:** current klar.ts still persists Firebase getDownloadURL() as photoURL; revocable viewer authorization is not established by the current source.

### Vercel read-only and release decision

- Team ves3 lists exactly one project: Klar klar-dating, ID prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre. Authenticated project metadata reports live=false and Node 26.x; the main release manifest declares Node 22.23.3, so runtime alignment needs owner verification.
- Production-target deployment [dpl_AJRgtKhyoF4B8ypLkXBF8vMzw32w](https://vercel.com/ves3/klar-dating/AJRgtKhyoF4B8ypLkXBF8vMzw32w) is READY and bound to current main SHA 2fa3ba223989ff248ad1abaea67f4f454f7c9f6b. The #313 preview [dpl_7yotUSoUhFovb9JZZdXH3GcYuvXc](https://vercel.com/ves3/klar-dating/7yotUSoUhFovb9JZZdXH3GcYuvXc) is READY, target null, bound to exact pre-refresh #313 head 00586288.... #314 has no deployment record for its exact head e5deab1.... A READY record does not prove user traffic, runtime health or production approval.
- The previously confirmed deletion of login-page-prototype was not repeated. No Neon/Postgres/Better-Auth credentials were accessed, rotated or revoked.
- Main phase2_work/RELEASE_MANIFEST.json continues to state decision=NO-GO, productionApproved=false, with dynamic/live evidence and independent sign-offs pending. **Decision: BLOCKED / NO-GO.**
- No main commit, merge, deployment, secret access, human-attestation simulation or production Firebase/GCS/IAM/Scheduler/database mutation was performed. This refresh is documentation-only on the existing audit review branch.


## Live checkpoint — 2026-11-11 05:40 CET (fresh exact-head GitHub/Vercel refresh)

### Main and PR inventory
- Fresh main HEAD remains **2fa3ba223989ff248ad1abaea67f4f454f7c9f6b**; exact push CI [run 42710429488](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710429488), job 129478192916, validate=completed/success. The current manifest on this SHA still says decision=NO-GO, productionApproved=false.
- Fresh REST pages still show **194 open PRs: 192 Drafts + 2 non-Drafts**; 50 target main, 144 target other branches; 141 non-main base refs match another open PR head, 3 do not; maximum observed stack depth 35. Head-prefix distribution remains: fix 81, security 55, test 19, docs 11, integration 10, audit 7, feat 5, feature 2, dependabot 1, release 1, plus one each audit-enterprise-e2e-20261102 and Veselin-Takev-patch-1. The earlier 153/152/1 snapshot is obsolete.
- Exact current Draft heads and CI:
  - #251 fc03f33996ccffc73e54e6b7a6fb05914cdcbc53, 10 ahead / 2 behind; [run 42818199684](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42818199684), job 129836618469, validate success; 0 reviews.
  - #269 fd68656957c01618c3a085e887ece504624d18b3, 33 / 2; [run 42020003801](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42020003801), job 127220743813, validate success; 0 reviews.
  - #203 1850e0a78b22e600e5add99273b84c081ffc3892, 57 / 2; [run 42017264009](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42017264009), job 127211414732, validate success; 0 reviews.
  - #253 036ee313747a7beb2ab926e721e3bef958304447, 11 / 2; [run 41539994863](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41539994863), job 125601704190, validate success; 0 reviews.
  - #313 c61ac48987f1ac60d0fe008cb657d39b550d58ef, 87 / 2; [run 42954618943](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42954618943), job 130306664764, validate success; 0 reviews. Its exact-head Vercel preview is READY, target=null.
  - #314 e5deab1dfd629065f3dfce3a5577eb21ac966a68, 3 / 2; [run 41619572341](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41619572341), job 125861548924, validate success; 0 reviews. Vercel API returns zero deployments for this exact SHA.
- #269 and #203 still overlap six files: DATA_RETENTION.md, deleteExpiredPhotos.ts, retention.ts, package.json, photoRetention.spec.ts, storageRules.spec.ts. Do not merge or combine blindly.
- #315 is **closed/unmerged**, last head 71743b14c66d9c5f2fdca2ed73a0fda3c137d48d; [run 41531498018](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41531498018) failed Enterprise static gates because the release workflow requires a GitHub-signed provenance attestation bound to an immutable image digest. Its one approval was by the repository owner, not independent.
- Current open Dependabot replacement #361 is non-Draft at 2f90d9fef013f7a7f070a3624cadd5fd62e914ff, 0 reviews; [run 42705724751](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42705724751) fails the same attestation gate. Do not merge or bypass.
- Other non-Draft #358 (RC1 migration claim) is open on release/v0.1.1-rc1, head 1321c42ffe1c5919c1baccaada66a650ab811f93, 0 reviews; [run 42710380877](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42710380877) fails Browser acceptance: 28 passed / 1 failed. Consent withdrawal expected the success message but received a generic failure; logs show Firestore PERMISSION_DENIED. The earlier 1,636-pass claim does not attest this head.

### Governance, source evidence and operations
- Active [Ruleset #25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) still applies to refs/heads/main, strictly requires validate, blocks deletion/non-fast-forward and has no bypass actors; it still requires **0 approvals**, no CODEOWNERS review, no stale-review dismissal, no last-push approval and no review-thread resolution.
- Issues **#202 #70 #254 #8 #73 #55 #56 #204 #206** remain open. Current main source was re-read: the 24-hour legacy photo worker still calls deleteExpiredPhotoPage; retention.ts still uses Storage timeCreated older than 30 days for verification/; the TTL script contains a 20-group gate but no live 20/20 ACTIVE readback; storage.rules profile reads remain signedIn()-only; klar.ts persists getDownloadURL() as photoURL; api.ts still includes full request URLs in diagnostics. These are source findings, not proof that a specific Scheduler is enabled or that live exploitation occurred.
- #253 remains unmerged; no approved legacy-to-tenant migration, full BOLA/IDOR negative evidence or live tenant cutover proof. #8 operations/alerts/restore/canary, #55/#56 partner authenticity/consent/retention/legal evidence and independent governance remain open.

### Vercel and decision
- Read-only Vercel calls confirm the team lists exactly one project: Klar klar-dating (prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre), metadata live=false, Node 26.x. A production-target deployment is READY and bound to the current main SHA; the exact #313 preview is READY with target=null; #314 has no exact-head deployment.
- The previously confirmed login-page-prototype project still returns **404 not_found** and is absent from the team project list. No deletion was retried; Neon/Postgres/Better-Auth credentials were not accessed, rotated or revoked.
- **Decision: productionApproved=false, BLOCKED / NO-GO.** No exact integrated release SHA has complete purge/receipt/race, 20/20 TTL/legal-hold/Art.-17, tenant/BOLA, production operations and independent Security/AppSec, DPO/Legal, SRE, Finance (where applicable) and Release Owner approvals. No main merge, deployment, secrets access or production Firebase/GCS/IAM/Scheduler/database mutation was performed.
