# PR #360 — Systemweite Remediation, 08.11.2026

Status: **Source verifiziert: 1.692 Hauptsuite-Tests PASS. Produktion NO-GO, Dual Sign-Off ausstehend.** Ausgangspunkt: Audit von `0e2c7e89fad3008f6d165c2b45ac1e936506043a`.

## Medien und Kontosperren

Profilbilder werden als rohe JPEG/PNG/WebP-Daten an `POST /api/media/profile` übertragen. Das Backend prüft Firebase-ID-Token mit Revocation-Check, registrierten Provider, autoritativen Erwachsenen-/Medienstatus und Lösch-/Sperrmarker. Es speichert ohne Firebase-Download-Token und veröffentlicht ausschließlich `/api/media/profiles/{uid}/{file}`. `GET` prüft Anfragenden und Eigentümer vor der Metadatenabfrage und erneut vor dem Stream-Start; Antworten sind `private, no-store` und `nosniff`. Downloads sind an die geprüfte GCS-Generation gebunden und verwenden Streaming/Backpressure. Maximal vier Uploads pro Instanz werden vor dem Raw-Parser zugelassen; ein Client-Abbruch gibt ihren Slot erst nach Ende der Backend-Operation frei. Das begrenzt den gepufferten Speicherbedarf und ergänzt die gemeinsamen Quoten.

Alle aktiven Bild-Komponenten verwenden `ProtectedImage`: Authorization-Header über `authFetch`, Abort bei Sessionwechsel, Freigabe lokaler Blob-URLs bei Logout/Unmount. Legacy-Firebase-URLs des konfigurierten Buckets werden ohne Token in API-Pfade übersetzt. Öffentliche Profilprojektionen verteilen ebenfalls keine alten Bearer-URLs mehr. Storage Rules verweigern direkte Profil-Reads sowie direkte Profil-/Verifikations-Uploads. Auch ein reiner Metadaten-Read oder Upload kann Firebase-Capabilities erzeugen; deshalb reicht das Entfernen von `getDownloadURL` im UI allein nicht.

DSA-Sperre/-Beendigung schreibt `active=false`, `mediaAccessState=blocked`, `account_locks/{uid}` und einen versionierten `account_security_jobs/{uid}`-Auftrag im selben Firestore-Commit. Backend und Firestore Rules prüfen den langlebigen Sperrmarker sowie ältere kanonische `active=false`-Sperren. Bei einem Backend-Aufruf wird eine solche Altsperre atomar in Fence/Retry-Auftrag überführt, ohne die ursprüngliche DSA-Entscheidung oder ihre Beschwerdefrist neu auszustellen. Ein vollständiges Betreiberinventar der Altsperren bleibt vor Freigabe erforderlich. Disable und Refresh-Token-Revocation werden unabhängig versucht. Native Storage-Capabilities werden ebenfalls widerrufen. Ein fehlgeschlagener Schritt lässt Fence und Job bestehen. Der bestehende signierte 5-Minuten-Compliance-Scheduler wiederholt fällige Jobs mit Lease/Versionsschutz; ein alter Worker darf keinen neueren Auftrag quittieren. Die Aufhebung einer DSA-Entscheidung erzeugt einen eigenen Enable-/Revocation-Auftrag; die Fence verschwindet erst nach bestätigtem Erfolg und erneuter Prüfung auf Löschaufträge.

`mediaCapabilities.ts` entfernt alte Tokens mit Metageneration-Precondition und prüft die tatsächlichen Metadaten danach. Backends mit separatem Firebase-Token-Index werden über den nativen administrativen `delete_token`-Endpunkt abgeglichen. OAuth/Admin-Berechtigung ist erforderlich. Emulator-Adminzugang ist ausschließlich bei Loopback und `demo-*` erlaubt. Kein Bearer-Token, Dateiname oder Provider-Body wird protokolliert. Alte Token müssen nach der Operation tatsächlich verschwunden sein; unbestätigte oder konkurrierende Änderungen bleiben Fehler.

**Offenes operatives Gate:** Bereits verteilte produktive URLs werden durch einen Code-Deploy allein nicht ungültig. Der explizit projekt-/bucketgebundene Migrationshelfer `scripts/revoke-media-capabilities.ts` läuft standardmäßig lesend. Beispiel aus `phase2_work/` mit autorisierten Operator-Credentials:

```sh
node --import=tsx scripts/revoke-media-capabilities.ts --project=APPROVED_PROJECT --bucket=APPROVED_BUCKET
# Nach geprüftem Inventar und betrieblicher Freigabe denselben Befehl mit --apply ausführen.
```

