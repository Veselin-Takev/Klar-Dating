# Vercel CI Setup – Eligibility, Fehlersuche und Enterprise-Gate

**Prüfdatum:** 2026-11-02  
**Review-Kontext:** [Enterprise-Audit Draft-PR #313](https://github.com/Veselin-Takev/Klar-Dating/pull/313) (nicht gemergt)  
**Release-Status:** `productionApproved=false`, **BLOCKED / NO-GO**.

## Auslöser und verbindliche Setup-Regel

Angefragter Skill: `npx skills use vercel/ci@setup`. [Originales Vercel-CI-Setup-SKILL.md](https://github.com/vercel/ci/blob/main/skills/setup/SKILL.md): GitHub-Repository **privat**, mit Vercel-Projekt verbunden und mit **Turborepo** betrieben. Falls diese Bedingungen fehlen, ist die Einrichtung abzubrechen. Die Skill-Anleitung verbietet zudem handeditierte Lockfiles, Änderungen an GitHub-Actions-Workflows im Rahmen des Skill-Setups und eigenmächtiges Mergen; Vercel CI muss vor dem Push eines Setup-Branches bewusst aktiviert werden. Für erforderliche Turborepo-Task-Tags siehe [Skill-Referenz](https://github.com/vercel/ci/blob/main/skills/setup/references/vercel-ci.md); Details vor tatsächlicher Installation mit [Vercel CI](https://vercel.com/docs/ci) abgleichen.

## Nachgewiesene Eligibility – nicht bestanden

| Prüfung | Nachweis | Entscheidung |
|---|---|---|
| GitHub-Sichtbarkeit | `GET /repos/Veselin-Takev/Klar-Dating`: `private=false`, `visibility=public` am 02.11.2026. | **BLOCKED**: Repository nicht eigenmächtig privat schalten. |
| Turborepo-Setup | GitHub-`main`-Tree `7ddcd135ce76b8bf98979ba9737062f37b957502` (1377 Einträge, nicht abgeschnitten): weder `turbo.json` im Root oder Unterordner noch `turbo` unter Root-/`phase2_work/package.json`-Abhängigkeiten. | **BLOCKED**: Kein etablierter Turbo-Taskgraph. |
| Bestehende CI | GitHub Actions `Klar Enterprise CI` mit `validate`; bestehende Release-/Governance-Gates verwenden diese Pipeline. | Beibehalten; kein CI-Ersatz ohne ADR/CI-Parität. |
| Vercel-Quelle | Vercel-Projekt `klar-dating` (`prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`) ist mit dem GitHub-Repository verbunden. Weiteres Vercel-Projekt `login-page-prototype` (`prj_kfJ06pJHn3neZAkrtasYKezxuprF`) verarbeitet laut Deployment-Metadaten **ebenfalls** dieselbe Git-Quelle. | Doppelte Projektverknüpfung fachlich zuordnen; nichts löschen/deaktivieren ohne Verantwortlichen. |

**Ergebnis:** Keine neue `vercel/ci@setup`-Konfiguration und kein Vercel-CI-Setup-PR. Es wurde weder die GitHub-Sichtbarkeit geändert noch `turbo.json` erstellt, Vercel CI neu aktiviert, ein Secret abgefragt, ein Deployment oder Release ausgelöst.

## Tatsächliche, fehlgeschlagene Vercel-native Checks

Eine bestehende Vercel-CI-Invocation wurde read-only geprüft: `invo1_fEf0cFNh5TAIXVm012LztHCz`, Attempt `1`, Branch `audit-enterprise-e2e-20261102`, Commit `7d1d8fc04f0ccf82565ed7e590f401a0e014f888`. [Vercel-CI-Dashboard](https://vercel.com/ves3/~/ci/invo1_fEf0cFNh5TAIXVm012LztHCz).

- `source.type=vercel-native-checks`, `source.projectId=prj_kfJ06pJHn3neZAkrtasYKezxuprF` (**login-page-prototype**, nicht `klar-dating`), `setupConclusion=succeeded`, **`runConclusion=failed`**.
- Vercel hat das Klar-Repository im Sandbox-Arbeitsverzeichnis `/vercel/sandbox/repo` geklont und mit `bun install --frozen-lockfile` installiert. Der Installationsschritt meldete Erfolg.
- Zwei Job-Definitionen wurden aus `project-settings` ausgeführt: `lint` mit `bun run lint`, `typecheck` mit `bun run typecheck`. **Beide endeten `command_failed`.**
- In **beiden** konkreten Job-Logs: `error TS18003: No inputs were found in config file '/vercel/sandbox/repo/tsconfig.json'. Specified 'include' paths were '["src"]'`; Exit-Code **2**. Das Root-`tsconfig.json` referenziert `src`, während die Projektquellen im Repo vor allem unter `phase2_work/src` liegen. **Arbeitshypothese:** falscher Ausführungskontext (Repo-Root statt App-Verzeichnis). Die Logs stützen genau diesen TS18003-Fall, nicht die Behauptung, dass der Anwendungscode an sich untypisierbar sei.
- Das zugeordnete Vercel-Deployment `dpl_5yVGzekc81prVa3QJXxw3ZiPiFfu` für `login-page-prototype` meldet separat **`readyState=ERROR`, `errorCode=ENOENT`, `Command "bun run build" exited with 1`**. Ohne Build-Log-Detail keine sichere Ursachenbehauptung über diesen Fehler.
- GitHub `validate` auf aktuellen PR-Commits und solche Vercel-native Checks sind **unterschiedliche** Prüfpfade. Grünes GitHub `validate` kompensiert weder diesen Vercel-CI-Fehler noch fehlende E3/E4/E5-Freigaben.

## Nachtrag: zusätzlicher Demo-Projekt-Sicherheitsbefund

Vercel `login-page-prototype` verarbeitet ebenfalls Klar-Git-Commits und hält 19 verschlüsselte, auch für Preview konfigurierte Auth-/Datenbankvariablen. Die zusätzliche Verknüpfung ist sicherheitsrelevant und **nicht** als nachgewiesene Offenlegung von Klar-Daten zu klassifizieren. Als reversible Sofortmaßnahme wurde `previewDeploymentsDisabled=true` und `gitForkProtection=true` für **nur dieses Demo-Projekt** gesetzt (Vercel-Update erfolgreich; Fork-Schutz read-after-write bestätigt). Siehe [detaillierte Risiko-/Bereinigungsanalyse](VERCEL_LEGACY_PROTOTYPE_RISK_2026-11-02.md). Keine Secrets gelesen oder rotiert, kein Demo-Projekt gelöscht, keine Produktionsfreigabe.

## Optionen und Sicherheitsentscheidung

**Bevorzugt:** Für den aktuellen öffentlichen Vite/Express-/Firebase-Stack die bestehende GitHub Actions Enterprise-CI als autoritatives Gate beibehalten. Vercel nur für isolierte und geschützte Previews verwenden. Die bereits beobachteten `login-page-prototype`-Build-/CI-Fehlversuche getrennt durch den Vercel-Projektverantwortlichen untersuchen; dessen Root-Directory/Build- und CI-Job-Kommandos gegen die tatsächliche App-Struktur prüfen. Keine stillschweigende Änderung fremder Projektkonfiguration.

**Alternative – falls ausdrücklich fachlich gewünscht:** Vercel CI erst nach separater Architekturentscheidung über Repository-Sichtbarkeit und echte Turborepo-Migration. Notwendige Reihenfolge: (1) expliziter Owner-Beschluss zum privaten Repository (inkl. Auswirkung auf Kollaboratoren/Integrationen), (2) Turborepo-Monorepo-ADR und deterministische Toolchain mit Taskgraph, (3) Task-Selektion pro Paket ohne persistente Server, ohne Produktions-Secrets, (4) Projekt-/CI-Scope, Branch-Schutz und Preview-Datenschutz, (5) erst danach den offiziellen Setup-Skill vollständig befolgen, Vercel CI vor Setup-Branch-Push aktivieren und einen einzigen reviewbaren Setup-PR erstellen. Keine Änderung an `main` ohne unabhängige Freigabe.

## Verifikation vor einer späteren CI-Einführung

1. GitHub-Repo-Visibilität und `turbo.json`/Turbo-Version **aktuell** prüfen, nicht auf diese Momentaufnahme vertrauen.
2. Identität und Git-Verknüpfung **beider** Vercel-Projekte klären; Job-/Build-Working-Directory samt RootDirectory dokumentieren.
3. `lint`/`typecheck`/ `build` separat auf einer **exakten SHA** mit reproduzierbarem korrektem cwd und locked dependencies bestehen lassen.
4. Repo-Zugriff und Pipeline-Secrets/Build-Commands prüfen; keine Secrets in PR-/Fork-Runner injizieren.
5. Review-Regel #25756841 stärken: zuletzt 0 Pflicht-Approvals, CODEOWNERS und Stale-Review-Sperre nicht erzwungen. Vercel-Ausführung ist kein Ersatz für diese GitHub-Policy.
6. E2 CI, E3 Emulator/Staging, E4 Cloud-Laufzeit und E5 unabhängige Security-/DPO-/Legal-/SRE-/Release-Owner-Freigaben getrennt belegen.

**Schreib-/Änderungsgrenze:** Dieses Dokument wird nur im bestehenden Audit-Draft-PR #313 erstellt. Keine Änderungen an Vercel CI Settings, anderen Vercel-Projekten, GitHub-Actions-Workflows, Tokens, produktiven Ressourcen oder `main`.

## Nachtrag: verifizierte Stilllegung der früheren Demo-Anbindung (02.11.2026)

Das in diesem Dokument historisch als `login-page-prototype` genannte zweite Vercel-Projekt wurde nach Eigentümerbestätigung **gelöscht und API-seitig als nicht mehr vorhanden verifiziert** (Projekt-ID: `prj_kfJ06pJHn3neZAkrtasYKezxuprF`; `get_project` und gefilterte Deployments jeweils 404; Team-List enthält nur `klar-dating`). Siehe [verifizierter Stilllegungsnachweis](VERCEL_LEGACY_PROTOTYPE_RISK_2026-11-02.md). Die oben beschriebenen Fehl-CI-Läufe und 19 Env-Variablen sind **historische Befunde**, nicht der aktuelle Bestand. Die noch offene technische Wahl über Turborepo/Vercel CI für Klar ist davon getrennt und begründet kein Release-GO.
