# P0 #48 – Tatsächlicher Node.js-Worker-Abbruch nach bestätigtem Firestore-Batch

**30.10.2026 | Isolierter Draft-Kandidat | Eigene CI noch nicht verifiziert | PRODUCTION BLOCKED / NO-GO**

## Bestätigte Grundlage
[Draft #227](https://github.com/Veselin-Takev/Klar-Dating/pull/227), exakter SHA `a771e6082ec41254d98f40a219d45660d1fccf94`, hat [Enterprise-CI #41135818356](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41135818356) bestanden. Original-Log: `hands off a real registry deletion after a completed slice to a new worker lease` **ausgeführt und bestanden**; 7 Kontolöschungstests, **1.483/1.483** Einzeltests und **203/203** Testdateien. Diese Prüfung beendet nur eine künstlich verkürzte Zeitscheibe, **keinen echten Prozess**.

## Neuer Prozessabbruch-Test
Die neue Testdatei `tests/helpers/accountDeletionCrashChild.ts` ist ein ausschließlich lokaler, durch Laufzeit-Guards geschützter Node.js-Worker. Sie akzeptiert nur synthetische UID und UUID und läuft nur unter Linux, nichtproduktiver Umgebung sowie bei Firestore/Storage-Emulator mit Projekt `demo-klar`. Vor Prüfung dieser Bedingungen darf sie weder Firebase/DB-Module dynamisch importieren noch Nutzerdaten abfragen. Sie startet den realen `runAccountDeletion`-Worker mit echten Firestore-Lease-Transaktionen und der realen `purgeAccountData`-Kaskade, aber nur synthetischen Stub-Aktionen für Auth, Didit und Stripe.

Im Test `recovers registry deletion after an actual SIGKILL of the leased child worker` wird der Child-Prozess über `node --import=tsx` separat gestartet. Er wird **mit OS-Signal SIGKILL selbst beendet**, unmittelbar nachdem `recordDeletionProgress()` den erfolgreichen Commit des ersten **400-Dokumente-Löschbatches** bestätigt. Anders als bei einem geworfenen Testfehler läuft im Child danach keine reguläre Catch-/Finally-Behandlung oder Lease-Freigabe.

Der unverändert laufende Elternprozess muss nachweislich feststellen, dass:
- der Child tatsächlich mit `signal:SIGKILL` und `code:null` beendet wurde;
- genau **1 von 401** eigenen Registry-Dokumenten verblieben ist, der fremde Datensatz erhalten blieb und das User-Profil weiterhin besteht;
- der in Firestore gespeicherte Löschauftrag auf `status:pending`, `phase:purge`, `attempts:1` und mit noch aktiver originaler Lease steht, **ohne** einen fertigen Löschbeleg;
- ein verfrühter Wiederanlauf keine neue Lease erhält und keine Auth-Löschung auslöst;
- nach Ablauf der gespeicherten Lease ein **neuer Worker** mit anderer Lease und gleicher `requestId` das verbliebene Dokument und Profil löscht, während die fremde Reservierung bestehen bleibt;
- der Job zunächst nur in `final_sweep` übergeht und erst nach dem 61-Minuten-Token-Grace einen transaktionalen Abschlussbeleg erzeugt; weitere Wiederholungen keine Löschung erneut starten.

Der Parent übergibt dem Child ausschließlich Emulator-Adressen, Projektkennung und eine minimale Laufzeitumgebung – **keine CI-Secrets, Cloud-Zugangsschlüssel, Tokens oder Provider-Credentials**. Der Test verfügt über einen 30-Sekunden-Child-Watchdog, festen 120-Sekunden-Test-Timeout und ein `finally`, das alle synthetischen Firestore-Fixtures entfernt. Auth- und externe Provider-Aktionen bleiben bewusst stubbed; der Absturz betrifft nur die isolierte Node-Testprozessinstanz.

## Ausdrückliche Grenzen
Der Test simuliert **keinen** echten Ausfall eines produktiven Cloud-Run-Containers, Scheduler-Trigger, Firestore-Region-Failover, reale Token-Rotation oder Live-Daten-Löschung. Er prüft jedoch einen tatsächlichen Betriebssystem-Prozessabbruch während einer echten lokalen Firestore-Lease, statt lediglich einen `DeletionTimeSliceComplete`-Fehler zu werfen.

Für eine Freigabe muss die **eigene** Enterprise-CI des unveränderlichen HEADs erfolgreich sein und der Original-Log den neuen Test ausdrücklich als **ausgeführt und PASS (nicht skipped)** ausweisen. Erwartet: `accountErasure.spec.ts (8 tests)`, **203 Testdateien** plus ein Test zur vorherigen Basis. Typecheck, Enterprise Static Security, Rules, emulatorbasierte Suite, Build, Smoke und Browser-Abnahme müssen ebenfalls durchlaufen.

Die Referral-Registry ist weiter nicht an die produktiven Ausgabe-/Claim-Routen angebunden. Vollständige freigegebene Altbestandsinventur, atomare Backfill-Migration, Didit-/Auth-/Consent-/Age-Berechtigungen, echte Art.-17-Vendor-Nachweise, produktive TTL/Foto-Retention und unabhängige Security-, DPO/Legal-, SRE-, Product- und Release-Owner-Freigaben fehlen.

**Keine Änderung an main, PR #119, RC R2 oder Produktion; keine Merges, Deployments oder manuellen GitHub-Actions-Neustarts. PRODUCTION BLOCKED / NO-GO.**

## CI-Abweichung und gezielte Korrektur — 30.10.2026
- Erster Quellstand `f168c3c25840c003398dc92ea0f7cae6dcdd7a36`, [Enterprise-CI #41137585203](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41137585203): **completed / failure** im **Typecheck** (Job `124343736557`), bevor die Testphase beginnen konnte. Originalfehlermeldung: `tests/helpers/accountDeletionCrashChild.ts(38,75): error TS2345: Argument of type '{ onProgress: () => void; }' is not assignable to parameter of type '{ now: () => number; onProgress?: (() => void) | undefined; }'.`
- Minimaler Quell-Fix `0d3531655771657ccd8d8b9a002df562360cc8e6`: setzt beim nur emulatorbasierten Child-Prozess `now: Date.now` zusätzlich zum synthetischen `onProgress`-Callback. Keine Änderungen an Produktiv-API, Löschtransaktionen, Firestore-Queries oder Berechtigungen.
- Korrigierter automatischer [CI-Lauf #41137823217](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41137823217): **zum Dokumentationszeitpunkt noch nicht abgeschlossen**. Nur ein eigener erfolgreich beendeter CI-Lauf und die ausdrücklich **ausgeführte** `SIGKILL`-Testzeile erlauben die Kennzeichnung „PASS“. Der erste fehlgeschlagene Lauf bleibt als Audit-Historie erhalten.
- **Keine Produktivmigration, Live-Daten, Merges oder Deployments. PRODUCTION BLOCKED / NO-GO.**
