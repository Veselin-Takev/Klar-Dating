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
