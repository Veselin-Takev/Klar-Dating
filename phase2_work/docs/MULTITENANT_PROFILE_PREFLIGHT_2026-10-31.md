# P0 #254 – Tenant-Profilmigration: schreibfreier Zuordnungs-Preflight

**Stand:** 31.10.2026 · **Status:** BLOCKED / NO-GO · **Abhängigkeit:** Draft PR #253, Head `80f1b45f31944222e6c92c5d9e25881d55e700dd`.

## Implementierter Teilumfang

`src/server/multitenant/tenantMigrationPreflight.ts` prüft mit strikten Zod-Schemata **ausschließlich** die Offline-Inventar-/Mapping-Manifestpaare für die Legacy-Wurzel `users/{uid}`. Er bindet jedes Profil an eine explizit zugeordnete `tenantId` und `ownerUid`, denselben Snapshot, denselben quellbezogenen SHA-256-Digest und einen gesonderten Mapping-Evidenzdigest. Ungültige Pfade, unbekannte Felder, doppelte Quellrecords/Zuordnungen, unbekannte Records, Hash-/UID-/Snapshot-Konflikte und unzugeordnete Profile werden **fail-closed** zurückgewiesen. Aktive Löschanforderungen und Legal Holds dürfen nicht durch diesen vereinfachten Workflow bewegt werden.

Der CLI-Aufruf ist **nur schreibfrei** zulässig:

```bash
KLAR_MIGRATION_TRUST_ANCHOR_PATH=/sicher/freigegebener-keyring.json KLAR_MIGRATION_TRUST_ANCHOR_SHA256=<SHA256_DES_FREIGEGEBENEN_KEYRINGS> node --import=tsx scripts/tenant-migration-preflight.ts --dry-run /sicher/inventory.json /sicher/mapping.json /sicher/signaturen.json
```

Der CLI hat **keinen** Ausführungsmodus, importiert kein Firebase-Admin-SDK, kopiert keine Datensätze und verändert niemals Firestore-/Storage-Daten. Er lehnt symbolische Links, ungültige Dateien und Manifeste über 2 MiB ab; Fehlermeldungen geben keine UID, Pfade oder Inhalte aus. Der Bericht enthält nur Profil- und Tenant-Anzahlen, einen sortierungsstabilen SHA-256-Fingerprint des Abgleichs und den festen Status `BLOCKED_MANUAL_APPROVAL_REQUIRED`.

**Wichtige Grenze:** Inventar- und Mapping-Digests werden strukturell verglichen, aber ohne Zugriff auf die unveränderten Originalexports oder einen freigegebenen Signaturprüfschlüssel **nicht kryptografisch als echt attestiert**. Ein selbst behaupteter `mappingEvidenceSha256` kann keine gültige DPO-/Release-Owner-Genehmigung ersetzen. Auch ein grüner Unit-Test oder erfolgreicher Dry-Run **berechtigt daher niemals zur Ausführung**.

## Nicht enthalten / zwingende nächste Gates

- Ein unveränderliches, revisionssicher signiertes Quellinventar mit verifizierter Eigentümer- und Datensatzherkunft; Live-Bestätigung der Tenant-Membership-/UID-Zuordnung durch zwei unabhängige Berechtigte.
- Separate Fachmodelle für Chats mit mehreren Teilnehmern, KYC, Zahlungen, Consent-, Referral- und Audit-/Art.-17-Daten. Für diese Collection-Typen werden **absichtlich keine** automatischen Mappings angeboten. Die Regeln ihrer Beziehungen und Legal-Holds müssen zuerst DPO/Legal-freigegeben werden.
- Migrationsexecutor, Write-Fencing, reversibler Staging-Probelauf, idempotente Retry-/Rollback-Semantik und vollständige Reconciliation nach Migration.
- Firestore/Storage Rules, Admin-SDK-Berechtigungsgrenzen und negative Cross-Tenant-/Same-Tenant-BOLA-Tests in Emulator und Staging.
- Pino-Dependency/Lockfile, vollständige Security-Scans und unabhängige Security-/DPO-/SRE-/Finance-/Release-Owner-Freigaben.

**Kein produktives Re-Mapping, kein `default`-Fallback, kein Merge oder Deployment. Die offizielle Produktionsfreigabe bleibt BLOCKED / NO-GO.**

## Exakter CI-Befund – Fixture-Typecheck korrigiert (31.10.2026)

