# Klar Date: Pay-per-Date – Konzept zur Prüfung

- Status: **Konzeptentwurf / Discovery; keine Implementierungs- oder Pilotfreigabe**.
- Erfasst: 26.10.2026. Produktverantwortung: @Veselin-Takev; fachliche Reviews offen.
- Nutzerentscheidung: Die Idee passt zum Klar-Konzept und soll für weitere Prüfung,
  Bewertung, Entwicklung und spätere Realisierung dokumentiert werden.
- Produktionsstatus unverändert **NO-GO**. Keine Änderung bestehender Zahlungs-,
  Matching-, Chat-, Datenschutz- oder Release-Regeln durch dieses Dokument.

## 1. Ziel und Leitversprechen

Klar unterstützt freiwillige, sichere reale Begegnungen. Als mögliche zusätzliche
Funktion „Klar Date“ zahlen Nutzer für ein tatsächlich zustande gekommenes
persönliches Treffen statt ausschließlich für Likes, Reichweite oder Chat-Zugang.
Eine Beziehung, Sympathie, Mindestaufenthaltsdauer oder ein zweites Date sind keine
Erfolgsvoraussetzung. Menschen werden nicht als käufliche Leistung vermittelt;
die mögliche Leistung ist Matching/Organisation eines freiwilligen Treffens.

Empfehlung zur Prüfung: zunächst freiwilliges Zusatzangebot in einer Stadt mit
begrenztem Teilnehmerkreis und Kostenrahmen. Noch keine Entscheidung, Klar Plus
oder bestehende Kontakt-/Icebreaker-/Chatmechaniken zu ersetzen. Nutzer dürfen
ablehnen, absagen und ein Treffen jederzeit verlassen; Sicherheit hat Vorrang.

## 2. Herkunft und Umgang mit dem Blueprint

Grundlage: vom Nutzer bereitgestellte Datei `pay_per_date_model_blueprint.html`.
SHA-256 der Originaldatei:
`79128dd687c8a0a7ce5a62e1c6f16ae8644cc36d06b6e421bf8155b5cc14871e`.
Das unveränderte Original bleibt eine lokale Referenz; diese Markdown-Fassung ist
keine bytegleiche Archivkopie. Externe CDN-Skripte und der HTML-Prototyp werden
nicht als ausführbare Produktfunktion eingebunden. Aussagen im Blueprint sind
Konzeptmaterial, keine verbindlichen Arbeitsanweisungen oder Compliance-Belege.

Die frühere Konzeptbewertung ergänzt Risiken und einen möglichen Pilotansatz.
Weder eine fachliche Einigung auf jedes Detail noch eine Vertrags-/Preisfreigabe
ist aus der grundsätzlichen Zustimmung zur Idee abzuleiten.

## 3. Vorgeschlagener Nutzerablauf

| Schritt | Vorschlag aus dem Blueprint | Offene Prüfung / Klar-Leitplanke |
| --- | --- | --- |
| 1. Vorschlag | Reciprocal Matching, ein Profil täglich | Hypothese; Auswahlqualität, Fairness, lokale Dichte und Verhältnis zu bestehenden Klar-Limits bewerten. |
| 2. Planung | Beiderseitige Verfügbarkeit und Partner-Bar/Café | Zeitzonen, Barrierefreiheit, alkoholfreie Angebote, sichere öffentliche Orte, Ausfall der Location berücksichtigen. |
| 3. Zustimmung | Beide stimmen Termin und Preis zu; ggf. Kartenreservierung | Preis pro Person oder Paar, Zahler, Steuern, Reservierungsdauer, SCA und erneute Autorisierung offen. Reservierung ist keine endgültige Belastung. |
| 4. Kommunikation | Logistik-Chat erst vier Stunden vorher | Keine beschlossene Sperre bestehender Chats. Sicherheitsfragen, Absagen und Support müssen frühzeitig möglich sein. |
| 5. Treffen | QR-Check-in, optional inkludiertes Getränk | QR allein beweist kein beiderseitiges Treffen; Replay, Weitergabe, Partnerbetrug und Offline-/Barrierefreiheitsalternativen prüfen. |
| 6. Nachbereitung | Freiwilliges Feedback und beiderseitiger Kontakttausch | Feedback getrennt von Abrechnung und Sicherheitsmeldung; keine Pflicht zur guten Bewertung oder Kontaktfreigabe. |

