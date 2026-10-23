# CODEOWNERS: Solo-Betrieb und unabhängige Freigaben (2026-10-24)

Der Eigentümer hat bestätigt, derzeit allein am persönlichen Repository zu arbeiten. GitHub meldete die bisherigen @klar/engineering-, @klar/security- und @klar/finance-Teamzuordnungen auf main als Unknown owner. Diese Zeichenketten waren keine wirksame Reviewer-Zuordnung.

## Technische Dateizuständigkeit

@Veselin-Takev ist der technische CODEOWNER. Alle bisherigen kritischen Pfade bleiben erhalten; explizite Regeln für die vier Governance-Prüfdateien kommen hinzu. check-codeowners.mjs prüft 21 geschützte Pfade, die zuletzt wirksame Regel, Identitäten, globale Zuständigkeit, Verzeichnisgrenzen und unzulässige Glob-/unanchored Overrides. Ein globaler Eigentümer ersetzt keine explizite kritische Regel. check-codeowners-owner.mjs delegiert an dieselbe vollständige Prüfung.

## Unabhängigkeit und Produktionsblockade

Dateizuständigkeit bestätigt keine unabhängige Security-/Finance-Abnahme. codeowners-review-policy.mjs enthält bewusst leere Reviewer-Listen für beide Rollen. check-production-release-approval.mjs führt den zusätzlichen Check zusammen mit allen bisherigen Release-Evidence-Prüfungen aus. Solange diese Rollen unbesetzt sind, bleibt die Produktionsfreigabe blockiert. Der technische Eigentümer wird auch bei abweichender Großschreibung als unabhängiger Reviewer abgewiesen; Security und Finance benötigen unterschiedliche Personen.

Nach späterer Besetzung sind kontengebundene Signoffs auf dem exakten Commit und passende Review-Belege erforderlich. Diese Strukturprüfung authentifiziert keine Identität und prüft keine tatsächlichen GitHub-Rechte: der geschützte Release-Prozess muss die Belege und Berechtigungen zusätzlich überprüfen. Keine Freigabe wird erfunden oder automatisch erteilt.

## Validierung und Umfang

87 lokale Governance-/Release-Regressionen bestehen. Die bestehende Release-Workflow-Prüfung besteht; der Produktionscheck verweigert den aktuellen NO-GO-Stand einschließlich unbesetzter Fachrollen wie vorgesehen. Vollständige CI und GitHub-CODEOWNERS-Validierung auf dem PR-Head stehen vor Veröffentlichung noch aus.

Keine Änderung an Branchschutz, Zugriffsrechten, produktiven Ressourcen oder Release-Freigaben. Issues #73 und #8 bleiben bis zur jeweils erforderlichen externen Evidenz offen.
