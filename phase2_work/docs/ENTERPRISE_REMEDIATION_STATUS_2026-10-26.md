# Enterprise-Maßnahmenabgleich – 26.10.2026

**Produktionsstatus: NO-GO.** Keine Bestätigung vollständiger Fehlerfreiheit oder
unabhängiger Compliance-Abnahme. Dieser Abgleich beschreibt vorhandene Kontrollen
und fehlende Nachweise; er ersetzt keinen Lauf gegen reale Cloud-Ressourcen.

| Maßnahme | Vorhanden | Offen / Abschlusskriterium |
| --- | --- | --- |
| Monorepo-Konsolidierung | Aktive CI arbeitet in phase2_work; Functions separat npm-gesperrt | Historische Root-/App-Konfigurationen bestehen; kein Nx/Turborepo-Workspace. Inventar, Zielstruktur, Import-/Build-/Deploymentmigration und Regressionen erforderlich. Unterschiedliche Laufzeitpakete brauchen nicht zwingend denselben Paketmanager. |
| CI/CD-Sicherheit | SHA-gepinnte Actions, read-only Standard-CI, Dependabot; Release-Rechte explizit | Kein verpflichtendes vollständiges SCA-/Scorecard-Gate nachgewiesen. Runner-Isolation und notwendige Release-Rechte separat prüfen. Scorecard ergänzt versionsgenaues Scanning, ersetzt es nicht. |
| TCO-Limits | Prozesslokaler telemetry/BudgetGuard; zusätzlicher Firestore-basierter Nutzer-/Global-Tageszähler vor KI-Aufrufen, Input-/Outputlimits | Keine validierte Cloud-Billing-/Anbieter-Abschaltung. Interne Units sind kein garantierter Geldbetrag. Preis-/Modellabdeckung, verteilte Reservierung, Quoten, Alarm-/Abschaltlatenz und Wiederanlauf real testen. |
| Lasttests | Begrenzter synthetischer GET-Generator, SLO-/Kosten-Evidenzvalidator | Keine belegten Account-/Matching-/Chat-Lastläufe im isolierten Staging; Firestore-Operationen, Kosten, Ramp-/Soak-/Erholung und Release-Commit-Bindung fehlen. |

## Umgesetzter nächster Teilschritt: Checkout-Credentials

Alle drei aktiven GitHub-Workflows setzen bei actions/checkout ausdrücklich
`persist-credentials: false`. Nachfolgende Build-/Testkommandos erhalten dadurch
keine vom Checkout persistierte Git-Anmeldung. Dies verhindert keine Zugriffe auf
anderweitig explizit bereitgestellte Tokens und ersetzt keine Runner-Isolation.
Der Release-Job benötigt weiterhin explizite Tokens für CI-Nachweis, Registry und
Attestierung; seine Rechte werden mit dieser Änderung nicht erweitert.

Lokale Prüfung: vorhandene Gates für Workflow-Layout, Toolchain-Pins,
Dependency-Locks und Release-Workflow sowie Release-CI-Regressionen. Alle vier Gates und 32 Release-CI-Regressionen bestehen lokal unter Node 24.22.1. Vollständige CI des neuen Heads ausstehend.
Workflow-dispatch-/Release-Pfade sind durch eine grüne PR-CI allein nicht live validiert.
Rollback: regulärer Revert der Workflowänderung; er würde persistierte
Checkout-Credentials wieder erlauben und ist sicherheitlich neu zu bewerten.

## Reihenfolge und Freigabegrenzen

1. Versionsgenaues automatisches SCA mit ehrlicher Behandlung bestehender Befunde
   und Ausfall-/Baseline-Politik einführen; keine Advisories pauschal unterdrücken.
2. Kostenkontrollen an tatsächliche Anbieter, Modelle und genehmigte Budgets binden.
3. Strukturmigration in kleinen überprüfbaren Schritten, ohne historische Quellen
   ungeprüft zu löschen; Nx/Turborepo nur bei begründetem Nutzen.
4. Nach Einrichtung eines separaten Staging-Projekts die Nutzerpfade, Skalierung,
   Abschaltung und Recovery mit synthetischen Daten ausführen und nachweisen.

Es existiert derzeit kein separates Staging-Projekt. Keine Cloud-Ressourcen oder
Produktionslast durch diesen Checkpoint eingerichtet oder ausgelöst. Offizielle
Produktionsfreigabe benötigt weiterhin unabhängige Freigaben und belastbare
Nachweise zum exakten Release-Commit.

Referenzen: [Auditstatus](SECURITY_AUDIT_STATUS_2026-10-26.md),
[Lasttestgrenzen](LOAD_TESTING.md),
[Cloud-Budgettypen](https://docs.cloud.google.com/billing/docs/how-to/budgets),
[Scorecard-Prüfungen](https://github.com/ossf/scorecard/blob/main/docs/checks.md).
Reine Billing-Warnbudgets begrenzen den Verbrauch nicht automatisch; verfügbare
Spend-Caps und deren verzögerte Durchsetzung müssen je Dienst geprüft werden.
