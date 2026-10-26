# Solo-Pilot und Evidenzkontrollen für Klar

Stand 2026-10-26. **Vorbereitung / kein Pilotstart / keine Produktionsfreigabe.**

## Bestätigte Ausgangslage

@Veselin-Takev ist der vom Repository-Eigentümer bestätigte technische Dateizuständige und arbeitet derzeit allein.
Die früheren Team-/Personazahlen sind Planungsvorschläge, keine existierenden Mitarbeiter oder besetzten Kontrollfunktionen.
Business Owner, Change Lead und Workflow Owner sind im vorgeschlagenen kleinen A1-Pilot Funktionen derselben Person;
ihre konkrete G0-Abnahme ist weiterhin nicht erfolgt. Unabhängige QA bleibt unbesetzt.
Security-/Finance-/Datenschutz-/Legal-Abnahmen für den offiziellen Release werden dadurch nicht ersetzt.

## Vorgeschlagener erster Anwendungsfall

- Workflow: KLAR-INTERNAL-DRAFT v1, ausschließlich interner Entwurf zu öffentlich dokumentierten App-Funktionen.
- Autonomie A1: Mensch prüft Quellen und Inhalt und entscheidet über Nutzung; kein automatischer Versand.
- Daten: synthetische Fragen und freigegebene öffentliche Quellenauszüge; keine Nutzer-Chats, KYC-/biometrischen Unterlagen,
  Zahlungsdetails, Zugangsdaten oder nicht freigegebenen personenbezogenen Daten.
- Werkzeug-/Modellkennung und Version: **noch festzulegen und fachlich freizugeben**.
- Messung: fünf Arbeitstage Baseline und anschließend die geplanten Befähigungs-/Pilotfälle.
  Aufwand und Zielwerte bleiben Annahmen bis G0. Es wird kein Starttermin erfunden.
- Ein fachlich geeigneter unabhängiger QA-Reviewer muss vor der entsprechenden Praxis-/Pilotabnahme benannt werden.
  Derselbe Mensch unter mehreren Rollen ist keine unabhängige Prüfung.

Ein kleiner Pilot darf Rollen bündeln, soweit die eigene Risikopolicy dies erlaubt.
Die bereits geltenden unabhängigen Security-/Finance-Release-Gates und fachlichen Datenschutzanforderungen bleiben bestehen.
Eine solche Organisationsstruktur wird hier nicht als allgemeine gesetzliche Pflicht für jedes Solo-Projekt dargestellt.

## Register und technische Prüfung

Das kanonische Register ist docs/phase3/EVIDENCE_REGISTER.json.
Schema 1, Dokumentversion 1.1 ergänzt Solo-Zuständigkeit, unabhängige QA, Abschlussdatum,
Commitbindung und explizite Beleglisten. Bestehende Gates und Messungen bleiben offen/null.

Aus phase2_work:
~~~sh
npm run check:adoption-evidence
~~~

Die CI führt diese Konsistenzprüfung auf jedem Lauf aus, auch wenn nur erlaubte narrative Dokumente geändert werden.
Ein PASS bedeutet ausschließlich **widerspruchsfreie Registerstruktur**, nicht bestandenes G0, verifizierte Belege,
durchgeführte Trainings, gesetzliche Konformität oder Produktions-GO.

Geprüft werden unter anderem:
- vollständige Gate-/Anforderungs-/Follow-up-Mengen und erlaubte Zustände;
- Vorbedingungen, zeitliche Reihenfolge und Beleg-/Commitfelder bei behaupteten Abnahmen;
- keine Selbstabnahme als unabhängige QA: G2 behält den Workflow Owner als A und benötigt einen separaten independent_review-Beleg; G3 benötigt die benannte unabhängige QA als Abnehmer;
- keine Pilotwerte vor Pilotstart, aber dokumentierte Baseline nach G0 vor Start möglich;
- Metadaten für Baseline/Pilot und Mindestfallzahl 20 für die vorgeschlagene Ein-Workflow-Auswertung;
- keine vorgezogene nachhaltige Adoption ohne tatsächlich als abgeschlossen dokumentierte Folgeprüfungen;
- unbekannte Registerfelder, rohe personenbezogene Zusatzfelder, URL-Zugangsdaten und Querytokens werden abgewiesen;
- keine Produktionsfreigabe aus dem Phase-3-Feld production_approval.

