# Hosting-Migration und Rollback: Staging-Verifikation

Stand: 2026-10-25. **DRAFT / Produktion NO-GO.**
Anforderung: Hosting-/Runtime-Wechsel; Firebase Auth und Firestore bleiben in Produktion unverändert.
Zielanbieter und isoliertes Staging-Projekt sind noch nicht festgelegt. Es wurde **kein Live-Staging-Lauf** ausgeführt.
Die lokalen Modelltests validieren den Controller, keine tatsächliche unterbrechungsfreie Migration und keine rechtliche DSGVO-Freigabe.

## Architektur und Geltungsbereich

Alte und neue Runtime verwenden in dieser Migration dieselbe Firestore-Instanz, dieselben Collections/Indexes/Rules und Firebase-Auth-Tokens.
Es gibt keine Datenkopie, kein Backfill und keinen Wechsel der Schreibautorität. Read/Write-Split bedeutet hier ausschließlich:
Der vorgeschaltete Router verteilt Requests auf beide App-Versionen; beide lesen und schreiben in dieselbe Datenbank.
Keine eigenen Read-Replicas, keine zweite Datenbank und keine unabhängigen Dual-Writes.
Bestehende Transaktionen/Idempotenz müssen bei Requests an beide Runtimes funktionieren.
Keine Firestore-Wiederherstellung als Hosting-Rollback: Sie könnte seit dem Wechsel bestätigte Schreibvorgänge verlieren.

Staging verwendet zwingend ein **separates Firebase-Projekt**, synthetische Konten und Daten, getrennte Secrets/IAM und deaktivierte echte Zahlungen, E-Mail-/Push-Empfänger und Webhooks.
Das bestehende Default-Projekt striped-antler-500815-e6 ist für den Controller gesperrt.
Die bestehende Produktions-Firebase-Anbindung bleibt unangetastet; ihre Zugangsdaten dürfen nicht im Staging-Kandidaten landen.
Emulatoren liefern zusätzliche lokale Evidenz, ersetzen aber keine Messung gegen echte isolierte Hosting-/Firebase-Dienste.

Das Schema bleibt N unverändert. Trotzdem müssen vorherige Runtime N-1 und Kandidat N mit diesem Schema kompatibel sein:
alte/neue Version lesen gegenseitige Schreibvorgänge, alte Updates erhalten neue optionale Felder,
wiederholte Requests erzeugen keine Doppelbuchungen, Sessions und Auth-Prüfung bleiben gültig.
Eine spätere Schema-Erweiterung benötigt Expand/Migrate/Contract mit separatem Review;
kein Contract während des Rückfallfensters. Die Referenz-Outbox im Simulator ist **kein produktiver Dual-Write-Adapter**.
Der Live-CLI-Pfad verweigert Datenbank-/Schemawechsel.

## Deterministische Ausführung

Dateien: scripts/staging-migration.mjs, staging-migration-core.mjs, staging-migration-simulation.mjs,
staging-migration.example.json und test-staging-migration.mjs.
Node >=22.23.3; keine neuen Abhängigkeiten. Aus phase2_work:

~~~sh
node --test scripts/test-staging-migration.mjs
node scripts/staging-migration.mjs plan scripts/staging-migration.example.json /secure/evidence/plan.json
node scripts/staging-migration.mjs simulate scripts/staging-migration.example.json /secure/evidence/simulation.json
~~~

Beispielwerte sind keine existierenden Ressourcen oder Freigaben. Verzeichnisse vorher mit restriktiven Rechten anlegen;
unter Windows gelten Verzeichnis-ACLs, mode 0600 allein setzt keine passende ACL.
Die Ausgabe muss außerhalb eines Git-Checkout liegen und darf nicht existieren.
Gleicher kanonischer Manifest-Inhalt erzeugt denselben Plan-Hash und dieselben Command-IDs.
Das ist kein Versprechen deterministischer Netzwerkantworten. Live-Läufe stoppen bei unbekanntem Zustand.

