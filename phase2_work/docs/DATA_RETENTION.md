# Data Retention & Privacy-by-Design Policy

Diese Richtlinie definiert die strikten Datenlebenszyklen (Time-to-Live / TTL) für das Projekt **Klar**.
Als Dating-App verarbeitet Klar besondere Kategorien personenbezogener Daten (Art. 9 DSGVO). Dem Grundsatz der Speicherbegrenzung (Art. 5 Abs. 1 lit. e DSGVO) wird durch automatisierte Löschroutinen (Firestore TTL Policies) Genüge getan.

## Firestore TTL (Time-To-Live) Konfiguration

Firestore bietet native TTL-Policies. Diese bereinigen Dokumente automatisch, wenn der in einem konfigurierten Timestamp-Feld (`expiresAt`) festgelegte Zeitpunkt überschritten ist.
Die Einrichtung erfolgt nicht über `firestore.rules`, sondern über die Google Cloud Console oder gcloud CLI.

### 1. Konversationsnachrichten (`/chats/{chatId}/messages`)
- **Feld:** `expiresAt`
- **Frist:** 90 Tage nach Erstellung. Jede neue Nachricht erhält den Ablaufzeitpunkt beim Schreiben; dadurch ist die Firestore-TTL tatsächlich wirksam.
- **Setup:** `gcloud firestore fields ttls update expiresAt --collection-group=messages --enable-ttl`

### 2. Archivierte Konversationsnachrichten (`/chats/{chatId}/archived_messages`)
- **Feld:** `expiresAt`
- **Frist:** identisch zur ursprünglichen Nachricht; die Archivierung darf die Löschfrist nicht verlängern.
- **Setup:** `gcloud firestore fields ttls update expiresAt --collection-group=archived_messages --enable-ttl`

### 3. KI-Zwischenspeicher (`/users/{userId}/ki_zwischenspeicher/{id}`)
- **Feld:** `expiresAt`
- **Frist:** 36 Stunden nach Erstellung. Dient ausschließlich der Überbrückung von API-Ausfällen.
- **Setup:** `gcloud firestore fields ttls update expiresAt --collection-group=ki_zwischenspeicher --enable-ttl`

### 4. Fehlgeschlagene Altersverifikationen (`/age_attempts`)
- **Feld:** `expiresAt`
- **Frist:** 24 Stunden nach Erstellung. Dient nur dem Rate-Limiting und der Betrugsprävention (Brute-Force auf das Geburtsdatum).
- **Setup:** `gcloud firestore fields ttls update expiresAt --collection-group=age_attempts --enable-ttl`

### 5. Funnel-/Analyseereignisse (`/funnel_events`)
- **Feld:** `expiresAt`
- **Frist:** 30 Tage. Die Ereignisse werden zusätzlich bei der Kontolöschung personenbezogen entfernt.
- **Setup:** `gcloud firestore fields ttls update expiresAt --collection-group=funnel_events --enable-ttl`

## 6. KI-Budget-Reservierungen (`/users/{userId}/ai_budget`)
- **Feld:** `expiresAt`
- **Frist:** 30 Tage. Abgelaufene Reservierungen dürfen nicht dauerhaft als Kontingentblockade bestehen bleiben.
- **Setup:** `gcloud firestore fields ttls update expiresAt --collection-group=ai_budget --enable-ttl`

## 7. KYC-Webhooks / Deduplizierungsereignisse (`/kyc_events`)
- **Feld:** `expiresAt`
- **Frist:** 30 Tage nach Eingang. Das Event dient nur der Deduplizierung und dem begrenzten Betriebsnachweis; bei Kontolöschung wird es sofort entfernt.
- **Setup:** `gcloud firestore fields ttls update expiresAt --collection-group=kyc_events --enable-ttl`

## 8. Abgeschlossene Löschaufträge (`/account_deletions`)
- **Feld:** `expiresAt`
- **Frist:** 30 Tage nach erfolgreichem Abschluss. Offene und `manual_review`-Aufträge erhalten keine TTL.
- **Setup:** `gcloud firestore fields ttls update expiresAt --collection-group=account_deletions --enable-ttl`

