# P0 #254 – Tenant-Profilmigration: schreibfreier Zuordnungs-Preflight

**Stand:** 31.10.2026 · **Status:** BLOCKED / NO-GO · **Abhängigkeit:** Draft PR #253, Head `80f1b45f31944222e6c92c5d9e25881d55e700dd`.

## Implementierter Teilumfang

`src/server/multitenant/tenantMigrationPreflight.ts` prüft mit strikten Zod-Schemata **ausschließlich** die Offline-Inventar-/Mapping-Manifestpaare für die Legacy-Wurzel `users/{uid}`. Er bindet jedes Profil an eine explizit zugeordnete `tenantId` und `ownerUid`, denselben Snapshot, denselben quellbezogenen SHA-256-Digest und einen gesonderten Mapping-Evidenzdigest. Ungültige Pfade, unbekannte Felder, doppelte Quellrecords/Zuordnungen, unbekannte Records, Hash-/UID-/Snapshot-Konflikte und unzugeordnete Profile werden **fail-closed** zurückgewiesen. Aktive Löschanforderungen und Legal Holds dürfen nicht durch diesen vereinfachten Workflow bewegt werden.

Der CLI-Aufruf ist **nur schreibfrei** zulässig:

```bash
node --import=tsx scripts/tenant-migration-preflight.ts --dry-run /sicher/inventory.json /sicher/mapping.json
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
