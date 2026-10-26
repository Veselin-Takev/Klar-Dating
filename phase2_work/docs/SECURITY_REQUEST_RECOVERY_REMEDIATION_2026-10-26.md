# Security-Folgestand: Anfrageparser und Kontowiederherstellung

Stand 26.10.2026. Basis: main c17e7c3af0ce2ad158565f49334346459e6821d3.
**Technische Teilkorrektur; Produktion weiterhin NO-GO.**

## Änderung und Vertrag

Die aktive phase2_work-App unterstützt ausschließlich nicht komprimierte Anfragekörper:
kein Content-Encoding oder identity. Andere Werte werden global vor sämtlichen
Bodyparsern mit HTTP 415 und unsupported_content_encoding abgewiesen.
Alle 14 aktiven JSON-/Raw-/Text-/Form-Parser konfigurieren zusätzlich inflate:false.

Accept-Encoding für Antworten bleibt davon unabhängig. Unkomprimierte JSON-Requests,
Größen-/Strict-Grenzen und die ursprünglichen Bytes signierter Webhooks bleiben erhalten.
Clients und Job-/Webhook-Sender müssen Bodies unkomprimiert senden. Es gibt keine
automatische Dekompression vor der Signaturprüfung. Ein vorgeschalteter Proxy, der
Bodies verändert, muss separat im isolierten Staging geprüft werden.

Das ist die veröffentlichte Hersteller-Mitigation für
[GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828).
Der aktive App-Lock enthält weiterhin ältere body-parser-Versionen; die Mitigation ist
keine Behauptung eines vollständig aktualisierten Abhängigkeitsgraphen.
Der Root-Laufzeitspiegel ist durch diese aktive Mount-Korrektur nicht allgemein freigeprüft.

## Paketstände

- Direktes Zod: 4.6.6 in App und Root-Spiegel; zugehörige Bun-Pins und Registry-Integritäten
  stimmen mit der veröffentlichten npm-Metadatenantwort überein.
  [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) nennt diesen Fixstand.
  Das Paket hat keine Abhängigkeits-/Peer-/Optional-Kanten; diese Voraussetzung wurde geprüft.
- Functions: npm 10.9.2 hat ausschließlich den gesperrten body-parser auf 2.4.0
  sowie dessen erforderliches qs auf 6.16.1 aktualisiert. Keine Lifecycle-Skripte ausgeführt.
- Die lokale Bun-Installationsprüfung scheitert in dieser Windows-Ausführungsumgebung
  bereits am temporären Dateihandle mit EBADF. Daher darf die Integration erst nach
  erfolgreichem eingefrorenem Bun-/npm-Install und vollständiger CI auf dem exakten PR-Head erfolgen.
  Kein größerer transitive Bun-Graph wurde manuell neu aufgelöst.

Die erneute versionsgenaue OSV-Abfrage umfasst 1.438 Versionen:
21 betroffene Versionen statt 22 im Audit, weiterhin 39 eindeutige Advisories,
weil andere gesperrte Versionen dieselben Meldungen behalten.
Insbesondere transitives Zod 3 und weitere App-/Toolingmeldungen bleiben zur separaten Triage offen.
Dies ist kein SCA-Gesamt-PASS und keine pauschale Schließung von SEC-02.

## Wiederherstellung und Transaktionen

Ein zuvor nicht existentes password_reset_rate_limits-Dokument wird innerhalb derselben
Firestore-Transaktion mit count:1 und expiresAt angelegt. Ein abgelaufenes Fenster wird
ebenfalls neu gesetzt; laufende Fenster verwenden weiterhin update und die bestehende Grenze.

Die Unit-Testdatenbank verwirft jetzt update auf nicht existenten Dokumenten.
Negativ-/Positivtests prüfen Neuanlage, TTL-Wert, Ablauf, normalisierte E-Mail-Identität,
Quotengrenze, fehlgeschlagenen Speicherzugriff und den neutralen HTTP-Vertrag.
Es wird keine neue Collection, Datenmigration oder produktive Reset-Mail erzeugt.

Drei zusätzliche Tests verwenden echte Firestore-Emulatortransaktionen in der getrennten
benannten Datenbank password-reset-security-tests unter dem demo-Projekt:
Neuanlage/TTL-äquivalente Löschung, vier parallele Anfragen mit maximal drei Erfolgen,
und der Neustart eines abgelaufenen Fensters. Zufällige synthetische Adressen verhindern
Kollisionen; Cleanup betrifft ausschließlich diese Testdokumente.

## Validierung und Restarbeiten

Lokal: 21 gezielte HTTP-/Reset-Tests PASS mit Node 24.22.1, Vitest 5.0.5
und gepatchtem Zod 4.6.6 in isolierten Testabhängigkeiten auf D:.
Auth-, Didit-, Stripe-, Compliance-Purge-, JSON-/Retired-Parser-, Lockfile-
und Secret-Pattern-Gates PASS. Die drei Emulatorfälle und der vollständige
Node-22.23.3-/Bun-1.4.2-Stand werden durch die erforderliche exakte CI geprüft.
Lokale Windows-/fehlende Vollinstallationsgrenzen werden nicht als Emulator-PASS ausgegeben.

SEC-03 ist technisch korrigiert und muss durch diese CI abgesichert werden.
SEC-02 ist teilweise korrigiert/mitigiert. SEC-01, SEC-04 bis SEC-07 und die
unabhängigen Fach-/Live-Staging-/Betriebsnachweise bleiben separat offen.
Die bisherigen Auditbefunde bleiben als datierter Snapshot erhalten.
Es gibt kein Produktionsdeployment und keine Änderung der offiziellen Releaseentscheidung.

## Nächste Schritte

1. Restlichen Parser-/Tooling-Graph kontrolliert aktualisieren und erneut versionsgenau scannen.
2. Medienzugriffsregeln, Download-Token-/Widerrufsmodell und tatsächliche Auslieferung
   gegen Gast-/Alters-/Block-/Löschgrenzen durchsetzen und real an Regeln testen.
3. Weitere Auditbefunde über getrennte überprüfbare Änderungen schließen.
4. Erst mit bestätigtem isoliertem Projekt echte Staging-/Rollback- und Fachnachweise erbringen.