## 9. Gelöschte Konten / Deletion Logs (`/deletion_log`)
- **Inhalt:** ausschließlich aggregierte Löschzähler, Status, Schema-Version und technische Zeitstempel; keine UID, E-Mail, Session-ID, Request-ID oder Provider-ID.
- **Feld:** `expiresAt`
- **Frist:** 30 Tage nach erfolgreichem finalem Kontrolllauf. Schema 2 wird atomar mit dem Abschluss des Löschauftrags geschrieben. Laufende Zähler bleiben im bestehenden `account_deletions`-Auftrag; sie erhalten dessen Aufbewahrung. Ältere Belege werden nicht nachträglich als vollständige Zählung ausgegeben.
- **Setup:** `gcloud firestore fields ttls update expiresAt --collection-group=deletion_log --enable-ttl`

## 10. Verifizierungsfotos (Storage)
- **Feld/Marker:** `verification_events.fotoLoeschenAb` plus `storagePath`.
- **Frist:** 30 Tage nach einer serverseitig dokumentierten Moderationsentscheidung, **nicht** 30 Tage nach Upload. Offene oder ungültige Entscheidungsdatensätze dürfen nicht durch einen Upload-Alter-Scanner gelöscht werden.
- **Entscheidungsbasierter Worker:** `functions/src/purgeVerificationStorage.ts` ruft den signierten API-Endpunkt `/api/admin/purge-verification-storage` auf. Die Route `src/server/routes/complianceStorage.ts` ermittelt fällige `verification_events` und nutzt `src/server/platform/storageRetentionEngine.ts` zur Prüfung von Entscheidung und `decidedAt`, zur Löschung und zur Audit-Aktualisierung.
- **Client-Upload-Lockdown:** Nach Einstellung der alten Gesten-/Fotoverifizierung verweigert `storage.rules` auf `verification/{uid}/{datei}` sämtliche Firebase-Clientoperationen einschließlich **Create/Overwrite**. Nur berechtigte Admin-SDK-Prozesse können Bestandsdaten für Retention/Art. 17 behandeln; Admin-SDK/IAM und signierte URLs sind gesondert zu prüfen. Ob die neuen Rules im Zielprojekt aktiv sind, ist **nicht** nachgewiesen.
- **Legacy-Cron:** `functions/src/deleteExpiredPhotos.ts` war zusätzlich als Scheduler registriert und nutzte früher `deleteExpiredPhotoPage` zum Löschen von `verification/`-Objekten allein anhand `timeCreated`. **P0 #202:** Der neue isolierte Quellpatch deaktiviert nur diesen Upload-Alter-Löschpfad; der Scheduler-Einstiegspunkt bleibt für die bestehende `funnel_events`-Bereinigung erhalten. Weder die tatsächliche Cloud-Bereitstellung noch die Scheduler-Migration sind hiermit bestätigt.
- **Audit:** Der entscheidungsbasierte Pfad aktualisiert nach dem Löschversuch `photoPurged`, `photoPurgedAt` und einen SHA-256-Löschdigest. Vor Produktionsfreigabe sind Storage-Generationsschutz, Holds, Fehlerbehandlung, Retention-Wirksamkeit und Datenschutzfreigabe unabhängig nachzuweisen.

## Security Rules Architektur (Least Privilege)
Die `firestore.rules` (siehe Datei) sind nach dem Prinzip "Default Deny" aufgebaut.
Schreibzugriffe erfolgen fast ausschließlich über den Server (Admin SDK) in Transaktionen, um Idempotenz und Validierung zu garantieren.
Client-seitige Schreibzugriffe sind blockiert (`allow write: if false;`), um Manipulationen von Zählern, Swipes oder Metriken (z.B. Kontingente) unmöglich zu machen.


## Aktivierung und Nachweis

Die Richtlinie ist erst aktiv, wenn die Plattformkonfiguration nachgewiesen ist:

