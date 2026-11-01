# Klar — Integration P0-Release-Gates mit Didit-Profilstatus-Fix (P1 #237)

**Datum:** 2026-11-01 · **Status:** isolierter Draft / **Production BLOCKED–NO-GO**  
**Unveränderter Ausgangscommit:** `85c092b708497b5954aaf5cbfe8a901a401e3549` von [Draft #294](https://github.com/Veselin-Takev/Klar-Dating/pull/294). **Unabhängige Fix-Quelle:** `57cc4519e46f3287905a5b0d90463a7194ce6e53` von [Draft #295](https://github.com/Veselin-Takev/Klar-Dating/pull/295).

## Technische Provenienz und Konfliktprüfung

- [CI #41354106319](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41354106319) zum P0-Ausgangscommit #294 vollständig **SUCCESS**, einschließlich 5 native Storage-, 6 Tenant-Firestore-, 6 Retention-Firestore-, 1.473 Vitest-, 26 Browser-Tests und 24 P0-Freigabe-Negativtests.
- [CI #41355375724](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41355375724) zum unabhängigen Didit-Quellcommit #295 **SUCCESS**, einschließlich 18 neue `kycStatusRefresh.spec.tsx`-Tests, insgesamt 1.390 Vitest-Tests, Production Smoke und 26 Browser-Tests.
- Der aktive `BiometricsVerificationModal.tsx` war auf #294 **bytegleich zu `main`**. Vier KYC-Test-/Status-/Dokumentations-Dateien existierten dort nicht. Diese fünf Dateien wurden als identische Inhalte von #295 in einen neuen, von #294 abgezweigten Branch übernommen; keine andere vorhandene Anwendungsfunktion ersetzt.
- `package.json` auf #294 enthielt zusätzliche, bereits bestandene P0-Enterprise-Gates. Daher wurde **nicht** die ältere `package.json` aus #295 überschrieben. Stattdessen wurde genau das neue Script `check:kyc-status-refresh` hinzugefügt und einmal unmittelbar nach `check:didit-kyc-integrity` in `check:enterprise` eingefügt. Die vorhandenen P0-Tests und `check:release-go-evidence` wurden erhalten. Die Herkunft wurde anhand der exakten beiden Quell-SHAs vor dem Schreiben überprüft.

## Pflichttests auf dem neuen kombinierten SHA

- [ ] `check:enterprise` einschließlich aller bestehenden Tenant-/Retention-/ReleaseOwner-/P0-Proof-Gates und neuer `check:kyc-status-refresh`.
- [ ] Didit-Refresh-Komponente: 18 Tests für den aktuellen authentifizierten `GET /api/kyc/status` und ausschließlich positives `approved`; Fail-Closed für `pending`, `review`, `not_started`, `unavailable`, unbekannte/alte Payloads, 401/410/429/503, Netzwerk- und JSON-Fehler.
- [ ] Nativer `demo-klar` Emulator: **5 Storage, 6 Tenant Firestore, 6 Retention Firestore** Fälle tatsächlich ausgeführt; echter fehlender-Emulator-Negativfall darf nicht zum stillen Skip führen.
- [ ] Vollständige Typecheck-, Functions-/Frontend-Build-, Vitest-, Production-Smoke- und Browser-Acceptance-Gates. Alle müssen den **neuen Integrations-HEAD** prüfen, nicht die grünen Eltern-Commits.

## Offene Produktivrisiken (kein Scope dieser Integration)

**P0 #202:** echte rechtlich freigegebene biometrische GCS-Löschkette mit Entscheidung/Legal Hold, Generation-Fencing, 404/412-/Crash-Quittungen, >300 durable Queue und Scheduler/IAM.

**P0 #254:** produktiv belegte Tenant-/UID-/Admin-SDK-BOLA-Isolation, Firebase Rules/IAM, Legacy→Tenant-Art.-17-Migration sowie durch Product/DPO/Legal unterschriebene Medien-Sichtbarkeitsentscheidung.

**Release-Governance:** sechsfache P0-Proof-Records sind strukturelle Pflicht, aber echte Cloud-Belege und unabhängige Security/DPO/Legal/SRE/ReleaseOwner-Signaturen fehlen. Keine tatsächlichen Produktivdaten verarbeitet. `main` nicht geändert, keine Merges, kein Deployment. **`productionApproved=false`; Production BLOCKED/NO-GO.**
