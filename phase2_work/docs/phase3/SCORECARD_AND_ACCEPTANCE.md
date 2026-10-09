# Adoption Scorecard und Abnahme

## 1. Messdesign vor Beginn festlegen

[ANNAHME] Baseline: fünf Arbeitstage vor dem Pilot, mindestens 20 vergleichbare synthetische Aufgaben je Workflow. In Woche 3/4 mindestens 20 Aufgaben je Workflow mit KI-Unterstützung. Gleiche Falltypen und Schwierigkeitsverteilung, festgehaltene Prompt-/Modellversionen und abwechselnde Reihenfolge reduzieren Lern- und Auswahlverzerrungen. Die Mindestmenge erlaubt nur eine deskriptive Pilotbewertung, keinen statistischen Wirksamkeitsnachweis. Bei zu wenigen Fällen lautet das Ergebnis „unzureichende Evidenz“, nicht „bestanden“.

Jeder ausgewertete Fall hat eine pseudonyme Fallkennung. Ein Reviewer prüft alle Pilotfälle, soweit möglich ohne Kenntnis der Erstellungsart. Kritische Fehler stoppen unabhängig vom Mittelwert. Eine wöchentliche manuelle Scorecard reicht für diesen kleinen Pilot; ein neues Tracking-System wird nicht vorausgesetzt.

## 2. Definitionen und Zielwerte

Alle Zielwerte sind [ANNAHME] und müssen vor G0 vom jeweiligen Owner bestätigt werden. Istwerte sind noch nicht erhoben. Nenner 0 ergibt `null` / „nicht anwendbar“, niemals 0 % oder 100 %. Prozentwerte werden stets mit Zähler, Nenner, Zeitraum und Datenabdeckung berichtet.

| Metrik | Definition / Quelle / Rhythmus | Vorgeschlagenes Ziel und Entscheidung | Owner |
|---|---|---|---|
| Daily Active Prompters (DAP) | eindeutige Pilotnutzer mit mindestens einem zulässigen abgeschlossenen KI-Auftrag pro Arbeitstag; bereinigtes Pilotregister, täglich aggregiert | deskriptiv; keine Mindestquote und kein Ranking | Change Lead |
| Wöchentliche geeignete Nutzung | Nutzer mit ≥1 geprüftem KI-Fall / Teilnehmer mit ≥1 geeigneter Aufgabe in derselben Woche; Pilot-/Aufgabenregister | ≥70 % in Woche 4; bei niedriger Quote Ursachen untersuchen, keine Nutzungsverpflichtung | Workflow Owner |
| Assisted Task Ratio | KI-unterstützte abgeschlossene geeignete Fälle / alle abgeschlossenen geeigneten Fälle | deskriptiv neben Qualität; ausgeschlossene und abgebrochene Fälle separat | Data Steward |
| Automated Task Ratio | ohne menschlichen Bearbeitungsschritt abgeschlossene, explizit zur Automatisierung freigegebene Fälle / alle abgeschlossenen geeigneten Fälle | im A1-Entwurfspilot 0 % erwartet; menschlich geprüfte Entwürfe zählen nicht als automatisiert | Workflow Owner |
| User Satisfaction Index | (Mittelwert freiwilliger Antworten auf 1–5 − 1) / 4 × 100; wöchentlich, Antwortquote mitberichten | ≥75/100; bei zu kleiner Gruppe nur qualitative Auswertung | Change Lead |
| Fachliche Qualität | akzeptierte Fälle ohne wesentliche Nacharbeit / alle unabhängig geprüften Fälle; QA-Rubrik | ≥90 % und mindestens Baseline; kritische Fehler immer 0 | QA |
| Unbelegte wesentliche Aussagen | Fälle mit ≥1 unbelegter wesentlicher Aussage / alle geprüften Fälle; QA | 0 weitergegebene kritische Falschaussagen; jede Feststellung triagieren | QA |
| Netto-Bearbeitungszeit | Median menschlicher Minuten pro akzeptiertem Fall: Vorbereitung + Prüfung + Korrektur + Fehlerbehandlung; Wartezeit zusätzlich erfassen | ≥10 % unter Baseline bei erfüllter Qualität; sonst keine Effizienzbehauptung | FinOps |
| Kosten pro akzeptiertem Fall | gesamte Personal-, Modell-, Werkzeug- und anteilige Einführungskosten / akzeptierte Fälle im Zeitraum, inklusive Kosten verworfener Versuche | laufende Kosten höchstens Baseline; Einführung getrennt und transparent ausweisen | FinOps |
| Befähigung | praktisch freigegebene Teilnehmer / Teilnehmer mit Zugriff auf den Pilotworkflow | 100 % vor selbstständiger Nutzung | Change Lead |
| Kontrolltreue | ausgeführte Fälle mit allen erforderlichen Prüfungen/Freigaben / alle ausgeführten Fälle | 100 %; Abweichung pausiert betroffenen Workflow | Security |
| Datenabdeckung | auswertbare Fallrecords / alle im Aufgabenregister gezählten Pilotfälle | ≥95 %; darunter keine positive Nutzenentscheidung | Data Steward |

[ANNAHME] Kleine Gruppen unter fünf Personen erhalten keine quantitativen Zufriedenheits-/Nutzungsberichte nach Untergruppe. Bei insgesamt weniger als fünf Teilnehmern nutzt die Steuerung anonymisierte qualitative Rückmeldungen statt scheinbar anonymer Personenquoten. Rückfragen dürfen freiwillig persönlich erfolgen; Teilnahme und Zufriedenheit werden nicht als Beschäftigtenranking verwendet.

