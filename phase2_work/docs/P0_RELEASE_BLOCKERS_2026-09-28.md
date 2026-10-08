## Current authoritative release status — 1 October 2026

**Production release remains NOT confirmed.** This section supersedes all older same-day release-status sections below while preserving them as historical evidence.

- Current technical baseline: `main@6eb37a86` after PR #124.
- The complete current-main code/security boundary series tracked in issue #27 is merged and exact-head validated. No pull requests remain open.
- PR #121 restored the High/Critical npm-audit gate for the newly published `basic-ftp` advisory without weakening audit policy.
- PR #122 and PR #124 completed the remaining journal-audio and Smart-Audit boundaries with Enterprise CI, Documentation and Playwright passing before merge.
- Repository-level technical green status does **not** close the external release gates below: real load/cost/SLO and business approval, restore/rollback drill evidence, secret rotation/alert delivery, manual accessibility validation, and enforced independent release governance remain required.
- Existing scripts/evidence schemas are validators and harnesses only; synthetic or placeholder evidence must not be treated as production proof.

## Authoritative post-merge release status — 1 October 2026

**Production release remains NOT confirmed.** This section supersedes older same-day dependency/CI blocker statements below while preserving them as historical evidence.

- Security/dependency baseline is merged and validated: PR #96 removed all high/critical npm-audit findings without exceptions; current audited counts are root full 1 low + 11 moderate, root production 1 low + 5 moderate, Functions production 2 moderate.
- Vitest 5 (PR #55) and Vite 8.3.1 (PR #56, coordinated with esbuild ^0.28.2 and Rolldown chunking) are merged and have passed Enterprise CI, Documentation/PR validation and Playwright evidence. Prior notes that these PRs are blocked are historical and no longer current.
- Current stack-recovered baseline is `main@b864e3a9`. The preceding `main@250550c1` passed post-merge Enterprise CI and Playwright with 109 Vitest files and 21 Playwright tests; PR #100 then passed Enterprise CI, Documentation and Playwright before merge, and its post-merge main gates are being verified.
- Manual-merge audit found exactly one stack propagation defect: PR #81 merged into the #74 feature branch rather than `main`. PR #100 restored that missing feedback delta plus the profile/recommendations extraction, passed all three exact-head gates, and was merged to `main` as `b864e3a9`.
- Repository-level technical green status does **not** close the external P0 evidence below: provider/cloud acceptance, production IAM/retention, real load/cost/SLO, restore/rollback, secret rotation/alert delivery, manual accessibility validation and independent release governance still require their own signed evidence.

## Update 1 October 2026 — security baseline and dependency PR status

**Production release remains NOT confirmed.**

- PR #96 has a candidate dependency resolution that passes the high-severity security gate without an exception or threshold reduction. It scopes the temporary gRPC override to `@firebase/firestore@4.17.2` only and resolves the affected nested `@grpc/grpc-js` to patched 1.13.6.
- Measured candidate audits: root full 12 findings (1 low, 11 moderate, 0 high/critical); root production 6 (1 low, 5 moderate, 0 high/critical); Functions production 2 moderate (0 high/critical). Exact-head CI remains mandatory after every dependency/documentation change.
- PR #55's Vitest 5 matcher-type migration has been repaired and its Documentation/Playwright checks pass. PR #44 (ESLint 10) and PR #56 (Vite 8) remain intentionally unmergeable until their peer/toolchain dependencies are upgraded compatibly; no `--force` or `--legacy-peer-deps` bypass is accepted.
- These dependency improvements do not close the external production-evidence gates below: protected-main/independent review, provider/cloud acceptance, real load/cost/SLO evidence, restore/rollback drills, IAM/secret-rotation/alert delivery, and manual accessibility validation remain required.

## Update 29 September 2026 — integration and governance evidence

**Production release remains NOT confirmed.**

- PR #51 is merged by squash to `main` as `ca7b6c15970e7875e95fa3e840f3786b229b4d76` after clean mergeability and green application, browser and documentation checks.
- The five commits unique to former PR #52 were isolated against the #51 head and reproduced as the exact final 86-file delta on current `main`, without deletions or renames. The clean replacement is PR #58 (`feat/global-readiness-2026-09-29-rebased`); #52 is superseded.
- Repository governance is not yet enterprise-enforced: GitHub returns HTTP 403 when branch protection is requested for this private repository on the current plan, with the requirement to upgrade to GitHub Pro or make the repository public. Until protected `main`, required successful checks and independent review (or an explicitly approved equivalent control) are demonstrably enforced, this gate is open.
- Vitest 5 / PR #55 is explicitly blocked: refreshed CI fails TypeScript and TypeDoc because `toBeInTheDocument`, `toHaveAttribute`, `toHaveTextContent` and `toHaveNoViolations` matcher typings are not available under the new major version. Vite 8 / PR #56 and lint/type PR #44 are also blocked by current-base merge conflicts and prior red CI. No red or conflicted dependency PR is part of the release baseline.
- The remaining production gates in this document are evidence gates, not checklist assumptions. They may be closed only with provider/cloud/runtime/manual-test artifacts that identify environment, date, responsible reviewer and result.

# P0-Umsetzung und Freigabenachweise — 28.09.2026

**Produktionsfreigabe: NICHT bestätigt.** Dieses Dokument ergänzt den [Audit-Bericht](AUDIT_2026-09-28.md). Grundlage ist die bereitgestellte Arbeitsmappe `Klar Dating - Ideen & Feature Backlog(2).xlsx`, Blatt `Ideen-Backlog`, mit 46 Epics, davon 17 P0-Epics. Die Bewertungen der Arbeitsmappe sind Anforderungen, keine Prüfbelege. Das zweite Blatt mit Vorschlägen und `Sheet2` wurden ebenfalls abgeglichen.

Vollständig grüner P0-Stand: `f3120329a07abd2948bccfaa0c3df64dbef22a4a` in PR #52: 592 Vitest-Tests in 93 Dateien, 18 Playwright-Tests sowie Enterprise- und Dokumentationspipeline erfolgreich. Nachfolgende Recovery-Änderungen erhalten eigene CI-Nachweise.

## Rückverfolgbarkeit der 17 P0-Epics

| Excel-ID | Thema | Befund und nächster Freigabenachweis |
| --- | --- | --- |
| 2 | Connected Data Stores / RAG | Kein zusätzlicher produktiver Datenexport eingerichtet. Zweck, Zugriff und Kosten vor einer neuen Kopie des Repositories freigeben. Kein notwendiger Laufzeitpfad der Dating-App. |
| 4 | Vollständige i18n | Typsichere vier Kataloge und Persistenz vorhanden. Neue KYC-, Vertrags-, Onboarding- und Musikwege lokalisiert; Serverübersetzungen jetzt ohne Browser-/React-Initialisierung. Vollmigration der Bestandsoberflächen weiterhin offen. |
| 6, 12, 41, 42 | Didit / Biometrie | V3-Sitzungsstart, vollständige HMAC-V2-Prüfung, Replay-Schutz, Sitzungsbindung und transaktionale Deduplizierung implementiert. Reale Sandbox-/Live-Abnahme und freigegebene Datenschutzhinweise fehlen. |
| 7 | DSGVO / DSA | Dauerhafter Löschauftrag, sofortige Zugriffssperre, Anbieterbereinigung, Wiederaufnahme und abschließender zweiter Durchlauf implementiert. DSA-Verfahren, Aufbewahrungsfristen und produktiver Scheduler-Nachweis bleiben eigenständige Gates. |
| 10 | KI-Kosten | Bestehende Firestore-Budgetreservierung und Output-Limits. Reale Eurobudgets, Lastmessung und freigegebene Cache-Strategie nicht nachgewiesen. Kein unbelegtes Redis-Einsparversprechen. |
| 11, 21 | CI / Qualitätsgates | Bestehende gepinnte Pipeline erweitert um KYC-, Vertrags- und Löschtests. Neue Ergebnisse unten nachtragen. |
| 13 | Magic-Link / Recovery | Nicht erreichbare Link-Verarbeitung gefunden und durch ein Gate im tatsächlichen App-Einstieg ersetzt. Explizite E-Mail-Eingabe auf anderem Gerät, keine E-Mail-Übernahme aus URL, SDK-Deduplizierung und lokalisierter Dialog mit Fokusführung. Neue SDK- und Browserregressionen; produktive Auth-Domain-/Mailkonfiguration separat abnehmen. Zusätzlich erkannte fremde UID-Anforderung und simulierte Versandbestätigung im Verifikationsmail-Endpunkt entfernt. |
| 19 | Frankfurt-Region | Drei Functions einschließlich Compliance-Scheduler explizit `europe-west3`; Compile-/Metadatengate prüft alle Exporte. Produktive Region und Datenresidenz separat nachweisen. |
| 20 | Analytics | Bestehende Einwilligungsprüfung, striktes Schema und Prozesslimit. Mehrinstanzbetrieb benötigt verteiltes Limit oder vorgelagerten Schutz. |
| 29 | Red-Flag-Moderation | Bestehende Funktionen sind keine nachgewiesene Missbrauchserkennung. Qualitätsdatensatz, Fehlalarmprozess, Beschwerdeweg und Kostenmessung offen. |
| 35 | BGB Kündigung / Widerruf | Öffentliche Formulare ohne Login und JavaScript, getrennte Erklärungen, Datum/Uhrzeit, Textdownload, atomarer Eingang und Mail-Outbox. Automatische Stripe-Kündigung für eindeutig authentifizierte Aufträge; öffentliche Zuordnung und Erstattungsentscheidung benötigen Bearbeitung. Kein pauschaler Ausschluss nach 14 Tagen. |
| 36 | Offline-Queue | Kein neuer Vollständigkeitsnachweis für IndexedDB-Replay, Kontowechsel und Idempotenz. |
| 37 | PII vor LLM | Datenminimierung und Einwilligung vorhanden; flächendeckende Erkennung von E-Mail, Telefon und IBAN noch gegen alle KI-Eingänge nachzuweisen. |

## Didit: Vertrag und Betrieb

- `POST /api/kyc/start`: authentifiziertes, volljähriges Konto, ausdrückliche Zustimmung und exakt aktuelle Hinweisversion. UID kommt ausschließlich aus dem geprüften Firebase-Token. Höchstens drei Starts je Konto/UTC-Tag, Firestore-Lease gegen konkurrierende Starts. Provider-Timeout acht Sekunden, keine automatische Wiederholung eines ungewissen POST. Didit dedupliziert laufende Sitzungen über Workflow und `vendor_data`.
- `POST /api/webhooks/didit`: JSON maximal 256 KiB. Nur HMAC-SHA256 `X-Signature-V2`, konstanter Signaturvergleich, rekursiv kanonische JSON-Darstellung, maximal fünf Minuten Zeitabweichung und Bindung an den signierten Body-Zeitstempel. Keine Übernahme unsicherer `Simple`-Signaturen. Prüfung von Anwendung, Umgebung, Workflow, Workflow-Version, Sitzungs-ID und gespeicherter UID. Wiederholungen über `event_id`; veraltete Ergebnisse dürfen keine neuere Ablehnung überholen.
- Ein Badge wird nur bei bestätigtem Gesamtergebnis **und** bestätigten V3-Arrays für Ausweis, Liveness und Face-Match vergeben. Ein Redirect oder ein vom Browser gelieferter Status genügt nicht. Webhooks nach einem Löschauftrag schreiben keine personenbezogenen Ereignisse mehr. Datenbankausfälle liefern 503, damit Didit wiederholt.
- App-seitig werden weder Ausweiskopien, Gesichtsaufnahmen, Rohentscheidungen noch Sitzungszugangs-URLs gespeichert. Private Sammlungen `kyc_accounts`, `kyc_sessions`, `kyc_events` sind für direkte Clientzugriffe gesperrt. Dies ist keine Behauptung, Didit selbst speichere keine biometrischen Daten.
- Aktivierung nur mit `DIDIT_ENABLED=true` und allen Variablen aus `.env.example`, einschließlich `DIDIT_PRIVACY_NOTICE_URL` und `DIDIT_PRIVACY_NOTICE_VERSION`. Vorher AV-Vertrag, Rollen, Datenresidenz, Löschfristen, Rechtsgrundlagen und veröffentlichte Hinweise fachlich prüfen. Der bisherige allgemeine Rechtstext-Platzhalter reicht dafür nicht.
- Konsole auf V3-Ereignisse `status.updated` und `data.updated` konfigurieren. Signierte Sandbox-Fälle einschließlich Ablehnung, unvollständiger Prüfungen, Duplikaten und Ausfall nachweisen. Ausgefallene Lieferungen über die Konsole abgleichen; vollständige automatische Reconciliation ist noch offen.

## Kündigung und Widerruf

Die Pfade `/vertraege/kuendigen` und `/vertraege/widerrufen` werden vor SPA, Anmeldung und Altersprüfung serverseitig ausgeliefert. Sie enthalten getrennte Bestätigungsschaltflächen, Vertrag/Identität/Kontakt, Kündigungsart und gewünschten Zeitpunkt. Fehlt der Zeitpunkt, dokumentiert die Erklärung den frühestmöglichen Termin. Außerordentliche Kündigungen verlangen einen Grund. Die Formulare und Bestätigungen sind in DE/EN/ES/FR verfügbar; der Textdownload enthält die übermittelte Erklärung und den serverseitigen UTC-Eingang.

`contract_requests/{requestId}` speichert Erklärung und Mail-Auftrag in derselben Transaktion. Derselbe Schlüssel mit anderem Inhalt ergibt 409. Der öffentliche Weg bestätigt keine Existenz eines Kontos und kündigt keine fremde Subscription anhand erratener Vertragsdaten. Solche Aufträge bleiben `review_required`, bis die Zuordnung sachlich bestätigt ist. Authentifizierte Bestands-API-Aufträge können über die gespeicherte Stripe-Kunden-/Subscription-Bindung verarbeitet werden. Stripe-Ausfälle bleiben wiederholbar; erst die Provider-Antwort erlaubt `completed`.

SendGrid wird unmittelbar nach der Eingangsspeicherung versucht und über einen Lease gegen gleichzeitigen Versand geschützt. 202 wird als **vom Anbieter angenommen**, nicht als nachgewiesene Zustellung gespeichert. Bei einem Verbindungsabbruch zwischen Versand und Statusspeicherung ist eine doppelte Bestätigung möglich; ein Exactly-once-Versprechen wird nicht gegeben. Produktionsnachweis: freigegebener Absender, erfolgreiche Zustellung, Überwachung ungesendeter Bestätigungen und verbindliche Bearbeitung öffentlicher Zuordnungsfälle. Erstattungen werden nicht allein durch einen Queue-Eintrag als erfolgt angezeigt; Finanzfreigabe und Providerabgleich sind noch offen.

## Kontolöschung und Wiederaufnahme

`POST /api/account/delete` verlangt eine höchstens fünf Minuten alte Anmeldung. Ein dauerhafter `account_deletions/{uid}`-Auftrag und die Entfernung aus öffentlichen Vorschlägen werden atomar geschrieben. Die Antwort ist 202 mit Aktenzeichen, **keine abgeschlossene Löschung**. Firebase-Konto und Refresh-Tokens werden gesperrt. API-Authentifizierung prüft widerrufene Tokens und den Löschmarker; Firestore-Regeln blockieren direkte Zugriffe. Chattransaktionen und Archivierung prüfen auch den Löschmarker des Gegenübers. Moderationsentscheidungen können kein gelöschtes Konto mehr neu anlegen.

Der Worker kündigt gebundene Stripe-Abos, entfernt Didit-Sitzungen seitenweise anhand des exakten `vendor_data`-Filters und fordert dabei ausdrücklich `privacy_erasure` sowie `retain_face_embeddings=false`. Anschließend löscht er den Didit-Nutzer einschließlich verbliebener Templates. Nicht bestätigte Providerlöschungen bleiben offen. Die lokale Kaskade ist wiederholbar und umfasst Profilunterkollektionen, Chats/Archiv/Gate-Antworten, beidseitige Verknüpfungen, Fotos, Analyse- und KYC-Daten. Große Meldungsbestände werden in Batches verarbeitet. Ein Lease schützt vor Doppelverarbeitung.

Nach dem ersten Durchlauf werden mindestens 61 Minuten abgewartet. Der zweite Durchlauf beseitigt späte Schreibzugriffe und Uploads mit noch nicht abgelaufenen Storage-Tokens. Erst danach wird der Auftrag abgeschlossen. Abgeschlossene Marker erhalten `expiresAt` nach 30 Tagen; fehlgeschlagene Aufträge erhalten keine Ablaufzeit. Produktiv muss die TTL aktiviert und getestet werden. Rechnungs-/Vertragsnachweise, DSA-Daten, Backups und externe Logs erfordern gesonderte, fachlich freigegebene Aufbewahrungsentscheidungen; sie werden nicht pauschal als vollständig gelöscht bezeichnet.

## Scheduler, Betrieb und TCO

`retryComplianceJobsCron` läuft in Frankfurt alle fünf Minuten, mit einer Instanz und begrenzten Abfragen. Er ruft `/internal/compliance/drain` mit zeitgebundener HMAC-Signatur auf. `COMPLIANCE_JOB_SECRET` muss als dasselbe mindestens 32 Zeichen lange Secret-Manager-Geheimnis in API und Function vorliegen; `COMPLIANCE_API_ORIGIN` muss exakt dem HTTPS-Origin entsprechen. Ohne Origin erfolgt keine Arbeit. Es werden keine Cloud-Run-Hintergrundtimer vorausgesetzt.

Abnahme vor Produktion: Scheduler erfolgreich ausführen; anstehende/fehlgeschlagene Lösch- und Vertragsaufträge überwachen; Alarm und Verantwortlichen für Rückstand und `review_required` benennen; Wiederaufnahme nach Prozessabbruch belegen. Pro Lauf maximal zwei Kündigungs-, drei Mail- und ein Löschauftrag. Die Kapazität ist eine TCO-orientierte Ausgangskonfiguration und muss zur gemessenen Last passen. Kein behauptetes Produktions-SLO ohne Last-/Wiederherstellungstest.

Lokale Nachweise dieses Inkrements: vollständiger TypeScript-Lauf; Signatur-/Erasure-Grenztests; Functions-Build und Regionsprüfung; Produktionsbuild und unveränderte Bundle-Grenzen. Firestore-Transaktionen, Regeltests und Browserfälle benötigen den CI-Emulatorlauf. Dieser Arbeitsbereich kann die Java-Emulatoren nicht zuverlässig starten. Erster neuer Lauf `0d79dec`: 18 Playwright-Tests und Dokumentationspipeline erfolgreich. Vitest: 589 bestanden, ein alter Löschtest fehlgeschlagen (fehlende aktuelle Anmeldezeit und veraltete Erwartung einer sofortigen Löschung). Der Test wurde auf 202-Auftrag, sofortige Kontosperre und zweite Bereinigung eines verspäteten Uploads erweitert. Der erneute vollständige CI-Lauf am Commit `f312032` bestand alle 592 Tests; Browser-CI bestand 18 Tests ohne Wiederholungen.

Das Onboarding erhebt keine zweite optionale E-Mail mehr: Diese Eingabe wurde zuvor vom übergeordneten Abschluss ignoriert, während die Oberfläche eine Kontosicherung versprach. Stattdessen erklärt der letzte Schritt die tatsächlich persistierten Interessen und Musikpräferenzen. Übersetzungen verändern weder gespeicherte Interessen- noch Genrekennungen; hierfür gibt es einen separaten Regressionstest.

## Offizielle Referenzen

- [Didit V3-Sitzungsablauf](https://docs.didit.me/integration/api-full-flow), [Webhooks und Signaturen](https://docs.didit.me/integration/webhooks).
- [Didit-Sitzungen auflisten](https://docs.didit.me/sessions-api/list-sessions), [Sitzung/biometrische Daten löschen](https://docs.didit.me/sessions-api/delete-session), [Nutzer löschen](https://docs.didit.me/management-api/users/delete).
- [BGB, insbesondere §§ 312k und 356a](https://www.gesetze-im-internet.de/bgb/BJNR001950896.html), abgerufen am 28.09.2026. Die technische Umsetzung ersetzt keine fachliche Einzelfallprüfung.
- [Stripe-Idempotenz](https://docs.stripe.com/api/idempotent_requests), [Subscription-Änderungen](https://docs.stripe.com/api/subscriptions/update), [Erstattungen](https://docs.stripe.com/api/refunds/create).

Die offiziellen Betriebsvoraussetzungen, vollständige i18n, Rückstandsbearbeitung, Anbieterabnahmen, manuelle WCAG-Prüfung, Last-/Restore-Nachweise und eine dokumentierte Freigabe durch die verantwortliche Stelle bleiben offen. Ein grüner Build allein bestätigt keine Produktionsfreigabe.
