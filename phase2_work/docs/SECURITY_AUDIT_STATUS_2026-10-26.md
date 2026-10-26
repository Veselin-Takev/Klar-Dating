# Security-Auditstatus – 26.10.2026

**Produktionsentscheidung: NO-GO. Keine offizielle Security-/Produktionsfreigabe.**

## Prüfstand und Umfang

Repository-Basis: f8654ee21d866191aff23b67f155971c6fac693b.
Der zugehörige [main-CI-Lauf 40300630969](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40300630969) ist erfolgreich.
Das technische Audit umfasst manuelle Architektur-/Codeprüfung, aktuelle Lockfile-SCA,
Secret-Pattern-Scan, gezielte lokale Tests und synthetische Reproduktionen.
Es ist keine unabhängige Drittprüfung und keine vollständige ASVS-Zertifizierung.

Der Eigentümer hat bestätigt: **Noch kein separates Staging-Projekt.**
Priorität ist zuerst das Security-Audit und sein Bericht; die Staging-/Hosting-Arbeit folgt anschließend.

## Ergebnis und Nachweisgrenzen

- Sieben offene priorisierte Befunde: zwei hoch, vier mittel, einer niedrig.
  Diese Befunde sind noch nicht als behoben abgenommen.
- Aktuelle OSV-Abfrage: 1.436 eindeutige npm-Paketversionen aus Root-/App-/Functions-Lockfiles,
  22 betroffene Versionen und 39 eindeutige Advisories.
  Datenbank-Severities: 2 CRITICAL, 13 HIGH, 16 MODERATE, 8 LOW.
  Meldungen enthalten Entwicklungs-/optionale Pakete und sind keine nachgewiesenen App-Exploits.
- Secret-Pattern-Scan: 1.271 getrackte Textdateien, keine Treffer; sechs Binärdateien übersprungen.
  Git-Historie und externe Secret-Stores sind damit nicht vollständig geprüft.
- Gezielter lokaler Testlauf: 149 Tests, 148 bestanden, einer fehlgeschlagen.
  Der zusätzliche Testumfang ist vom bestehenden CI-Umfang zu unterscheiden.
- Lokale Enterprise-Prüfgruppen: 51 PASS, acht FAIL, eine INCOMPLETE.
  Windows-/Werkzeug-/Eingabebedingungen sind im detaillierten Bericht einzeln eingeordnet;
  diese Zahlen sind kein Nachweis von acht neuen Anwendungsschwachstellen.
- Live-DAST, tatsächlich ausgerollte Cloud-Regeln, IAM/Netzgrenzen, Container-/OS-SCA,
  Alarmzustellung, Restore und Live-Rollback bleiben ungeprüft.

Der vollständige Bericht mit Befunddetails, Reproduktionen und Evidenzanlagen wurde dem Eigentümer
als lokales Auditpaket bereitgestellt. Dieser öffentliche Status enthält die Freigabeentscheidung
und den Prüfungsumfang; die noch offenen detaillierten Sicherheitsbefunde werden kontrolliert behandelt.

## Nächste Schritte

1. Hohe Risiken zuerst triagieren und über überprüfbare Fix-PRs bearbeiten.
2. Jeden Befund mit verantwortlicher Person, Commit, positiven/negativen Tests,
   Ergebnis und tatsächlichem Reviewer schließen; verbleibende Risiken ausdrücklich entscheiden.
3. SCA und relevante Tests am exakten korrigierten Commit erneut ausführen.
4. Anschließend ein isoliertes EU-Staging mit synthetischen Daten und getrennten Firebase-Ressourcen
   festlegen und dort die fehlenden Betriebs-/Integrations-/Migrationsnachweise erbringen.
5. Offizielle Produktion erst nach dem separaten geschützten Releaseprozess und tatsächlichen
   erforderlichen Fachfreigaben. Technischer Owner bleibt @Veselin-Takev;
   unabhängige Fachprüfer sind noch zu benennen.

Bestehende Branch-/Freigabeschutzregeln wurden durch dieses Audit nicht verändert.
Grüne CI allein erteilt keine Produktionsfreigabe. Historische Auditberichte beschreiben ihren jeweiligen
damaligen Umfang und dürfen diesen aktuellen Nachweisstand nicht ersetzen.

## Prüfrahmen

[OWASP ASVS 5.0.0](https://asvs.owasp.org/),
[OWASP API Security Top 10 2023](https://owasp.github.io/blog/2023/07/03/owasp-api-top10-2023),
[NIST SSDF SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final),
[OSV API](https://google.github.io/osv.dev/post-v1-querybatch/).

## Technischer Folgestand

Eine nachfolgende Teilkorrektur für Anfrageparser, Paketstände und Kontowiederherstellung ist in [Security-Folgestand](SECURITY_REQUEST_RECOVERY_REMEDIATION_2026-10-26.md) dokumentiert. Der obige Auditstand ist ein datierter Snapshot. Teilfixes oder technische CI-Nachweise ersetzen keine unabhängige Security-/Produktionsfreigabe; verbleibende Befunde bleiben ausdrücklich offen.

## 2026-10-26: Trace exception minimization

The Firestore/Gemini tracing wrappers now export fixed exception categories instead
of arbitrary thrown values. Thirteen real-SDK/batched-export boundary tests pass locally;
full exact-head CI is pending. SEC-04 remains partially open for other logging paths
and real sink controls. See [trace checkpoint](SECURITY_TRACE_MINIMIZATION_2026-10-26.md).
Production remains **NO-GO**; PR #131 passed full CI before integration, independently
of the remaining production acceptance evidence.
