# Phase 3 — KI-Einführung und Workflow-Adoption für Klar

Stand: 2026-10-26 · Version 1.1 · Verantwortliche Funktion: Change Lead.

**Status: Dokumentationspaket erstellt; fachliche Freigabe und Durchführung offen.**
Dieses Paket erfüllt die schriftlichen Liefergegenstände des angehängten „AI Change Management & Workflow Adoption Playbook (Pillar 3)“. Es ist kein Nachweis abgeschlossener Schulungen, erfolgreicher Nutzung oder einer Produktionsfreigabe.

## Aktueller Solo-Stand

Ein technischer Owner ist bestätigt; echte unabhängige QA-/Fachfreigaben, Pilot und Messungen bleiben offen. [Solo-Pilot und Evidenzkontrollen](SOLO_PILOT_AND_EVIDENCE_CONTROLS_2026-10-26.md) konkretisiert den nächsten A1-Entwurfspilot und die Registerprüfung. Ein CI-PASS bestätigt die Konsistenz des Registers, keine absolvierte Einführung oder Produktionsfreigabe.

## Arbeitsunterlagen

| Unterlage | Verwendung |
|---|---|
| [Roadmap und Workflow-Auswirkungen](ADOPTION_PLAYBOOK.md) | ADKAR, Verantwortungen, Meilensteine, Pilotgrenzen, Arbeitstag vorher/nachher |
| [Befähigung und Kommunikationsvorlagen](ENABLEMENT_AND_TEMPLATES.md) | Vier Wochen, Workshop-Drehbücher, Promptstandard, Feedback und Ankündigungen |
| [Scorecard und Abnahme](SCORECARD_AND_ACCEPTANCE.md) | Definitionen, Datenqualität, Kosten, Auswertung, Freigabeverfahren |
| [Nachweisregister](EVIDENCE_REGISTER.json) | Maschinenlesbare Ausgangslage; fehlende Nachweise bleiben ausdrücklich offen |

## Verbindliche Grenzen

- Grundlage: [Phase-2-RACI](../governance/AI_GOVERNANCE_RACI.md), [Incident Response](../INCIDENT_RESPONSE.md), [Produktions-Runbook](../PRODUCTION_RUNBOOK.md), [CI-Ressourcenpolicy](../CI_RESOURCE_POLICY.md).
- Unbekanntes Risiko wird entsprechend der Phase-2-Regel als hoch behandelt. Unklare Befugnisse bedeuten keine Ausführung.
- Kein Versand, keine Berechtigungsänderung, keine Zahlung, keine Identitätsentscheidung und keine irreversible Löschung allein aufgrund eines KI-Entwurfs.
- Freigaben gelten für bezeichneten Anwendungsfall, Datenklasse, Version und Personenkreis; eine Schulung erteilt keine zusätzlichen Systemrechte.
- Messwerte, Teilnehmer, Verantwortliche und Abnahmen werden nicht erfunden. `null` im Register bedeutet nicht erhoben bzw. nicht freigegeben.
- Das Paket aktiviert keine Pilot-Telemetrie und startet keine Schulung. Die Register-Konsistenzprüfung läuft in CI; eine gesondert vom Nutzer beauftragte Chat-Nachverfolgung ersetzt keine fachliche Abnahme.

## Quellen und Einordnung

Prosci beschreibt ADKAR als Awareness, Desire, Knowledge, Ability und Reinforcement. Diese fünf individuellen Veränderungsziele strukturieren die Roadmap. ADKAR ist eine Marke von Prosci; dieses Paket ist eine eigene Klar-Ausarbeitung und kein offizielles Prosci-Assessment.

NIST AI RMF strukturiert Risikomanagement über Govern, Map, Measure und Manage. Hier wird dies durch Zuständigkeiten, Workflow-Abgrenzung, Messung und dokumentierte Stop-/Korrekturentscheidungen umgesetzt. Daraus wird keine Zertifizierung abgeleitet.

Primärquellen, geprüft am 2026-10-09:

- https://www.prosci.com/methodology/adkar
- https://www.nist.gov/itl/ai-risk-management-framework
- https://airc.nist.gov/airmf-resources/airmf/
- https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf

Sämtliche Zeitpläne, Stichproben und Zielwerte unten sind Klar-Planungsvorschläge, keine von diesen Quellen vorgeschriebenen Grenzwerte. Personenbezogene Messung und erforderliche organisatorische Beteiligungen werden vor dem Pilot durch die zuständigen Stellen geprüft.
