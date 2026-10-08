# Verbesserungsprogramm

Stand 27.09.2026. Tracking: [Issue 27](https://github.com/veselin8606-source/Klar-App/issues/27). Aktueller Prüfzweig: [PR 51](https://github.com/veselin8606-source/Klar-App/pull/51).

| Phase | Umsetzung | Status |
|---|---|---|
| 0 | Programmdokumentation und Zuständigkeiten | PR 28 gemergt |
| 1a | Health- und Account-Router | PR 29 gemergt |
| 1b | Webhook-Router | PR 30 gemergt; Reihenfolge und Signaturgrenze in PR 51 korrigiert |
| 1c | Chat- und Gate-Router | In PR 51 ausgelagert, gemeinsame Zugriffskontrolle |
| Kritische Wege | Anmeldung, Gast, Musik, Alter, Einwilligung, Chat-Gates; Widerruf ergänzt | Automatisierte Auswahl, keine Vollabdeckung |
| 2 | Große Screens, verteilte KI-Kontingente und Funktionsschalter | Teilweise offen |
| 3 | Last, Kosten, Wiederherstellung, manuelle WCAG- und Datenschutzfreigaben | Ohne reale Betriebsnachweise offen |

Die älteren Checkboxen im Issue geben den Stand vor PR 30 wieder. Dieses Dokument bildet den überprüften Codezustand ab. PR 51 darf erst nach erfolgreicher CI und unabhängigem Review übernommen werden; kein automatisches Schließen des Gesamtprogramms.

Nächste technische Priorität ist ein verbindliches, instanzübergreifendes KI-Budget einschließlich paralleler Anfragen und Neustarts. Anschließend große Screens entlang tatsächlicher Nutzung trennen und ungenutzte Widgets nach Produktentscheid entfernen. Neue Features dürfen nicht durch simulierte Erfolgszustände freigeschaltet werden.

Produktionsfreigaben und Nachweise stehen in [PROJECT_STATUS.md](PROJECT_STATUS.md). Dokumentationsänderungen gehören jeweils in denselben PR wie die zugehörige Verhaltensänderung.
