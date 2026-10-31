# P0 #254 – Datenminimierung der Tenant-Profil-Lesegrenze

**Prüfdatum:** 31.10.2026 · **Status:** Isolierter Draft / Production BLOCKED / NO-GO · **Parent:** [PR #261](https://github.com/Veselin-Takev/Klar-Dating/pull/261), SHA `97ebb2e554b9d127f5ca6f2235460cf7f75448d9`. Die vollständige [Enterprise-CI #41237617548](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41237617548) dieses Parents ist `completed/success`.

## Konkret belegter Befund

In `src/server/multitenant/tenantData.ts` prüfte `getOwnProfile()` bisher anhand des korrekt ausgestellten, nicht imitierbaren Tenant-Kontexts, ob das gespeicherte Firestore-Profil exakt `tenantId` und `uid` trägt. Anschließend wurde jedoch das **vollständige rohe Firestore-Dokument** zurückgegeben. Ein solches Dokument kann neben UI-Profildaten auch interne KYC-/Moderations-/Payment-/Rollenfelder enthalten, die selbst für den eigenen User nicht automatisch für eine generische Profilanzeige bestimmt sind. Der Firebase Admin SDK ignoriert Firestore Security Rules – die API-Grenze muss daher selbst das Ausgabeschema begrenzen.

## Korrektur (nur isolierte Foundation)

- `getOwnProfile()` gibt ausschließlich ein neues, eingefrorenes und mittels Zod erstelltes Objekt mit den verpflichtenden Feldern `tenantId`, `uid` und dem optionalen, validierten (getrimmten, maximal 100 Zeichen langen) `name` zurück.
- Ein Quellrecord mit fehlender oder widersprüchlicher `tenantId`/`uid` wird weiterhin verweigert. Ungültig typisierte, leere oder zu lange `name`-Werte führen fail-closed zu `tenant_record_inconsistent`.
- Unbekannte/nicht freigegebene zusätzliche Felder werden **nicht ausgegeben**, selbst wenn das gespeicherte Dokument selbst gültig und vom korrekten User ist. Die Originaldaten werden dadurch nicht verändert.
- `tests/tenantFoundation.spec.ts` prüft synthetische versteckte `email`-, interne Rollen-, KYC-Foto-, Payment-, Moderations- und Cross-Tenant-Felder. Der Test erwartet ausschließlich das Minimalobjekt; außerdem werden strikte Schemas, Unveränderlichkeit und Nichtmutation des Quellobjekts verifiziert.
- Diese Änderung fügt **keine** zusätzliche eigene Profil-API oder vollständige Datenmodellmigration hinzu. Ein späterer größerer Profilbildschirm benötigt einen separat geprüften Endpunkt und ein ausdrückliches feldweises Freigabe- sowie DSGVO-Konzept. Die aktuelle Lesegrenze ist absichtlich schmal; keine implizite Übernahme bisheriger Rohfelder.

## Unveränderte Freigabeblockade

Die neue Foundation ist weiterhin **nicht** in alle Legacy-Routen eingebunden. `tenants/{tenantId}/...`-Migration, Firestore/Storage Rules, Member-Revoke, Art.-17-Cascade, Chat-/KYC-/Payment-BOLA/IDOR sowie ein vollständiger nachgewiesener externen Semgrep-/Gitleaks-/npm-audit-/ESLint-Satz bleiben offen (Issues #254 und #8). Ein grüner CI-Lauf des neuen SHA würde ausschließlich den isolierten Commit bewerten. Unabhängige AppSec-/Datenschutz-/SRE- und Release-Owner-Freigaben bleiben zwingend.

**Keine Migration, kein Merge, kein Deployment, keine Änderung an `main`, Firestore, IAM oder produktiven Secrets. Production BLOCKED / NO-GO.**
