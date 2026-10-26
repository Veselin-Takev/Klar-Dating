# Code-Struktur und Bereinigung — 2026-10-26

## Prüfstand und Ergebnis

Basis: main 22576716df77f9002fe2a924909778be566e4719.
Dies ist eine konkrete Quellcode-/Testprüfung mit begrenztem Änderungsumfang, kein vollständiges Security-Audit oder Enterprise-Zertifikat.
Der aktive App- und Servercode liegt unter phase2_work/. Dateien im Repository-Root werden nicht pauschal gelöscht:
Docker-/CI-/Release-Einstiegspunkte und historische Spiegel müssen vor einer späteren Konsolidierung einzeln zugeordnet werden.

Der erste Bereinigungsblock trennt Request-Diagnostik vom App-Bootstrap:
src/server/middleware/requestDiagnostics.ts enthält Korrelation, HTTP-Span-Lebenszyklus,
abgeschlossene API-Metriken und begrenzte Fehler-Snapshots. server.ts montiert diese an den bisherigen Positionen.
Dadurch entfallen rund 100 Zeilen Inline-Implementierung im Server-Einstieg.

## Behobene Probleme

- Das Überschreiben von res.send kann für send(object) durch den internen JSON-Pfad doppelt erfassen;
  end()- und Redirect-Antworten werden nicht zuverlässig auf demselben Weg erfasst.
  Die Diagnose verwendet jetzt einmalige finish-Listener und verändert keine Express-Antwortmethode.
- Vorzeitig getrennte Verbindungen konnten einen HTTP-Span ohne Abschluss hinterlassen.
  finish/close teilen sich jetzt einen einmaligen Abschluss; ein Abbruch erhält error.type=client_disconnect
  und keinen fingierten HTTP-200-Abschluss. finish belegt die Übergabe an das Betriebssystem, nicht den Empfang beim Client.
- API-Latenzlabels verwenden jetzt ebenfalls den begrenzten Routen-Template-Helper.
  Rohe URLs, Queryparameter und Bodies werden nicht in Diagnoseeinträgen gespeichert.
- Fehler-Snapshots sind auf zehn Einträge begrenzt, Latenzproben auf 1000.
  Der Zugriff liefert Kopien; ein Verbraucher kann die interne Liste nicht verändern.
  Die Daten bleiben pro App-Instanz und sind keine flotteweite SLO-/Staging-Evidenz.

Auth-/Rollenprüfungen, CSP, globale API-Limits, Stripe-Raw-Body-Reihenfolge, KI-Budgets und fachliche Handler
werden in diesem Block nicht umgebaut. Keine Abhängigkeiten oder Lockfiles geändert.

## Validierung und Grenzen

Neun neue HTTP-Lifecycle-Tests plus zwölf bestehende Telemetrie-Privacy-Tests: 21 PASS lokal,
isolierte Testkonfiguration, Node 24.22.1 / Vitest 5.0.5. Tracing wird in diesen neuen HTTP-Tests kontrolliert ersetzt;
echter Providerexport und externe Logs werden damit nicht bestätigt.
39 zusätzliche Auth-/CSP-/Release-Regressionen PASS.
Observability-, Auth-, JSON-Body-, TypeScript-Suppression- und Secret-Pattern-Gates PASS.
Vollständige Typechecks, Emulator-, Build- und Browserprüfungen müssen für den veröffentlichten PR-Head in CI bestehen.
Die lokale schlanke Testumgebung enthält nicht alle Produktionsabhängigkeiten; z.B. das glob-basierte IPv6-Gate ist dort nicht ausführbar.

## Bestehende Prüfschulden (auf main reproduziert)

- scripts/check-admin-route-boundaries.mjs behandelt auch den separat HMAC-authentifizierten
  Verification-Storage-Purge-Mount als fehlende Benutzer-/Rollenprüfung.
  Das Skript muss die tatsächliche alternative Authentifizierungsgrenze prüfen; keine pauschale Ausnahme ergänzen.
- scripts/check-core-business-write-boundaries.mjs erwartet teilweise überholte Limiter-Namen und das frühere IP-Keying.
  Abgleich mit den aktuellen Router-/IPv6-Grenzen sowie Mutations- und HTTP-Negativtests erforderlich.
- Beide Skripte sind nicht Teil der aktuellen check:enterprise-Kette.
  Ein grüner CI-Lauf ist deshalb kein Beleg, dass jedes historische Skript funktioniert.

Diese Befunde sind keine durch diesen Refactor eingeführten Regressionen und kein Nachweis eines ungeschützten Endpunkts.

## Nächste strukturelle Arbeitspakete

1. Die beiden historischen Prüfskripte an die wirklichen Sicherheitsgrenzen binden und mit Negativtests absichern.
2. KI-Routen fachlich gruppiert aus server.ts extrahieren; Policy-, Auth-, Einwilligungs- und Budget-Gates dabei
   auf tatsächlich gemountete Router umstellen. Keine reine Datei-Verschiebung mit blind gewordenen Scannern.
3. Große Screens anhand zusammenhängender Zuständigkeiten in Datenzugriff/Hooks, Zustandslogik und UI-Komponenten teilen.
   Gemessene Ausgangsgrößen auf dem Basisstand: Dashboard.tsx 2931, ChatView.tsx 2453,
   Profile.tsx 2301, AICoach.tsx 1184 Zeilen. Zeilenzahl allein ist kein Qualitätsurteil.
4. Root-Spiegel und aktive phase2_work-Einstiegspunkte inventarisieren, verbleibende Verbraucher nachweisen,
   erst dann Duplikate entfernen oder explizit archivieren.
5. Deployment-/Staging-/Rollback-Validierung separat fortsetzen. PR #127 ist ein eigener Entwurf;
   dessen erfolgreiche CI ersetzt keinen Live-Staging-Test.

## Primärquellen für den Lifecycle

- [Node HTTP: ServerResponse](https://nodejs.org/api/http.html#class-httpserverresponse)
- [Express Middleware-Reihenfolge](https://expressjs.com/en/guide/using-middleware/)
- [OpenTelemetry JavaScript Instrumentierung](https://opentelemetry.io/docs/languages/js/instrumentation/)

Keine Produktionsbereitstellung oder pauschale DSGVO-/Security-Freigabe durch diese Bereinigung.
