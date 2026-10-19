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
- **Feld/Marker:** `verification_events.fotoLoeschenAb` plus `storagePath`
- **Frist:** 30 Tage nach der serverseitig gespeicherten Moderationsentscheidung, nicht 30 Tage nach Upload.
- **Worker:** `functions/src/deleteExpiredPhotos.ts` verarbeitet fällige `verification_events` und löscht mit Generation-Precondition. Offene Prüfungen ohne Entscheidung werden nicht vom Retention-Worker gelöscht.
- **Audit:** Nach erfolgreicher Löschung wird `photoPurged`, `photoPurgedAt` und ein SHA-256-Löschdigest im Event gesetzt.

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
# KLAR_PROJECT_ID=... KLAR_DATABASE_ID=... bash scripts/configure-retention.sh
gcloud firestore fields ttls list --project "$KLAR_PROJECT_ID" --database "$KLAR_DATABASE_ID"
```

Der zweite Befehl muss für alle 13 dokumentierten Collection Groups den aktiven TTL-Zustand zeigen. Der Nachweis wird im Change-Ticket abgelegt. Zusätzlich prüfen automatisierte Tests, dass neue Dokumente ein plausibles `expiresAt` erhalten; ein vierteljährlicher Stichprobentest weist tatsächliche Löschung nach. Legal Holds müssen explizit, zeitlich begrenzt und auditierbar sein.

**Verifikationspflicht:** Die lokale Matrix-Prüfung `node scripts/check-retention-matrix.mjs` sowie ihre Negativtests `node scripts/test-retention-matrix.mjs` prüfen ausschließlich Repository-Code und Dokumentation. TTL löscht nicht sofort und nicht transaktional. Der tatsächliche Status `ACTIVE` aller 13 Gruppen muss in der genehmigten **Staging**-Umgebung mit Projekt- und Datenbankbezug nachgewiesen werden; das Schreiben gültiger `expiresAt`-Zeitstempel, Legal Holds und der sofortige Art.-17-Löschpfad bedürfen gesonderter Emulator-/E2E- und DPO-Prüfung. Ein Staging-Setup ist keine Produktionsfreigabe.

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
