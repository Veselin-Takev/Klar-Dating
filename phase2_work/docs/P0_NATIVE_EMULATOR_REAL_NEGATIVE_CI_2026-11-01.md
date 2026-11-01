# P0 #202/#254 — Tatsächliche CI-Negativausführung bei fehlenden Firebase-Emulatoren

**Datum:** 2026-11-01 · **Status:** isolierter gestapelter DRAFT / Release BLOCKED-NO-GO  
**Parent:** [Draft #289](https://github.com/Veselin-Takev/Klar-Dating/pull/289) SHA `fd62b44c0c763ca58ae358fd10c92138b1aff3b3` – **PASS** auf [CI #41347553626](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41347553626), 4 Storage + 6 Tenant Firestore + 6 Retention Firestore, alle 1.472 Vitest-Tests und 26 Browser-Tests.

## Eigenständiges Sicherheitsproblem

Draft #289 hat den in GitHub Actions verbotenen Silent-Skip quellseitig verriegelt und die drei nativen Testgruppen auf einem korrekt gestarteten `demo-klar`-Emulator erfolgreich ausgeführt. Die **Fehlkonfiguration selbst** – CI ohne Emulator – wurde bisher jedoch nur anhand von Source-/Mutationstests geprüft. Diese Änderung macht daraus einen echten gezielten Negativ-Testlauf.

## Implementierung

Ein neuer, ausschließlich synthetischer Node-Regressionstest `scripts/check-p0-native-emulator-runtime.test.mjs` startet in einem **separaten Child-Prozess** das tatsächlich installierte `vitest` und selektiert exakt drei native Sicherheits-Testdateien:

- `tests/tenantStorageBoundary.emulator.spec.ts`
- `tests/tenantRulesBoundary.emulator.spec.ts`
- `tests/verificationPurgeWorkFirestore.emulator.spec.ts`

Der Kindprozess erhält explizit `CI=true`, `GITHUB_ACTIONS=true`, `GCLOUD_PROJECT=demo-klar`, `GOOGLE_CLOUD_PROJECT=demo-klar`; alle Firebase-Emulator-Host-Variablen und der Google-Credentials-Pfad sind leer. **Es wird keine Verbindung zu GCS oder Kunden-Firestore hergestellt**; die im Parent #289 eingeführten `beforeAll`-Checks müssen vor jedem SDK-Zugriff scheitern. Das Testharness akzeptiert ausschließlich `exit=1`, drei spezifische Loopback-Sperrdiagnosen, alle drei tatsächlichen Suite-Dateien im Runner-Output und **3 failed** anstatt eines erfolgreichen oder übersprungenen Tests. Fehler, Timeout, ein fehlendes Testfile, unerwarteter Exitstatus oder ein anderer Fehlschlag führen zum **fehlerhaften Enterprise-Gate**.

Der Kindprozess ist auf 90 Sekunden und 8 MiB Output limitiert; keine Hintergrundprozesse, kein produktives Cloud-Projekt, keine Firebase-/IAM-/Rules-/Backend-/Scheduler-/GCS-Datenmutation. `check:p0-native-emulator-ci` enthält nun sowohl den Source-/Mutationstest **als auch** diesen realen Negativlauf. Eine neue Source-Mutation stellt sicher, dass die Regression nicht unbemerkt aus dem Pflicht-Gate entfernt werden kann.

## Abnahme und Grenzen

- [ ] Neuer gestapelter PR-HEAD muss den **vollständigen exact-SHA GitHub-CI**-Lauf mit statischer Prüfung, Typcheck, Functions Build, realen Emulator-Tests, Build, Smoke und Browser bestehen. Vor dem Abschluss **kein PASS behaupten**.
- [ ] Im CI-Log muss die absichtliche Fehlkonfiguration mit allen drei konkreten `loopback_required`-Fehlern scheitern, **während der übergeordnete Negativtest gerade deshalb PASS** meldet; danach müssen die echten korrekt konfigurierten 4+6+6 Emulator-Tests PASS ausführen.
- [ ] Parent #289 nicht blind mergen; keine vorherigen grünen Commits auf neue SHAs übertragen.
- [ ] Unabhängige fachliche Product/DPO/Legal-Profile-Media-Sichtbarkeitsentscheidung, Firestore-/Storage-/Admin-SDK-BOLA-Negativtests, deployed Rules-/IAM-/Art.-17-Migrationsnachweise sowie P0 #202 GCS-Generation/404/412/Legal-Hold-Receipts und >300-Löschqueue fehlen weiter.

**`productionApproved=false`; P0 #202/#254 bleiben OPEN; Production BLOCKED/NO-GO.** Keine direkte Änderung an `main`, kein Release, keine produktive Datenmutation.
