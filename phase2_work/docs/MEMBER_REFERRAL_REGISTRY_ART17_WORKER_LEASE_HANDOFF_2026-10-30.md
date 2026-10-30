# P0 #48 — Art. 17 Worker-Lease-Übergabe mit echter Referral-Registry-Löschung

**2026-10-30 | Isolierter Draft-Kandidat | PRODUCTION BLOCKED / NO-GO**

## Verifizierter Ausgangspunkt
[Draft-PR #226](https://github.com/Veselin-Takev/Klar-Dating/pull/226), exakter Quell-Commit `b480fdc855d263dd59a6f9da412568be352b5846`, hat [Enterprise-CI #41134045700](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41134045700) **completed/success** durchlaufen. Originalprotokoll: `resumes after 400 acknowledged registry deletions and an expired deletion time slice` tatsächlich ausgeführt und bestanden; `accountErasure.spec.ts (6 tests)`; 1482/1482 Einzeltests und 203/203 Testdateien bestanden.

Dieser Nachweis ruft die Löschkaskade direkt auf, verwendet aber nicht den echten transaktionalen Worker-Lease-Wechsel durch `runAccountDeletion`.

## Neuer synthetischer Integrationstest
`tests/accountErasure.spec.ts`: `hands off a real registry deletion after a completed slice to a new worker lease`.

Nur mit Firestore- und Storage-Emulator, Loopback-Firestore-Adresse, nichtproduktiver Umgebung und `demo-klar`-Projekt. 401 synthetische Reservierungen eines Test-UID, eine fremde Reservierung, ein Profil und ein vollständiger dauerhafter `account_deletions/{uid}`-Auftrag werden angelegt. Externe Dienste werden über den existierenden `DeletionDependencies`-Mechanismus isoliert; **nicht** über produktive Auth- oder Didit-/Stripe-APIs.

- Worker A erhält eine echte, transaktional gespeicherte Lease und ruft `purgeAccountData` mit dieser Lease auf. Ein echter Emulator-Batch von 400 Dokumenten wird bestätigt. Die nur für diesen Test optionale Uhr lässt danach die Zeitscheibe ablaufen; der Worker behandelt `DeletionTimeSliceComplete` und speichert `completedSlices:1`, `leaseUntil:0`, `status:pending`, `attempts:0` sowie einen Wiederanlaufzeitpunkt.
- Unmittelbarer Wiederanlauf vor `nextAttemptAt` darf keine neue Lease gewinnen. Nach Fortschreiben der injizierten Worker-Uhr um 1.001 ms gewinnt Worker B eine **andere** Lease. Derselbe `requestId` wird fortgeführt, das letzte Registry-Dokument und das Profil gelöscht. Die fremde Reservierung bleibt unverändert. Die identitätsvernichtende Provider-Aktion darf vor der zweiten vollständigen Löschung **nicht** erfolgen.
- Der Worker wechselt zunächst nur zu `final_sweep`; der Audit-Beleg darf vor Ablauf der Token-Schonfrist nicht entstehen. Erst nach Fortschreiben der Uhr um 62 Minuten erfolgt ein dritter geleaster Durchlauf, der die finale Löschquittung transaktional schreibt und den Auftrag als `completed` markiert. Ein weiterer Aufruf erzeugt keine zusätzlichen Worker-Aktionen.

**Sicherheitsabgrenzung:** Firestore und die echte Löschkaskade laufen im lokalen Emulator. Auth-Löschung, Provider-Löschung, Stripe und das Fortschreiten der Worker-Zeit werden mit synthetischen Stubs ersetzt. Es handelt sich um eine deterministische Lease-Übergabe in einer Testumgebung, **nicht** um einen physisch gestoppten Prozess, konkurrierende Container, echten Cloud-Scheduler, produktive IAM-Policies oder eine End-to-End-Didit-/Auth-Löschung.

## Verifizierungsbedingungen
Der Test ist bis zur eigenen **exakten** CI- und Logprüfung **UNVERIFIED**. Zu prüfen sind vollständiger TypeScript-/Functions-Build, Security-/Privacy-Gates, Firebase-Emulator und Firestore Rules, der explizite neue Test als **executed PASS (nicht skipped)**, die übrigen Tests sowie Browser-Abnahme und null fehlgeschlagene Schritte. Erwartet: `accountErasure.spec.ts (7 tests)` (Ausgangspunkt: 6).

Eine grüne CI belegt nur diese synthetische Leased-Worker-Wiederaufnahme. Registry-Altbestandsmigration, aktivierte Claim-/Ausgabe-Routen, Produktions- und Staging-JWT/KYC/Consent, Live-Retention/TTL, echte Prozess-/Scheduler-Failover-Tests und unabhängige Product-, DPO/Legal-, Security-, SRE- und Release-Owner-Abnahmen bleiben ausstehend.

Keine Produktivdaten gelesen oder verändert; keine direkten `main`-Commits, Merges, Deployments, manuellen GitHub-Actions-Auslösungen oder Änderungen an PR #119/RC R2. **P0 #48 OFFEN; PRODUCTION BLOCKED / NO-GO.**

## Exakter CI-Nachweis — 2026-10-30, erfolgreich

- [Draft-PR #227](https://github.com/Veselin-Takev/Klar-Dating/pull/227), unveränderlicher Quell-HEAD `a771e6082ec41254d98f40a219d45660d1fccf94`: automatischer [Enterprise-CI-Lauf #41135818356](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41135818356) **completed / success**; Validate-Job `124337869550` **completed / success**, **0 fehlgeschlagene Schritte**.
- Original-Testprotokoll zeigt ausdrücklich `tests/accountErasure.spec.ts (7 tests)` und die als **PASS ausgeführte, nicht übersprungene** Testzeile `✓ hands off a real registry deletion after a completed slice to a new worker lease` (837 ms).
- Gesamte Vitest-Suite: **`203 passed (203)` Testdateien** und **`1483 passed (1483)` Einzeltests**. Static-Gates, Typecheck, Functions-Build, Testphase, Production-Smoke und Browser-Abnahme sind im erfolgreichen Validate-Job durchlaufen.
- Dieser Nachweis deckt **nur** den getesteten synthetischen Emulator-Worker-Handoff, die Firestore-gestützten Lease-Transaktionen und den getrennten Final-Sweep ab; **keinen** physischen Worker-/Containerabsturz, realen Didit-/Auth-/Stripe-Provider, Scheduler-Failover, Staging- oder Produktionsdatenbestand.
- Der komplette Referral-Registy-Produktivpfad bleibt **nicht aktiviert**, Migration/Berechtigungsprüfungen sind offen, fachliche Freigaben fehlen: **PRODUCTION BLOCKED / NO-GO**.
