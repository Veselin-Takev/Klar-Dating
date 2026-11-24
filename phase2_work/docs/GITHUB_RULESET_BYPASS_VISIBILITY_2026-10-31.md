# GitHub Ruleset #25756841 – Bypass-Sichtbarkeit, Release-Token und unabhängige Reviews

**Datum:** 2026-10-31 · **Status:** BLOCKED / NO-GO · **Betroffen:** #73, Draft PR #251, Release-Workflow

## Bestätigter Stand

- Auf dem aktuellen `main`-Ruleset #25756841 stehen `required_approving_review_count=0` und `require_code_owner_review=false`. Der technische Gate von [Draft PR #251](https://github.com/Veselin-Takev/Klar-Dating/pull/251), Commit `254190921059b31086ae555973184fcb6a17b784`, hat [Enterprise-CI Run 41208342316](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41208342316) als `completed/success` beendet; der Head bleibt **Draft und ungemergt**.
- Der neue Release-Gate `scripts/check-main-ruleset.mjs` verlangt `bypass_actors` als Array ohne Einträge. Unter dem beobachteten GitHub-App-Admin-Zugriff war dieses Feld bei der API-Abfrage vorhanden.
- **GitHub dokumentiert aber ausdrücklich**, dass `bypass_actors` bei `GET /repos/{owner}/{repo}/rulesets/{ruleset_id}` **nur bei Schreibzugriff auf die Ruleset** ausgegeben wird. Für das Lesen der restlichen Ruleset reichen `Metadata (read)`-Rechte. Siehe [offizielle GitHub-REST-Dokumentation](https://docs.github.com/en/rest/repos/rules#get-a-repository-ruleset).
- `.github/workflows/release.yml` nutzt aktuell `GITHUB_TOKEN` mit `contents: read`, `actions: read` sowie paket-/Attestierungsrechten, aber **nicht** mit Ruleset-Schreibrechten. Damit ist das erwartete Verhalten beim GitHub-Actions-Release-Token: `bypass_actors` fehlt, der Gate schlägt aus gutem Grund **fail-closed** fehl. Eine echte Release-Job-Laufzeitprüfung dieser Annahme liegt noch nicht vor.

## Operative Konsequenz und sichere Entscheidungsvorlage

**Die aktuelle Implementierung kann selbst nach Korrektur der Review-Schwellen für den standardmäßigen Release-Token dauerhaft blockiert bleiben.** Dies ist nicht durch eine erfolgreiche PR-CI oder das Admin-App-Leseergebnis widerlegt. Der Gate darf `undefined` keinesfalls als 'keine Bypass-Berechtigten' interpretieren.

Vor der Aktivierung einer Release-Kette sind folgende Nachweise verbindlich zu sammeln:

1. Unabhängige, tatsächlich berechtigte Security-, Datenschutz-/DPO-, Finance- und Release-Owner identifizieren; `main`-Ruleset auf genehmigte Review-Anzahl, Codeowner-/Stale-/Last-Push-/Thread-Schutz setzen und Negativ-Mergeversuche dokumentieren.
2. Einen genehmigten **least-privilege Beweispfad für Bypass-Freiheit** festlegen: beispielsweise separat von autorisiertem Ruleset-Administrator eingeholten und manipulationsgeschützt signierten Konfigurationsnachweis mit zeitlicher/Commit-Bindung und unabhängiger Prüfung. Die Kombination aus diesem Beleg und einer live lesenden `main`-Regelprüfung muss in einem separaten Review-fähigen Change erst technisch spezifiziert und negativ getestet werden.
3. Ein kurzlebiges Ruleset-Schreibtoken innerhalb des Release-Jobs wäre eine technisch mögliche, **aber sicherheitskritische Privilegienerweiterung** und ist ohne separate Risikofreigabe, isolierte Identität und strikte Begrenzung **nicht** zu implementieren.
4. Den tatsächlichen GitHub-Actions-Token-Payload / HTTP-Status ausschließlich in einer sicheren Testumgebung auf **Feldpräsenz, nicht auf Secrets** prüfen. Fehlende Feldpräsenz, 403, 404 oder nicht bestätigte Rollen müssen stets `NO-GO` ergeben.

**Keine Ruleset-Mutation, kein Hinzufügen eines privilegierten Tokens, kein GO aus Konfigurations-Evidenz allein.** Der CODEOWNERS-/Manifest-Signoff und die P0-Pflichten #202/#55/#56/#48/#70 bleiben unabhängig bestehen.
