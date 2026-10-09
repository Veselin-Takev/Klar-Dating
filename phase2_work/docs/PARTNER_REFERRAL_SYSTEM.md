# Klar & Partner — Referral-System

## Sicherheits- und Betriebsmodell

Partnerkampagnen liegen ausschließlich serverseitig in \`partner_campaigns\`; geschützte CRUD-Endpunkte sind unter \`/api/admin/partners\` verfügbar. Änderungen sowie Consent-/Trackingereignisse erhalten HMAC-SHA256-Signaturen über den gemeinsamen kanonischen Serializer aus \`src/server/consentAudit.ts\`. \`DELETE\` ist ein Soft-Delete: Status, Zeitstempel und Version bleiben als Historie erhalten; Slugs bleiben reserviert.

Neue Kampagnen starten als unbestätigte Entwürfe. Die erstmalige Markenfreigabe braucht eine zweite Admin-Identität; die erstellende Admin-Person kann ihre eigene Kampagne nicht selbst als geprüft freigeben. Das Freigabefeld dokumentiert eine manuelle Prüfung der offiziellen Domain und Vertragsbeziehung; es erzeugt selbst keinen Partnervertrag. Es werden keine aktiven Beispielkampagnen vorbefüllt. Namen wie HelloFresh und Revolut sind Beispiele, keine Behauptung, dass ein Vertrag besteht.

Referral-Tokens werden aus UID, Kampagnen-ID und Token-Version mit HMAC-SHA256 abgeleitet. Der rohe Token wird nicht persistiert; die Referral-Dokument-ID ist ein SHA-256-Derivat. Pseudonyme UID-Referenzen im Ledger sind HMAC-SHA256-abgeleitet mit dem bestehenden stabilen \`CONSENT_AUDIT_SECRET\`. Eine Schlüsselrotation erfordert einen kontrollierten Versions-/Migrationsplan, damit Art.-17-Löschung alle bestehenden Pseudonyme auflösen kann. Beim Widerruf wird die Token-Version erhöht; Links mit älterer Version zählen weder Klicks noch Conversions.

Firestore-Clientzugriffe auf Partnerkollektionen sind explizit verweigert. Admin-CRUD erfordert ausschließlich den verifizierten Firebase Custom Claim \`admin === true\`; Profilrollen und Clientfelder sind kein Autorisierungsnachweis. Öffentliche Click-/Webhook-Routen bleiben durch das globale IP-Rate-Limit begrenzt und besitzen eigene zusätzliche Limits.

## Betrugsprävention und Conversion-Verifikation

- Bekannte Bots, Crawler, Link-Preview-Clients und Prefetch-Anfragen werden weitergeleitet, aber nicht als Klick gezählt. Rohe IP, User-Agent und Referrer werden nicht im Partner-Ledger gespeichert.
- Ein authentifiziert erkannter Link-Eigentümer wird beim Öffnen nicht als Klicker gezählt; \`buyerUid === ownerUid\` wird als Selbst-Empfehlung abgelehnt.
- Conversions benötigen einen HMAC-signierten Partner-Webhook, einen frischen 10-stelligen Zeitstempel (maximal 5 Minuten), striktes JSON-Schema, eine aktive/geprüfte Kampagne sowie gültige Alters- und Partner-Einwilligungszustände beider Klar-Konten.
- Event-ID und Käufer-Deduplikation verwenden HMAC-abgeleitete IDs. Externe Event-IDs, Kundenkennungen, E-Mail-Adressen, rohe UIDs, IP-Adressen und User-Agent werden nicht im Partner-Ledger gespeichert. Pro Kampagne und Klar-Konto kann nur eine Conversion zählen.
- Eine Conversion mit Status \`earned\` bedeutet: die Empfehlung ist nach dem definierten Vertrag qualifiziert. Das ist **keine Auszahlung**; Zahlungen oder Gutscheine benötigen einen gesondert genehmigten Abrechnungs-/Voucherprozess.

## API-Vertrag

| Methode | Pfad | Sicherheitsgrenze |
|---|---|---|
| GET | \`/api/partner/consent\` | Registriertes, authentifiziertes, volljähriges Konto |
| POST | \`/api/partner/consent\` | Separate, versionierte Einwilligung; signiertes Ledger |
| GET | \`/api/partner/referrals\` | Personalisierte Links und aggregierte Übersicht |
| POST | \`/api/partner/interaction\` | Signierte copy/share/QR-Ereignisse |
| POST | \`/api/partner/open/:campaignId\` | Server-validierter Partnerlink |
| GET | \`/api/partner/click/:token\` | Öffentliches rate-limited Redirect; Crawler zählen nicht |
| POST | \`/api/partner/webhook/:slug\` | Öffentlich erreichbar, nur mit passender HMAC-Signatur |
| GET | \`/api/admin/partners\` | Kampagnenliste; Firebase Claim \`admin: true\` |
| POST | \`/api/admin/partners\` | Kampagnenentwurf anlegen |
| PATCH | \`/api/admin/partners/:id\` | Kampagne bearbeiten / Status ändern |
| POST | \`/api/admin/partners/:id/disable\` | Sofortige Deaktivierung |
| DELETE | \`/api/admin/partners/:id\` | Soft-Delete |

## Produktionskonfiguration

Aus einem genehmigten Secret Manager provisionieren:

- \`PARTNER_REFERRAL_SECRET\`: mindestens 32 zufällige Zeichen; signiert Referral-Tokens.
- \`CONSENT_AUDIT_SECRET\`: bestehender dedizierter, stabiler HMAC-Schlüssel; signiert Ledger und pseudonyme UID-Referenzen.
- \`KLAR_PUBLIC_URL\`: kanonische öffentliche HTTPS-Origin.
- \`PARTNER_WEBHOOK_SECRETS_JSON\`: JSON-Zuordnung Kampagnen-Slug zu kampagnenspezifischem Geheimnis (mindestens 32 Zeichen). Niemals Schlüssel im Firestore-Dokument oder Client speichern.

Webhook-Body (zusätzliche Felder werden abgelehnt):

\`\`\`json
{
  "event": "qualified_conversion",
  "eventId": "provider-event-123456",
  "referralToken": "<64-stellige hexadezimale Klar-Referral-ID>",
  "buyerUid": "<Firebase-UID, nur transient zur Eligible-/Self-referral-Prüfung>"
}
\`\`\`

Header \`X-Klar-Partner-Timestamp\` (Unix-Sekunden, 10 Ziffern, maximal 300 Sekunden alt) und \`X-Klar-Partner-Signature\` (\`sha256=<hex>\`). Signatur:
\`HMAC-SHA256(partnerSecret, "klar-partner-webhook:v1\\n" + timestamp + "\\n" + canonicalJson(body))\`. JSON-Objektschlüssel werden rekursiv sortiert und ohne Leerraum serialisiert. Externe Event-ID und Käufer-UID werden nur transient geprüft; gespeichert werden domänenseparierte HMAC-Bezüge.

## Art. 17 DSGVO / Retention

Die Kontolöschung entfernt Referral-Zuordnungen, Conversion-/Buyer-Claim-Dokumente und signierte Ledger-Ereignisse über HMAC-pseudonyme Konto-Bezüge. HMAC-Adminreferenzen werden aus Kampagnen entfernt; Kampagnentext und aggregierte Zähler bleiben. Konto-spezifische Rate-Limit-Zähler werden gezielt gelöscht. IP-basierte Rate-Limit-Zähler enthalten keine rohe IP und benötigen aktivierte Firestore-TTL-Policies für das 60-Sekunden-Fenster; entsprechende \`gcloud firestore fields ttls update\`-Befehle stehen in \`docs/DATA_RETENTION.md\`.

Vor Produktivbetrieb müssen Partnerverträge, Prämienbedingungen, Datenschutz-/Rechtsreview, TTL-Policies und produktive Secrets unabhängig geprüft und provisioniert sein. Fehlende Schlüssel lassen Aktionen sicher scheitern; unbestätigte Kampagnen werden nicht ausgegeben.
