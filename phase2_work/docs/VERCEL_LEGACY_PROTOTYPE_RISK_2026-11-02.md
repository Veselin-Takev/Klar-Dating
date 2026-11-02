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

## Read-after-write-Verhalten nach Dokumentationscommit

Ein nach der Schutzmaßnahme gepushter GitHub-Dokumentationscommit `7c70412af5aac14acd7555b3952fe70b44706311` erzeugte im regulären `klar-dating`-Projekt bereits ein Preview `dpl_2guciHa39icuRKdBjqnMbv3PPHFb` mit Status `READY`, `target=null`. Die unmittelbar folgende Vercel-List-Abfrage des Demo-Projekts zeigte **kein** Deployment für diese SHA; neuester Demo-Eintrag blieb `dpl_Dxseq9wb5unRB7ztystThT9iPB49`, SHA `4d9c8dfeb96a1674d667d64523cf91f67fa468a9`, `ERROR`. Das ist ein positives **punktuelles** Verhaltensindiz für wirksame Preview-Sperre nach `previewDeploymentsDisabled=true`, jedoch kein vollständiger Langzeit- oder Produktionsbranch-Test. Die Git-Verknüpfung und 19 vorhandenen Projekt-Env-Variablen bleiben ein offenes Bereinigungsthema.

## Stilllegungsfreigabe durch den Eigentümer (02.11.2026, 23:06 MEZ)

Der Projektverantwortliche hat ausdrücklich erklärt: **`login-page-prototype` wird nicht mehr benötigt und darf gelöscht werden** (Vercel-Ansicht `https://vercel.com/ves3/login-page-prototype/deployments`). Dieses Einverständnis gilt **nur für das Demo-Projekt**, nicht für `klar-dating`, die GitHub-Quelle, unabhängige Datenbank-/Neon-Accounts oder die produktiven Klar-Ressourcen.