Ablauf: Identität/Isolation/Artifact-Digests -> echte N-1-Nachweise -> gesunde Quell-Baseline -> exklusiver Fence/Lease ->
1%, 10%, 50%, 100% Kandidat -> **geplanter Rückfall auf 100% Quelle** -> Readiness-/Datenprüfung.
Auch der erfolgreiche Staging-Test endet auf der Quelle. Die Fehlerszenarien health-failure und error-spike werden in getrennten,
frischen Läufen geprüft. Alle Belege müssen denselben basePlanHash und Adapterstand haben.

Der Controller hat keinen Produktionsbefehl. Jede Ausgabe enthält productionApproved:false.
Eine SIMULATION_REHEARSAL kann keinen Live-Dry-Run ersetzen. Keine automatische Übernahme lokaler Modell-Fixtures als App-Nachweis.

## Live-Adapter: vor Ausführung noch zu implementieren und unabhängig zu prüfen

Der Zielanbieter ist offen. Deshalb enthält dieser Stand keinen erfundenen universellen Provider-Adapter.
Ein lokal geprüfter ESM-Adapter exportiert createAdapter({plan}), origin:'live', capabilities und untenstehende Methoden.
Der CLI prüft SHA-256 des Adapter-Einstiegs vor Import; **auch alle transitiven Abhängigkeiten und Konfigurationen müssen
im Review/Lockfile gebunden sein**. Ein Hash ersetzt kein Code-Review. Adaptercode ist vertrauenswürdiger Betriebscode.

~~~sh
node scripts/staging-migration.mjs stage-dry-run staging.json /secure/evidence/dry.json adapter.mjs ADAPTER_SHA256
node scripts/staging-migration.mjs stage-run staging.json /secure/evidence/live.json adapter.mjs ADAPTER_SHA256 /secure/evidence/dry.json
~~~

Dry-Run ausschließlich lesend: inspect prüft tatsächliche Projekt-/Service-/Datenbankbindung, Images, Labels und
synthetische Isolation; compatibility liest zuvor erzeugte, unveränderliche App-Kompatibilitätsnachweise mit suiteSha256.
Es wird weder ein Container ausgerollt noch Traffic geändert. Ein passender Dry-Run-Beleg verfällt nach 15 Minuten.
Belege/Journale gehören in einen zugriffsbeschränkten, nach Erstellung unveränderlichen Evidenzspeicher.
Die lokale Hash-Kette erkennt versehentliche Änderungen, ist ohne extern gesicherten Schluss-Hash **keine Signatur**.

Adaptervertrag (keine Methoden dürfen rohe Providerfehler/Secrets/Personendaten in Belege schreiben):

- inspect: tatsächliche projectId, databaseId, sourceRevision, targetRevision, beide Artifact-SHA256,
  environment:'staging', stagingLabelVerified, syntheticDataOnly, productionDataCopied:false, serviceBindingVerified,
  sourcePercent, targetPercent, writeAuthority:'source', origin:'live'. Vorbereiteten Kandidaten ohne öffentlichen Traffic prüfen.
- compatibility: origin, suiteSha256, sourceSchema, targetSchema und belegte
  oldReadsNewWrites, newReadsOldWrites, oldWritesPreserveNewFields, rollbackWritesSurvive.
  Gegen beide echten Images an isoliertem Firebase ausführen; synthetische Belege nicht umetikettieren.
- acquireLease/releaseLease: release liefert origin und released:true; dauerhaftes exklusives Lease mit monotonem Fencing-Token, TTL/Erneuerung und Besitzerprüfung.
  Mutationen prüfen Lease UND erwarteten Providerzustand atomar/CAS; keine ungesicherte read-then-write-Sequenz.
- setTraffic({percent,lease,commandId,signal}): nur explizite immutable Revisionen,
  exakt 100-percent/percent, vorhandene fremde Traffic-Änderungen zurückweisen.
  Operation auspolling bis tatsächliche Konvergenz; anschließend unabhängige Zustandsabfrage.
  Ergebnis origin, sourcePercent, targetPercent, writeAuthority, fenceVerified:true.
