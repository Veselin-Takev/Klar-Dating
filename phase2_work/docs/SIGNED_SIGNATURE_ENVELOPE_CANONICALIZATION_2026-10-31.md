# P0 #254 – Eindeutige Signatur-Hülle im Tenant-Migrations-Dry-Run

**Datum:** 31.10.2026 · **Status:** DRAFT / BLOCKED / NO-GO · **Parent:** [PR #260](https://github.com/Veselin-Takev/Klar-Dating/pull/260), SHA `3a98997df35cf8273342152a31a6bea979333d1a`, [CI #41236327628](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41236327628): `completed/success`.

## Konkret belegter Befund

Der CLI-Einstieg `scripts/tenant-migration-preflight.ts` dekodierte bislang die nicht selbst signierte **Signatur-Hüllendatei** (`signatures.json`) mit `JSON.parse(readBoundedFile(...).toString('utf8'))`. Im Gegensatz zu Inventar, Mapping und Keyring wurde die Originalbytefolge der Hülle nicht gegen eine deterministische JSON-Serialisierung geprüft. JSON erlaubt in manchen Implementierungen wiederholte Felder; Node.js übernimmt bei `JSON.parse` den letzten Wert. Ein Angreifer konnte so beispielsweise `"mappingSignature":"ungültig","mappingSignature":"gültig"` in derselben Datei platzieren. Die weiterhin erfolgende Ed25519-Prüfung verhinderte zwar das Erfinden gültiger Signaturen; ein Review-Werkzeug konnte jedoch die **andere** Signatur bzw. einen anderen `schemaVersion`-Wert wahrnehmen als die Node-Laufzeit.

Die weitere Byte-Freshness-/PIN- und Trust-Anchor-Prüfung bleibt wirksam; der Befund betrifft die **eindeutige Interpretation** der nicht signierten Detached-Signature-Hülle und deren nachvollziehbare Freigabe-/Auditnachweise.

## Implementierung und Prüfstrategie

- `parseMigrationSignatureEnvelopeBytes` ist eine separate, strikt begrenzte Eingabegrenze in `src/server/multitenant/tenantMigrationAttestation.ts`. Sie erzwingt den bereits für die signierten Manifeste verwendeten fatal-UTF-8-Decoder, byteidentisches `JSON.stringify(JSON.parse(bytes))`, die bisherige 16-KiB-Obergrenze und das vorhandene strikte Zod-Schema mit nur `schemaVersion`, `inventorySignature` und `mappingSignature`.
- Der eigentliche CLI-Einstieg verwendet ausschließlich diesen Parser statt ungeschütztem `JSON.parse`. Zwei gültige Ed25519-Signaturen, V2-Bindung auf Inventarbytes, drei extern gepinnte Snapshot-Digests und Trust-Anchor-Pin bleiben unverändert erforderlich.
- Die neue echte Node/tsx-CLI-Suite erweitert den positiven, immer noch nur `BLOCKED_MANUAL_APPROVAL_REQUIRED` liefernden Testlauf um Negativfälle für doppelte `mappingSignature`-/`schemaVersion`-Keys, nachgestellten Whitespace, BOM, kaputtes UTF-8 und ein nicht autorisiertes `migrationApproved`-Feld. Diese Tests laufen über `check:multitenant-foundation` innerhalb des bisherigen Enterprise-Gates; es gibt keine gesonderten manuellen CI-Restarts.
- Die Eingabekontrolle behauptet ausdrücklich **nicht** RFC-8785/JCS-Kompatibilität. Sie verlangt das für diesen Node-22-JavaScript-Preflight dokumentierte restriktive `JSON.stringify`-Profil. Bereits anders formatierte Hüllendateien müssen bewusst neu erzeugt und unabhängig geprüft werden.

## Grenzen / verbleibende Freigabeblocker

Diese Maßnahme ist eine Parser-/Audit-Härtung, **keine** zusätzliche kryptografische Unterschrift über die Hülle selbst. Die Ed25519-Verifikation liefert ausschließlich einen Nachweis über die signierten Inventar-/Mapping-Bytes. Noch fehlen: originale Firestore-Quellprovenienz, autorisierte Key-Rollen und Widerruf, Trust-Anchor-/Snapshot-Freshness, SRE-geprüfte TOCTOU-freie Hostpfade, vollständige Tenant-/Chat-/KYC-/Payment-Berechtigungen, Art.-17-Löschkaskade sowie gesonderte Semgrep-/Gitleaks-/npm-audit-/ESLint-Nachweise (Issue #8).

**Akzeptanz:** neuer exakter CI-PASS plus unabhängiger Security-/DPO-/SRE-Review. Kein `main`-Merge, kein produktiver Datenzugriff, keine Cloud-Rules-/IAM-Änderung, kein Deployment. Production **BLOCKED / NO-GO**.
