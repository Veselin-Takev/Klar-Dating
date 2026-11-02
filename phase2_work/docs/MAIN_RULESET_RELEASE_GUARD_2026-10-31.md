# P1 #73 – GitHub-Main-Ruleset als verbindlicher Release-Preflight

**Stand:** 31.10.2026 · **Status:** Draft / BLOCKED / NO-GO · **Basis:** main 2808dc1cbb485f70b403681c108cea5a3361d950

## Live verifizierter Befund

Repository-Ruleset [#25756841](https://github.com/Veselin-Takev/Klar-Dating/rules/25756841) gilt aktiv für main, verlangt Pull Requests und den strikten validate-Check. Sie verlangte bei der API-Abfrage aber **0 genehmigende Reviews**, kein Codeowner-Review, keinen Schutz vor veralteten Reviews, keine Zustimmung für den letzten Push und keine Auflösung der Review-Kommentare. Ein grüner CI-Lauf konnte damit allein keine unabhängige Security-/DPO-/Finance-Abnahme beweisen.

## Implementierung im separaten Branch

- scripts/check-main-ruleset.mjs liest vor dem Production-Release ausschließlich die festgelegte GitHub-REST-Ruleset per GET; bei 403/404, JSON-Fehlern, Timeout, Überschreitung von 64 KiB oder falscher Repo-/ID-/Branch-Identität wird der Release angehalten.
- Als Voraussetzung gelten aktive main-Regeln ohne Bypass-Akteure, PR-Pflicht, mindestens eine genehmigende Review, CODEOWNERS-Pflicht, Schutz vor stale Reviews und Letztpush-Selbstfreigabe, aufgelöste Diskussionen und ein striktes validate-Check-Gate sowie Schutz vor Löschen/Force-Push.
- Der Release-Workflow ruft den Gate **vor** der bisherigen Produktionsfreigabe und jeder Veröffentlichung auf. Ein erfolgreicher Konfigurationscheck schreibt nur einen tokenfreien, an GITHUB_SHA gebundenen JSON-Beleg in release/github-main-ruleset-evidence.json. Der Release-eigene SHA256SUMS-Lauf erfasst die Belegdatei.
- Die CI führt synthetische Positiv-/Negativtests ohne Netzwerk aus. check-release-workflow.mjs schützt den obligatorischen Einbau gegen versehentliches Entfernen.
- Die vorhandenen formalen exakten Commit-/Rollen-/Evidence-Gates bleiben zusätzlich erforderlich; ein Ruleset-Check ersetzt keine tatsächlich unabhängige Freigabe.

## Explizite Grenzen und nächste Schritte

Diese PR **ändert keine GitHub-Admin- oder Ruleset-Einstellungen**. Unter der aktuell ausgelesenen Ruleset ist der neue Gate bewusst rot. Repo-Verantwortliche müssen reale und unabhängige Security-, Privacy-/DPO-, Finance- und SRE-Reviewer mit geeigneten Rechten benennen und die Schutzregel nach Prüfung tatsächlich aktivieren; negative Mergeversuche und eine Live-Abfrage müssen beweisen, dass die Regel greift. GitHub-API-Leserechte des Release-Tokens sind für den realen Job zu bestätigen; fehlende Rechte führen fail-closed zu NO-GO.

Der Gate prüft eine aktuell bekannte Ruleset-ID; bei einer genehmigten Ruleset-Migration muss auch der Pin in einem neuen kontrollierten PR geändert werden. Freigaben für P0 #202/#55/#48/#56/#70, echte Storage-/Cloud-IAM-/Scheduler-/TTL-/Art.-17-Nachweise und unabhängige Signaturen stehen weiterhin aus. Kein Merge, kein Deployment, kein Produktivzugriff. **BLOCKED / NO-GO.**

## Nachtrag 02.11.2026 – Main-Abgleich und Reviewer-Realität

**GitHub-Readback:** `main` hat SHA `96c3857c53f5ced31fe1394895185f42c75bc716`. Der aktive Ruleset #25756841 verlangt weiterhin `required_approving_review_count=0`, `require_code_owner_review=false`, `dismiss_stale_reviews_on_push=false`, `require_last_push_approval=false`, `required_review_thread_resolution=false` – trotz striktem `validate`-Check. Dieser Code-PR kann die API-/Admin-Einstellungen nicht selbst nachweisen oder ersetzen.

**Reviewer-Konstellation:** Die aktuelle Root-`CODEOWNERS` nennt für alle aktiven Pfade nur `@Veselin-Takev` und bezeichnet dies ausdrücklich als *technical ownership*, nicht unabhängige Security-/Finance-Freigabe. Ein Pull-Request-Autor kann seine eigene Änderung nicht als unabhängiger Reviewer genehmigen. Bevor verpflichtende CODEOWNERS-Reviews aktiviert werden, muss der Repo-Owner einen tatsächlich anderen, berechtigten Reviewer/Team für Security/Privacy und ggf. Finance benennen und den Approval-Ablauf mit den realen GitHub-Rechten prüfen. Ein unkoordiniertes Umschalten kann den Solo-Release-Prozess dauerhaft blockieren; **niemals** durch selbst erteilte oder simulierte Approvals umgehen.

**Synchronisation:** GitHub-Compare zeigte 3 aktuelle `main`-Commits, die nur `CODEOWNERS`, `phase2_work/docs/CODEOWNERS_ACTIVE_RETENTION_BOUNDARIES_2026-10-28.md`, `phase2_work/scripts/check-codeowners.mjs` und `phase2_work/scripts/test-codeowners.mjs` verändern. Keine Überschneidung mit den 7 Dateien dieses PR. Sie wurden durch einen rückverfolgbaren Branch-only Merge-Commit `49f94d51b705b7409feda5aacbd093ee03a5d99f` synchronisiert (Eltern: `254190921059b31086ae555973184fcb6a17b784`, `96c3857c53f5ced31fe1394895185f42c75bc716`). GitHub bestätigt danach `ahead=2`, `behind=0`, exakt 7 geänderte PR-Dateien, Draft, 0 Reviews. **Neue** `validate`-CI war bei dieser Dokumentation `in_progress`, also keine behauptete Freigabe.

**Freigabepfad:** (1) Reviewer-Identitäten und Rechte inklusive Vermeidung von Selbstapproval festlegen, (2) Review-Gate und CODEOWNERS in einem gesondert autorisierten GitHub-Admin-Change durchsetzen, (3) negative Probeläufe ohne Approval und mit veraltetem Approval dokumentieren, (4) Release-Workflow auf exakter SHA und mit passender Token-Read-Berechtigung prüfen, (5) erst nach unabhängiger Abnahme über Merge des Release-Guards entscheiden. Keine Produktivfreigabe durch diesen Bericht.

## Nachtrag 02.11.2026 – Wildcard-Ausschluss als fail-closed Regression

Bei der Prüfung des Release-Gates wurde ein **konkreter fail-open-Prüfpfad** gefunden: `validateMainRuleset` lehnte bisher nur den exakt geschriebenen Ausschluss `refs/heads/main` ab. Ein Ruleset mit `include=['refs/heads/main']` und `exclude=['refs/heads/*']` wäre durch die alte lokale Strukturprüfung trotz potenzieller Ausschlusswirkung nicht abgelehnt worden.

**Korrektur nur in diesem Draft-PR:** Für das explizit auf `main` gerichtete Ruleset gilt nun `conditions.ref_name.exclude.length===0` als Pflicht. Damit werden alle Ausschlüsse (inklusive Wildcards und noch unbekannter GitHub-Fnmatch-Syntax) konservativ verworfen. Vier zusätzliche Node-Regressionsmutationen decken `refs/heads/*`, `**`, `refs/heads/m*` und einen sonstigen Nicht-Main-Ausschluss ab. Diese Verschärfung ändert weder die GitHub-Admin-Regel noch andere Repository-Branches oder productive Cloud-Deployments.

**Stand bei Dokumentation:** Vor diesen Änderungen war [CI 41529817722](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41529817722) für SHA `e6d8b8410fbe7706d4cc89cc843ad6955aab0518` erfolgreich. Dieser Erfolg ist nach den neuen Commits **veraltet**. Erst die Enterprise-CI auf dem finalen neuen Head kann E2 für die Regression bestätigen; selbst diese ersetzt weder eine aktive GitHub-Ruleset-Änderung noch unabhängige Reviewer, den Cloud-Betriebsnachweis oder das Release-GO. `productionApproved=false`, **BLOCKED / NO-GO**.
