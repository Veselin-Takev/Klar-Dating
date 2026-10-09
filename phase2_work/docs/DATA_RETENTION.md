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
- **Frist:** 30 Tage. Kaskadierende Löschvorgänge schreiben ein Audit-Log, um im Fehlerfall Inkonsistenzen aufzuspüren.
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
KLAR_PROJECT_ID=... KLAR_CONFIRM_RETENTION=... scripts/configure-retention.sh
gcloud firestore fields ttls list --project "$KLAR_PROJECT_ID"
```

Der zweite Befehl muss für alle neun Collection Groups den aktiven TTL-Zustand zeigen. Der Nachweis wird im Change-Ticket abgelegt. Zusätzlich prüfen automatisierte Tests, dass neue Dokumente ein plausibles `expiresAt` erhalten; ein vierteljährlicher Stichprobentest weist tatsächliche Löschung nach. Legal Holds müssen explizit, zeitlich begrenzt und auditierbar sein.

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