```bash
KLAR_PROJECT_ID=klar-staging-123 KLAR_DATABASE_ID='(default)' bash scripts/configure-retention.sh  # DRY RUN ONLY
# Nur nach unabhängiger Prüfung und dokumentierter Staging-/Legal-/Inventar-Freigabe:
# KLAR_APPLY_RETENTION=true KLAR_ENVIRONMENT=staging KLAR_APPROVED_STAGING_PROJECT_ID=... \
# KLAR_PRODUCTION_PROJECT_ID=... KLAR_CONFIRM_RETENTION='<project>/<database>' \
# KLAR_RETENTION_LEGAL_APPROVED=true KLAR_RETENTION_INVENTORY_APPROVED=true \
# KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19 \
# KLAR_PROJECT_ID=... KLAR_DATABASE_ID=... bash scripts/configure-retention.sh
gcloud firestore fields ttls list --project "$KLAR_PROJECT_ID" --database "$KLAR_DATABASE_ID"
```

Der zweite Befehl muss für alle 20 freigegebenen Collection Groups den aktiven TTL-Zustand zeigen. Der Nachweis wird im Change-Ticket abgelegt. Zusätzlich prüfen automatisierte Tests, dass neue Dokumente ein plausibles `expiresAt` erhalten; ein vierteljährlicher Stichprobentest weist tatsächliche Löschung nach. Legal Holds müssen explizit, zeitlich begrenzt und auditierbar sein.

**Verifikationspflicht:** Die lokale Matrix-Prüfung `node scripts/check-retention-matrix.mjs` sowie ihre Negativtests `node scripts/test-retention-matrix.mjs` prüfen ausschließlich Repository-Code und Dokumentation. TTL löscht nicht sofort und nicht transaktional. Der tatsächliche Status `ACTIVE` aller 20 Gruppen muss in der genehmigten **Staging**-Umgebung mit Projekt- und Datenbankbezug nachgewiesen werden; das Schreiben gültiger `expiresAt`-Zeitstempel, Legal Holds und der sofortige Art.-17-Löschpfad bedürfen gesonderter Emulator-/E2E- und DPO-Prüfung. Ein Staging-Setup ist keine Produktionsfreigabe.

### Kündigungsnachweise nach § 312k BGB

`subscription_events` bleibt als Nachweiskategorie für Kündigungs-/Widerrufsvorgänge erhalten. Die Kündigungs-Request-Dokumente unter `contract_requests` enthalten die Erklärung, den Eingangszeitpunkt, den Verarbeitungsstatus und den Bestätigungsbeleg. **[ANNAHME]** Die konkrete fachliche Aufbewahrungsdauer dieser Vertragsnachweise ist vor Produktionsfreigabe anhand der Vertrags-/Streitvorsorgeanforderungen final zu bestätigen.


## 11. Klar & Partner — Referral-Daten, Ledger und Rate Limits

- **Personalisierte Zuordnungen** (`partner_referrals`) werden bei Art.-17-Kontolöschung gelöscht. Der rohe Referral-Token wird nicht gespeichert; die Dokument-ID ist ein SHA-256-Derivat.
- **Conversion-Claims und signierte Ereignisse** (`partner_referral_conversions`, `partner_referral_buyer_claims`, `partner_referral_ledger`) enthalten keine Drittanbieter-E-Mail, Provider-Kunden-ID, rohe UID, IP-Adresse oder User-Agent. UID-Bezüge sind HMAC-SHA256-pseudonymisiert und werden bei Löschung des jeweiligen Kontos entfernt.
- **Kampagnenverträge und Summenzähler** bleiben als unternehmensbezogene Informationen erhalten. HMAC-Adminreferenzen (`createdByRef`, `updatedByRef`, `verifiedByRef`) werden bei Löschung des Admin-Kontos entfernt. Slugs bleiben reserviert.
- **Kurzlebige Rate-Limit-Zähler** nutzen ein Feld `expiresAt` und ein 60-Sekunden-Fenster. Diese TTL-Policies müssen je Zielumgebung explizit aktiviert werden; das Feld allein aktiviert Firestore-TTL nicht:
  - `gcloud firestore fields ttls update expiresAt --collection-group=partner_referral_click_rate_limits --enable-ttl`
  - `gcloud firestore fields ttls update expiresAt --collection-group=partner_referral_webhook_rate_limits --enable-ttl`
  - `gcloud firestore fields ttls update expiresAt --collection-group=partner_referral_admin_rate_limits --enable-ttl`
  - `gcloud firestore fields ttls update expiresAt --collection-group=partner_referral_user_rate_limits --enable-ttl`
