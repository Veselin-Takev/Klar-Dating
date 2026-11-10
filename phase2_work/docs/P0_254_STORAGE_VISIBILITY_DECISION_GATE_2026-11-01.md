# P0 #254 — Storage-Profilsichtbarkeit: Entscheidungs- und Freigabe-Gate

**Stand:** 2026-11-01 · **Entscheidung:** **BLOCKED / PRODUCTION NO-GO**  
**Prüfbaselines:** `main` SHA `2808dc1cbb485f70b403681c108cea5a3361d950`; ungemergter [Integrations-Draft #288](https://github.com/Veselin-Takev/Klar-Dating/pull/288) SHA `c358d4360e36ef7a68555c2471f17648358557f7`.  
**Scope:** Governance-/Testprotokoll; keine Änderung von Storage Rules, IAM, Scheduler, Kundendaten oder produktiver Infrastruktur. Verknüpft: [#254](https://github.com/Veselin-Takev/Klar-Dating/issues/254), [#202](https://github.com/Veselin-Takev/Klar-Dating/issues/202), [#204](https://github.com/Veselin-Takev/Klar-Dating/issues/204), [#206](https://github.com/Veselin-Takev/Klar-Dating/issues/206).

## 1. Verifizierte Nachweise — klar getrennte Aussagegrenzen

| Evidenz | Verifiziertes Ergebnis | Keine Behauptung über |
| --- | --- | --- |
| `main` `phase2_work/storage.rules` | `profiles/{uid}/{datei}` nutzt `allow read: if signedIn();`. Diese lokale Regel prüft keine `tenantId`-Claims oder aktive Mitgliedschaft. `verification/{uid}/{datei}` verweigert Client-Lesezugriffe. | Ausgerollte Live-Rules oder explizit genehmigte Discovery-Policy |
| [#284 / CI 41342810126](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342810126) | Quellbranch mit vier nativen Storage-Regeltests, sechs Tenant-Firestore und sechs Retention-Firestore-Fällen erfolgreich getestet | Freigegebenen Mandanten-Cutover |
| [#286 / CI 41343839097](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41343839097) | Full CI erfolgreich; synthetische Profil-/Biometrie-Metadatenkontrollen | Echte Kunden-/Cloud-Daten oder Produktion |
| [#287 / CI 41344683269](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41344683269) | Exakt SHA `4ea1cd63a38eae45284dcb84722ec43e53c7aa81`: Full CI SUCCESS; `tests/storageRules.spec.ts` mit **5 tatsächlich ausgeführten Tests**; 1.464 Vitest-Tests | Freigabe, diese überlappenden Tests zusätzlich zu #284 zu mergen |
| [#288 / CI 41345204334](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41345204334) | Exakt SHA `c358d4360e36ef7a68555c2471f17648358557f7`: **completed/success**; Log bestätigt **4 native Storage**, **6 native Tenant-Firestore** und **6 native Retention-Firestore**-Tests, insgesamt **200 Testdateien / 1.472 Vitest-Tests**; Smoke und 26 Browser-Acceptance-Tests erfolgreich. Der Integrations-Draft ergänzt Metadaten-Assertions in **bestehende** Tests und übernimmt nur read-only Marker-Gates, ohne doppelte Storage-Suite. | Produktion, Live-Rules/ACL, Admin SDK, Datenschutz-Einwilligung oder fachlichen Policy-Beschluss |

**CI-Grenze:** Lauf #288 ist nur Nachweis für den o.g. **ungemergten** Commit. #287 ist ein alternativer/überlappender Draft; keine blinde Doppel-Merge-Strategie. Grüne Quellen-/Emulator-Tests zertifizieren weder produktive Tenant-Isolation noch ein Sicherheitsversprechen. Der derzeitige Profilzugriff kann beabsichtigtes Dating-Discovery-Verhalten sein; ohne fachliche Autorisierung ist er weder als zulässig noch als bereits ausgenutzte Sicherheitslücke eingestuft.

## 2. Fehlende Entscheidung — Product, DPO und Legal

**Noch keine Option freigegeben.** Die verantwortlichen Stellen müssen eine versionierte ADR mit der **zulässigen Empfängergruppe** und dem Verhalten bei Sperre/Widerruf/Löschung zeichnen:

| Option | Fachlich festzulegender Zugriff | Mindestanforderung |
| --- | --- | --- |
| **A — kontrollierte tenantübergreifende Entdeckung** | Nur explizit zugelassene, qualifizierte Profile zwischen genau definierten Mandanten, nach dokumentiertem Zweck und Rechtsgrundlage | Autoritativer Viewer-/Account-/Alters-/Blockierungs-/Tenant-/Medien-ACL-Check; kein bloßes `signedIn()` |
| **B — strikte Tenant-Isolation** | Profile ausschließlich innerhalb genehmigter aktiver Tenant-Mitgliedschaft | Fail-closed Tenant/UID/ACL in Client Rules **und** Admin SDK, positive/negative Cross-Tenant-Tests |
| **C — temporäre Unterbindung von Direktdownloads** | Kein direkter Client-Zugriff bis Policy und Medien-Dienst freigegeben | Kontrollierter Proxy/Zugriff mit kurzer Gültigkeit, erneuter Berechtigung und Widerruf alter Firebase-Download-URLs |

**Sperrkriterium:** Ohne unterzeichnete Entscheidung keine globale Rules-Öffnung, keine eigenmächtige Verschärfung mit möglichem Discovery-Ausfall, kein tenantweiter Datenumzug und keine Produktionsfreigabe.

## 3. Abnahme-Matrix für die spätere genehmigte Ziel-Policy

| Testakteur / Zustand | Profil-Medien/Metadaten | Biometrische Medien | Nachweispfad |
| --- | --- | --- | --- |
| Nicht angemeldet / anonym | deny | deny | Storage Emulator, Download und List |
| Rechtmäßiger Eigentümer | Nur signierte Policy-ACL | Client read deny | JWT, aktive DB-Mitgliedschaft, UID |
| Anderer Benutzer im selben Tenant | Nur freigegebene Viewer | deny | Same-Tenant-BOLA, Blockierung |
| Anderer Tenant | deny **außer** explizit legitimierter Option A | deny | Cross-Tenant-BOLA/IDOR, JWT-/Host-/DB-Mismatch |
| Inaktiver, gesperrter, minderjähriger oder gelöschter Nutzer | deny gemäß genehmigter Policy | deny | Revoke/Refresh/Clock-/Status-Races |
| Service/Admin SDK | Zweck-/Tenant-/UID-/Rollen-Guard und Audit | Nur berechtigter KYC-/Retention-Dienst | Server-Integration und IAM-Audit; Rules werden umgangen |
| Alte Firebase-Download-Tokens/Cache | Widerruf bzw. genehmigte kurze Gültigkeit | Nicht teilbar | #206; direkte URL-, Cache-/Referrer-Proben |
| Tenant-/UID-Migration und Art.-17-Erasure | Kein Fremdzugriff, vollständige Kaskade | Hold-/Retention-fähig | Signierter Mapping-/Rollback-Beleg, Staging |

Tests brauchen echte Allow- **und** Deny-Assertions; unbekannte oder stale Claims, widersprüchliche Tenant-Hints und gelöschte Accounts müssen **fail-closed** bleiben. Emulator-Proofs reichen nicht als Live-Rules- oder IAM-Nachweis.

## 4. Verbindliche, nachweisbare Freigabereihenfolge

1. **Product Owner + DPO + Legal** zeichnen die ADR für Sichtbarkeit, Zweck/Rechtsgrundlage, Alter/Verifizierung, Blockierung, Widerruf, Retention und Betroffenenrechte.
2. **AppSec / Architecture** verifizieren Threat Model, Auth-/Firestore-/Storage-/Admin-SDK-Grenzen und volle BOLA/IDOR-Negativmatrix.
3. **Data Migration + DPO** zeichnen signierte Tenant-/UID-/Objekt-Inventur, Migrationsplan, Art.-17-Löschkaskade, Holds und rollback-sicheren Cutover.
4. **P0 #202 separat schließen:** Nur autorisierter, generation-gebundener Biometrie-Purge mit 404/412-/Crash-/Hold-Reconciliation, dauerhafter >300-Queue und korrekt deploytem Scheduler/IAM; keine ungeschützte upload-age-Löschung.
5. **SRE** liefern Live-/Staging-Projektnachweis, Rules-/IAM-/GCS-Hashes, Monitoring, Backup/Restore, Canary und Rollback.
6. **QA + Release Owner** prüfen **einen** finalen, integrierten Code-/Artifact-SHA, Gates/Exitcodes/Logs/SBOM und unterschriebene Freigaben; keine Übernahme von grünen Draft-Checks.

| Offenes Freigabe-Gate | Verantwortliche | Status |
| --- | --- | --- |
| Profil-Medien-ADR Option A/B/C | Product, DPO, Legal | **BLOCKED** |
| Cross-/Same-Tenant ACL, IAM, Admin-SDK-Negativtests | AppSec, Architecture, QA | **BLOCKED** |
| Tenant-Migration, Art. 17, alte Download-Tokens | DPO, Data Engineering, SRE | **BLOCKED** |
| GCS-Receipts, Scheduler und >300-Retention-Queue (#202) | AppSec, DPO, SRE | **BLOCKED** |
| Final integrierter SHA, deployed Rules und signierter Release | Release Owner | **NO-GO** |

**Release-Invariante:** `productionApproved=false`. Keine direkten Änderungen an `main`, keine blinden Merges der überlappenden Drafts #284–#288, keine produktiven Datenoperationen und keine Aussage `Production GO` ohne unabhängig attestierte vollständige Evidenz.