**Vor der finalen Löschung live über Vercel geprüft:**
- Demo: Team `ves3`, ID `prj_kfJ06pJHn3neZAkrtasYKezxuprF`, `name=login-page-prototype`, `live=false`, neuestes erfasstes Deployment `ERROR`; 19 weiterhin konfigurierte, **nicht entschlüsselte** Environment-Variablen; Projekt-Domains `login-page-prototype-ves3.vercel.app` plus Git-Preview-Alias.
- Klar: **getrennte** Projekt-ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`, Name `klar-dating`, unverändert, neuestes Deployment `READY`. **Nicht löschen oder unlinken**.
- Der verbundene Vercel-Connector bietet **keine direkte Delete-Projekt-Aktion**: `get_project_deletion_link` bestätigte genau Demo-ID, Ownership und `status=requires_user_action`, `mutationExecuted=false`. Der Nutzer muss im Vercel-Dashboard den endgültigen **Delete Project**-Dialog bestätigen: [Vercel – Demo löschen](https://vercel.com/d?to=%2Fves3%2Flogin-page-prototype%2Fsettings%2Fgeneral%23delete-project&title=Review+in+Vercel).
- Ein zusätzlicher, nicht destruktiver Versuch, die Demo bis zur Bestätigung zu pausieren, scheiterte mit HTTP `400 invalid_deployment` und **`Active production deployment does not exist`**. **Keine Pause bestätigt.** Die früher aktivierte Preview-Sperre und Fork-Protection werden dadurch nicht aufgehoben; eine erneute Aktivierung wurde nicht vorgenommen.

**Ist-Status:** `deletionAuthorized=true`, **`deletionExecuted=false`**, `deletionConfirmed=false`. Keine falsche Behauptung der Entfernung. Die 19 Variablen bleiben bis zur tatsächlichen Löschung konfiguriert. Löschen des Vercel-Projekts führt **nicht automatisch** zur Rotation oder zum Widerruf existierender Datenbank- und Auth-Credentials beim externen Provider.

**Nachweisbar abzuschließende Stilllegung:**
1. Eigentümer bestätigt in Vercel **Delete Project** ausschließlich für `login-page-prototype`. Die Löschung entfernt Projekt, Deployments, Projektvariablen und die Projekt-Git-Verknüpfung; die externen Datenbank-/Auth-Anbieter sind separat zu betrachten.
2. Danach read-only `get_project` und `list_projects` abfragen: Demo-ID muss nachweislich nicht mehr existieren; Klar-Projekt muss weiter bestehen. Erwartete 404/Not-found nicht mit technischen Netzwerkfehlern verwechseln.
3. Bei den externen Neon-/Postgres-/Better-Auth-Zugängen Eigentümer, tatsächliche Nutzung und Abhängigkeit prüfen. Nicht mehr verwendete Credentials vom verantwortlichen Owner separat widerrufen; gemeinsam genutzte oder sensible Credentials nur nach Impact-Analyse kontrolliert rotieren. Nie Werte exportieren oder in Tickets schreiben.
4. Entfernte Demo-Verknüpfung anhand eines späteren Klar-Branch-Commits kontrollieren, ohne **extra nur zu Testzwecken** neue Deployments oder Secrets zu erzeugen.
5. Abschlussbelege mit Datum, Vercel-Projekt-ID und Gültigkeitsgrenze ergänzen, Audit-PR und Release-Risiko-Register aktualisieren. Das übergreifende Klar-Produktions-GO bleibt bis zur unabhängigen Freigabe gesperrt.

**Kein Produktions-GO:** `productionApproved=false`, **BLOCKED / NO-GO**; GitHub `main` und das Klar-Vercel-Projekt wurden durch diese Stilllegungsfreigabe nicht geändert.

## Abschlussnachweis – Demo tatsächlich gelöscht (02.11.2026)

**Eigentümerbestätigung:** Der Nutzer hat die endgültige Vercel-Demo-Löschung bestätigt. Anschließend wurde diese Aussage read-only in der **korrekten Vercel-Team-ID** `team_EiPWvm6QxGGw5oOV39HiSjaw` technisch gegen die alte Projekt-ID geprüft:

| Quelle/Operation | Rückgabe | Beweiskraft |
|---|---|---|
| Vercel `GET /v9/projects/prj_kfJ06pJHn3neZAkrtasYKezxuprF` | **HTTP 404, `not_found`, `Project not found`** | Frühere Demo-Projekt-ID existiert nicht mehr |
| Vercel `GET /v7/deployments` gefiltert auf dieselbe Demo-ID | **HTTP 404, `not_found`, `Project not found`** | Keine über diese Projekt-ID zugänglichen Deployments |
| Vercel `list_projects`, Team `ves3` | **1 Projekt**, ID `prj_9dEo2EJIDfmkx6JCS0BqwtF9fXre`, Name `klar-dating`; **kein** `login-page-prototype` | Zweiter, unabhängiger API-Nachweis der Entfernung |
| Vercel `get_project` für `klar-dating` | **200**, Name/ID erhalten, letztes Preview `READY` | Eigenständiges Klar-Projekt nicht gelöscht |

**Abschlussentscheidung:** `deletionAuthorized=true`; `deletionConfirmed=true`; `oldVercelProjectPresent=false` auf Basis authentisierter Vercel-API-Abfragen. Die Löschung selbst wurde nach Nutzerbestätigung in der Vercel-Oberfläche vorgenommen, **nicht** durch den ChatGPT-Connector. Die frühere Dopplung der Vercel-Git-Projektzuordnung ist für das gelöschte Projekt damit beendet. Die ursprüngliche 19-Variablen-Projektkonfiguration ist nicht mehr über die gelöschte Projekt-ID erreichbar. Keine Secret-Werte entschlüsselt oder publiziert.

**Wichtig:** Der erfolgreiche Projekt-Delete beweist **keine** Revocation/Rotation von Neon-/PostgreSQL-/Better-Auth-Provider-Credentials, keine Unversehrtheit historischer Logs und keine Abwesenheit von Datenkopien außerhalb des Vercel-Projekts. Der verantwortliche Provider-Owner prüft separat, ob alte Zugangsdaten aktiv und exklusiv der Demo zugeordnet waren, und widerruft sie kontrolliert, falls noch gültig; gemeinsam genutzte Credentials nur nach Impact-Analyse. Keine automatische Datenbanklöschung oder -rotation.

**Vercel-Demo-Gate:** Projektstilllegung **abgeschlossen und API-verifiziert**. **Klar-Release-Gate:** weiterhin `productionApproved=false`, **BLOCKED / NO-GO** wegen offener Security-Reviews, P0 #202/#254, TTL-/Cloud-/DPO-/SRE-Nachweisen. Die vorherigen Abschnitte dokumentieren den *historischen Zustand vor dem Delete* und dürfen nicht als aktueller Projektstatus gelesen werden.
