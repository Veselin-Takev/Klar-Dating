# Compliance-Audit: Entwicklungsstand und Freigabereife

**Stichtag:** 02.11.2026. **Baseline:** `main` `2808dc1cbb485f70b403681c108cea5a3361d950`.
**Status: NO-GO / keine offizielle Produktionsfreigabe.**

Der Eigentümer bestätigt **nur Entwicklung**. Dieser Bericht bewertet die Vorbereitung auf eine Veröffentlichung und den verfügbaren Nachweisstand. Er bestätigt weder eine gegründete Betreiberfirma noch den Sitz oder ein vollständig synthetisches Entwicklungsdateninventar. Es wird kein bereits laufender Kunden-/Zahlungsbetrieb unterstellt.

## Umfang und Grenzen

Datenschutz, Einwilligung/Betroffenenrechte, Retention, Anbieter/Transfers, KI-/Safety-Governance, Rechtstexte/Vertragswege, Barrierefreiheit, TOMs/Lieferkette, Incident/Recovery, Lizenzen, Marketing/FinOps und offizielle Freigabe wurden quellen- und evidenzbasiert abgeglichen. Der vertrauliche Detailbericht mit konkreten unbehandelten Befunden verbleibt beim Eigentümer. Das öffentliche [Kontrollregister](COMPLIANCE_EVIDENCE_REGISTER_2026-11-02.json) enthält 19 Bereiche, verantwortliche Rollen und Schließkriterien.

**P0/P1 bedeuten hier interne Freigabereifeprioritäten**, keine Anzahl festgestellter Gesetzesverstöße. Rollen sind noch keine besetzten unabhängigen Prüfer. Fehlende Unterlagen im Repository beweisen nicht, dass solche Unterlagen außerhalb des Repositories nicht existieren. Kein ISO-/DSGVO-/KI-Act-Zertifikat, keine externe Rechtsfreigabe und kein Live-Produktionsaudit werden behauptet.

## Tatsächlich überprüfte Evidenz

- 38 ausgewählte Quelldateien des festen Main-Commits mit Git-Blob und SHA256 im privaten Inventar gebunden.
- Acht zusätzliche lokale Prüfaufrufe: sieben erfolgreich; expliziter Marketing-Releaseversuch erwartungsgemäß Exit 1/NO-GO. Die Quellen-/Fixtureprüfungen belegen weder echte Zustellung noch rechtliche Wirksamkeit oder Fachabnahme.
- Bereits ausgeführte Security-/E2E- und CI-Nachweise bleiben wiederverwendete, commitgebundene Evidenz. Unbehandelte Sicherheits-/Dependencybefunde sind dadurch nicht geschlossen; siehe [Security-Audit](ENTERPRISE_SECURITY_AUDIT_2026-10-31.md).
- Authentifizierte GitHub-Sichtung: 152 offene PRs und 20 offene Issues; keine vollständige Fachprüfung jedes PRs behauptet. Vorhandene PRs #232/#270/#313 und Remediation-Ketten bleiben voneinander unterscheidbar.
- Unabhängige Fachabnahmen und tatsächlicher geschützter Produktionsprozess bleiben offen. Ein Environment-Name im Workflow ist kein Nachweis einer eingerichteten geschützten Environment.

## Kontrollübersicht

| IDs | Bereich | Nachweisstand vor Freigabe |
|---|---|---|
| C01–C02 | Betreiber/Rechtstexte, Zwecke/Rechtsgrundlagen | Tatsachenbehauptungen, Identität und vollständiges freigegebenes Verarbeitungsregister bestätigen |
| C03–C05 | Consent, Betroffenenrechte, Retention/Löschung | Teilumsetzung vorhanden; vollständige Fehler-/Wirkungs-/Frist-/Abschluss- und Betriebsbelege offen |
| C06–C07 | Analysedaten, Endgerätespeicherung, SDKs | Zweck-/Erforderlichkeits-/Fristen-/Auskunftsabdeckung und tatsächliches Browser-/Providerverhalten prüfen |
| C08 | Anbieter, Verträge und Transfers | Tatsächlich aktive Dienste/Rollen, Verträge, Unterauftragnehmer, Regionen und Transferinstrumente belegen |
| C09–C10 | KI, Alter, Safety und DSA | Rollen-/Use-Case-/Diensteklassifikation, Transparenz, Kompetenz und menschliche Betriebsprozesse prüfen |
| C11 | Preis, Vertrag, Widerruf und Kündigung | Öffentliche Erklärungswege vorhanden; aktive Funktionen, dauerhafte Bestätigungen, Fehlerbetrieb und gegebenenfalls Refunds belegen |
| C12 | Barrierefreiheit | Internes WCAG-Ziel und technische Prüfungen vorhanden; Anwendbarkeit, manuelle Journeys und unabhängige Bewertung offen |
| C13–C15 | TOMs, Incident/Recovery, OSS/Lieferkette | Bestätigte Befunde beheben; reale Kontrollen, Übungen und Lizenz-/NOTICE-/SBOM-Nachweise des tatsächlichen Artefakts offen |
| C16 | Marketing und FinOps | Claims blockiert bis Beleg/Fachfreigabe; interne Budgetunits sind kein nachgewiesenes anbieterweites Geldlimit |
| C17–C18 | Release und Change/Pilot | Exakte unabhängige Freigaben, tatsächliche Schulungs-/Pilot-/Betriebsbelege nicht erbracht |
| C19 | DSFA und Benennungspflicht | Verarbeitung/Risiko/Jurisdiktion fachlich screenen; Solo-Entwicklung ist keine pauschale Ausnahme |

