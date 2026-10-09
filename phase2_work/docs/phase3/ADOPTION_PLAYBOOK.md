# ADKAR-Roadmap und Workflow-Neugestaltung

## 1. Auftrag, Annahmen und Pilotumfang

Ziel: Klar-Teams können geeignete KI-Unterstützung sicher anwenden, Ergebnisse prüfen, Fehler melden und einen messbaren Nutzen ohne Qualitätsverlust nachweisen.

[ANNAHME] Zielgruppen sind Support/Operations, Entwicklung/QA, Security/Datenschutz und fachliche Führung. Teamgrößen, benannte Personen und verfügbare Arbeitszeit sind noch nicht bestätigt.

[ANNAHME] Ein vierwöchiger interner Pilot startet erst nach G0-Freigabe. Woche 0 dient Vorbereitung und Baseline; anschließend erfolgen vier Kalenderwochen Befähigung sowie Nachprüfungen nach 30/60/90 Tagen. Es gibt noch kein freigegebenes Startdatum.

[ANNAHME] Der erste Pilot umfasst höchstens zehn freiwillige Teilnehmer und zunächst nur synthetische Fälle in freigegebenen Werkzeugen. Kleinere Teams nehmen vollständig teil, soweit Freiwilligkeit und Aufgaben passen. Die Personenzahl ist kein Leistungsziel.

Pilotfälle:

1. Support: Antwortentwurf zu einer öffentlich dokumentierten Klar-Funktion mit nachvollziehbarer Quelle; Mensch prüft und entscheidet über Verwendung.
2. Entwicklung/QA: Testfallentwurf und Zusammenfassung eines bereinigten Fehlers; Entwickler prüft, führt lokal aus und lässt Änderungen regulär reviewen.
3. Operations: Zusammenfassung synthetischer Betriebsereignisse und Vorschlag passender Runbook-Schritte; Operator bestätigt Diagnose und Handlung.

Ausgeschlossen: echte private Gespräche, biometrische Unterlagen, Zugangsdaten und Zahlungseinzelheiten in Schulungs-Prompts; automatische KYC-, Moderations-, Zahlungs- oder Löschentscheidungen; selbstständiger Kundenversand. Ein Übergang zu realen Daten braucht eine eigene dokumentierte Daten- und Risikofreigabe. Vorhandene technische Sanitizer ersetzen diese Prüfung nicht.

## 2. Verantwortung und Entscheidung

Die folgende Zuordnung ergänzt die Phase-2-RACI. Pro Entscheidung gibt es genau eine verantwortliche Freigabefunktion (A). Vor G0 werden reale Personen und Vertretungen im zugriffsbeschränkten Organisationsregister benannt; ein Funktionsname allein ist keine Unterschrift.

| Entscheidung / Arbeit | A | Ausführung (R) | Einzubeziehen |
|---|---|---|---|
| Pilotauftrag, Zeitbudget, Nutzenziel | Business Owner/Sponsor | Change Lead | Teamleitungen, FinOps |
| Anwendungsfall- und Risikobewertung | CoE Lead | Workflow Owner | Architektur, Security, Datenschutz |
| Werkzeug- und Zugriffskontrollen | Security Lead | Engineering | CoE, Operations |
| Datenverwendung und Messkonzept | Datenschutzverantwortliche Funktion | Data Steward | Security, zuständige Personal-/Interessenvertretung |
| Schulung und praktische Befähigung | Change Lead | Trainer/Team-Champions | Teamleitungen, QA |
| Fachliche Pilotqualität | Workflow Owner | unabhängiger QA-Reviewer | Anwender, Security |
| Scorecard und Nachweisqualität | Business Owner | Data Steward/FinOps | QA, Datenschutz |
| Übergang in regelmäßige interne Nutzung | Business Owner | Change Lead | alle erforderlichen Kontrollfreigaben |

Produktionsfreigabe bleibt beim bestehenden Release-/Governance-Prozess. Niemand darf die eigene hochriskante Ausführung allein abnehmen. Bei kleinen Teams ist ein zweiter geeigneter Reviewer zu benennen; bis dahin bleibt die betreffende Freigabe offen.

## 3. Meilensteine und ADKAR

| Phase / Termin | Konkrete Maßnahme und Kommunikationspaket | Verantwortlich | Nachweis / Austrittskriterium |
|---|---|---|---|
| Awareness · Woche 0–1 | Sponsor erläutert Problem, Nutzenhypothese und Grenzen; 30-Minuten-Teamdialog; zugängliches FAQ und Aufzeichnung/Transkript ohne Fallinhalte | Sponsor + Change Lead | Alle Teilnehmer erhalten Unterlagen; jeder kann Zweck, Grenzen und Meldeweg anhand eines Falls erklären |
| Desire · Woche 1 | Freiwillige Pilotvereinbarung, Einzelgespräche, dokumentierte Bedenken; Teamleitungen schaffen geschützte Lernzeit | Teamleitungen | Bedenken erhalten Owner und Antworttermin; jeder Teilnehmer entscheidet informiert über Pilotteilnahme |
| Knowledge · Woche 2 | Promptstandard, Quellenprüfung, Datenklassifizierung und Stop-/Meldeübung; rollenbezogene Lernkarten | Trainer | Wissenscheck mindestens 80 %; alle sicherheitskritischen Fragen korrekt, sonst Nachschulung vor Praxiszugang |
| Ability · Woche 3 | Begleitete Fallbearbeitung, manuelle Rückfalloption, unabhängige Bewertung | Workflow Owner + QA | Je Teilnehmer drei unterschiedliche Szenarien bestanden, darunter ein absichtlich fehlerhafter und ein eskalationspflichtiger Fall |
| Reinforcement · Woche 4 und +30/+60/+90 Tage | Scorecard-Review, Sprechstunde, aktualisierte Standardabläufe, Anerkennung hilfreicher Fehlermeldungen | Change Lead + Business Owner | G4-Entscheidung protokolliert; Folgeprüfungen mit Owner und Termin geplant; fortgesetzte Nutzung und Qualität später separat nachgewiesen |

