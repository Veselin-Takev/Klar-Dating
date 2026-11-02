# P0 #254 — Tenant-Zugriffsinventar: Quelltextabdeckung und Symlink-Fence

**Datum:** 2026-11-02  
**Ausgangspunkt:** gestapelter Branch von [Draft #309](https://github.com/Veselin-Takev/Klar-Dating/pull/309), exakt `1a291209a111788f72eb5187af339dc6232f8a12`, [Actions #41464881430](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41464881430) SUCCESS. **Parent-PASS ist nicht auf diesen Branch übertragbar.**  
**Release:** `productionApproved=false`, **BLOCKED / NO-GO**.

## Source-verified Befund

`scripts/inventory-tenant-access.mjs` listet die relevanten Quellordner `src`, `functions/src`, `scripts` und die aktive Datei `server.ts` deterministisch auf und emittiert Pfad, SHA256 und kategorisierte Texttreffer. Der bisherige `sourceTypes`-Filter erfasste nur `.ts`, `.tsx`, `.js`, `.mjs` und `.cjs`, nicht aber `.jsx`, `.mts` und `.cts`. Zusätzlich wurden symbolische Links im durchlaufenen Quellbaum **stillschweigend** übersprungen. Dadurch kann eine Quellinventur Kandidaten übersehen; daraus folgt kein Beleg einer bereits erfolgten Cross-Tenant-Datenoffenlegung.

## Isolierte, fail-closed Korrektur

- Das neue reine Hilfsmodul `scripts/tenant-inventory-source-policy.mjs` definiert ausdrücklich alle acht überwachten TypeScript-/JavaScript-Endungen; `inventory-tenant-access.mjs` verwendet die gemeinsame Typprüfung.
- Wenn innerhalb des inventarisierten Quellbaums ein Symlink auftaucht, wird die Inventur mit `inventory_failed: unreviewed_source_symlink` verweigert, statt auf eine scheinbar vollständige JSON-Liste zu schließen. Links werden **nicht** verfolgt, sodass keine unkontrollierte Pfadauflösung erfolgt.
- `inventory-tenant-access.test.mjs` prüft alle neuen Erweiterungen, negative Nicht-Quellfälle, die Symlink-Sperre und weiter den kompletten Datei-/SHA-/Treffer-Abgleich. `check:tenant-inventory` ist in `check:enterprise` verdrahtet.
- Keine Cloud-/Firestore-/Storage-/IAM-/Scheduler-/Kundendatenänderung, keine Löschung, kein Deploy und kein direkter `main`-Commit.

## Strikte Grenzen der Aussage

Diese Verbesserung betrifft **nur die statische Inventarisierung möglicher Codezugriffe**. Die vorhandenen Regex-Treffer beweisen ausdrücklich weder vollständige Datenflussanalyse noch Tenant-ACL-/BOLA-Abdeckung. Firebase-Konfigurations- und Rules-Dateien sowie Firestore-Index-/TTL-Schemata haben separate Source-Gates; aus diesen Gates darf kein Live-Deploy- oder rechtskonformer Art.-17-Nachweis abgeleitet werden. Die Änderungen enthalten **keine Migration** und schalten die isolierte Multi-Tenant-Middleware nicht global ein.

Vor jeder Produktionsfreigabe sind offen: verifiziertes Legacy→Tenant-Mapping und Quarantäne, read-only Dry-Run mit Referenzintegrität, erprobte idempotente Migration mit Rollback/Write-Fencing, Admin-SDK-/Client-Firestore-/Storage-BOLA-Negativtests, Art.-17-Kaskade, vollständiges IAM/Logging, native Staging-Beweise, P0 #202 Löschquittungen und die unabhängigen Security-/DPO-/Legal-/SRE-/ReleaseOwner-Attestationen.

**Neue vollständige exact-head Enterprise-CI zwingend.** Auch bei PASS bleiben P0 #254 und P0 #202 offen und `productionApproved=false`.
