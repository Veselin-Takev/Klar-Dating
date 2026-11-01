# P0 #254 / P1 #204 — Angemeldete Gastkonten und Profilmedien-Sichtbarkeit

**Stand:** 2026-11-01 · **Status:** Beweisführung im Draft / Production BLOCKED–NO-GO  
**Quellbaseline:** [#290](https://github.com/Veselin-Takev/Klar-Dating/pull/290) SHA `a93fdc993beb294b684404a26be30a67d23f27b3` ([CI 41348580636](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41348580636) komplett PASS); dieser Zusatz hat **eigene neue CI-Verifikation** und darf kein PASS vom Parent übernehmen.

## Quellbefund und Entscheidungsbedarf

- In `phase2_work/storage.rules` ist für `profiles/{uid}/{datei}` das **Lesen** mit `allow read: if signedIn();` erlaubt. Ein authentifiziertes *anonymes Firebase-Gastkonto* erfüllt `signedIn()`, obwohl `istGast()` für die Bild-Uploads genutzt wird. Storage-Lesen ist hier weder an das Alter, eine erfolgreiche KYC-Prüfung, eine verifizierte aktive Mandantenmitgliedschaft noch eine geprüfte individuelle Freigabe gebunden.
- Die Firestore-Regel für `public_profiles/{userId}` verlangt `isAuthenticated() && !istGast()`, serverseitig gesetzte Erwachsenen-Gates für Viewer und Zielprofil sowie die Abwesenheit gegenseitiger Blockierungen. **Diese Firestore-Regel greift nicht automatisch auf direkte Storage-Objektzugriffe durch.**
- Diese Inkonsistenz ist ein **im Repository sichtbarer potentieller Policy-Bypass**, aber **kein Nachweis** einer tatsächlichen produktiven Offenlegung, Kenntnis eines konkreten Storage-Objektpfads, eines aktiven Live-Deployments oder einer rechtswidrigen Datenverarbeitung. Die aktuelle Profilentdeckung kann bewusst breiter ausgestaltet sein; Product, DPO und Legal müssen die gewünschte Sichtbarkeit ausdrücklich genehmigen.

## Neue, tatsächlich ausführbare native Testevidenz

Der bereits bestehende synthetische `tests/tenantStorageBoundary.emulator.spec.ts` wird **um einen** Test ergänzt, nicht um eine zweite Testdatei. Ein UID-Eigentümer im Tenant A erstellt ein Fake-JPEG unter `profiles/{owner}/guest-visibility.jpg`; ein `tenant-beta`-Gast mit `firebase.sign_in_provider='anonymous'` versucht **getDownloadURL** und **getMetadata**; beide werden unter den derzeitigen *lokalen Quellregeln* ausdrücklich als erlaubt erwartet. Derselbe Gast darf das Bild **weder überschreiben noch löschen**; danach räumt der Eigentümer das synthetische Objekt im lokalen `demo-klar`-Storage-Emulator wieder ab. Es gibt keine Cloud-/Kundendaten-Operation.

`check:tenant-native-storage` fordert die Gast-Read-/Metadata-Assertions und die Write-/Delete-Negativfälle als statische CI-Regressionsbarriere. Zusätzliche Mutationstests schlagen bei Entfernung der Gastidentität, einer Lese-Assertion oder einer Schreibsperre fehl. Der zuvor nachgewiesene **Fail-Closed-Emulator-CI-Mechanismus aus PR #289/#290 bleibt erhalten**; diese Veränderung wird auf dessen exaktem Parent-SHA gestapelt.

## Pflichtmatrix für spätere tatsächliche Policy

| Fall | Quellverhalten (zu verifizieren) | Freigabe vor produktiver Änderung |
| --- | --- | --- |
| Anonymer Client ohne Authentifizierung | Lesen verboten | Negative Testmatrix |
| Firebase-Anonymous-Gast mit gültigem Token | Profile-Read nach `signedIn()` derzeit erlaubt | Product/DPO/Legal entscheiden ausdrücklich, ob zulässig |
| Erwachsener regulärer Viewer | Profile-Read nach `signedIn()` derzeit erlaubt | Serverautoritative Profil-/Block-/Tenant-/Viewer-Policy |
| Minderjähriger, gesperrter, gelöschter oder widerrufener Viewer | Von der derzeitigen Storage-Regel nicht einzeln geprüft | Testmatrix, Auth-Revocation und identitätsbasierte Backend-ACL |
| Biometrisches Verifizierungsbild | Alle Client-Reads verboten | Admin SDK, IAM und Retention-Protokoll separat prüfen |
| Früher ausgegebene Download-Token | Client Rules allein reichen nicht zur Entwertung | Widerruf, Cache-/URL-Token-Strategie, P1 #206 |

**Kein eigenmächtiges Ändern** von `storage.rules`, da dadurch beabsichtigte Entdeckungsfunktionen ausfallen könnten. Zuerst dokumentierte Visibility-ADR samt Legal-Grundlage, danach abgestimmte serverseitige Autorisierung und gemeinsame Firestore-/Storage-/Admin-SDK-Tests, danach unabhängige genehmigte Staging-Erprobung. Ohne diese Schritte: P0 #254 und P1 #204 weiter offen.

## Offene Gates und Freigabe

- [ ] Neue vollständige **Exact-HEAD CI**: Source-/Mutation-Gates, **5 native Storage**, **6 Tenant-Firestore** und **6 Retention-Firestore** Tests müssen tatsächlich ausgeführt werden; Typecheck, Builds, Production Smoke und Browser Acceptance.
- [ ] Verbindliche Product-/DPO-/Legal-Entscheidung über Anonym-/Gast-/Alter-/Tenant-Mediensichtbarkeit mit Zweck, Aufbewahrung und Löschrechten.
- [ ] Verifikation des tatsächlich ausgerollten Firebase-Projekts, Security Rules, Storage ACLs, Admin-SDK-Pfaden, Download-Token und Staging-Negativmatrix.
- [ ] P0 #202 weiterhin separat: generation- und entscheidungsgebundener GCS-Purge, 404/412/Legal-Holds/Receipts und dauerhafter Durchsatz über 300 fällige Einträge.
- [ ] Unabhängige AppSec/DPO/Legal/SRE/Release-Owner-Reviews und endgültiger SHA-gebundener GO-Beschluss.

**Unverändert:** `productionApproved=false`; **Production BLOCKED / NO-GO**, `main` unverändert. Kein Merge, Deployment oder produktiver Zugriff.