Es wurde kein produktiver Apply ausgeführt. Für das Re-Audit werden ein unabhängiges Inventar, Replay-Tests zuvor kopierter URLs, der effektive Cache-Vertrag und die Bestätigung benötigt, dass kein externer Writer neue statische Capabilities verteilt. Bereits rechtmäßig heruntergeladene Kopien sind nicht rückwirkend aus fremden Geräten löschbar. Refresh-Token-Widerruf ist ebenfalls keine nachträgliche Änderung ausgestellter JWT-Signaturen; die aktuellen Zustandsprüfungen je Einstiegspunkt sind maßgeblich.

## Art. 17, Holds und Bild-Purges

Jede destruktive Accounting-Transaktion prüft das Profil und die UID-bezogenen `verification_events`/`verification_requests` auf `legalHold`, `photoPurgeHold` und `retentionHold`. Vorhandene Werte außer literal `false` blockieren, einschließlich mehrdeutiger Daten. Bei 200 gefundenen Metadatensätzen blockiert der begrenzte Scan konservativ und verlangt Inventarprüfung. Auch vor externen Provider-/Abo-Aktionen wird auf Holds geprüft. Die ursprüngliche Hold-Probe bewahrt nun den gehaltenen Datensatz.

Der Worker bleibt bei echten Provider-/Storage-/Auth-Fehlern `pending`, mit exponentiellem, auf eine Stunde gedeckeltem Backoff. Nach 50 Fehlern wird zusätzlich `requiresAttention` gesetzt; automatische Wiederaufnahme bleibt aktiv. Ungültiges altes Accounting bleibt bewusst in manueller Migration, da ein Retry keine sichere Rekonstruktion ersetzt. Keine Abschlussquittung vor bestätigter Auth-Löschung, erneutem Inventarabgleich und verzögertem Final-Sweep. Holds bleiben offen mit festem Fehlercode `legal_hold_review_required`.

Für Verifikationsobjekte existiert ein gesonderter kontobezogener Autorisierungsvertrag statt eines globalen Enable-Flags:

- Aktiver pending Auftrag, passende Request-ID und Lease; mindestens 61 Minuten seit dem Erstellungszeitpunkt für alte Tokens/In-flight Requests.
- Admin-only `account_photo_purge_plans/{uid}` mit passender Request-ID, tatsächlichem Bucket, nicht abgelaufenem Nachweis, `writerFenceVerified=true`, `legalApproved=true` und SHA-256-Evidenzreferenz.
- Genau ein kanonisches Ereignis je Objekt mit passendem Pfad/Bucket/Generation, abgeschlossener Entscheidung und explizit negativen Hold-Feldern.
- Transaktionale Hold-/Lease-Prüfung und Purge-Intent unmittelbar vor der Storage-Operation; GCS-Hold-Prüfung und Generation-Precondition bei der Löschung; wiederholte begrenzte Inventare.

Fehlende/alte Nachweise autorisieren keine Löschung. Der globale altersbasierte Purge und der alte signierte Bulk-Endpunkt bleiben gesperrt. Die neue Autorisierung ist nur ein kontrollierter Account-Erasure-Pfad. Ein lokaler synthetischer Nachweisdatensatz ist keine rechtliche oder produktive All-Writer-Attestierung.

**Offenes operatives Gate:** Nachweise werden nicht durch diese Implementierung automatisch freigegeben. Die DPO-/SRE-Prüfung muss alle Writer und Hold-Änderungen einschließlich externer Admin-Operationen abdecken. Hold-Aktivierung muss Storage-/Firestore-Rennen sicher behandeln; Firestore- und GCS-Transaktionen ergeben zusammen keine ACID-Transaktion. Vor einem produktiven Purge sind entsprechende Staging-Fault-Drills, freigegebene Datentyp-/Hold-Matrix und unabhängige Provenienz erforderlich. Ohne diesen Nachweis bleibt die Verifikationslöschung pending.

`requiresAttention` ist ein maschinenlesbares Eskalationssignal, keine versandte Meldung. Für den Betrieb sind Queue-Monitoring, Zuständigkeit, Reaktionsfrist, DSAR-Deadline und Wiederaufnahme nach Störungsbehebung zu attestieren. Es wurden keine Nachrichten an Dritte verschickt.

## Logging und verteilte Limits

Server-, Browser- und Functions-Einstiegspunkte installieren eine zentrale Ausgabe-Allowlist. Arbiträre Argumente, Error-Objekte, Getter, Stacks, Ursachen, Request-Bodies und Provider-Antworten werden nicht übernommen. Nur feste Ereignisse, feste Methoden und begrenzte numerische Betriebsfelder erreichen Console-Sinks. Die verbliebenen rohen Server-Fehlersenken wurden auf feste Ereignisse umgestellt. Der lokale Browser-Puffer speichert nur minimierte Einträge und wird bei Auth-Wechsel geleert. Sentry-Consent/Minimierung und die OTel-Fehlergrenzen bleiben aktiv.