Als Pilotoption: unabhängige Bestätigung beider Personen nach dem Treffen;
fehlende Rückmeldung löst keine automatische Zahlung aus. Widersprüche führen in
einen begrenzten Support-/Prüfprozess, nicht zur automatischen Schuldzuweisung.
Dies ist eine Empfehlung zur Validierung; Einnahmeausfälle und Missbrauch müssen
mitgemessen werden. Ein optionaler Location-Nachweis darf keine sensiblen Profile
oder Dating-Präferenzen an die Gastronomie übertragen.

## 4. Entscheidungsregister vor Spezifikation

| ID | Entscheidung | Status / erforderlicher Nachweis |
| --- | --- | --- |
| PPD-01 | Abrechenbares Erfolgsereignis und beweisbare Vermittlungszuordnung | Offen: beiderseitiges tatsächliches Treffen, unabhängige Nachweise, Wiederholung und Streitfälle definieren. |
| PPD-02 | Nachträgliche Zahlung oder vorherige Autorisierung | Offen: Zahlungsanbieter, Verfahren, Kartenfenster und Zahlungsfehler im Sandbox-Test validieren; keine beliebig lange Hold-Garantie. |
| PPD-03 | Preis, Zahler und Gebühren | Offen: 14 EUR ist ein Beispiel, kein beschlossener Preis. Pro Person/Paar und Gesamtpreis ausdrücklich bestimmen. |
| PPD-04 | Absagen, No-Shows, Sicherheitsausnahmen | Offen: keine Strafgebühr oder automatische Sperre freigegeben. Recht, Fairness, Beschwerdeweg und Missbrauchsschutz prüfen. |
| PPD-05 | Datenverarbeitung und Einwilligung | Offen: Daten-/Zweckmatrix, Rechtsgrundlagen, ggf. Art.-9-Ausnahme, Widerruf und DSFA-Bedarf unabhängig prüfen. |
| PPD-06 | Partner- und Getränkemodell | Offen: Vertragsrollen, Leistungsausfall, Abrechnung, Datenschutzrollen und tatsächliche Marge nachweisen. |
| PPD-07 | Verknüpfung mit Klar-Kernprodukt | Offen: optionaler Modus, Matching-/Icebreaker-Konsistenz und Auswirkung auf bestehende Nutzer prüfen. |
| PPD-08 | Pilotziele und Stoppschwellen | Offen: vor Start messbare Ziele und genehmigte Kosten-/Sicherheitsgrenzen festlegen. |
| PPD-09 | Zahlungs-/Sicherheitsreife | Offen: Security-Review, isoliertes Staging, Recovery, unabhängige Abnahmen und exakter Release-Commit. |

## 5. Konflikte und nicht übernommene Zusicherungen

Der Blueprint kombiniert das reine Erfolgsversprechen mit Tokenverfall bei Absage
4–24 Stunden vorher und 14 EUR plus 15 EUR Strafe sowie 30 Tagen Sperre bei später
Absage/No-Show. Das widerspricht dem uneingeschränkten Versprechen, ausschließlich
bei einem Treffen zu zahlen. Vor Umsetzung entscheiden: reines Erfolgsmodell oder
abweichender Reservierungsvertrag mit separat geprüften, transparenten Regeln.
Keine dieser Gebühren/Sperren ist hier freigegeben. Sicherheitsbedingte Absagen
und frühes Verlassen dürfen keinen finanziellen oder sozialen Druck erzeugen.

Das Onboarding-Muster enthält eine bereits angekreuzte, deaktivierte Checkbox und
die Behauptungen „rechtssicher“/„vollständige Konformität“. Diese Darstellung ist
kein gültiger Nachweis einer aktiven Einwilligung und darf nicht unverändert in
das Produkt übernommen werden. Freiwilligkeit, Zwecktrennung, verständliche
Information und wirksamer Widerruf brauchen einen eigenständigen Review.
Ein Art.-9-Text allein löst weder alle DSGVO-Pflichten noch die Art.-6-Frage.

Aussagen zu ausschließlich europäischen Rechenzentren, Verschlüsselung, keinem
Ad-Tech/Verkauf und einfacher Widerrufbarkeit sind Zielanforderungen, bis die
vollständige Lieferkette, Übermittlungen und tatsächlichen Prozesse belegt sind.
Ein einzelner QR-Scan bestätigt weder beide Personen noch Freiwilligkeit/Sicherheit.

## 6. Wirtschaftlichkeit: Annahmen statt Nachweise