- observe: frisches, nicht überlappendes Fenster mit origin, revision, startMs, endMs, requests, errors,
  p95Ms, healthy, ready. Explizite synthetische Last durch den Router; keine prozesslokale Metrik als Fleet-Metrik ausgeben.
  Wiederholte Leseaufrufe liefern neue Fenster, keine gecachten Command-Antworten.
- injectFault: ausschließlich den isolierten Kandidaten beeinträchtigen; überprüfbarer synthetischer Fehler/Healthcheck-Failure.
  Niemals Firestore, Auth oder die Quell-Runtime beschädigen.
- probeRollback: alte Revision DIREKT vor und nach Rückschaltung prüfen: origin, healthy, ready, dataSafe.
  Datenprüfung umfasst erfolgreiche Writes beider Runtimes, Löschmarkierungen und keine doppelten Nebenwirkungen.
- rollback: Fault entfernen, Quelle auf 100%, Kandidat auf 0%, laufende Requests geordnet drainen;
  Ergebnis origin, Prozente, writeAuthority:'source', unacknowledgedWrites:0, parity:true, tombstonesPreserved:true.
  Bereits bestätigte Writes dürfen nicht durch Backup-Restore verloren gehen.

Alle Methoden respektieren AbortSignal und liefern erst nach verifiziertem Abschluss.
Mutationen sind über commandId wiederholungssicher; nach Timeout **keine blinden Wiederholungen**.
Providerzustand und Operations-ID zuerst durch einen Operator abgleichen; Traffic/Lease nicht ohne Klarheit freigeben.
Das Journal schreibt und synchronisiert COMMAND_INTENT vor jeder Mutation.
Capabilities: fenced-lease, conditional-routing, per-revision-windows, identity-attestation,
n-minus-one-fixtures, rollback-probe, synthetic-fault-injection.
Ein bloßes true im Adapter beweist nichts: dessen Implementierung und externe Evidenz müssen geprüft werden.

## Trigger und Rückweg

Die Beispielschwellen sind **Vorschläge**, keine genehmigten Betriebs-SLOs:

| Trigger | Beispiel | Aktion |
|---|---|---|
| Readiness | einmal false | Sofort Rollback-Probe und Rückschaltung |
| Health | 3 aufeinanderfolgende fehlgeschlagene Fenster | Rückschaltung |
| Fehlerquote | >5% | Rückschaltung |
| Anstieg zur Baseline | >1 Prozentpunkt | Rückschaltung |
| P95 | >300 ms | Rückschaltung |
| Metrik fehlt/zu alt/zu wenig Last/falsche Revision | <100 Requests, Fenster <60s oder >120s alt | Kein weiteres Ramp-up; bei bekanntem Zustand Rückschaltung |
| N-1/Isolation/Digest vor Start ungültig | jede Abweichung | Keine Mutation |
| Provider-Timeout/unklarer Abschluss | jede unklare Mutation | Stop, Lease nicht aktiv freigeben; manuelle Zustandsklärung |
| Alte Runtime oder Datenprüfung unsicher | Probe false | Keine blinde Rückschaltung; Incident/Containment |

Der Hosting-Router muss alte Verbindungen, WebSockets/Streaming, Keep-alive, DNS-/CDN-Caches und Session-Affinität berücksichtigen.
TTL vorab senken allein garantiert keine Unterbrechungsfreiheit. Router/Provider müssen atomare gewichtete Umschaltung,
Verbindungsdrain und einen beobachtbaren Rückweg unterstützen; sonst ist die Zero-Downtime-Anforderung für diesen Anbieter nicht belegt.
Webhooks/Jobs dürfen nicht doppelt aktiv werden; Single-Leader oder transaktionale Idempotenz erforderlich.
Auth Authorized Domains, CORS/CSP, Redirects, Secret-Zugriff und Egress zu Firebase explizit testen.
RTO und zulässiger Requestverlust sind vorab zu genehmigen und im Live-Lauf zu messen; noch keine Zahlen zugesagt.
Bei gemeinsamem Firebase ist die beabsichtigte Daten-RPO=0, aber erst der Live-Schreibtest kann dies belegen.

