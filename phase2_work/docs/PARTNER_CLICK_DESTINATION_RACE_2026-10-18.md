# P0 #55/#56 – Kampagnen-Zieladresse beim Partner-Klick atomar bestätigen (18.10.2026)

**Status: Draft / NO-GO.** Auf PR #108 aufgebaut.

## Befund
`recordPartnerClick` validiert die Kampagnen-Ziel-URL bereits vor dem Firestore-Transaktionsbeginn. Wenn ein Administrator die Zieladresse während dieses Zeitfensters verändert, konnte die Klicktransaktion für die aktualisierte Kampagne einen Zähler und Audit-Eintrag erzeugen, während der zuvor gelesene Tracking-Link den `klar_referral`-Token noch an die alte Adresse übergab.

## Korrektur
Die Firestore-Transaktion verlangt nun zusätzlich, dass `savedCampaign.data().destinationUrl` exakt der beim Vorabcheck validierten `campaign.destinationUrl` entspricht. Bei Abweichung findet keine Attribution, kein Ledger-Eintrag und keine Übergabe des Tracking-Tokens statt. Die bisher validierte Zieladresse wird dabei **ohne Tracking** zurückgegeben; eine Umleitung zur neuen Adresse ist ein separater Produkt- und UX-Entscheidungspunkt und wird hier nicht stillschweigend erzwungen.

Die bestehenden Prüfungen für aktiven/verifizierten Kampagnenstatus, erwachsene authentifizierte Besucher, Consent-Epochen, Quarantäne und Löschstatus bleiben erhalten.

## Test und offene Gates
Eine In-Memory-Vitest-Regression simuliert eine Änderung der Kampagnen-Zieladresse unmittelbar vor der Transaktion und fordert `tracked:false`, direkte ungetrackte URL, unveränderte Zähler und keinen Audit-Eintrag. Der lokale statische Sicherheitscheck prüft zusätzlich das Vorhandensein der Vergleichsbedingung. Der Vitest-Test und echte Firebase-Emulator-Konkurrenztests müssen unter dem gepinnten Node 22.23.3 ausgeführt werden. Auch Typprüfung, Build, Playwright, Security/Privacy/Legal/Finance-Freigaben und unabhängige Kaufnachweise stehen aus. Kein Merge, Deployment oder zusätzlicher GitHub-Actions-Lauf. Issues #55/#56/#8 offen – **NO-GO**.