Die Blueprint-Angaben 15–25 Prozent Pay-Ratio gegenüber 5 Prozent Freemium,
68 Prozent Zusatzbestellungen, nahezu vollständige Anwesenheit, hohe Viralität
und vollständige Anreizübereinstimmung sind **unbelegte Hypothesen**. Sie dürfen
nicht als gemessene Klar-Kennzahlen oder gesicherte Investorenaussagen erscheinen.
Auch die Annahme schwacher Gastro-Zeiten Di–Do ist lokal zu prüfen.

Das Diagramm verteilt beispielhafte 14 EUR brutto auf 5,50 EUR Gastronomie,
5,76 EUR „Plattform Netto-Marge“, 2,24 EUR Umsatzsteuer und 0,50 EUR Zahlungsabwicklung.
Das ist ein illustratives Rechenbeispiel, keine freigegebene Steuer-/Gebührenkalkulation.
Die 5,76 EUR sind ohne vollständige Kostenrechnung kein nachgewiesener Gewinn.
Steuerliche Behandlung von Vermittlung, Getränk, Gutschein und Partneranteil sowie
Zahlungsgebühren hängen von Vertrag, Markt und Verfahren ab und sind zu prüfen.

Planungsformel pro tatsächlich bezahltem Treffen:

Nettoerlöse beider Personen + vertragliche Netto-Partnererlöse
− Partner-/Getränkekosten − Zahlungs-/Erstattungs-/Chargebackkosten
− Support/Moderation/Betrug − KI/Cloud/Verifikation
− anteilige Akquise und Kosten erfolgloser Vermittlungsversuche.

Alle Posten im selben Betrachtungszeitraum und auf derselben Netto-Basis erfassen;
Partnererlöse nicht doppelt zählen. Sensitivität für Bestätigungsquote, Ausfälle,
Supportminuten, Akquisekosten, Zahlungsbereitschaft und lokale Dichte rechnen.
Keine Umsatzprognose oder automatische Wirtschaftlichkeitsfreigabe.

## 7. Technische Anforderungen für eine spätere Umsetzung

Noch keine Implementierungsvorgabe, sondern zu spezifizierende Kontrollziele:

- Getrennte Zustände für Planung, Zustimmung beider Personen, Zahlungsreservierung,
  Anwesenheit, strittige Fälle, Capture, Freigabe einer Reservierung und Erstattung.
  Keine Gleichsetzung von Match, Reservierung, QR-Scan und abgeschlossenem Date.
- Serverseitige Autorisierung pro Teilnehmer; sichere Partnerrollen und minimale
  Partnerdaten. Zahlungsvorgänge nur über Providerreferenzen, keine Kartendaten im App-Store.
- Idempotente Zahlungsbefehle/Webhooks, Signaturprüfung, Replay-Schutz und Reconciliation;
  Race Conditions zwischen Absage, Capture, Widerruf und Erstattung prüfen.
- Kurzlebige, zweckgebundene Check-in-Tokens, keine privaten Profildaten im QR-Code;
  Rate-Limits, Kontingente und Kostenreservierung gegen Missbrauch.
- Keine dauerhafte GPS-Ortung, biometrischen Anwesenheitsnachweise oder verpflichtende
  Chat-Inhaltsanalyse zur Abrechnung. Keine Dating-Details in Payment-Metadaten/Logs.
- Lösch-/Aufbewahrungsplan für Termin-, Zahlungs-, Consent- und Sicherheitsdaten
  mit getrennten Zwecken und geprüften gesetzlichen Pflichten; pseudonym ist nicht anonym.
- Feature standardmäßig aus, keine bestehende Zahlung verändern. Provider-Sandbox,
  isoliertes Staging und rollbackfähige Aktivierung vor jedem real bezahlten Pilot.

## 8. Prüf- und Entwicklungsphasen mit Abschlusskriterien

1. **Discovery:** Zielgruppen-/Partnerinterviews und Zahlungsbereitschaft; keine
   behaupteten Marktzahlen. Erfolg/Preis/Absagevarianten schriftlich entscheiden.
2. **Fachliche Prüfung:** Product, unabhängige Legal/Privacy/Security und Finance
   bewerten PPD-01 bis PPD-09. Der Solo-Owner ersetzt keine unabhängige Abnahme.
3. **Prototyp:** synthetische Personen, fiktive Termine und Sandbox-Zahlungen;
   UX zu Zustimmung, sicherer Absage, Streitfall und Kontaktfreigabe evaluieren.
4. **Technik/Staging:** Auth-/IDOR-, Token-Replay-, Webhook-, Capture-/Cancel-Race-,
   Refund-, Lösch-, Ausfall-, Last- und Recoverytests samt Nachweisen zum Commit.
   Es gibt derzeit noch kein separates Staging-Projekt; keine Einrichtung durch diese Doku.
