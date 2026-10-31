# P0 #254 – Firestore-Rules-Scope und Tenant-Namespace-Default-Deny

**Stand:** 31.10.2026 | **Basis:** Draft PR #266, `b218bc7a4f2f55161197c3def3d432339b1876f7` | **Parent Enterprise-CI:** #41242366372, completed/success | **Status:** vorbereitet im separaten Feature-Branch; **keine neue CI/Emulatorausführung** wegen Actions-Budgetlimit; **Production BLOCKED / NO-GO**.

## Nachgewiesener Rules-Quellbefund

In `phase2_work/firestore.rules` und der Root-Variante `firestore.rules` deklarierte der äußere `match /databases/{database}/documents`-Scope `function validUserMutableUpdate()`. Diese Funktion referenzierte im Ausdruck zum UID-Wechsel `userId`, das erst innerhalb von `match /users/{userId}` gebunden ist. Die Regeln für Firebase-Funktionen stellen Variablen aus dem Definitions-Scope bereit; bei einer Funktion außerhalb des untergeordneten Match-Scopes muss die benötigte ID als Argument übertragen werden (Firebase Rules Language: https://firebase.google.com/docs/rules/rules-language). Ohne echten Rules-Compiler-/Emulator-Exit-Code ist dies ein **begründeter Compile-/Scope-Befund, nicht ein behaupteter beobachteter Emulatorfehler**.

**Minimaler Fix an beiden Regelsätzen:** `function validUserMutableUpdate(userId) { ... }` und `allow update ... && validUserMutableUpdate(userId)`. Der unveränderte UID-Vergleich lautet weiterhin `request.resource.data.uid == userId`. Berechtigungsfelder und alle sonstigen Allow-Prädikate bleiben unangetastet. Der bestehende schnelle Gate `scripts/check-public-firestore-rules.mjs` stellt künftig zusätzlich in **beiden** Dateien sicher, dass die Helper-Signatur und ihr Aufruf den expliziten `userId`-Parameter führen; ein statischer Textcheck ersetzt **nicht** den Compiler und keine Verhaltensprüfung.

## Emulator-Tests – synthetische Daten, keine produktiven Ressourcen

`phase2_work/tests/rules.spec.ts` ergänzt zwei klar getrennte Prüfschichten:

- Für `users/anna` muss eine eigene harmlose Profiländerung erlaubt bleiben, ein Wechsel der eingebetteten UID auf `bea` dagegen verweigert werden, ebenso ein Schreibversuch auf `users/bea` durch `anna`. So wird nicht nur „deny“ aus falschem Grund geprüft, sondern auch ein positiver Autorisierungspfad.
- Für vorhandene, **mit deaktivierten Regeln ausschließlich im Emulator gesäte** Testdokumente `tenants/tenant-a`, `tenants/tenant-a/users/anna`, `tenants/tenant-a/members/anna`, `tenants/tenant-a/featureFlags/SAFE_CHAT` und `tenants/tenant-b/users/anna` werden negative `get`-, `create/overwrite`-, `update`- und `delete`-Entscheidungen geprüft. Tests nutzen normale und mit Admin-Custom-Claims versehene Client-Kontexte. Dieses gewünschte Default-Deny ist **nur ein Vor-Cutover-Schutz**, kein Nachweis einer fertigen mandantenspezifischen Client-Rules-Policy.

**Zwingende Verifikation nach erneuter Budgetfreigabe:** Im Checkout exakt dieses Feature-SHA mit Node.js 22.23.3, Java 21+ und gelockten Abhängigkeiten in `phase2_work` den Befehl `npm run test:rules` ausführen; er verwendet den isolierten Firestore-Emulator `demo-klar` mit `firebase.pruefung.json` und den aktuellen `phase2_work/firestore.rules`. Den exakten Host, SHA, Exit-Code, vollständigen Testbericht, tatsächlichen Compilerstatus und Log-Digests dokumentieren. Danach erst einen Draft-PR eröffnen und die reguläre Enterprise-CI auf dessen exaktem Head prüfen. Die Root-Regelvariante benötigt zusätzlich einen eigenen Compiler-/Diff-Abgleich.

## Erweiterter Testumfang ohne neue CI-Auslösung (31.10.2026)

Die vorbereiteten Emulator-Tests hatten zunächst nur `setDoc` auf **vorhandenen** Tenant-Dokumenten geprüft: Firestore bewertet das als Update/Overwrite und nicht als echten CREATE. Ein zusätzlicher Test ergänzt deshalb ausdrücklich **nicht existierende** `tenants/tenant-a/users/new-user`- und `tenants/tenant-b/members/new-user`-Pfade. Außerdem müssen sowohl normale als auch Admin-Claim-Clients `getDocs`/LIST der Tenant-User-Collection verweigert bekommen; unauthentifizierte Reads müssen ebenfalls abgelehnt werden. Für LIST wird ein Testdokument mit deaktivierten Regeln im **isolierten Emulator** vorab angelegt. Auch diese Szenarien bleiben bis zum echten Emulatorlauf **unverifiziert**.

Der neue unabhängige Node-Standardbibliothekstest `scripts/check-public-firestore-rules.test.mjs` prüft den schnellen statischen Scope-Gate gegen temporäre Kopien beider tatsächlich versionierten Regeldateien. Mutationstests entfernen absichtlich den `userId`-Parameter bei Definition oder Aufruf und ergänzen eine unbedingte Client-Leseregel. Die Testfälle müssen die beiden Scope-Fälle sowie öffentliche Lesefreigabe als Fehler erkennen. Das bestehende `check:emulator-profile` ruft diese reine Offline-Regressionssuite künftig mit auf; dies ist weiterhin **kein Ersatz für Rules-Compiler und Firebase Emulator**.

Da der lokale Container derzeit nur Node.js 22.16.0 statt der vorgeschriebenen 22.23.3 bietet und die gelockten Abhängigkeiten nicht bereitgestellt sind, wurde kein formaler Lauf dieser neuen Tests als PASS verbucht. Es wurden **keine** GitHub-Workflows gestartet. Der Branch enthält nur ungemergte Vorbereitung.

## Sicherheits-Gate-Abdeckung beider Firebase-Deployment-Wurzeln (31.10.2026)

Die weitere Quellprüfung ergab eine zusätzliche **CI-Gate-Lücke**: Sowohl das Root-`firebase.json` als auch `phase2_work/firebase.json` verweisen jeweils auf ein eigenes `firestore.rules`. Der ursprüngliche `scripts/check-public-firestore-rules.mjs` suchte nach globalen öffentlichen Zugriffen und dem `public_profiles`-Volljährigkeits-Gate jedoch **nur** in `phase2_work/firestore.rules`. Die erst kürzlich hinzugefügte `userId`-Scope-Prüfung war die einzige Regel, die beide Dateien abdeckte. Ein unbeabsichtigt öffentliches `allow read: if true;` nur im Root-Regelsatz wäre somit im statischen Public-Rules-Gate unentdeckt geblieben.

**Gezielte Korrektur:** Der Source-Gate bewertet jetzt für **beide** deploymentrelevanten Firestore-Regeldateien unabhängig (1) unerlaubte bedingungslose `allow ...: if true`-Statements, (2) das bestehende `public_profiles`-Erwachsenheits-Gate und (3) den expliziten `userId`-Funktionsparameter. Zusätzlich müssen `firebase.json` und `../firebase.json` weiterhin das jeweils geprüfte `firestore.rules` referenzieren. Bei einem neu konfigurierten Regelpfad schlägt das Gate **fail-closed** fehl, anstatt eine alte Datei weiterzuprüfen.

Die Offline-Mutationssuite `scripts/check-public-firestore-rules.test.mjs` umfasst nun **acht** Testfälle. Neu sind die Root-Regeln mit eingefügtem `allow read: if true`, die Entfernung des Alters-Gates jeweils in Root- und Phase2-Regeln sowie eine nicht kontrollierte Änderung des Root-`firebase.json`-Regelpfads. Die Test-Fixtures kopieren nun neben beiden Regeldateien auch beide `firebase.json`-Dateien in temporäre Verzeichnisse. **Keine Cloud-Zugriffe, keine echten Daten.**

**Validierung in dieser Arbeitsrunde:** Die Review-Logik wurde mit den beiden tatsächlich aus GitHub geladenen Rule-Quellen und synthetischen Gegenbeispielen nachgebildet: Beide Baselines ergaben `PASS`, eine injizierte offene Leseregel `PUBLIC`, ein entfernter Erwachsenen-Gate `ADULT` und ein fehlender Scope-Parameter `SCOPE`. Das ist **keine Ausführung der committeten Node-Tests**, kein echter Rules-Compiler und kein Emulator-PASS. Die lokale Runtime ist Node 22.16.0 statt 22.23.3; die offizielle Enterprise-Toolchain und gelockte Dependencies stehen hier nicht vollständig bereit.

**Weitere Grenze:** Reguläre Ausdrücke sind keine vollständige semantische Firestore-Rules-Analyse. Für verschachtelte Match-Blocks, Ausnahmen, indirekte Freigaben und reale Multi-Tenant-RBAC-/Art.-17-Eigenschaften bleiben ein echter Rules-Compiler/Emulator und unabhängige Code-/Security-Reviews zwingend. Keine neue GitHub-CI wegen des bereits erreichten 100-Minuten-Vorsichtslimits.

## Laufzeit-/Budget-Governance

Die 13 überprüften Enterprise-Workflow-Läufe von #253 bis #266 dauern gemäß GitHub-Zeitstempeln zusammen **ca. 100,2 Minuten**. Das ist eine Schätzung der abgelaufenen Laufzeiten und **keine** offizielle GitHub-Billing-Zahl. Entsprechend der vereinbarten Grenze von maximal 100 zusätzlichen Actions-Minuten wird **kein weiterer PR mit automatischem CI-Trigger** und kein Workflow-Neustart ohne neue ausdrückliche Budgetfreigabe vorgenommen. Der isolierte Branch-Commit allein löst unter der derzeitigen GitHub-Workflow-Konfiguration (`push: main`, `pull_request`) keine CI aus. Die Änderung gilt als **unverifiziert**, solange kein echter Emulator-Test und unabhängige Reviews vorliegen.

## Weitere P0-Befunde unverändert offen

- In den geprüften Client-Regelsätzen fehlen ausdrückliche Tenant-Client-Policies. Der Default-Deny-Test ist keine vollständige Cross-Tenant-Read-/Write-Genehmigung; Firebase Admin SDK umgeht Rules und benötigt serverseitige RBAC-/BOLA-/IDOR-Kontrollen.
- `phase2_work/storage.rules` erlaubt unter `/profiles/{uid}/{datei}` jedem angemeldeten Nutzer `read`, ohne alters-/block-/mandantenspezifische Einschränkung. Die gewünschte Sichtbarkeit muss vor einer Änderung von Privacy, Produkt und Security festgelegt und im Storage-Emulator getestet werden.
- Original-Firestore-Snapshot-Provenienz, Signer-Autorisierung, Art.-17-Löschkaskade, Chat/KYC/Payment-Isolation, vollständige Pflichtscans (Issue #8), Host-/SRE- und DPO-/Legal-/AppSec-/Release-Owner-Freigaben sind weiterhin nicht belegt.

**Keine Änderung an main, keine Cloud-Rules-Bereitstellung, keine Live-Datenmutation, kein Merge, kein Deploy. Production: BLOCKED / NO-GO.**