Für nicht belegte Gates bleiben named_approver, approved_at, approval_commit und independent_review null, evidence_refs leer.
Für eine behauptete Abnahme: approved_at als UTC-Zeitstempel, approval_commit als voller SHA passend zum Registerbasisstand,
belegter GitHub-Login und HTTPS-Referenzen ohne Credentials/Queryparameter.
Diese Kennungen und URLs müssen tatsächlich von den Berechtigten geprüft werden.
Eine spätere Änderung von Code, Prompt, Werkzeugrechten, Datenklasse oder Scope verlangt die entsprechende erneute Bewertung;
die bloße Gleichheit einer SHA-Zeichenfolge beweist keine aktuelle oder unabhängige Freigabe.

Aggregierte Messmetadaten haben ausschließlich case_count, period_start, period_end und evidence_refs.
Das ist kein Datensammler und keine vollständige Berechnung aller Scorecard-Qualitäts-/Kostenkriterien.
Reale Fall-, Qualitäts-, Datenabdeckungs- und Kostenprüfungen sowie die fachliche Akzeptanz bleiben außerhalb dieses Strukturchecks.
Ein geringfügig anderes Case-Design darf nicht stillschweigend durch Herabsetzen der Schwellen als bestanden gelten.

## Geschützte Nachweise statt öffentlicher Trainingsdaten

Git enthält Status, technische Kennungen und datensparsame Referenzen. Fallinhalte, Teilnehmerdetails, Roh-Prompts,
Antworten und Vorfallbeweise gehören in die vorher freigegebene zugriffsbeschränkte Ablage.
Auch eine URL kann sensible Informationen enthalten: nur opake, bereinigte Referenzen verwenden.
Der Checker ruft externe URLs nicht ab und authentifiziert weder ihre Inhalte noch den angeblichen Entscheider.

Vor realer Erfassung müssen Ablage, Zugriff, Aufbewahrung und Löschverfahren bestätigt sein.
Die geplanten Fristen in der Scorecard sind noch keine eingerichteten Löschjobs.
Ein Pilot mit einer Person benötigt keine scheinbar anonymen Nutzungsrankings;
qualitative Rückmeldungen und überprüfbare Fall-/Aufwandsbelege sind vorrangig.

## Nächste Abnahmen

| Schritt | Aktueller Stand | Benötigter tatsächlicher Nachweis |
|---|---|---|
| G0 Auftrag/Scope | OFFEN | Werkzeug/Modell, Rollen, Zeit-/Kostenbudget, Daten- und Messkonzept bestätigt |
| G1 Wissen | OFFEN | durchgearbeitete Fallkarten, Quellen-/Fehler-/Eskalationsverständnis |
| G2 Fähigkeit | OFFEN | unabhängige praktische QA-Abnahme der Szenarien |
| G3 Pilotbewertung | OFFEN | echte Baseline-/Pilot-Fallzahlen, Qualität, Datenabdeckung und Gesamtkosten |
| G4 interne Übernahme | OFFEN | fachlicher Beschluss, SOP, Rückfalloption und geplante Reviews |
| G5 Nachhaltigkeit | OFFEN | tatsächlich abgeschlossene +30/+60/+90-Tage-Reviews |
| Offizielle Produktion | **NO-GO / separat** | geschützter Release-Prozess mit echten Fach-/Betriebs-/Staging-Nachweisen |

G5 ist das Abschlusskriterium für die nachhaltige organisatorische Adoption.
Es wird hier nicht als pauschale neue 90-Tage-Sperre für jeden unabhängigen App-Release eingeführt.
Der vorhandene Produktionsprozess prüft seinen eigenen Geltungsbereich und bleibt maßgeblich.

## Bereits bekannte Produktionsblocker

- Kein abschließend festgelegter Hosting-Zielanbieter und kein bestätigtes isoliertes Live-Staging-Projekt.
- Kein geprüfter Live-Migrationsadapter und keine echten Staging-Dry-/Live-/Rollback-Nachweise.
- Unabhängige erforderliche Fachfreigaben und operative Nachweise noch offen.
- Release-Manifest führt weiterhin NO-GO; lokale oder CI-Modelltests ändern dies nicht.

Die Nachverfolgung bearbeitet technische und dokumentarische Aufgaben autonom.
Eine echte Abnahme durch eine berechtigte Person oder eine fehlende Umgebungs-/Budgetentscheidung kann sie nicht selbst erzeugen.