- **Retention offen vor Produktivbetrieb:** Die verbindliche Aufbewahrungsdauer für nicht personenbezogene Kampagnen-/Conversion-Belege muss anhand des Partnervertrags und mit Datenschutz-/Rechtsreview festgelegt werden. Keine TTL für notwendige Vertrags-/Finanznachweise ohne diese Entscheidung setzen.


### Gezielter TTL-ACTIVE-Evidenznachweis (Staging; lesend)

Nach unabhängig genehmigter Aktivierung kann ein berechtigter Reviewer den Status ohne Änderung an Cloud-Daten erfassen und den gespeicherten Nachweis offline prüfen:

```bash
gcloud firestore fields ttls list --project="$KLAR_PROJECT_ID" --database="$KLAR_DATABASE_ID" --format=json > staging-ttl-evidence.json
node scripts/check-retention-active-evidence.mjs --evidence staging-ttl-evidence.json --project "$KLAR_PROJECT_ID" --database "$KLAR_DATABASE_ID"
node scripts/test-retention-active-evidence.mjs
```

Der Prüfer verlangt 13 distinct `expiresAt`-Felder mit `ttlConfig.state=ACTIVE`, exakt zum angegebenen Projekt und zur angegebenen Datenbank. Abweichende, fehlende, doppelte, nicht aktive oder umkonfigurierte Felder verursachen einen Fehler. Die JSON-Datei ist ein **Snapshot**, kein signierter Live-Nachweis; Projektidentität und Zeitpunkt des `gcloud`-Abrufs müssen im Change-Ticket unabhängig attestiert werden. Dieser Check aktiviert keine TTL, ersetzt keine Legal-Hold-/DSGVO-Art.-17-Kaskadenlöschung und autorisiert keinen Produktions-Deploy.

---

## Staging TTL verification (read-only, separate from provisioning)

Use `npm run verify:retention-staging-live` under approved credentials and exactly scoped project/database identity. See `docs/PRODUCTION_RUNBOOK.md` for required `KLAR_*` environment values, fresh private evidence path and independent reviewer procedure. The script only performs `gcloud projects describe` and `gcloud firestore fields ttls list`; it validates all 13 ACTIVE TTL fields and records a JSON SHA-256 with UTC capture time. Unlike `configure-retention.sh`, it never requests any TTL mutation. A passing unit test uses **mock gcloud only**, and no live Staging TTL state is confirmed here. **NO-GO.**


### P0 #70 — 2026-10-19: sieben weitere TTL-Feld-Schreibpfade (20 Gruppen, **noch nicht freigegeben**)

Die Codeprüfung der aktuellen Entwicklungszweige ergab **sieben weitere Firestore-Collection-Groups**, in denen `expiresAt` tatsächlich als Zeitstempel geschrieben wird, die aber nicht in der bisherigen 13er-TTL-Matrix vorkamen:

| Collection-Group | Nachgewiesener Schreibpfad |
| --- | --- |
| `password_reset_rate_limits` | `src/server/passwordReset.ts` |
| `verification_mail_rate_limits` | `src/server/email.ts` |
| `account_deletion_rate_limits` | `src/server/routes/account.ts` |
| `kyc_start_rate_limits` | `src/server/verification/diditKyc.ts` |
| `kyc_reconciliation_events` | `src/server/verification/diditKyc.ts` |
| `chat_message_rate_limits` | `src/server/routes/chat.ts` über `distributedRateLimiter.ts` |
| `chat_gate_answer_rate_limits` | `src/server/routes/chat.ts` über `distributedRateLimiter.ts` |