[Enterprise CI #41230227502](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41230227502) auf Commit `92d26b0e06749c7c58f91694b276c4bc33743659` war **FAIL** bei `Typecheck`, nicht beim fachlichen Preflight: strenge TypeScript-Regeln `noUncheckedIndexedAccess` meldeten TS2345 und TS2532 auf direkten Test-Fixture-Zugriffen `records[0]` / `assignments[0]`. Der Testcode nutzt jetzt eine explizit geprüfte generische `first<T>`-Hilfsfunktion statt nicht nachgewiesener Arrayelemente. Es wurden weder Security-Schema noch Live-Pfade oder die Ablehnungsentscheidung verändert. Der vollständige CI-Lauf auf dem neuen Commit ist erneut Pflicht; **kein vorzeitiger PASS**.


## CI-Regressionskorrektur (31.10.2026)

[Run #41230581261](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41230581261) für `7dd2b10716ab94c6047c5ee08aba7ef093d93848`: strenger Typecheck PASS, neuer Testumfang **25/26 PASS**, ein negativer Test durch `ReferenceError: mapping is not defined` abgebrochen. Zwei synthetische Fixture-Mutatoren wurden vollständig geprüft und von `v.first(mapping.assignments)` auf `first(v.mapping.assignments)` korrigiert. Kein geänderter Produktions-/Preflight-Kern. Ein neuer SHA-gebundener Gesamt-CI-PASS ist für jede spätere Integration notwendig; **NO-GO**.


## Signierte Provenienz – sichere Erweiterung (31.10.2026)

Der erste Preflight in [Draft #255](https://github.com/Veselin-Takev/Klar-Dating/pull/255) (exakter Parent-Commit `c68cca957a61a1fe063208d2e5a46b5583fd95d1`, [CI #41230731605](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41230731605) abgeschlossen mit PASS) validierte bislang lediglich **selbst behauptete** SHA256-Werte. Diese Form konnte weder den Inventar-Exporter noch die Mapping-Freigabestelle authentifizieren. Die neue gestapelte Sicherheitsänderung stellt die **obligatorische** Offline-Ed25519-Prüfung vor die Zod-/Eigentümerreconciliation:

- Das vollständig rohe Inventar (nicht nachträglich normalisiertes JSON) muss von einem gesondert autorisierten *Exporter*-Schlüssel signiert sein. Die Zuordnung muss unabhängig von einem *Approver*-Schlüssel signiert sein. Die jeweiligen Ed25519-Signaturtranskripte tragen getrennte, versionierte Domain-Präfixe einschließlich Null-Separator.
- Der vor Ort nur-lesend geöffnete, strikte Keyring definiert beide **verschiedenen** öffentlichen Schlüssel. Sein Dateidigest muss mit dem von einer *separat vertrauenswürdig* gesetzten `KLAR_MIGRATION_TRUST_ANCHOR_SHA256` übereinstimmen. `KLAR_MIGRATION_TRUST_ANCHOR_PATH` und diese Digestvariable dürfen **nicht** aus untrusted PR- oder Manifestinhalten stammen. Bei fehlenden Schlüsseln, fehlender Pin-Bindung, wiederverwendetem Key oder ungültigem Format wird strikt abgebrochen.
- Der CLI ist jetzt nur noch mit `--dry-run <inventory.json> <mapping.json> <signatures.json>` und diesen beiden sicheren Trust-Anchor-Umgebungswerten aufrufbar. Er öffnet nur reguläre lokale Dateien, verweigert Symlinks, begrenzt Bytes und hat **keinen** Live-Modus oder Firebase-Admin-Zugriff.
- Die GitHub-CI prüft synthetische Ed25519-Rollenbindung, Manipulation, falsche Domain, ausgetauschte Signaturen, abweichende/identische Public Keys, ungültige Trust-Anchors sowie eine trotz formal korrekter Signaturen bestehende Legal-Hold-Sperre. Es werden **keine** privaten Produktionsschlüssel benutzt oder an GitHub übertragen.
- Der Rückgabestatus bleibt **immer** `BLOCKED_MANUAL_APPROVAL_REQUIRED`; der Zusatz `CRYPTOGRAPHIC_SIGNATURES_VERIFIED_NOT_APPROVAL` beschreibt ausschließlich die technische Signaturprüfung. Zwei technisch gültige Signaturen belegen nicht, dass der Schlüsselhalter im konkreten Fall tatsächlich Datenverantwortlicher oder freigabeberechtigt ist.

**Zusätzlicher verbindlicher Gate:** unabhängige DPO-/Security-/SRE-Bestätigung der Keyring-Herkunft, Signer-Rollen, Key-Lifecycle/Revocation und eines unveränderlichen, vollständig mit den Original-Firestore-Datensätzen abgeglichenen Snapshot-Exports. Der selbst angegebene `sourceSha256` muss separat aus tatsächlichen Quellbytes authentisiert werden. Ohne Nachweis kein Executor, keine produktive Migration, kein GO.

