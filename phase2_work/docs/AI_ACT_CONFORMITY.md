# Klar: KI-, Datenschutz- und Compliance-Nachweisstatus

Stand: 2026-10-26. **Konformität nicht abschließend bestätigt. Produktion NO-GO.**

Dieses Dokument erteilt keine rechtliche Einstufung, Zertifizierung oder Produktionsfreigabe.
Der bisherige Status „Validiert & Dokumentiert“ und die früheren Audit-Stempel waren kein hinreichender Nachweis
für den aktuellen Gesamtstand. Die ursprünglichen Aussagen bleiben in der Git-Historie erhalten:
[historischer Stand vom geprüften main](https://github.com/Veselin-Takev/Klar-Dating/blob/22576716df77f9002fe2a924909778be566e4719/phase2_work/docs/AI_ACT_CONFORMITY.md).
Sie sind nicht als aktuelle Freigabe zu verwenden.

## Aktuelle Einordnung

| Bereich | Nachweisstand / erforderlicher nächster Schritt |
|---|---|
| EU AI Act | Funktionen und konkrete Verwendungszwecke einzeln einstufen; tatsächliche Transparenz, menschliche Kontrolle und erforderliche KI-Kompetenz belegen. Keine pauschale Einstufung aller Klar-Funktionen. |
| DSGVO, insbesondere sensible Daten | Zwecke/Rechtsgrundlagen, Datenflüsse, Empfänger, Auftragsverarbeitung, Transfers, Löschung und ggf. DSFA fachlich prüfen. Sanitizer und Tests ersetzen diese Prüfung nicht. |
| DSA | Anwendbarkeit und konkrete Pflichten gesondert prüfen; vorhandene Melde-/Moderations-Endpunkte sind noch kein vollständiger Rechtsnachweis. |
| ISO/IEC 42001 / NIST AI RMF | Orientierung für Kontrollen; keine Zertifizierung oder vollständige Umsetzung behauptet. |
| Change/Adoption | Unterlagen vorhanden, Pilot und G0–G5 ohne Durchführungsnachweis; siehe Phase-3-Register. |
| Technische Qualität | CI-Ergebnisse gelten für den bezeichneten Commit und Testumfang; keine Garantie allgemeiner Fehlerfreiheit oder rechtlicher Konformität. |
| Produktionsfreigabe | Nur der separate geschützte Release-/Governance-Prozess mit überprüften Nachweisen kann die Freigabe bestätigen. |

## Maßgebliche Register und Grenzen

- [Release-Manifest](../RELEASE_MANIFEST.json): Produktionsentscheidung und referenzierte technische Nachweise.
- [Go-Live-Checkliste](../GO_LIVE_CHECKLIST.md): offene Integrations-, Betriebs- und Kontrollfreigaben.
- [Phase-3-Register](phase3/EVIDENCE_REGISTER.json): ausschließlich Pilot-/Adoptionsnachweise; kein alternativer Produktionsfreigabekanal.
- [Solo-Pilot und Prüfregeln](phase3/SOLO_PILOT_AND_EVIDENCE_CONTROLS_2026-10-26.md): konkrete Zuständigkeit, Syntax-/Konsistenzprüfung und deren Grenzen.
- [Produktions-Runbook](PRODUCTION_RUNBOOK.md): sichere Betriebs- und Wiederherstellungsabläufe.

Fehlende Evidenz bleibt fehlend. Datierte technische Prüfergebnisse, Modellselbstauskünfte oder eine JSON-Angabe
„approved“ sind keine eigenständig authentifizierte Fachfreigabe. Externe Belege müssen zugriffsgeschützt und datensparsam gehalten werden.

## Aktualisierung und Freigabe

Vor jeder Statusänderung sind Scope, Code-/Prompt-/Modellversion, Datenklasse, Entscheider, Datum,
Evidenzherkunft und offene Restrisiken anzugeben. Die Referenzen müssen fachlich geprüft werden.
Eine technische Änderung oder ein erfolgreicher Test darf diese Bewertung nicht automatisch auf GO setzen.

Primärquellen für die weitere fachliche Prüfung:
[EU-Kommission – KI-Kompetenz](https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers),
[EDPB – Verantwortlicher/Auftragsverarbeiter](https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en),
[NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework).
