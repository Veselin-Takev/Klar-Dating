# P0 #55/#56 – Signierte Referral-Tokens an gespeicherte Metadaten binden (18.10.2026)

**Status: Draft / NO-GO**, aufbauend auf PR #109.

## Befund
Ein Klick suchte den Referral-Datensatz anhand des Hashs eines HMAC-Tokens. Danach wurden die veränderlichen Datenbankfelder `ownerUid`, `campaignId` und `version` für die Kampagnen- und Eigentümerzuordnung verwendet. Der Hash des Tokens als Dokument-ID beweist nicht, dass diese Metadaten weiterhin den bei Token-Erzeugung signierten Werten entsprechen. Fehlkonfiguration oder unzulässige interne Schreibzugriffe könnten so eine bestehende Link-ID an einen anderen Eigentümer, eine andere Kampagne oder Einwilligungsperiode binden.

## Behebung
`recordPartnerClick` prüft zunächst, ob die aus den gespeicherten Eigentümer-/Kampagnen-/Versionswerten und dem konfigurierten Geheimnis deterministisch abgeleitete HMAC-Tokenfolge exakt dem angeforderten Token entspricht. Fehlende oder manipulierte Bindung wird mit HTTP 404 `partner_link_not_found` abgelehnt, bevor eine Weiterleitung an die aus diesen Feldern abgeleitete Kampagne erfolgt. Nach dem Vorabcheck vergleicht die Firestore-Transaktion die gespeicherten `ownerUid`-, `campaignId`- und `version`-Felder erneut mit den geprüften Werten. Ein dazwischen erfolgter Feldwechsel verhindert Zähler, Audit und `klar_referral`-Weiterleitung.

## Tests und offene Gates
Neue In-Memory-Vitest-Fälle prüfen manipulierte Eigentümer-, Kampagnen- und Versionswerte sowie eine Änderung der Kampagne unmittelbar vor der Transaktion. Der Test muss unter Node v22.23.3 mit vollständigen Projektabhängigkeiten ausgeführt und durch echte Firebase-Emulator-Transaktions- und Rules-Prüfungen ergänzt werden. Der Schutz ersetzt keine Firestore Least-Privilege-Rules gegen illegitime Metadatenänderungen. Kauf-/Käuferverifikation, Datenschutz- und Auditnachweise, TypeScript, Build, Playwright und Security/Privacy/Legal/Finance-Freigaben ausstehend.

Keine Änderung an `main`, kein produktiver Deploy und kein kostenpflichtiger GitHub-Actions-Lauf. P0 #55/#56 und Release #8 bleiben offen. **NO-GO.**