Entsprechend werden **sieben neue Staging-TTL-Pläne** mit dem Feld `expiresAt` ergänzt (weiterhin standardmäßig **nur Dry Run**):

```bash
# Nur Plananzeige; keine Aktivierung ohne erneute rechtliche/operative Prüfung:
gcloud firestore fields ttls update expiresAt --collection-group=password_reset_rate_limits --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=verification_mail_rate_limits --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=account_deletion_rate_limits --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=kyc_start_rate_limits --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=kyc_reconciliation_events --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=chat_message_rate_limits --enable-ttl
gcloud firestore fields ttls update expiresAt --collection-group=chat_gate_answer_rate_limits --enable-ttl
```

**Neue zwingende Sperre für Staging-Apply:** Zusätzlich zu den vorhandenen Legal-/Inventar-/Projekt-/Datenbank-Gates verlangt `configure-retention.sh` explizit `KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19`. Dieser Wert ist nur ein Marker für eine **außerhalb des Systems separat archivierte, aktuell genehmigte 20-Gruppen-Matrix**; er ist selbst keine rechtliche Freigabe. Alte 13-Gruppen-Genehmigungen dürfen die sieben zusätzlichen Löschregeln nicht aktivieren. Keines der sieben zusätzlichen Felder wurde in Google Cloud aktiviert oder als ACTIVE nachgewiesen.

**Unverändert NO-GO:** Jeder Bestand muss auf tatsächliche Firestore-Timestamp-Typen, bestehende Ablauftermine, Aufbewahrungspflichten, Legal Holds, Audit-Bewahrung und Löschkosten geprüft werden. Firestore TTL löscht asynchron und ersetzt nicht die Art.-17-Löschkaskade. Nur im freigegebenen Staging mit unabhängigen Reviews testen; niemals Produktion automatisch verändern.


### 2026-10-19 — P0 #70: Undokumentierte zusätzliche TTL-Policies strikt ablehnen

**Quellbefund:** `scripts/check-retention-active-evidence.mjs` ignorierte bisher mit `if (!required.includes(group)) continue` jede TTL-Policy einer nicht in der genehmigten 20er-Matrix enthaltenen Collection-Group. Da `gcloud firestore fields ttls list` sämtliche konfigurierten TTL-Felder der gewählten Datenbank auflistet, konnte ein erfolgreicher 20/20-ACTIVE-Nachweis gleichzeitig eine **zusätzliche, potenziell rechtswidrige Löschrichtlinie verschweigen**.

**Korrektur:** Die Read-only-Evidenzprüfung bricht jetzt bei **jeder** unerwarteten TTL-Policy sofort ab, auch bei `CREATING` und alternativen Feldnamen. Zusätzliche Richtlinien müssen zuerst in der vollständigen Matrix erfasst, auf Rechtsgrundlage, Aufbewahrung und Legal Holds geprüft und gesondert genehmigt werden; der Validator bietet absichtlich keine automatische `ignore`-Ausnahme. `test-retention-active-evidence.mjs` enthält nun **12** Negativmutationen statt 9. Das Mock-Staging-Skript verweigert zusätzlich eine unautorisierte aktive Policy (**13** Fail-Closed-Szenarien statt 12). Vor der Korrektur hätte der Validator die unautorisierte ACTIVE-Policy akzeptiert.

**Wichtige Grenze:** Das sind lokale JSON-/Mock-/Quellcode-Tests, **kein** realer Google-Cloud-Abruf. Diese Änderung aktiviert/deaktiviert/löscht keine TTL-Policies. Für eine GO-Entscheidung fehlen insbesondere die unabhängig genehmigte *vollständige* 20er-Policy-Matrix, die Auswertung **aller** tatsächlich vorhandenen Policies im freigegebenen Staging, Bestands-/Legal-Hold-Nachweise, echte Firestore-Emulator-Transaktionen und die vollständigen Enterprise-Release-Gates. Produktionsfreigabe **NO-GO**.

