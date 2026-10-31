# Multi-Tenant Foundation – Zero-Trust Boundary (31.10.2026)

**Entscheid:** Implementationsschritt 1 – ausschließlich isolierter Draft-Branch, **BLOCKED / NO-GO**, keine Produktionsmigration. **Basis:** `main` `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Architektur und Autoritätsquellen

Die bestätigte Mandantenautorität ist das serverseitig mit Firebase Admin SDK verifizierte und auf Revocation geprüfte Custom-Claim-Paar `tenantId` plus `roles`. `X-Tenant-ID` und ein konfigurierbarer, vertrauenswürdiger Subdomain-Suffix sind ausschließlich Routing-Hinweise. Die Middleware lehnt jede Abweichung gegen den verifizierten Claim mit 403 ab und fordert zusätzlich `tenants/{tenantId}` mit `status='active'` und `tenants/{tenantId}/members/{uid}` mit `status='active'`. Berechtigte Rollen sind die Schnittmenge aus den signierten JWT-Rollen und der aktuellen Server-Mitgliedschaft: eine alte Rollenbehauptung kann kein erweitertes Recht erzeugen. Keine Datenrückgabe bei abgelehnter Autorisierung.

**API:** `src/server/multitenant/tenantAuth.ts` implementiert `authorizeTenant`, `firebaseTenantDependencies`, `createTenantMiddleware` und `requireTenantContext`. `res.locals.tenantContext` kann ausschließlich nach erfolgreicher Prüfung genutzt werden. Der neue Code ist **noch nicht global in `server.ts` eingehängt**, weil die aktuelle Flat-Storage-Codebase und Firebase Rules keine mandantenfähigen Produktionspfade haben. Dies ist ein Sicherheitsstaging, keine vorgetäuschte Cutover-Freigabe.

## Konfiguration

`tenantConfig.ts` führt Base → Region → Tenant → Subtenant als reinen und begrenzten Deep-Merge aus. Jedes Zwischenresultat wird mit strikten Zod-Schemata validiert. Prototyp-gefährliche Namen (`__proto__`, `constructor`, `prototype`), Arrays/Objekte mit abweichendem Prototyp, unbekannte Schlüssel und eine Abschwächung von `privacy.requireVerifiedProfile` werden verweigert. Subtenant-Overrides benötigen eine gültige Subtenant-ID. Vererbung betrifft nur Systemkonfiguration; Datenrechte werden nicht vererbt.

## Firestore-/Feature-Grenze

`tenantData.ts` bietet **keinen** generischen Zugriff auf fremde User-/Chat-/KYC-/Payment-IDs. Es erlaubt nur `getOwnProfile` unter `tenants/{claimTenant}/users/{claimUid}` und mandantengebundene Flag-Abfragen unter `tenants/{claimTenant}/featureFlags/{flag}`; Profile mit abweichender `tenantId` werden verweigert. Die getrennte `tenantFlags.ts`-Auswertung validiert `tenantId`, Aktivstatus und Boolean-Flag mit Zod. Ein Pino-kompatibles strukturiertes `info`-Sink-Interface erzwingt `tenant_id`, `trace_id` und ISO-Zeitstempel bei jedem gültigen Auswertungsversuch, auch bei fehlender/ungültiger Flag-Evidenz. Audit-Sink-Ausfall führt zum Abbruch.

**Offener Provider-Gate:** Das Repository enthält noch keine direkte, gesperrte Pino-Dependency. Der neue Kern fordert daher den tatsächlich konfigurierten Pino-Logger als Dependency-Injection und darf nicht als unabhängig ausführbare produktive Feature-Flag-Router-Integration freigegeben werden. Ein kontrolliertes Pino-Dependency-/Lockfile-Update und die konkrete Laufzeitverdrahtung sind vor Produktiv-GO nötig. Keine stille Nutzung von `console.log` als Ersatz.

## Tests und freigegebener Code-Scope

`tests/tenantFoundation.spec.ts` prüft gültiges Auth/Membership, ungültige/mismatched Claims und Routing-Hints, widerrufene Servermitgliedschaft, Rollen-Schnittmenge, 401/403, Prototyp-Pollution, tiefe Konfigurationsvererbung, fremde Tenant-Daten, Path-Traversal und strukturiertes Flag-Auditing. `npm run check:multitenant-foundation` ist in `check:enterprise` integriert. CI muss vollständig **auf dem neuen exakten SHA** bestanden sein, bevor die Branch-Integration überhaupt bewertet wird.

## Migration und verbleibende P0-Freigabeblocker

- **Legacy-Mapping:** Kein automatisches Zuweisen flacher `users`, `chats`, `subscriptions`, `verification_events`, KYC- und Payment-Einträge zu `default`. Ohne serverseitig autoritative, vollständige und DPO-geprüfte Tenant-Zuordnung: Datensatz in kontrollierter Quarantäne belassen, keine Live-Mutation. Ein revisionssicherer Migrationsplan muss erst alle Eigentümerbeziehungen, Referenzen, Art.-17-Aufbewahrungs-/Legal-Hold-Zustände und Undo-/Reconciliation-Verfahren erfassen.
- **Firebase Security Rules:** `firestore.rules`, `storage.rules` und die serverseitigen Altpfade sind noch nicht global auf `tenants/{tenantId}/...` umgestellt. Firebase Admin SDK umgeht Firestore Rules. Deshalb verhindert dieses Modul **nicht** bereits existierende BOLA/IDOR-Risiken anderer Legacy-Routen.
- **Rollenentzug:** Admin Custom Claims können bis zum Token-Refresh veraltet sein; die Servermitgliedschaft wird pro Request geprüft. Für tatsächliche sofortige Sperrung der Live-Daten müssen alle Listener, Firestore Rules und direkt zugänglichen Firebase-Clients ebenfalls das Revocation-/Mitgliedschaftsmodell abbilden.
- **Subtenant:** Kind-Mandanten erhalten weder Chat- noch KYC-/User-/Payment-Leserechte der Elterninstanz; nur getestete Systemparameter erben.
- **Live-Gates:** Node.js 22.23.3, Semgrep, Gitleaks, npm audit, ESLint, Typecheck, Emulator-Storage/Rules, Full E2E, Cloud IAM, unabhängige Security/DPO/SRE/Finance-Freigaben und Production-Readiness müssen am Zielsystem nachgewiesen werden. Der verschriebene `thinking_effort`-Befehl ist ungültig und kein Gate.

**Freigabe:** Implementationsstufe auf dediziertem Branch, **keine** Änderung an `main`, keine Deployments, keine Live-Daten, keine Tenantmigration, **Production NO-GO**.

## CI-Failure #41211522340 – Art.-17-Katalog korrekt nachgeführt (31.10.2026)

Der erste exakte Feature-Head `019f5722c5529e31f8ad592a54402fd397ec0037` schlug in `Enterprise static gates` fehl: `scripts/loeschkaskade.mjs` fand erstmals den Parent-Collection-Namen `tenants` ohne dokumentierte Entscheidung. Die Ursache ist nicht ein vermeintlich bestehender Purge: Der neue Code führt lediglich lesende Tenant-Lookups aus, aber eine **aktive** Art.-17-Cascade in `tenants/{tenant}/members/users/chats/...` ist noch nicht implementiert. Im Katalog wird daher `tenants` als `sonderfall` erfasst: root metadata werden nicht für das Löschen eines einzelnen Mitglieds global entfernt; **Member- und personenbezogene Unterkollektionen bleiben P0-Freigabeblocker**. Der statische Katalog-PASS allein bestätigt ausdrücklich keine vollständige Löschung. Kein Absenken des CI-Fehlerlimits und keine irreführende Markierung als `geloescht`.

Weitere notwendige Gates: autoritative Zuordnung, tenantbewusste UID-Cascade, Emulator-/Rules-Negativtests und unabhängige DPO-/Legal-Abnahme. **NO-GO**.

## Exakte CI-Evidenz nach der DSGVO-Katalogkorrektur (31.10.2026)

[Run #41211727208](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41211727208) auf `33776d61ef76225fbb3b2d633a8040ddccecaf5c`: Die verpflichtenden Enterprise Static Gates inklusive `scripts/loeschkaskade.mjs` **PASS**; die neue `tests/tenantFoundation.spec.ts`-Suite **17/17 PASS**. Der nachfolgende vollständige Typecheck **FAIL** mit genau zwei Testdatei-Befunden: TS6133 (unbenutzter `TenantAccessDenied`-Import, Zeile 6) und TS2352 (Request-Stub muss über `unknown` statt direkt zu `Request` casten, Zeile 93). Beide rein testtypischen Stellen wurden ohne Verhaltensänderung korrigiert. Neuer Head benötigt erneut komplettes CI; vorher kein PASS und kein Production-GO.


## Tenant-Kontext als nicht fälschbares Laufzeit-Capability (31.10.2026)

Die zusätzliche Security-Selbstprüfung zeigte, dass der erste Typvalidator allein die Authentifizierung nicht beweisen kann: Beliebiger Code könnte ein syntaktisch gültiges `TenantContext`-Objekt erfinden und einen Admin-SDK-Repository-Aufruf auslösen. Der Kontext wird jetzt ausschließlich nach erfolgreicher Firebase-Token-/Membership-Prüfung als eingefrorenes Objekt ausgestellt und in einem privaten `WeakSet` registriert. Repository-Leser und Feature-Flag-Auswertung verlangen diese Laufzeit-Capability; rekonstruierte, gefälschte oder serialisierte Kontexte werden mit 403 verweigert. Ein neuer Negativtest prüft sowohl den Datendienst als auch die Feature-Flag-Grenze.

Diese Härtung betrifft **nur die neue Tenant-Schicht**. Sie ist kein Schutz für Legacy-Firestore-Zugriffe, die den neuen Dienst umgehen. **Production NO-GO.**


## P0-Datenadapter-Review – Tenant-Label und Feldprojektion (31.10.2026)

Nach dem vollständigen [Enterprise-CI-PASS #41212151654](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41212151654) auf `f506f9909e4888a40324088af997ba22157b7a25` ergab die erneute Sicherheitsprüfung einen konkreten BOLA/Informationsabfluss-Befund: `getFeatureFlag()` konnte den **rohen** Firestore-Datensatz herausgeben, bevor `evaluateTenantFlag()` dessen `tenantId` validierte. Ein direkter Repository-Aufrufer wäre damit nicht durch die Serviceprüfung geschützt gewesen. Die Korrektur verlagert die Prüfung in den Adapter: Nur `tenantId === ausgestellter TenantContext`, `status='active'` und `enabled:boolean` werden akzeptiert. Zurückgegeben wird ausschließlich das Zod-projizierte Minimum dieser drei Eigenschaften. Ein fehlender Eintrag liefert `null`; ein vorhandener, fremd markierter oder ungültiger Datensatz löst `tenant_record_inconsistent` aus (fail-closed), und der höherliegende Service muss im `finally` seine strukturierte Denial-Auditmeldung schreiben.

Die Negativtests verifizieren fremd markierte Dokumente **direkt am Repository**, verweigern fehlerhafte/inaktive Datensätze, prüfen minimierte Rückgaben ohne zusätzliche private Felder und kontrollieren den strukturierten Audit bei Ausnahmefehlern. Die vorherige erfolgreiche CI deckt **nicht** diesen neuen Commit ab; vollständige exakte CI und unabhängiger Review sind erneut Pflicht. Kein globales Live-Mounting oder Freigabe der Legacy-Migration. **BLOCKED / NO-GO**.

