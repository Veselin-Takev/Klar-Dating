# P0 #202/#254 — Pflicht-Emulatortests in CI: Fail-Closed statt stilles Überspringen

**Datum:** 2026-11-01 · **Änderungstyp:** isolierte CI-/Test-Härtung · **Status:** DRAFT / Production BLOCKED–NO-GO

## Ausgangsbefund

Auf der zuvor erfolgreich getesteten [Integrationskette #288](https://github.com/Veselin-Takev/Klar-Dating/pull/288) SHA `c358d4360e36ef7a68555c2471f17648358557f7` verwendeten drei native Firebase-Sicherheits-Emulator-Tests `describe.skipIf(!emulatorOnly)`. Wenn der Emulator im verpflichtenden CI-Lauf versehentlich nicht bereitstand oder eine nicht zugelassene Projektkennung gesetzt wurde, konnte die betroffene Suite als **skipped** statt FAILED erscheinen. Source-Gates prüften lediglich den Test- und Emulator-Aufruftext; die bereits erfolgte tatsächliche Ausführung wurde bei #288 separat im CI-Log bestätigt. Dieser neue Befund betrifft einen **zukünftigen CI-Regression-Pfad**, nicht eine in #288 beobachtete Testlücke oder einen Produktionsangriff.

## Exakter atomarer Fix

Die drei Dateien `tests/tenantStorageBoundary.emulator.spec.ts`, `tests/tenantRulesBoundary.emulator.spec.ts`, `tests/verificationPurgeWorkFirestore.emulator.spec.ts` behandeln `CI=true` **oder** `GITHUB_ACTIONS=true` als verbindliche Emulatortestpflicht. Der Suite-Skip ist nur noch bei fehlendem Emulator **außerhalb** der CI zulässig. In der CI schlägt `beforeAll` ohne erfolgreich geprüften Loopback/`demo-klar`-Emulator vor jedem SDK-/Firestore-Zugriff fehl. Die Tests bleiben nur synthetisch; die bestehenden positiven und negativen Tenant-, Legacy-UID-, Storage- und Retention-Aussagen ändern sich nicht. Es werden **keine produktiven Security Rules, IAM, GCS-/Löschfunktionen oder API-Routen** verändert.

Das neue read-only Gate `scripts/check-p0-native-emulator-ci.mjs` mit Negativtests `scripts/check-p0-native-emulator-ci.test.mjs` prüft jede der drei Suiten auf CI-erzwungene Ausführung, explizite Preflight-Verweigerung und `demo-klar`-Projekt, verhindert die stille Aufnahme in eine Vitest-Exclude-Liste, verlangt die drei Emulatoren in `test:ci` und die exakte Einbindung des neuen Gates in `check:enterprise`. Die vorhandenen `check:tenant-native-rules`, `check:tenant-native-storage` und `check:dual-p0-integration` sind auf die neue Form angepasst, einschließlich Pflicht-Gate-Mutationsprüfungen.

**Regressionsversuche:** Stilles Skip wiederhergestellt, `CI`-Kennung deaktiviert, Preflight entfernt, jeweilige Tests ausgeschlossen, Emulatorliste/Demo-Projekt verändert, Negativtest-/Pflichtschritt entfernt. Diese Fälle müssen alle fail-closed zurückgewiesen werden.

## Abnahme und Nachweisgrenzen

Vor einem technischen PASS ist ein GitHub Actions **exakt auf dem finalen Feature-Commit** vollständig abgeschlossener `validate`-Job nötig: Static Gates, Typecheck, Functions Build, Tests, Build, Smoke, Browser. Im Joblog müssen **vier native Storage**, **sechs native Tenant Firestore** und **sechs native Retention Firestore** Tests als wirklich ausgeführt **PASS**, nicht nur als im Quelltext vorhanden oder skipped, nachgewiesen werden. Der Test ohne konfigurierte Emulatoren darf in der CI nicht still grün werden. Der unveränderte erfolgreiche Vorgänger [#288 CI 41345204334](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41345204334) belegt nur dessen eigenen SHA. **Für diesen neuen Fix wird kein vorgezogener CI-PASS behauptet.**

### Offene Produktionsblocker (unabhängig vom Test-Hardening)

- **P0 #254:** signierte DPO/Product/Legal-Entscheidung zur tenantübergreifenden Medien-Sichtbarkeit, reale deployte Firestore/Storage Rules, serverseitiger Admin-SDK-BOLA-Schutz, vollständige JWT-/Membership-Isolation, Tenant-Mapping, Art.-17-Migration und Rollback.
- **P0 #202:** rechtmäßig freigegebener, dauerhafter GCS-Foto-Löschprozess einschließlich Generation-Fencing, 404/412- und Absturz-Reconciliation, Legal Holds, KYC-Entscheidungsbindung und >300-fälliger-Einträge-Skalierung.
- **Release #8:** sämtliche endgültigen CI-, SBOM-, Staging-/IAM-/Scheduler-, Security-, Datenschutz-/Legal-, SRE- und Release-Owner-Nachweise und schriftlichen Freigaben.

**Stop:** Kein PR-Merge, kein direkter `main`-Commit, keine Cloud-/Produktionsdatenmutation. `RELEASE_MANIFEST.json` bleibt `productionApproved=false`, **Production NO-GO**.
