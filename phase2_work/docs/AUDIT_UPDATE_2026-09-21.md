# Klar App Auditfortschritt

Stand 22. September 2026

Dieser Bericht aktualisiert das Audit vom 20. September und dokumentiert den inzwischen gemergten PR 13. Er beschreibt die geprüfte Anwendung, die Wirkung der Änderungen und die weiterhin erforderlichen Freigabenachweise. Eine vollständige Enterprise-Freigabe, WCAG-Zertifizierung oder Produktionsfreigabe wird nicht behauptet.

## Geprüfter Stand

| Nachweis | Ergebnis | Bezug |
|---|---|---|
| PR-Status | Gemergt | [PR 13](https://github.com/veselin8606-source/Klar-App/pull/13) |
| Geprüfter Anwendungscode | `f172abfc1eb4014349a6eb0c5317fce4d108d5a2` | PR 13 |
| Enterprise-CI | Erfolgreich | [CI 35630837390](https://github.com/veselin8606-source/Klar-App/actions/runs/35630837390) |
| TypeScript und Tests | 474 Tests in 64 Dateien bestanden | [CI 35630837390](https://github.com/veselin8606-source/Klar-App/actions/runs/35630837390) |
| Produktionsbuild und Container | Beide erfolgreich | [CI 35630837390](https://github.com/veselin8606-source/Klar-App/actions/runs/35630837390) |
| Chromium/Accessibility | 10 von 10 Checks bestanden | [Playwright 35630837241](https://github.com/veselin8606-source/Klar-App/actions/runs/35630837241) |
| Dependency-Audit | 0 hohe, 0 kritische; 7 moderate gesamt, 2 im Produktionsgraph | CI-Audit-Artefakt |

Die Nachweise gelten für den genannten Anwendungscode. Spätere Dokumentationscommits ändern diesen Code nicht.

## Wirkung der Änderungen

- Firestore ist die dauerhafte Quelle für Authentifizierungs-, Alters- und Einwilligungsentscheidungen; ein fehlgeschlagener Probe- oder Schreibvorgang erzeugt keinen falschen Erfolg und keinen flüchtigen Ersatzspeicher.
- Einwilligungsnachweis und Profilzustand werden atomar geschrieben. Signaturen und verkettete Evidence-IDs erhalten Integrität und Reihenfolge, auch bei konkurrierenden Widerrufen.
- Gäste dürfen keine geschützten Kontakte beginnen; deaktivierter anonymer Login erzeugt kein dauerhaftes Ersatzkonto.
- Benachrichtigungen und die Dashboard-Einführung wurden für Tastatur, Screenreader, Fokus, Fortschrittsansagen, Dismissals und reduzierte Bewegung überarbeitet.
- Fehlerdiagnose bleibt nach ausdrücklicher Einwilligung auf freigegebene technische Felder beschränkt. Browser-Tracing und automatische Session-Integrationen sind deaktiviert.
- CSP-, Browser-Wartebedingungen und Enterprise-Scanner wurden korrigiert. TypeScript-Casts werden erkannt; leere Modell-Scans schlagen fehl.
- Actions und Container-Basis sind unveränderlich referenziert. Firebase CLI 15.30.2 und Java 21 sind dokumentiert und in CI berücksichtigt.

## Verbleibende Freigabenachweise

| Bereich | Offener Nachweis | Verantwortliche Rolle |
|---|---|---|
| Barrierefreiheit | NVDA/Chrome, VoiceOver/Safari, Tastatur und Reflow auf angemeldeten Seiten | Accessibility und QA |
| Kritische Abläufe | Zwei Konten mit Kontakt/Chat sowie Safety, Löschung, Zahlung und Verifikation | Engineering und QA |
| Plattform | Branch-Schutz, IAM, Secret Manager, Alarmierung, TTL und Backups | Plattformbetrieb |
| Performance und TCO | Kaltstart, Laststufen, Spitzen, Dauertest, Latenz, Fehler und Kosten | SRE und Produkt |
| Rechtliche Nachweise | Dokumentinhalt/Hash, Schlüsselrotation, Aufbewahrung und geschütztes Archiv | Security und Datenschutz |
| Wiederherstellung | Isolierter Restore und Rollback mit gemessenem RPO/RTO | SRE |
| Externe Prüfung | Penetrationstest, Datenschutzfreigabe und manuelle Accessibility-Evidenz | Security und Datenschutz |
| Abhängigkeiten | Sieben moderate npm-Meldungen bewerten; zwei betreffen den Produktionsgraph | Security und Maintainer |
| Musik-Coach | Den getesteten Musik-Icebreaker an einen produktiven Caller anbinden oder bewusst abgrenzen | Produkt und Engineering |

HMAC-Signaturen sind für Personen ohne Schlüssel tamper-evident, ersetzen aber keine geschützte Archivierung, Aufbewahrung oder privilegierte Zugriffskontrolle. Automatisierte Axe- und Browserchecks ersetzen keine fachkundige menschliche WCAG-Prüfung.

## Freigaberegel

Keine breite Produktion, solange die blockierenden Nachweise nicht erbracht oder mit einer zeitlich begrenzten, verantworteten Risikoakzeptanz kompensiert sind. Ein Pilot benötigt zusätzlich Canary, Rollback, Alarmierung, Kostenlimits und eine benannte Freigabeverantwortung.

Aktuelle Kriterien: [Projektstatus](PROJECT_STATUS.md). Entwicklerstart: [Entwicklerdokumentation](DEVELOPMENT.md). Historische Bewertung: [Audit vom 20. September](END_TO_END_AUDIT_2026-09-20.md).
