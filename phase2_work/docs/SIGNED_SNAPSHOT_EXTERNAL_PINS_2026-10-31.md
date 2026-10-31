# P0 #254 – Unabhängige Snapshot-Pins für signierten Migrations-Preflight

**Datum:** 31.10.2026 · **Status:** DRAFT / BLOCKED / NO-GO. **Parent:** [PR #258](https://github.com/Veselin-Takev/Klar-Dating/pull/258), SHA `11383c2dcf03bf69c2804d7e7eb3c3f8fb068818`. Parent-CI [#41234355771](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41234355771) `completed/success`.

## Verifiziertes Bedrohungsmodell

Der vorliegende Migrations-Preflight akzeptiert ein **vollständig gültig doppelt signiertes**, aber möglicherweise veraltetes Inventar-/Mapping-Paar, sofern beide Parteien es irgendwann korrekt signiert haben und die erforderlichen selbstdeklarativen Quellfingerprints zusammenpassen. Ed25519 schützt die exakten Dateibytes, nicht die aktuelle Firestore-Snapshot-Version, die DPO-Genehmigung oder den aktuellen produktiven Lösch-/Legal-Hold-Status. Eine Rückspielung alter gültiger Dateien wäre ohne weitere, separat verwaltete Kontrollwerte nicht von der ursprünglich freigegebenen Version zu unterscheiden.

## Isolierter Sicherheits-Fix

Für **jede** Aufrufstelle von `preflightSignedLegacyProfileMapping()` sind nun **drei zwingende, strikt validierte SHA-256-Pins** erforderlich, die aus einem **unabhängig verwalteten und geschützten Kontrollkanal** stammen müssen:

| Pin | Bindung |
|---|---|
| `inventorySha256` | SHA-256 der unveränderten Inventardatei-Bytes |
| `mappingSha256` | SHA-256 der unveränderten Zuordnungsdatei-Bytes |
| `reconciliationSha256` | SHA-256 des deterministisch aufgebauten fachlichen Abgleichs (UID/Tenant/Quellfingerprint/Evidenz), einschließlich Snapshot-ID |

Das Zod-Schema lehnt fehlende, falsch formatierte oder zusätzliche Pin-Felder ab. Der Validator verifiziert zuerst die beiden unabhängigen Ed25519-Signaturen, prüft anschließend die SHA-256-Datei-Pins mittels `timingSafeEqual`, dekodiert die strikt serialisierten JSON-Dateien und vergleicht schließlich den berechneten Reconciliation-Digest mit dem separat erwarteten Wert. Die Ausgabe bleibt ausnahmslos `BLOCKED_MANUAL_APPROVAL_REQUIRED`, selbst bei voller Übereinstimmung.

Die schreibfreie CLI `scripts/tenant-migration-preflight.ts` verlangt zusätzlich zu den bereits bestehenden Trust-Anchor-Einstellungen zwingend drei Umgebungsvariablen: `KLAR_MIGRATION_EXPECTED_INVENTORY_SHA256`, `KLAR_MIGRATION_EXPECTED_MAPPING_SHA256` und `KLAR_MIGRATION_EXPECTED_RECONCILIATION_SHA256`. Sie dürfen **nicht** aus dem zu prüfenden Manifest, seiner PR, einem untrusted CI-Artefakt oder unkontrollierten Anwender-Parametern übernommen werden.

## Testabdeckung

Die isolierten Negativtests prüfen falsch gepinnte Inventar-, Mapping- und Reconciliation-Digests, fehlende/falsch formatierte/zusätzliche Control-Pins sowie eine **neu von beiden Signern korrekt signierte, aber gegenüber den früher separat genehmigten Pins abweichende Mapping-Datei**. Die bestehenden Tests für gültige Signaturen, Signature-Replay, doppelte JSON-Schlüssel, BOM, UTF-8, Legal Holds und Erasure müssen weiter bestehen. Die exakte CI des neuen HEAD ist erneut nötig.

## Kritische Grenze: Ein Pin ist noch kein Freshness-Beweis

Die zusätzliche Hash-Bindung verhindert nur **Substitution relativ zu einer unabhängig festgelegten erwarteten Version**. Sie kann **nicht** feststellen, ob diese Version tatsächlich die letzte produktive Firestore-Version ist oder ob der Control-Channel selbst veraltet/kompromittiert wurde. Noch zwingend: autoritativer Quellsnapshot aus Firestore mit verifizierbaren Originaldatensatz-Digests, zeitnahe unabhängige DPO-/Security-/Release-Approvals, Pin-Revoke-/Rotation und monotone High-Water-Mark-Evidenz außerhalb dieses Prozesses; gesonderte Art.-17-/Legal-Hold- und Write-Fencing-Kontrollen.

Kein Live-Executor, kein Admin-SDK-Schreibzugriff, keine produktiven Änderungen an Daten/Rules/IAM und kein Merge. **Production bleibt BLOCKED / NO-GO.**

## Integration der signierten CLI in verbindliche Sicherheits-Tests (31.10.2026)

Die bisherige Bibliotheksprüfung deckt die aufrufende Dateiöffnung nicht vollständig ab: Ein ausschließlich finales `O_NOFOLLOW` verweigert keinen Symlink im übergeordneten Verzeichnis. Eine gestapelte, isolierte Korrektur verlangt deshalb kanonische absolute Dateien (Auflösung mittels `realpathSync.native`, anschließend finale `O_NOFOLLOW`-Öffnung) und prüft den tatsächlichen Node/tsx-Dry-Run mit lokal generierten Ed25519-Dateien im Pflicht-Gate. Die Grenzen von TOCTOU und fehlender originaler Firestore-Provenienz sind separat dokumentiert. [Sicherheitsbericht](TENANT_MIGRATION_CLI_PATH_ATTESTATION_2026-10-31.md). **Production NO-GO.**

