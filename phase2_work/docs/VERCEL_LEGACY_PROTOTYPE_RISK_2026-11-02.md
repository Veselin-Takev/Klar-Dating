# Vercel Altprojekt `login-page-prototype`: Risikoabgrenzung und reversible Sofortmaßnahme

**Erhoben am 02.11.2026** über die authentisierte Vercel-API; gültig ausschließlich für den angegebenen Abfragezeitpunkt. Dieser Bericht ist Teil des [Enterprise-Audit-Draft-PR #313](https://github.com/Veselin-Takev/Klar-Dating/pull/313) und keine Produktionsfreigabe.

## Gesicherter Befund (E4 API-Konfiguration, keine Credential-Nutzung bewiesen)

| Sachverhalt | Vercel-/GitHub-Evidenz | Bewertung |
|---|---|---|
| Team/Projekt | `ves3` / `login-page-prototype` (`prj_kfJ06pJHn3neZAkrtasYKezxuprF`), getrennt von Klar-Projekt `klar-dating` (`prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`) | Eigenständiges Projekt, keine Anwendungsidentität mit Klar belegt |
| Unerwartete Source-Kopplung | Vercel-Deployment-Metadaten der Demo nennen `githubOrg=Veselin-Takev`, `githubRepo=Klar-Dating`; unter anderem Branch `fix/p0-202-disable-legacy-photo-purge-20261101` und Audit-Branch `audit-enterprise-e2e-20261102` | Verifizierte **cross-project Git-Verknüpfung**. Klar-Commits erzeugten ungefragt Demo-Preview-Builds |
| Deployment-Zustand | 13 jüngste Demo-Deployments im API-Ergebnis, jeweils `ERROR`, Ziel `target=null` (Preview); `live=false` | Kein belegter produktiver Demo-Traffic; ERROR ist kein Nachweis von sicherer Isolation |
| Verschlüsselte Env-Konfiguration | `filter_project_envs(decrypt=false)`: **19** projektbezogene Variablen, darunter Auth-/PostgreSQL-/Neon-Konfiguration, `type=encrypted`, `target=[production,preview,development]`, `hiddenProductionEnvCount=0` | **Potenziell hohe bis kritische** Secrets-Exposition für ungeprüfte Klar-Branches. **Keine Werte ausgelesen; keine kompromittierten Secrets nachgewiesen** |
| Zugriffsschutz | `ssoProtection.enabled=true`, Scope `all_except_custom_domains`; Demo-Projekt-Domain `login-page-prototype.vercel.app` | SSO mindert Zugriff durch Besucher, ersetzt aber keine Isolation der Build-Secrets |
| CI-Fehler | [Vercel-CI-Invocation](https://vercel.com/ves3/~/ci/invo1_fEf0cFNh5TAIXVm012LztHCz) auf `login-page-prototype` mit Klar-Commit `7d1d8fc...`: Job `lint` und `typecheck` enden mit TS18003 (`/vercel/sandbox/repo/tsconfig.json` ohne `src`-Inputs), Exit-Code 2 | Fehlerhafte Arbeitsverzeichnis-/CI-Projektzuordnung; **kein** Beweis eines P0-Ausfalls von Klar |

**Risikoeinstufung:** Eine **bestätigte Konfigurations-/Abgrenzungslücke** durch die zusätzliche Git-Verknüpfung; vorsorglich als **Security-Release-Blocker** behandeln. Ein bestätigter **P0-Incident für Klar** lässt sich aus diesen Daten **nicht** ableiten, solange weder gemeinsam genutzte produktive Credentials noch Offenlegung, Zugriffe auf Klar-Daten oder übergreifende Produktionswirkung nachgewiesen sind. Priorität der vollständigen Entflechtung: hoch; bei identischer Klar-Produktionsdatenbank oder verdächtiger Secret-Nutzung sofort P0-/Incident-Prozess.

## Bereits ausgeführte reversible Schutzmaßnahme

Über das explizit ausgewählte Projekt `prj_kfJ06pJHn3neZAkrtasYKezxuprF` wurde **nur** das folgende Projekt-Update ausgeführt:

- `previewDeploymentsDisabled=true` – weitere Demo-Preview-Deployments deaktivieren, ohne Klar-Deployments zu verändern.
- `gitForkProtection=true` – Deployments aus Git-Forks bedürfen Autorisierung.

Die Vercel-API hat das Update **erfolgreich angenommen**. Ein unabhängiger Read-after-write-Filter `list_projects(gitForkProtection=1)` bestätigte, dass `login-page-prototype` den Fork-Schutz erfüllt. **Die Connector-Read-Ansicht liefert `previewDeploymentsDisabled` nicht zurück; dessen effektives Verhalten muss im Vercel-Dashboard bzw. anhand ausbleibender neuer Git-Preview-Deployments zusätzlich geprüft werden.**

**Nicht durchgeführt:** kein Löschen des Demo-Projekts, keine Änderung der Repository-Sichtbarkeit, kein Löschen/Entschlüsseln/Rotieren von Variablen, kein produktiver Datenbankzugriff, keine Git-Unlink-, Domain-, IAM-, Scheduler-, Klar-Deployment- oder Release-Mutation. Die 19 Secrets sind weiterhin konfiguriert. Die Maßnahme stoppt **nicht nachgewiesenermaßen** mögliche Main-Branch-Production-Builds oder zuvor gebaute Deployments.

## Verbindliche nächste Prüf- und Bereinigungsschritte (keine vorweggenommene Freigabe)

1. **Ownership bestätigen** (Vercel-Projektverantwortlicher): Ist `login-page-prototype` tatsächlich ungenutzt? Welche ehemaligen Demo-Datenbanken/Auth-Dienste sind noch angebunden? Mit dem Eigentümer den beabsichtigten Zustand dokumentieren.
2. **Git-Anbindung bereinigen**: Nach Zuordnungsprüfung das Demo-Projekt im Vercel-Dashboard von `Veselin-Takev/Klar-Dating` trennen oder das alte Projekt offiziell stilllegen; nicht `klar-dating` entkoppeln. Danach verifizieren, dass Klar-Branch-Commits im Demo keine neuen Builds mehr auslösen. Dies ist nicht über die hier verfügbaren Projekt-Update-Parameter belegbar.
3. **Credentials beurteilen und ggf. rotieren**: Auth-/PostgreSQL-/Neon-Secret-Inhaber und Gültigkeit überprüfen; bei realen gemeinsam genutzten oder exponierten Credentials über den Provider sichere Rotation/Revocation, Audit-Logs und Impact-Analyse durchführen. Ohne autorisierte Eigentums-/Providerfreigabe keine Rotation, da andere Apps/Datenbanken betroffen sein können. Niemals Secret-Werte in PR-Logs oder Dokumentation schreiben.
4. **Build-/Git-Schutz**: Vor Neuverknüpfung unabhängig kontrollieren, welche Variablen an PR-/Fork-Previews gelangen, ob Deployment Protection die relevanten Domains abdeckt und welche Build-Prozesse ungeprüfte Branch-Code-Ausführung erlauben.
5. **Release-Gates getrennt halten**: Ein grünes Klar-`validate` oder Vercel-`READY` ist keine E3-Emulator-/E4-Live-/E5-Freigabe. `main` enthält weiterhin die unter #202 dokumentierte altersbasierte Löschlogik.

## Nachtrag P0 #202 – neu verifizierte CI

Draft [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269), Head `d6c1c99978a0f6e402068d57d1da0ce75795d55f`: [GitHub Actions Run 41523279539](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41523279539) **completed/success**, ein Job `validate` **success**; alle ausgeführten Schritte erfolgreich, bedingter Browser-Fehlerartefakt-Upload zurecht `skipped`. PR bleibt **Draft**, `behind main`, ohne unabhängige Reviews. Das bestätigt nur E2 auf der PR-SHA; nicht die aktuelle integrierte `main`-SHA und nicht die Live-Scheduler-/GCS-/Moderationsentscheidung.

**Schlussfolgerung: `productionApproved=false`, BLOCKED / NO-GO.** Keine Änderung am offiziellen Release-Scope oder Freigabeprozess.