Google-Cloud-Dokumentation: https://docs.cloud.google.com/sdk/gcloud/reference/firestore/fields/ttls/list und https://firebase.google.com/docs/firestore/ttl


## 2026-10-19 — P0 #70: Read-only preflight before any staging TTL update

**Confirmed source gap (base commit `7adc5c1e0320cfd9826136f2f206bb78ea3dd749`):** `scripts/configure-retention.sh` gated the staging target, environment label, DPO/legal inventory approval and 20-group matrix revision, but issued 20 sequential `gcloud firestore fields ttls update` operations **without first reading the database's existing TTL policies**. Thus an unapproved pre-existing policy, nonzero expiry offset, alternate field, or unfinished `CREATING` operation could go unnoticed until after writes had started. The separate ACTIVE evidence checker did not prevent this scenario because it ran only when the operator deliberately requested evidence afterward.

**Correction:** Before any “update” call, the script now runs the read-only, explicit-project-and-database `gcloud firestore fields ttls list --format=json` command. It uses `check-retention-active-evidence.mjs --mode preflight` to permit only a subset of the **approved 20 “expiresAt” policies**, each already ACTIVE with zero/default expiration offset. An empty policy list is safe for the preflight; unknown groups/fields, wrong scope, duplicates, nonzero offset, `CREATING`, malformed JSON or cloud-list failure abort **before the first write**. Full final ACTIVE evidence still requires all 20 groups in the separate standard validator mode; preflight must never substitute for after-activation independent proof.

**Offline negative proofs:** The mock `gcloud` stage test asserts **zero TTL update calls** for an unapproved existing policy, an unfinished policy and a failing list command, and exactly 20 updates for a safe mocked empty list after all approvals. The source-matrix gate also enforces that the read-only list/validation precedes the first update and has three mutation regressions against a removed/bypassed preflight. The checker accepts an empty or approved existing subset and rejects seven malicious existing-policy fixture types. **No cloud TTL settings have been read or modified during these tests.**

**Residual risk:** The preflight is a snapshot and cannot rule out changes by a concurrent administrator after it completes (TOCTOU); a protected change window, least-privilege Cloud IAM and independent change approval are still necessary. Since policies are applied sequentially, an operational error after the first write could result in **partial activation**, which must be independently reconciled. Existing expired-data and legal-hold review is mandatory because activating TTL can trigger deletion of historical records. Firestore TTL deletion is asynchronous, non-recursive, and billable. No production deploy/merge and no human GO authorized.

Sources: https://firebase.google.com/docs/firestore/ttl and local scripts/tests described above. **PRODUCTION NO-GO**.


### 2026-10-19 — TTL staging idempotence and mandatory 3-iteration NO-GO review

The staging TTL provisioner now uses the existing fail-closed scoped policy preflight to retrieve validated ACTIVE group identifiers and skips already ACTIVE policies. Mocked GCP tests show **20/18/0 update requests** when **0/2/20 policies** were already ACTIVE, and unsafe policy fixtures still cause zero writes. Three additional static matrix mutations cover an omitted skip or ID-validation step; the regular full-20 ACTIVE evidence check remains unchanged. See `docs/ADR_TTL_STAGING_IDEMPOTENCE_2026-10-19.md` and `docs/ENTERPRISE_REVIEW_3_ITERATIONS_2026-10-19.md`.

The mandatory tests cannot yet all pass in the isolated checkout: root Bun-only lock policy forbids npm package-lock, `npm audit` exits ENOLOCK, and the full TS/Vitest/Playwright/Emulator/build toolchain is absent. Do not fabricate zero vulnerabilities or GO from static checks; the final third-iteration result is recorded in the associated Draft PR description. **NO-GO.**


### 2026-10-19 — Finalization: emulator port preflight, runner evidence and TTL NO-GO

