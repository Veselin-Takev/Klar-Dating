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
