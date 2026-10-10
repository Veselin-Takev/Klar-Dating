# DB-02 – Begrenzte Provider-/Storage-Löschung

Stand: 10.10.2026. Basis: `55f6a0705be0f2dda2bf304137496265a0ca9105`.
Kandidat auf `fix/audit-runtime-policy-2026-10-10`; nicht bereitgestellt.
**Produktion: NO-GO / NOT CONFIRMED.**

## Befund und Korrektur

Bisher behandelte der Worker jede weitere Didit-Seite als Fehler
(`provider_more_pages`). Große Konten konnten dadurch das Limit von
50 Fehlversuchen trotz erfolgreicher Löschungen erreichen. Die Kontofoto-Löschung
verwendete außerdem `deleteFiles` ohne Begrenzung der Objektzahl pro Aufruf.

Didit verarbeitet weiterhin höchstens fünf Sitzungen pro Lauf. `eraseDiditPage`
liefert `false` jetzt ausschließlich nach mindestens einer bestätigten 204-Löschung.
Eine nichtleere Liste mit ausschließlich 404-Antworten ergibt einen wiederholbaren
Fehler, damit veraltete Listen keine unbegrenzten kostenlosen Wiederholungen auslösen.
Unerwartete Antworten und Fehler nach Teilerfolg bleiben echte Fehler. Eine leere
Sitzungsliste und bestätigte Provider-Nutzerlöschung sind weiterhin Voraussetzung
für `true`. Die Provider-API-Endpunkte wurden nicht verändert.

`deleteAccountPhotos` liefert nun `Promise<boolean>`:
- `true`: Beide Kontopräfixe wurden leer und ohne Fortsetzungsmarker gelesen.
- `false`: Mindestens ein Objekt wurde erfolgreich gelöscht; ein weiterer Lauf
  muss die leeren Präfixe bestätigen.
- Ausnahme: Kein belegter Fortschritt, Objekt-Hold, fehlende Generation,
  Generationskonflikt, Zugriffs- oder Dienstfehler.

Pro Lauf werden höchstens 100 Objekte aus `verification/{uid}/` und 100 aus
`profiles/{uid}/` verarbeitet. Automatische Paginierung ist aus; Wiederholungen
beginnen am Anfang der verbleibenden Objekte. Der abschließende Schrägstrich
begrenzt die Suche auf das betreffende Konto. Löschungen verwenden
`ifGenerationMatch`; ein zwischenzeitlich ersetztes Objekt wird nicht als
erfolgreich gelöscht behandelt. Holds werden weder entfernt noch stillschweigend
übersprungen. Ein Fehler nach Teilfortschritt wird nicht in Erfolg umgewandelt.

Der Worker unterscheidet Provider-, Storage-, Chatseiten- und Zeitabschnittsfortschritt.
Bestätigte Seiten stellen nur den beim Start reservierten Fehlversuch wieder her;
frühere echte Fehler bleiben erhalten. Fortschrittsupdates erfordern eine noch
gültige eigene Lease. Neue interne Jobzähler: `completedProviderPages` und
`completedStoragePages`. Sie zählen Fortschrittsläufe, keine vollständig gelöschten
Konten und keine Provider-/Storage-Gesamtmengen. Die finalen DB-01-Belegzähler bleiben
auf ihre sieben dokumentierten Kategorien begrenzt.

## Nachweise und Grenzen

- 49 dependency-free Node-Tests bestanden unter Node 24.19.0, davon sieben neue
  Tests am tatsächlichen Storage-Modul. Die Tests verwenden synthetische Bucket-
  Implementierungen, keine Produktionszugriffe oder Emulatoren.
- Statischer Art.-17-Check bestanden.
- Neue/aktualisierte Vitest-Szenarien: 51 Provider-/Storage-Fortschrittsläufe,
  Erhalt früherer Fehler, echter Fehler nach Fortschritt, abgelaufene Lease,
  404-only-Provider-Seite sowie separater Storage-Fortschritt im Erasure-Integrationstest.
  Diese Szenarien wurden hier nicht ausgeführt.
- TypeScript-Syntaxprüfung ersetzt keinen Typecheck.
- Keine neue Abhängigkeit, Lockfile-Änderung, PR, Main-Push, Release-Tag oder
  Workflow-Dispatch durch diese Korrektur.

Die Objektzahl ist begrenzt, nicht die Gesamtdauer der Storage-SDK-Netzwerkaufrufe.
SDK-Retry-/Timeout-Konfiguration und tatsächliche Latenzen müssen in Staging geprüft
werden. Ein laufender externer Request wird durch Lease-Ablauf nicht abgebrochen.
Provider-Konvergenz und Verhalten bei wiederholt bestätigten, aber weiterhin
gelisteten Löschungen müssen ebenfalls in Staging nachgewiesen werden.

## Freigabe- und Betriebsaufgaben

1. Gepinnte Node-22.23.3-/Bun-Umgebung: vollständige Enterprise-Gates, Typechecks,
   Functions-/App-Builds sowie Emulator-, Produktions-Smoke- und Browsertests auf
   exakt dem Freigabe-Commit ausführen.
2. Große synthetische Konten und partielle Provider-/Storage-Ausfälle prüfen;
   Abschlussbeleg darf erst nach vollständigem Kontrolllauf entstehen.
3. Storage-Versionierung, Soft Delete, Retention Policies und Holds in der
   autorisierten Zielumgebung inventarisieren. Der Kandidat bestätigt die Abwesenheit
   aktuell gelisteter Objekte; keine nachgewiesene physische Löschung aller historischen
   oder soft-gelöschten Versionen. Keine Retention-/Hold-Policy zur Kostenersparnis lockern.
4. DB-01-Altauftragsinventur und kompatiblen Worker-Rollout durchführen.
5. Unabhängige Produktionsfreigaben und Betriebsnachweise bleiben erforderlich.

TCO: zusätzliche Listen-/Metadatenabfragen und Bestätigungsläufe, dafür begrenzte
Arbeitspakete und kein Fehlerbudgetverbrauch allein wegen großer Datenmengen.
Die Nettokosten sind nicht gemessen; keine prozentuale Einsparung wird behauptet.

API-Abgleich (10.10.2026):
- https://docs.cloud.google.com/storage/docs/samples/storage-list-files-paginated
- https://googleapis.dev/nodejs/storage/latest/Bucket.html
- https://github.com/googleapis/nodejs-storage/blob/main/src/file.ts

Diese Quellen erklären Paginierung und SDK-Schnittstellen; sie sind kein
Validierungsnachweis für die Anwendung.

