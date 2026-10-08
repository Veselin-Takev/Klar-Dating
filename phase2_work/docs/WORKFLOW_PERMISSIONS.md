# Workflow permissions

Stand 27.09.2026 im Prüfzweig PR 51.

| Workflow | Rechte | Zweck |
|---|---|---|
| ci.yml | contents read | Typen, Sicherheit, Emulatoren, Build, Container |
| playwright.yml | contents read | Chromium und Barrierefreiheit |
| docs-autoupdate.yml | contents read | TypeDoc als Review-Artefakt, kein Push nach main |
| auto-version.yml | contents read | Manuell gestarteter Versionsvorschlag als Patch; kein automatisches Tag |
| security.yml | contents read, security-events write | CodeQL und Dependency-Prüfung |
| release.yml | contents write, packages write, id-token write, attestations write | Geschützte Release-Umgebung, Container und Nachweise |

Actions-Standardrechte sollen lesend bleiben. Release-Schreibrechte gelten nur im Release-Workflow mit `environment: production`; dessen tatsächliche Schutzregeln müssen im Repository eingerichtet und geprüft werden. Eine YAML-Umgebung allein erzwingt keine Freigabe.

Am 27.09.2026 meldete die Branch-API `protected: false` für main. Erforderlich sind mindestens unabhängiges Review, verpflichtende Enterprise-/Playwright-/Dokumentationschecks und Schutz vor Force-Push. Die App-Anbindung liefert keinen administrativen Nachweis für diese Einstellungen.

Änderungen an Berechtigungen, Auslösern oder Veröffentlichung werden im selben PR dokumentiert. Keine ungetesteten Versions- oder Dokumentationscommits direkt nach main; keine erweiterten Connectorrechte allein zum Beheben von Workflowfehlern.
