# P0 #202 – Zusammenführung des stillgelegten Legacy-Verifizierungs-Handlers in die Purge-Stack-Basis

**Datum:** 31.10.2026 · **Status:** DRAFT / BLOCKED / NO-GO. **Parent:** PR #250, Commit `6656e71f36e17457c98f4d5fdb0c4b6595bba3e5`; **Quelle:** PR #235 (`03180776003eac4ef2d3268cfd217228eccf508e`) und PR #236 (`9ae55a7536230a76c54b81b860a04c6d4c98b45e`).

## Quell- und Historienbefund

Der durch CI bestätigte Retention-Head von [PR #250](https://github.com/Veselin-Takev/Klar-Dating/pull/250) enthielt **nicht die Commit-Historie** von PR #235/#236. Der tatsächlich gelesene `phase2_work/src/server/klarCore.ts`-Blob auf #250 ist `6b7a80f4ea30cae855684e812d8042b8e6e396d4` und identisch mit `main`. Er enthielt noch die als Exports erreichbaren manuellen Handler für Challenge, Bild-Upload und Moderationsentscheidung. Obwohl die aktuellen Express-Routen bereits HTTP 410 liefern und Client-Storage-Zugriff auf `verification/{uid}` untersagt ist, darf ein ungenutzter/exportierter Handler bei versehentlichem Remount nicht mutieren.

## Isolierte Integrations-Teiländerung

- Übernahme von `src/server/klarCore.ts` **als exakter unveränderter Git-Blob** `60d1bdfba05ba791008e8c7d3ebb8b047a5b66d2` aus PR #236: Status/Challenge/Submit/Decide antworten nur mit statischem HTTP 410; keine GCS-/Firestore-/Identitätsveränderung. Der übrige Quellcode blieb in dieser Übernahme unberührt.
- Übernahme der bereits in PR #236 vorliegenden `tests/legacyCoreRetired.spec.ts` (`c8128cd340ac73ca34bfb457dee8592c506978b8`) mit direkten Negativtests sämtlicher vier Exporte.
- Übernahme der Quellprüfung `scripts/check-legacy-verification-writer-fence.mjs` und ihrer zwölf Mutationstests aus PR #236. Diese kontrollieren die tatsächlichen Router-, Core- und `storage.rules`-Schranken.
- Übernahme von `tests/legacyVerificationRetiredHttp.spec.ts` aus PR #235 (25 methodenübergreifende Express-410-Regressionen).
- Die bestehende Pflichtprüfung `check:compliance-storage-purge` führt künftig Quell- und Mutationstests **explizit** aus. Die Express/Vitest-Tests laufen zusätzlich im regulären Testsuite-Gate.
- Kein Update an `storage.rules`, Firestore-Regeln, IAM, KYC-Didit-Webhooks, produktiven Daten oder Release-Systemen.

## Kritische Integrationsgrenzen

Die Übernahme löst nur die **Legacy-Handler- und Client-Boundary-Lücke** im betrachteten #250-Branch. Die Commit-Historie von #231 und #233 bleibt zu prüfen; abweichende Branches und überlappende Sicherheitspatches sind vor einem späteren Merge inhaltlich zu diffen und gegen den dann aktuellen `main` erneut zu validieren. Die ursprünglichen Drafts #235/#236 bleiben als Quellreferenz **unverändert und ungemergt**; über ihre spätere Schließung/Integration entscheidet ein unabhängiger Reviewer nach Patch-Äquivalenzprüfung.

Der neue Head braucht **eigene vollständige exact-SHA-CI**, Security-/DPO-/SRE-Review und eine unabhängige Integrationsevaluierung. Live-Cloud-Functions/IAM-/Scheduler-/All-Writer-Inventur, vertrauenswürdige Uploadgeneration und Art.-17-/Legacy-Altbestandsbereinigung bleiben unerledigt. **Keine Main-Änderung, kein Merge, kein Deployment. Production NO-GO.**