## Rechtsstand und Anwendbarkeit

EU/Deutschland ist ein vorläufiger Prüfrahmen aus dem Produktkontext, kein bestätigter Unternehmenssitz. Die endgültige Zuordnung hängt von Betreiber, Zielmärkten, echten Datenflüssen, Funktionen und Unternehmensgröße ab.

- [EDPB: Rechenschaft, Verzeichnis und DSFA](https://www.edpb.europa.eu/sme/be-compliant/be-compliant_en) sowie [Betroffenenrechte](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en): tatsächliche Prozesse und Nachweise prüfen; technische Existenz einer Exportfunktion reicht nicht als Gesamtfreigabe.
- [§25 TDDDG](https://www.gesetze-im-internet.de/ttdsg/__25.html): Endgerätespeicher-/SDK-Vorgänge zweckbezogen einschließlich möglicher Erforderlichkeitsausnahmen beurteilen.
- [Aktueller §356a BGB](https://www.gesetze-im-internet.de/bgb/__356a.html) regelt die elektronische Widerrufsfunktion. Der Verweis ist nicht pauschal veraltet; tatsächlichen Zugang, Bestätigung und dauerhaften Beleg prüfen. Allgemeine Frist-/Belehrungsregeln und Kündigung gesondert abnehmen.
- [EU-Kommission: KI-Kompetenz](https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers) und [Art.50 im AI Act Service Desk](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50): aktuelle Rollen-/Funktionspflichten und Übergänge prüfen. Keine automatische Hochrisikoeinstufung aller Dating-/KI-Funktionen.
- [DSA-FAQ der Kommission](https://digital-strategy.ec.europa.eu/en/faqs/digital-services-act-questions-and-answers), [§3 BFSG](https://www.gesetze-im-internet.de/bfsg/__3.html) und [§38 BDSG](https://www.gesetze-im-internet.de/bdsg_2018/__38.html): Dienstekategorie, Größe, Verarbeitung und mögliche Ausnahmen sind fachlich zu beurteilen. Keine pauschale Pflicht oder Befreiung allein aus „arbeitet allein“ ableiten.

## Nächste Abnahmeschritte

1. Betreiber-/Daten-/Anbieterinventar und reale Entwicklungsdaten klären; rechtlich unbestätigte Behauptungen vor Veröffentlichung fachlich berichtigen. Keine fehlenden Geschäftsdaten erfinden.
2. Bestehende technische Remediation-PRs sequenziell prüfen und vollständige Fehler-/Erfolgs-/Lifecycle-Nachweise ergänzen. Unbehandelte Sicherheitsdetails bleiben privat.
3. Vor realen Pilotdaten Zweck, Rechtsgrundlage, Anbieter-/Vertragsstatus, DSFA-/DSB-Screening sowie Information, Zugriff und Löschung bestätigen. Ein Staging-Name ist keine Echtdatenfreigabe.
4. Isolierte reale Staging-, Vertrags-/Zustell-, manuelle Accessibility-, Restore-/Rollback- und Betriebsprüfungen nach erforderlichen Angaben und Autorisierung durchführen.
5. Nur der geschützte Prozess mit belastbaren technischen und unabhängigen Fachnachweisen zum integrierten Release-Commit darf Produktion bestätigen.

Keine Merges, Ressourcen-/Rechte-/Schutzregeländerungen, Rechtsfreigaben oder Deployments folgen aus diesem Bericht. Pay-per-Date bleibt Discovery. Der bestehende Audit-PR bleibt Draft/Blocked bis zum vorgesehenen unabhängigen Security-/Compliance-Review und seinen exakten Pflichtchecks. Neue Dokumentations-CI ist separat am tatsächlichen Commit zu lesen; frühere grüne Läufe sind kein Ersatz.