5. **Begrenzter Pilot:** erst mit freigegebenen Verträgen/Einwilligungen, Support,
   Budget und vorab festgelegten Start-/Stoppkriterien. Keine Pilotfreigabe erteilt.
6. **Rolloutentscheidung:** tatsächliche Ergebnisse und Risiken erneut unabhängig
   bewerten. Keine automatische Übernahme in die offizielle Produktionsfreigabe.

Pilotmessung mit definiertem Nenner: Vorschlag→beiderseitige Zusage→Termin→
bestätigtes Treffen→erfolgreich bezahltes Treffen; dazu Absagen/No-Shows,
Widersprüche, Erstattungen/Chargebacks, Supportaufwand, Sicherheitsmeldungen,
Deckungsbeitrag und lokale Wartezeit. Sicherheitsmeldungen nicht durch Zielquoten
unterdrücken. Schwellen, Stichprobe und Dauer sind vor Start offen zu genehmigen.

## 9. Referenzen und verwandte Repository-Nachweise

- [Klar-Roadmap](04-implementation-roadmap.md)
- [Produkt-/Marketing-Abgleich](PRODUCT_MARKETING_ENTERPRISE_ALIGNMENT_2026-10-14.md)
- [Security-Auditstatus](SECURITY_AUDIT_STATUS_2026-10-26.md)
- [Lasttestgrenzen](LOAD_TESTING.md)
- [EDPB: Einwilligungsleitlinien](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en)
- [EU-Kommission: Rechtsgrundlagen und Einwilligung](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en)
- [EU-Kommission: Datenschutzgrundsätze](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
- [Stripe: Autorisierung und spätere Belastung](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)
- [Breeze: Vergleichsmodell, keine Klar-Erfolgsevidenz](https://www.breeze.social/faq)

Externe Quellen sind Orientierung für die spätere Prüfung, keine Abnahme dieses
Entwurfs. Der bereitgestellte Blueprint begründet keine rechtliche Zertifizierung.

## 10. Optimierungsvorschläge für die nächste Konzeptprüfung

Ergänzt auf Nutzerwunsch am 26.10.2026. **Empfehlungen zur Bewertung**, keine
beschlossenen Produktregeln, Preisfestlegung, Implementierung oder Pilotfreigabe.
Die offenen Entscheidungen PPD-01 bis PPD-09 bleiben bestehen.

Leithypothese: Klar schafft durch passende Auswahl und hilfreiche Organisation
so viel zusätzlichen Wert, dass Menschen nach einem tatsächlichen Treffen
freiwillig für die vereinbarte Leistung bezahlen möchten. Diese Hypothese ist
mit Interviews und einem später freigegebenen Pilot zu prüfen, nicht als Erfolg
vorauszusetzen.

### 10.1 Vereinfachte Ausgestaltung

| Bereich | Empfehlung | Zu prüfen vor einer Entscheidung |
| --- | --- | --- |
| Leistungsversprechen | Passende Begegnung organisieren; keine Garantie für Sympathie oder Beziehung. | Verstehen Nutzer Leistung und Erfolgsereignis ohne falsche Erwartungen? PPD-01. |
| Zahlung | Ein verständlicher Einzelpreis, Gesamtbetrag vor Zustimmung sichtbar; zunächst keine Token-Pakete oder Zusatzgebühren. | Preis pro Person/Paar, Zahlungsbereitschaft, Steuer-/Gebührenbasis und Abrechnungszeitpunkt. PPD-02/03. |
| Verbindlichkeit | Terminbestätigung, einfache Umbuchung und ggf. Warteliste zuerst testen; Strafgebühren und automatische Sperren zurückstellen. | Nutzen, Supportaufwand, Fairness und Missbrauch; Ersatzmatches nur bei neuer beiderseitiger Zustimmung. PPD-04. |
| Sicherheit | Absagen, Blockieren, Melden und vorzeitiges Verlassen jederzeit zugänglich; Sicherheitsmeldungen unabhängig von Zahlungsstreit behandeln. | Kein finanzieller/sozialer Druck und keine Zustimmung des Gegenübers für Schutzmaßnahmen. PPD-04/09. |
| Treffpunkte | Wenige geeignete öffentliche, zugängliche Orte; alkoholfreie Angebote und Cafés einschließen. | Sicherheit, Erreichbarkeit, Barrierefreiheit und Partnerzuverlässigkeit; kein Konsumzwang. PPD-06. |
| Kommunikation | Freiwilligen kurzen Kennenlern-/Sicherheitsdialog ermöglichen; starre Vier-Stunden-Öffnung nicht voraussetzen. | Erwartungen, Moderation und Einbindung in bestehende Klar-Chats/Icebreaker. PPD-07. |
| Nachweis | Beiderseitige Bestätigung als Pilotoption; QR-Check-in nur ergänzend, keine Standortüberwachung. | Nichtantwort, abweichende Aussagen, Weitergabe/Replay und Supportfall. PPD-01/05/09. |
| Partnerangebot | Zuerst Vermittlung und Organisation validieren; Getränke-Bundles/Umsatzbeteiligung nachgelagert prüfen. | Tatsächlicher Mehrwert und Aufwand statt vorausgesetzter Partnererlöse. PPD-06. |

### 10.2 Drei zentrale Bewertungsregeln

1. **Zahlungsfähigkeit ist kein Beleg für Verbindlichkeit.** Zahlungsbereitschaft
   beweist weder respektvolles Verhalten noch ernsthafte Absichten. Erwartungen,
   reale Verfügbarkeit und gegenseitige Zustimmung sollen die Vermittlungsqualität
   bestimmen; Einkommen oder Zahlung allein sind kein Vertrauenssignal.
2. **Ein Modellversprechen wählen.** Für den ersten Pilot empfiehlt sich weiterhin
   das reine Erfolgsmodell. Einnahmeausfälle bewusst erfassen. Eine abweichende
   Reservierungs-/Absagegebühr ist eine eigene Produkt- und Vertragsentscheidung,
   kein stilles Detail desselben Versprechens. Rechtliche Prüfung bleibt erforderlich.
3. **Qualität vor bloßer Anzahl.** Mehr Treffen sind nicht automatisch bessere
   Vermittlung. Feedback zu respektvollem Ablauf, Profiltreue und hilfreicher
   Organisation ergänzen die Conversion. Eine gewünschte Beziehung oder positive
   Bewertung ist keine Voraussetzung für Abrechnung oder Unterstützung.

### 10.3 Empfohlener kleinster Pilotumfang

Eine Stadt, freiwillige Teilnahme, ein klarer noch zu bestimmender Preis,
wenige geeignete Partnerorte und ein begrenzter manueller Supportprozess.
Zunächst keine zusätzliche komplexe Empfehlungs-KI, Getränkegutscheine,
automatischen Sanktionen oder umfassende Partnerabrechnung bauen.
Bestehende Sicherheits-, Alters-, Einwilligungs- und Zahlungsprüfungen dürfen
auch im kleinen Pilot nicht reduziert werden. Erst belegte Abläufe automatisieren.

Mögliche Experimente vor dem bezahlten Pilot: Konzeptinterviews zur Leistung und
Preisverständlichkeit, klickbarer Prototyp mit synthetischen Personen, simulierte
Absage-/Streitfälle und Zahlungsanbieter-Sandbox. Keine echten Belastungen oder
Treffen aus dieser Dokumentation auslösen. Die Staging-/Review-Gates aus Abschnitt8
bleiben Voraussetzung; Stichprobe, Zeit, Budget und Stoppschwellen sind offen.

### 10.4 Qualitäts- und Wirtschaftlichkeitsmessung

Zusätzlich zum Funnel aus Abschnitt8 freiwillig und datensparsam erfragen:

- War das Treffen gewünscht und der Ablauf respektvoll?
- Entsprach die Person ihrem Profil?
- War die Organisation hilfreich?
- Würde die Person Klar Date erneut nutzen?

Getrennt davon messen: Bestätigungs-/Zahlungsausfälle, Widerspruchsquote,
Supportminuten, Erstattungen/Chargebacks und Deckungsbeitrag einschließlich der
Kosten erfolgloser Versuche. Nenner, Zeitraum, fehlende Antworten und Rücklaufquote
angeben; freiwilliges Feedback ist keine repräsentative Erfolgsgarantie.
Sicherheitsmeldungen dienen dem Schutz, nicht einer schlechten Nutzerbewertung;
keine Sanktion für Meldung oder Rücknahme einer Date-Zusage. Sicherheitssignale
nicht mit kommerziellen Erfolgsquoten verrechnen.

Nächster fachlicher Schritt: PPD-01/03/04/07 gemeinsam anhand dieser Empfehlungen
entscheiden und erst danach einen konkret begrenzten Prototyp spezifizieren.
Die Aufnahme dieses Abschnitts dokumentiert die Vorschläge; sie ist keine
Zustimmung zu jedem Detail und keine Freigabe zur autonomen Realisierung.