Individuelle Blockaden werden an ihrer Ursache bearbeitet: fehlender Sinn → Sponsor-Gespräch; Sorge um Rolle/Arbeitslast → Teamleitung und Kapazitätsanpassung; Wissenslücke → Übung; fehlende Fähigkeit/Zugriffe → Coaching oder technische Korrektur; Rückfall → Ursachenanalyse. Zusätzliche Kommunikation allein ersetzt keine fehlenden Fähigkeiten oder Ressourcen.

[ANNAHME] Eine kurze freiwillige Selbsteinschätzung nutzt je ADKAR-Dimension eine Skala von 1–5. Unter 3 löst ein Unterstützungsangebot aus. Die Werte sind keine Zertifizierung und keine personenbezogene Leistungsbewertung. Auswertung nur aggregiert, keine Veröffentlichung kleiner Gruppen.

## 4. Persona- und Tätigkeitsauswirkungen

| Persona | Entfällt im freigegebenen Zielprozess | Verändert sich | Neue Aufgabe / Kompetenz |
|---|---|---|---|
| Support | manuelles Erstformulieren wiederkehrender Standardtexte | Antwortprüfung wird quellen- und fallbezogen; Versand bleibt menschlich | Halluzination erkennen, Unsicherheit erklären, Fall datensparsam melden |
| Operations | wiederholtes Zusammenstellen bereits freigegebener Runbook-Auszüge | Diagnosehilfe ergänzt die menschliche Ursachenprüfung | KI-Vorschlag gegen Live-Signal prüfen, stoppen und manuell übernehmen |
| Entwicklung/QA | erste Rohfassung einfacher Testfälle | Review umfasst Prompt-/Modellversion und neue Fehlerklassen | Angriffs- und Grenzfälle, lokale Regression, reproduzierbare Evaluation |
| Security/Datenschutz | nichts ohne bestätigte Prozessfreigabe | Prüfung wird stärker an Datenflüssen und Anwendungsfällen ausgerichtet | Kontrollstichproben, Eskalationsmuster, Zugriff auf sichere Nachweise |
| Teamleitung | informelle Schätzung der Akzeptanz | Planung berücksichtigt Lern- und Reviewzeit | Hindernisse bearbeiten, Nutzen mit Qualität und Aufwand abgleichen |

„Entfällt“ beschreibt einen Arbeitsschritt, keine zugesagte Stellenveränderung. [ANNAHME] Prompt-Verantwortlicher und Guardrail-Monitor sind Zusatzverantwortungen bestehender qualifizierter Rollen; neue Stellen werden nicht vorausgesetzt.

## 5. Arbeitstag vorher und nachher

**Support, synthetischer Standardfall „Wo finde ich die Spracheinstellung?“** Vorher: Dokumentation suchen, Text formulieren, Vollständigkeit prüfen, Antwort senden. Nachher: freigegebene Quelle und bereinigte Frage eingeben; KI liefert Entwurf mit Beleg und Unsicherheiten; Mitarbeiter gleicht UI/Quelle ab, korrigiert, entscheidet über Versand und erfasst nur Ergebnis-Metadaten. Wenn eine Funktion erfunden wird: Entwurf verwerfen, manuell antworten und reproduzierbaren Fehler melden. Zeitgewinn wird erst durch Messung bestätigt.

**Entwicklung/QA, synthetischer Fehlerbericht.** Vorher: Bericht lesen, Grenzfälle sammeln, Tests schreiben, lokal prüfen, Review. Nachher: KI entwirft Grenzfälle aus bereinigter Beschreibung; Entwickler ergänzt Sicherheitsfälle, verwirft unzutreffende Annahmen und führt lokal aus. Review und Freigabe bleiben bestehen. Kein zusätzlicher Remote-Lauf nur für Prompt-Experimente.

**Operations, synthetischer Verfügbarkeitsalarm.** Vorher: Signale und Runbook manuell vergleichen. Nachher: KI schlägt prüfbare Hypothesen vor; Operator bestätigt sie anhand autorisierter Signale. Falsche Diagnose → manuelle Analyse. Kein automatischer Rollback oder Secret-Zugriff durch den Pilot.

## 6. Kontrollierter Ablauf und Ausstieg

Auftrag klassifizieren → Eignung und Datenfreigabe prüfen → freigegebenen Prompt/Modellstand verwenden → Ergebnis mit Quellen und Regeln prüfen → menschliche Entscheidung → Ergebnis-/Aufwandsdaten erfassen → Fehler an bestehenden Incident-Prozess übergeben.

Bei Timeout, Budgetüberschreitung, fehlender Quelle oder nicht erlaubter Handlung endet der KI-Pfad; der dokumentierte manuelle Ablauf bleibt verfügbar. Bei möglicher Sicherheits-/Datenschutzverletzung sofort betroffenen Workflow pausieren und Security informieren. Fehlende Qualitätsnachweise verhindern die Ausweitung. Ein Wiederanlauf benötigt Ursache, Korrektur, Regression und Freigabe der zuständigen Kontrollfunktion.

Wöchentliche 30-Minuten-Steuerung: Fortschritt je Meilenstein, offene Hindernisse, Qualitäts-/Sicherheitslage, tatsächlicher Aufwand, nächste Entscheidung. Entscheidungen werden mit Version, Datum, Verantwortlichem und Nachweis im Register verlinkt. Produktivbetrieb wird daraus nicht automatisch genehmigt.
