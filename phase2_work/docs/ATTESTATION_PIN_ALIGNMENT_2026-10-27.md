# Attestierungs-Pin und Release-Policy – 27.10.2026

**Produktionsstatus NO-GO. Kein Release ausgeführt.**

Dependabot-PR144 ersetzt den festen actions/attest-Commit durch
`b60c2628ab941b449db82e38ba8d500980ce8a54`. Der ursprüngliche CI-Lauf40407278151
scheiterte, weil die lokale Release-Policy noch den vorherigen SHA fest verlangte.
Der bestehende PR wird fortgeführt; kein paralleler Dependency-PR angelegt.

## Prüfung der Upstream-Änderung

Am27.10.2026 über die offizielle GitHub-API geprüft: neuer SHA gehört zu
`actions/attest`, ist genau einen Commit vor dem bisherigen Pin und wird von GitHub
als verified gemeldet. Betreff: Fix zur Erhaltung benutzerdefinierter Registry-Ports.
Geändert wurden Upstream-Integrationstest, src/attest.ts und dist/index.js.
Das action.yml am neuen Commit bietet weiterhin subject-name, subject-digest und
push-to-registry und verwendet Node24 als Action-Runtime. Der Compare enthält
keine Änderung dieser Metadaten. Das ersetzt keinen vollständigen Upstream-Codeaudit
oder Nachweis einer tatsächlich ausgeführten Produktionsattestierung.

## Änderung und Validierung

Die Release-Policy verlangt jetzt exakt denselben geprüften unveränderlichen SHA
wie der Workflow. Digest-Bindung, Registry-Push, erforderliche Berechtigungen,
Tag-Trigger, geschützte Produktionsfreigabe und exakte CI-Commitprüfung bleiben
bestehen. Keine zusätzliche Berechtigung und keine entfernte Assertion.

Lokal Node24.22.1: Release-Workflow-Gate PASS und32Release-CI-Regressionen PASS.
Gezielte Negativproben des realen Gates lehnen alten Pin, beweglichen main-Tag
und entfernte subject-digest-Bindung jeweils ab; danach Original-Workflow
wiederhergestellt und erneut PASS. Auf Windows wurden nur Arbeitskopie-Zeilenenden
für diese Prüfung normalisiert; kein semantischer Workflow-Diff dadurch.
Vollständige Pflicht-CI des aktualisierten PR-Heads steht aus.

Rollback: Workflow-Pin und Policy-Pin gemeinsam auf den vorherigen geprüften Stand
zurücksetzen und dieselben Release-Gates ausführen. Kein Produktionstag, Image-Push
oder Deployment wurde zum Test ausgelöst. Reale Attestierungs-/Container-/OS- und
unabhängige Freigaben bleiben gesonderte Release-Nachweise.

## Separater Dokumentationsabschluss

PR145 mit Pay-per-Date-Konzept und Optimierungsvorschlägen ist nach erfolgreicher
vollständiger CI40463562288 auf a39c0da176bc666cb67295801cb5278702f684df integriert.
Main-Merge:17a37c49f72e99bfc1dbd872d5427a9010af308f; Tree-Vergleich bestanden.
Die Integration betrifft nur Dokumentation: keine Preis-, Feature-, Vertrags- oder
Pilotfreigabe und keine autonome Realisierung des Konzepts.

Referenzen:
- https://api.github.com/repos/actions/attest/commits/b60c2628ab941b449db82e38ba8d500980ce8a54
- https://github.com/actions/attest/compare/7a37fbbab9669658a566371acd1cf2f8c7a40d32...b60c2628ab941b449db82e38ba8d500980ce8a54
- https://github.com/actions/attest/blob/b60c2628ab941b449db82e38ba8d500980ce8a54/action.yml