Nutzenformel für die Pilotentscheidung: Baseline-Gesamtkosten vergleichbarer Fälle minus Pilot-Gesamtkosten; Skalierungsszenarien separat als Annahme ausweisen. Weniger Modellaufrufe oder mehr Prompts sind allein kein Nutzenbeleg. Schulung und Reviewzeit sind nicht kostenlos.

## 3. Datensparsame Erfassung

Vorgeschlagene Felder: Fallkennung, Workflow, Wochenfenster, Prompt-/Modellversion, Eignung, KI genutzt, menschlich geprüft, akzeptiert, Nacharbeitsminuten, Gesamtzeit, direkte Kosten, Fehlerkategorie, sichere Nachweisreferenz. Für DAP ist nur im eingeschränkten Quellsystem eine pseudonyme Teilnehmerkennung nötig; sie wird nicht ins Git-Repository übernommen.

Keine Prompttexte, Roh-Antworten, Privatgespräche, biometrischen Daten, Tokens oder Klarnamen in der Scorecard. Auch Metadaten und Referenzen können sensibel sein. Zugriff auf Einzelrecords nur für benannte Data-Steward-/QA-Funktionen nach Freigabe; Führung erhält Aggregate. Fehlerbeweise werden im bestehenden zugriffsbeschränkten Incident-System gehalten.

[ANNAHME] Rohdaten des Piloten werden spätestens 30 Tage nach Pilotabschluss gelöscht, aggregierte Entscheidungsnachweise nach 90 Tagen überprüft. Datenschutzverantwortliche Funktion muss Zweck, Zugriff, konkrete Aufbewahrung und Löschverfahren vor G0 bestätigen; bis dahin keine personenbezogene Erhebung. Sicherheitsvorfälle folgen separat freigegebenen Beweissicherungsregeln. Dieses Papier konfiguriert keinen automatischen Löschjob.

Data Steward prüft wöchentlich Duplikate, fehlende Pflichtfelder, Nenner und Kostenabdeckung. Test-/Trainingsfälle bleiben von produktiven Messungen getrennt; ein synthetischer Pilot belegt keine Produktionswirkung.

## 4. Entscheidungstore

| Tor | Benötigter Nachweis | Entscheidung / Verantwortlichkeit |
|---|---|---|
| G0 — Pilotbereit | benannte Personen und Vertretung, bestätigtes Zeit-/Kostenbudget, freigegebene Tools und Daten, geeignete Fälle, Baseline-Plan, sicherer Meldeweg und manueller Rückfall getestet | Business Owner bestätigt Start erst mit allen Kontrollfreigaben |
| G1 — Wissen | Lernnachweise, Verständnisprüfung, kritische Fragen korrekt, Bedenken und Hilfen dokumentiert | Change Lead erteilt Lernfreigabe; keine zusätzlichen Systemrechte |
| G2 — Fähigkeit | drei bewertete Praxisfälle je Teilnehmer, unabhängiger Reviewer, sichere Stop-/Eskalationsübung | Workflow Owner erlaubt beaufsichtigten Pilotzugang nach Kontrollen |
| G3 — Bewertbarer Pilot | Mindestfallzahlen, Baseline, ≥95 % Datenabdeckung, vollständige Qualität-/Kosten-/Sicherheitsbewertung | QA bestätigt Nachweisqualität; kein pauschales Go durch Nutzungsquote |
| G4 — Interne Übernahme | alle Pflichtkriterien erfüllt, keine offenen kritischen Vorfälle, SOP/Support/Owner vorhanden, Restrisiken bewertet, Folgeprüfungen terminiert | Business Owner entscheidet Go / begrenztes Weiterlernen / No-Go; Kontrollfreigaben sind Voraussetzung |
| G5 — Nachhaltige Adoption | tatsächlich durchgeführte +30/+60/+90-Tage-Reviews, Qualitätsstabilität, fortgesetzte geeignete Nutzung, Nachschulung und behobene Hindernisse | Change Lead dokumentiert nachhaltigen Abschluss; Sponsor bestätigt |

Eine Zielverfehlung wird nicht nachträglich durch niedrigere Grenzwerte geheilt. Änderungen brauchen begründeten versionierten Beschluss und ggf. neue Baseline. Neue Datenklassen, Werkzeuge oder Handlungsvollmachten öffnen G0 erneut.

**Phase 3 ist organisatorisch erst nach bestätigter Durchführung und G5 abgeschlossen.** Das schriftliche Paket kann davor vollständig vorliegen. Die offizielle Produktionsfreigabe bleibt ein eigenständiger Prozess einschließlich der offenen Audit-, Restore- und Betriebsnachweise.

## 5. Abnahmevorlage und erste offene Maßnahmen

```text
Tor / Entscheidung: Go | begrenztes Weiterlernen | No-Go
Datum, Dokumentversion, Anwendungsfall und technischer Stand:
Person und Funktion des Entscheiders / unabhängiger Reviewer:
Nachweise und Zeitraum:
Pflichtkriterien: erfüllt | nicht erfüllt | nicht erhoben
Datenabdeckung / Einschränkungen / Restrisiken:
Erforderliche Kontrollfreigaben mit Nachweisreferenzen:
Maßnahmen, Owner, Frist / nächster Review:
Geltungsbereich und Ablaufdatum der Entscheidung:
```

Aktuell offen: Sponsor benennt Change Lead und Vertretungen; Workflow Owner bestätigt Pilotfälle; Security und Datenschutz prüfen Werkzeug-/Messkonzept; Teamleitungen bestätigen Lernzeit; FinOps bestätigt Budget und Kostenbaseline. Diese Aufgaben benötigen organisatorische Entscheidungen und werden im [Nachweisregister](EVIDENCE_REGISTER.json) nicht als erledigt ausgegeben.