Rollback-Reihenfolge:
1. Ramp-up/Jobs stoppen, Incident-ID und letzten bestätigten Zustand sichern.
2. Quelle separat auf Health/Readiness/Auth/Firestore und Datenkompatibilität prüfen.
3. Bei sicherem Zustand per gefenctem CAS Traffic zu Quelle100/Kandidat0 zurückstellen; Fault entfernen.
4. Bestätigte Schreib-IDs/Idempotenz/Löschungen und laufende Verbindungen prüfen; keine Datenbank zurücksetzen.
5. Mehrere volle gesunde Fenster durch den Router sowie direkt zur Quelle messen.
6. Erst dann Lease lösen, Schluss-Hash extern sichern und Ergebnis als verifiziert oder NO-GO dokumentieren.
Der aktuelle Controller liefert den Staging-Rahmen; der Adapter muss Drain-/Daten-/Messfenster-Nachweise tatsächlich umsetzen.

## DSGVO und Freigaberegister

Technische Vorgaben: nur synthetische Daten; Least-Privilege und getrennte Service-Identitäten;
keine Tokens, E-Mail, IP, Profile, Requestpfade oder Payloads im Migrationsjournal;
nur aggregierte Metriken und technische Digests. Belege nicht in Git/öffentliche CI-Artefakte laden.
Vorgeschlagene Aufbewahrung 7 Tage (Manifest maximal30), ACL, Löschung mit protokollierter Fristkontrolle.
Das Skript löscht Belege nicht automatisch: Aufbewahrungs-/Löschjob ist vor Live-Start einzurichten.
Providerregion, Auftragsverarbeitung, Unterauftragsverarbeiter, etwaige Drittlandtransfers/TOMs,
Verzeichnis der Verarbeitung und ggf. DSFA müssen nach Zielauswahl geprüft werden.
reviewReference bindet die vorhandene fachliche Freigabe; ein erfundener Wert ist keine Freigabe.

| Nachweis | Status |
|---|---|
| Zielanbieter / Routing-/CAS-/Drain-Fähigkeiten | OFFEN |
| Isoliertes Hosting + Firebase-Projekt/DB/IAM/Secrets | OFFEN |
| Reale Quell-/Kandidaten-Digests und App-N-1-Fixtures | OFFEN |
| Datenschutz-/Region-/AVV-/Transfer- und Evidenzlöschfreigabe | OFFEN |
| Adapterimplementierung + Review inkl. Abhängigkeiten | OFFEN |
| Lokaler Controller-/Referenzmodell-Test | 26/26 PASS unter Node 24.22.1; kein Live-Beleg |
| Lesender Live-Staging-Dry-Run | NICHT AUSGEFÜHRT |
| Live-Staging: happy-path und beide Fehlerdrills | NICHT AUSGEFÜHRT |
| Gemessene RTO/RPO, Session-/Drain-/Job-Tests | OFFEN |
| Produktionsfreigabe | **NO-GO** |

Erst nach vollständiger Staging-Evidenz kann ein separater Produktionsplan zur Freigabe vorgelegt werden.

## Primärquellen

- [Cloud Run: Traffic und Rollback](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration):
  Umschaltungen sind nicht instantan; Rollback prüft Abhängigkeiten/Health nicht erneut.
- [Cloud Run Session Affinity](https://docs.cloud.google.com/run/docs/configuring/session-affinity):
  best effort; Verteilung allein ist kein Session-Nachweis.
- [Firestore Transaktionen](https://firebase.google.com/docs/firestore/manage-data/transactions):
  atomare Schreibvorgänge im Transaktionsbereich; Callbacks können wiederholt werden.
- [Cloud Run Service API](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services):
  etag, Trafficzustand und Reconciliation für einen späteren Cloud-Run-Adapter.

