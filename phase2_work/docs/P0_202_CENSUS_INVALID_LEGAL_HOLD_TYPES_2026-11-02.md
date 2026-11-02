# P0 #202 — Ungültige Legal-Hold-Feldtypen in der lesenden Retention-Inventur

**Stand:** 2026-11-02 · **Branch:** `security/p0-202-retention-census-hold-type-anomalies-20261102` · **Status:** DRAFT, NO-GO.

## Nachgewiesener Befund

Die **rein lesende** Funktion `src/server/platform/verificationBacklogCensus.ts` zählt `knownLegalHolds` bisher nur bei explizit booleschem `true`. Das ist korrekt als Zähler **bekannter Holds**, blendet aber vorhandene, nicht boolesche Flags wie `legalHold: "false"`, `retentionHold: "true"`, `hold: null` oder `hold: 1` aus. Ein Bericht mit `knownLegalHolds=0` kann daher mit fehlerhaften und ungeklärten Hold-Metadaten koexistieren. Diese Ambiguität ist ein **Source-Befund im Inventurbericht**, kein Nachweis, dass eine aktive GCS-Löschung die Flags bereits falsch auswertet oder dass Produktionsdatensätze solche Werte besitzen.

## Atomare read-only-Korrektur

- Ein zusätzlicher aggregierter Zähler `invalidHoldIndicators` zählt Datensätze mit mindestens einem **vorhandenen, nicht booleschen** Hold-Indikator aus `legalHold`, `retentionHold`, `hold`. Die etablierten Zähler `knownLegalHolds`, `dueByMarker`, `pendingOrUnknownDecision` und Eigentümer-/Pfad-Anomalien behalten ihre bisherige Bedeutung.
- Strikt boolesches `true` zählt als bestätigter Hold, `false` als explizit falsches Feld. Ein fehlendes Feld wird **nicht** als ungültiger Typ gezählt, ist aber ausdrücklich **kein Nachweis**, dass ein rechtlicher Hold ausgeschlossen ist. Der neue Zähler ist kein Entscheidungsgate für einen aktiven Löschworker.
- Die reine Vitest-Suite injiziert fünf Datensätze mit ungültigen Flagtypen; ein Datensatz kann gleichzeitig einen bestätigten Hold und eine zusätzliche ungültige Hold-Angabe besitzen (getrennte, nicht exklusive Anomalien).
- Der verpflichtende native Firestore-Emulator-Test mit **350 synthetischen Zeilen** injiziert vier weitere ungültige Holdtypen (String, Zahl, NULL, Map) und verlangt `knownLegalHolds=10`, `invalidHoldIndicators=4`, weiterhin 310 fällige / 40 ausstehende / vier fehlerhafte Owner-Pfade / ein duplizierter Objektpfad. Alle 350 Daten müssen nach der Inventur noch existieren.
- Der existierende zwingende `check:p0-native-emulator-ci`-Quell-Guard verlangt den neuen nativen Zähler; ein negativer Mutationstest prüft das Entfernen. Keine Test-Suite oder bestehendes Gate wird abgeschaltet.

## Freigabeabgrenzung

Ein **vollständiger neuer exakter HEAD-CI-PASS** ist nötig (Typecheck, P0 Source-/Mutation-Gates, 5 native Storage, 6 Tenant-Firestore, 17 Retention-Firestore einschließlich 350-Zeilen-Inventur, no-Emulator-Negativtest, gesamte Vitest, Builds, Smoke, 26 Browser, ReleaseOwner/P0-Evidenzschema). Ein grüner Eltern-Commit wird ausdrücklich nicht übernommen.

Die Implementierung klassifiziert ausschließlich die **lesende** Inventur. Sie legt **nicht** fest, ob ein Datensatz gelöscht werden darf, ändert keine Cloud-/Firebase-/GCS-Berechtigungen und benutzt keine Kunden- oder Produktivdaten. Vor einer echten Löschung müssen fachlich freigegebene Authoritätsquellen und Legal-Hold-Prüfungen **fail-closed** unmittelbar am Löschzeitpunkt verifiziert werden. Fehlende Hold-Flags und widersprüchliche Daten benötigen eine eigene rechtsverbindliche Entscheidung durch DPO/Legal/Security.

**Offene P0-Sperren:** #202 real genehmigtes GCS-Decision-/Hold-/Generation-Fencing mit 404/412-/Timeout-/Crash-Quittungen, dauerhaft >300 Löschaufträge, Scheduler/IAM; #254 tatsächliche Tenant-/Art.-17-/Admin-SDK-/Rules-Isolation sowie signierte Gast-/Alter-/Medien-Policy. Echte unabhängige Security/DPO/Legal/SRE/ReleaseOwner-Signaturen fehlen.

`productionApproved=false`. **Production BLOCKED / NO-GO**. Keine direkten `main`-Commits, Merges, Deployments, produktiven GCS-/Cloud- oder Kundendatenoperationen.