Alle bisherigen `express-rate-limit`-Instanzen im Backend verwenden jetzt einen gemeinsamen atomaren Firestore-Store mit getrennten Policy-Namespaces: global, AI/Gast-AI, Übersetzung, Kontakte, Verträge, Admin-Health, Analytics und KYC-Status. Ohne Store kein lokaler Fallback: 503. Der Test mit zwei unabhängigen HTTP-Instanzen bestätigt ein gemeinsames Budget. Eine begrenzte Warteschlange serialisiert gleiche Schlüssel innerhalb einer Instanz und verhindert lokale Transaktions-Lock-Stürme; das Budget bleibt vollständig in Firestore. Numerische Proxy-Hop-Zahlen werden abgewiesen; standardmäßig zählt die Socket-IP. Vertrauenswürdige Ingress-CIDRs müssen ausdrücklich konfiguriert werden.

`api_rate_limits` enthält nur gehashte Schlüssel und Zähler/Fristen. Kontobezogene Schlüssel werden im Art.-17-Purge entfernt. Der Compliance-Worker bereinigt zusätzlich abgelaufene Zähler transaktional und begrenzt; konkurrierende Fristverlängerungen werden erneut geprüft. Diese Bereinigung ist kein Nachweis einer produktiven TTL-Policy. Für `api_rate_limits.expiresAt` ist eine separat freizugebende Ergänzung zur historischen 20-Gruppen-Matrix erforderlich; die bestehende genehmigungspflichtige Provisionierung wurde nicht stillschweigend erweitert. Hohe Last erfordert Kapazitäts-/Backlog-Monitoring oder genehmigte native TTL.

**Offenes operatives Gate:** Effektive Cloud-Run-Revisionen, IAM/Invoker/Ingress, WAF/DoS-Konfiguration, Proxy-Netzwerke, Collector-/Sentry-/Cloud-Logging-Empfänger, Regionen und Aufbewahrung sind weiterhin nicht live attestiert. Geschützte API-Routen prüfen Firebase-Tokens; ein zusätzlicher verpflichtender Edge-HMAC-Vertrag wird damit nicht behauptet.

## Regulatorischer Betrieb gesperrter Konten

Ein Firebase-Disable sperrt auch die gewöhnliche Anmeldung und damit die normalen authentisierten Self-Service-Routen. Vor Freigabe muss Legal/Operations die erreichbaren alternativen Kanäle für DSA-Beschwerden und Betroffenenanfragen gesperrter Personen nachweisen. Diese Implementierung akzeptiert dafür keine widerrufenen Session-Tokens und aktiviert gesperrte Identitäten nicht automatisch. Der interne Moderator-Review mit anschließendem versioniertem Enable-Auftrag ist technisch vorhanden; die Erreichbarkeit des vollständigen Beschwerde-/DSAR-Prozesses ist kein hier attestierter Live-Nachweis.

## Revalidierung und Freigabe

Die ehemaligen Audit-Charakterisierungen sind jetzt eingecheckte Regressionstests mit den korrigierten Sicherheitserwartungen. Der 79er-System-Audit-Umfang ist Bestandteil der vollständigen Vitest-Suite. Zusätzliche Tests prüfen Capability-Replay, Auth-Teilausfälle, Lease-/Versionswechsel, explizite und fehlende Purge-Nachweise sowie Blob-Lebensdauer. Bestehende Tests wurden nur bei geänderten Verträgen/Fixtures angepasst: direkte SDK-Zugriffe sind nun verweigert; KYC-Fallback setzt einen funktionierenden gemeinsamen Limiter voraus; der 50-Fehler-Auftrag bleibt wiederholbar.

Verifizierter Runtime-Commit: `f13c736781daaa333040df5a67c1b0ff7b002c6d`. Vollständige [Enterprise-CI](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42532259296): 1.577 Vitest + 86 Enterprise Node + 29 Chromium-E2E = **1.692 PASS**, alle Pflicht-Gates grün. Die 79 Audit-Tests sind darin enthalten; der zusätzliche lokale 116er-Lauf ist ebenfalls PASS. Semgrep: 616 Regeln, 1.176 Ziele, keine Findings/Parserfehler, 698/698 Runtime-Dateien. Typechecks, Functions-/App-Builds, Produktions-Smoke und Produktions-High/Critical-Gate PASS. Maschinenlesbare Nachweise stehen in `SYSTEM_REMEDIATION_EVIDENCE.json` und der `systemWideRemediation`-Sektion beider RELEASE_MANIFEST-Dateien. Überlappende 79er-/Rules-Teilmengen werden nicht zur Gesamtsumme addiert. Kein Scope-Ausschluss, Test-Retry oder SAST-Suppressions-Eintrag wurde zur Erzeugung eines Passes hinzugefügt.

**Audit Release Status: NO-GO.** PR #360 bleibt Draft. Keine produktive Datenänderung, Deployment-, IAM- oder Legal-Freigabe. Erst Code-/Test-Nachweise plus unabhängig geprüfte Betriebsnachweise erlauben die Empfehlung für ein finales Dual Re-Audit.