The Rules and Art17 Firebase profile actually reserves Firestore **8085**, hub **4405**, and logging **4505**; the old hard-coded port check omitted all three. The replacement reads the approved Firebase emulator config instead of guessing. Eight Node22 offline regressions PASS (including denial for port conflicts and unsafe production/fallback settings). All corresponding Rules/Art17 scripts execute this preflight before starting their isolated emulator. Correct dependency install is `bun ci`, not `npm ci` in the root app.

A real Java21/Firestore Emulator process started locally using `firestore.rules` and `demo-klar`, but the sandbox crashed before any SDK tests; **actual integration was NOT completed**. Issue #70 20-group TTL offline gates PASS, while real staging ACTIVE policies, legal holds, data-lifecycle inventory and independent approval are **NOT VERIFIED**. GitHub Actions job #117997339276 used `ubuntu-latest`, received runner_id=0 and ran zero steps; Actions repository variables list was empty. Runner assignment/billing/platform cause requires administrator diagnostics, not an unverified YAML change. Root supply chain still has outstanding High/Critical advisories. **Release NO-GO**.

See `docs/FINALIZATION_EMULATOR_RUNNER_TTL_2026-10-19.md` and `docs/ADR_FIRESTORE_EMULATOR_PORT_PREFLIGHT_2026-10-19.md` for evidence, rollback and N-1 compatibility.


## 2026-10-25 — #56: Token-free owner partner opens

POST /api/partner/open/:campaignId now returns the validated current campaign destination without a referral token or new referral documents. User adult/consent/epoch state, account deletion and campaign/destination are read together in one transaction with the signed tokenForwarded:false audit. No click/conversion credit is awarded. The {url} API, private response headers and rate limits remain unchanged. Targeted in-memory service tests: 35/35 PASS (Node 24.22.1, Vitest 5.0.5); full exact-head CI/emulator/browser evidence remains required. Other eligible visitors' tracked redirects still transmit tokens. Partner-side logs/retention, legal approvals, live TTL/Art.-17 evidence and purchase authenticity remain open; production NO-GO. See docs/ADR_PARTNER_OWNER_OPEN_NO_TOKEN_2026-10-25.md. Historical entries above describe their then-current source, not this correction.

## 2026-10-25 — #56: Template-only request telemetry

server.ts uses requestRouteForTelemetry for initial/final span routes, structured request logs and failedApiCalls diagnostics. Registered Express templates or unmatched replace raw request paths; authentication and redirect behavior remain unchanged. Twelve local unit/HTTP tests PASS (including 200/401/404/429/500 canary-token paths), and the observability source gate passes. Full CI remains required; no live exporter/CDN log, historical erasure or retention approval is claimed. See ADR_REQUEST_TELEMETRY_ROUTE_PRIVACY_2026-10-25.md. #56/#70/#8 remain OPEN, production NO-GO.

### 2026-10-29 — P0 #202: Zwei konkurrierende Verifizierungsfoto-Worker

Quellcodeprüfung von `functions/src/index.ts` ergab zwei exportierte Scheduler. Der alte `deleteExpiredPhotosCron` nutzte die Upload-Zeit `timeCreated`, unabhängig von Moderationsentscheidungen. Das widerspricht der oben dokumentierten Entscheidungsfrist. Der isolierte Fix entfernt den Zugriff des Legacy-Crons auf Storage, ohne einen Cloud-Scheduler zu löschen; die bestehende signierte `purgeVerificationStorageCron`-Route bleibt die einzige vorgesehene entscheidungsbasierte Foto-Löschung. **Dies ist nur ein Quellcode-Fix, kein Nachweis des Produktionszustands.** Issue #202 verlangt Cloud-Inventar, Staging-Integration, Retention-/Hold-/Generationstests und unabhängige Legal/Security/SRE-Freigaben. Die 20-gruppige Firestore-TTL-Matrix (#70) ist weiterhin nicht durch Live-Cloud-Nachweise freigegeben. **PRODUCTION NO-GO.**
