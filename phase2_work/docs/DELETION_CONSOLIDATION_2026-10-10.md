# DB-01: Konsolidierung des Löschworkflows – 10.10.2026

## Stand und Herkunft

Korrekturbranch: `fix/audit-runtime-policy-2026-10-10`.
Integrationsbasis: `e9180852f67b9e98a7084d238542020480d9b3c1`.
Die Löschkorrekturen wurden selektiv aus `fix/deletion-cumulative-accounting`,
Commit `31363ebeb4251d788f877c008c12c5f7d7583e83`, übernommen.
Der Vergleich mit dem gemeinsamen Vorfahren bestätigt: Die übernommenen
Implementierungsdateien überschreiben keine Änderungen der aktuellen INF-01-,
SEC-01- oder BE-01-Korrekturen. Historische Status- und CI-Budgetdateien wurden
nicht übernommen. Vitest-Umgebungsdirektiven stehen vor den Imports.

**DB-01: Kandidat implementiert; integrierte Emulatorvalidierung und Betriebsabnahme offen.
Produktion: NO-GO / NOT CONFIRMED.**

## Implementiertes Verhalten

- Neue Löschaufträge initialisieren sieben kumulative Zähler mit `accountingVersion: 2`.
- Gezählt gelöschte beziehungsweise pseudonymisierte Datensätze und ihre Zähler werden
  in derselben Firestore-Transaktion geschrieben. Wiederholungen lesen die verbliebenen
  Daten; die Zähler gehen bei Seitenwechseln und Teilabbrüchen nicht verloren.
- Gezählt werden Chats, Nachrichten inklusive Archiv, Gate-Antworten, Verbindungen,
  Kontakte, eigene Meldungen und pseudonymisierte Meldungen. Dies ist kein Gesamtzähler
  sämtlicher Dokumente, Storage-Objekte oder Provider-Datensätze.
- Bestätigter Fortschritt innerhalb eines Zeitabschnitts verbraucht kein Fehlerbudget.
  Ein Zeitablauf ohne bestätigte Mutation bleibt ein echter Fehler.
- Der Purge erzeugt keinen Abschlussbeleg. Erst der erfolgreiche Kontrolllauf
  (`final_sweep`) erzeugt Beleg und abgeschlossenen Job atomar.
- Unbekannte oder ungültige Altzähler führen vor weiteren Löschaktionen zu
  `manual_review / accounting_migration_required`. Es werden keine historischen
  Zählwerte erfunden. Die Löschverpflichtung bleibt offen.

## Nachweise auf diesem konsolidierten Stand

| Prüfung | Ergebnis | Aussagegrenze |
| --- | --- | --- |
| `node scripts/check-art17-deletion-audit.mjs` | PASS | Statische Strukturprüfung |
| Vier vorhandene Node-Regressionsskripte für Auth, Runtime, Release und CI-Scope | 42/42 PASS | Node 24.19.0; keine App-/Emulatorprüfung |
| Direkte Ausführung des tatsächlichen `deletionProgress.ts` nach TypeScript-Transformation | 4/4 PASS | Zeitablauf ohne/mit Fortschritt, Weitergabe von DB-Fehlern, Isolation paralleler Aufträge; kein Vitest-Lauf |
| Transformation der acht übernommenen TypeScript-Dateien | PASS | Syntax; kein Typecheck |
| Firestore-/Auth-/Storage-Emulator, vollständige Suite, Build, Browser und Container | NICHT AUSGEFÜHRT | Freigegebene Node-22.23.3-/Bun-/Emulatorumgebung hier nicht verfügbar |

Die vier vorhandenen Skripte sind `auth-boundary-check.mjs`,
`runtime-node-alignment-check.mjs`, `release-ci-check.mjs` und `ci-scope-check.mjs`.
Historische Emulatorresultate in den beiden Dokumenten vom 09.10.2026 gelten
ausschließlich für deren Quellstand. Sie ersetzen keinen Lauf des kombinierten Standes.

## Betriebs-Runbook vor Freigabe

1. In der freigegebenen Umgebung Node 22.23.3 und die gepinnte Bun-Version verwenden;
   Abhängigkeiten ohne Lockfile-Änderung installieren. Enterprise-Gates, Typechecks,
   vollständige Tests und Builds auf exakt dem Freigabekandidaten ausführen.
2. Insbesondere `deletionAccounting.spec.ts`, `deletionLifecycle.spec.ts`,
   `deletionTimeSlice.spec.ts` und `accountErasure.spec.ts` gegen die vorgesehenen
   Emulatoren prüfen. Verlorene Commit-Bestätigung, Parallelität, abgelaufene Lease,
   51-Chat-Paginierung und atomaren Abschlussbeleg nachweisen.
3. Pending-/Manual-Review-Aufträge in der autorisierten Zielumgebung inventarisieren.
   Schema, Zustand und zuständige Person dokumentieren. Die tatsächliche Verteilung
   der Altaufträge ist unbekannt; keine Produktionsinventur wurde durchgeführt.
4. Altaufträge nur anhand belastbarer Nachweise migrieren. Sind historische Zähler
   nicht rekonstruierbar, einen ausdrücklich freigegebenen Altfallprozess mit
   dokumentierter Zählungslücke verwenden. Keinen Nullstand als vollständige Historie ausgeben.
5. Alte Worker beim kontrollierten Rollout beenden; keine parallelen alten/neuen
   Worker und kein ungeprüftes Rollback auf Worker ohne Version-2-Zähler.
   Offene Jobs und Zähler erhalten. Wiederanlauf und Kontrolllauf in Staging nachweisen.
6. TTL-Ausführung, Provider-/Storage-Löschung, Wiederherstellungsnachweise und unabhängige
   fachliche/technische Freigaben bleiben separate Gates.

## Kosten und nächste Schritte

Pro gezählter Seite entstehen zusätzliche transaktionale Job-Lese-/Schreibzugriffe;
eine Transaktion umfasst maximal 400 Datensätze plus Job-Schreibzugriff. Die Wirkung
auf Firestore-Kosten und Konfliktwiederholungen ist noch zu messen. Keine prozentuale
Einsparung wird behauptet. Die bestehende CI-Minutenfreigabe wird durch keinen neuen
PR, Main-Push, Tag oder Workflow-Dispatch genutzt.

Nächster separater Befund: DB-02, begrenzter Fortschritt bei Provider-/Storage-Löschung.
`provider_more_pages` zählt weiterhin als Fehler; dieser Kandidat behebt das nicht.
