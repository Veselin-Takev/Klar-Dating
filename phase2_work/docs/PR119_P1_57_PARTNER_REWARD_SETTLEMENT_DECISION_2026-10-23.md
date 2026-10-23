# PR #119 — P1 #57 Reward-Fulfillment, Abrechnungs- und Reversal-Nachweise (2026-10-23)

**Status: DECISION REQUIRED / UNAPPROVED. Production NO-GO / HARD STOP.**
**Scope:** ausschließlich kostenfreie statische Audit- und Dokumentationsarbeit auf `audit/pr119-host-evidence-governance-2026-10-23`; unveränderter Anwendungscode PR119 `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, Tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`. [Offenes Issue #57](https://github.com/Veselin-Takev/Klar-Dating/issues/57), abhängig von [P0 #55](https://github.com/Veselin-Takev/Klar-Dating/issues/55) und [P0 #56](https://github.com/Veselin-Takev/Klar-Dating/issues/56).

## 1. Bestätigter aktueller Stand (Source-of-truth versus veraltete Beschreibung)

1. `src/server/partnerReferralService.ts`, `recordPartnerConversion` speichert eine signierte Partnerbehauptung mit `rewardStatus:'pending_verification'`, `proofStatus:'partner_assertion_only'`. Das Audit-Ereignis ist `partner_conversion_asserted`. Der Transaktionspfad erstellt ein Event und einen pro Buyer/Kampagne deduplizierten Claim, **erhöht in diesem Pfad keine `qualifiedConversions`** und gibt für Neuereignisse `pending_verification` bzw. für konsistente Wiederholung `already_recorded` zurück.
2. `src/server/routes/partnerReferrals.ts` prüft HMAC/Timestamp/Schema und leitet die verifizierte Nachricht an diese Service-Funktion weiter. Diese Signatur beweist die Herkunft der Nachricht vom Schlüsselinhaber, nicht einen tatsächlichen Kauf oder die reale Zuordnung des angegebenen `buyerUid`.
3. `tests/partnerReferralService.spec.ts` enthält Fake-Firestore-Regressionen für vorläufigen Status, nicht erhöhte Zähler, Duplikate und Replay-/Consent-Inkonsistenzen. In-Memory-Tests beweisen keine reale Firestore-Transaktions- oder Drittsystem-Semantik.
4. `src/server/stripeService.ts` ist ein separater Abonnement-Billing-Pfad. Die untersuchten Partner-Conversion-/Stripe-Codepfade zeigen **keinen nachgewiesenen Übergang von Partnerbehauptung zu unabhängiger Kaufprüfung, Klar+-Erfüllung oder Partnerabrechnung**; dies ist eine begrenzte Quelltextaussage, kein globaler Beweis für alle Systeme.
5. Das bisherige `docs/PARTNER_REFERRAL_SYSTEM.md` beschrieb eine neue Conversion noch als `earned`. Die Dokumentation wird hier **auf den nachweisbaren Status `pending_verification` korrigiert**, ohne historische Daten umzudeuten oder fremde Systeme anzutasten.

**Quellidentität:** Original-Git-Blob `partnerReferralService.ts` = `caac15e4609cd526e47a487a2d6d5f335649995d`, Partner-Service-Test = `bf862cf49ce7240ced0c1d7b0ca7d3eae35f8dd6`, Stripe-Service = `8aed124d4b90d1c3b5e2f1abd705b7873ae1071f`. Diese Objekte gehören zum unveränderten PR119-Tree; lokale Snapshotdateien wurden für die Partnertests gegen ihre Git-Blob-Hashes bestätigt.

## 2. Fachlicher Vertragsentwurf, ausdrücklich nicht genehmigt

| Stufe | Erforderliches Beweismittel | Zulässiger Effekt | Nicht zulässig |
|---|---|---|---|
| `assertion_pending` | HMAC-signierter Partnerreport mit konsistenter idempotenter Event-ID | Nicht auszahlbarer, auditierter Claim in Quarantäne | `earned`, Klar+-Gutschrift, Provision als verdient ausweisen |
| `purchase_verified` | Authentifizierter Klar-Buyer-Intent + unabhängig bestätigte Bestellung/Leistung mit Provider-Order-ID | Nachweisreferenz und nachvollziehbare Käufer-/Kampagnenbindung | Signatur oder `buyerUid` allein als Kaufbeweis |
| `settlement_eligible` | Vertragsgemäße Finalität, Consent-/Datenschutz-/Fraud-Prüfung und Finance-Policy | Separater, idempotenter Freigabeauftrag | Auszahlung vor Vertrags- und Steuerprüfung |
| `fulfilled` | Einmalige, quittierte Klar+-Zeitgutschrift mit eindeutigem Entitlement- und Ledgerbeleg | Exakt einmalige vereinbarte Klar+-Nutzungsdauer | Coins, frei erfundene Guthaben, Doppelgutschrift |
| `failed`/`quarantined` | Fehlende Belege, Widerruf, Streitfall oder Fristablauf | Keine Gutschrift; überprüfbarer Einspruch/Reconciliation | Permanentes Blockieren einer legitimen Buyer-Zuordnung |
| `reversal_pending`/`reversed` | Independently verifizierter Refund, Chargeback, Fraud oder Storno | Unveränderliche Gegenbuchung und ggf. zulässige, manuell geprüfte Entitlement-Korrektur | Stille Löschung, negativer Zeitraum, unautorisierte Rücknahme |

Die Statusnamen und Belegarten sind **Designvorschläge**; sie sind keine Behauptung über aktuelle Firestore-Daten oder genehmigte externe Verträge. Keine pauschale Verrechnung mit Stripe-Abos ohne ausdrücklich geprüfte Konten- und Vertragsgrenzen.

## 3. Kritische Invarianten vor Produktimplementierung

- **Identitätsbindung:** Kein Credit für nur partnerbehauptete UID. Buyer und eindeutige Order-ID durch Klar-authentifizierten, zweckgebundenen Intent und unabhängige Bestätigung binden (P0 #55).
- **Idempotenz/Deduplikation:** `(provider, order-id, offer, buyer intent, generation)` konsistent und eindeutig; parallele 10-fach-Callbacks, zwei Event-IDs für dieselbe Bestellung, Schlüsselrotation und Wiederaufnahme nach Absturz dürfen keinen zweiten Klar+-Zeitraum auslösen.
- **Abgrenzung der Schuldverhältnisse:** Wer trägt Promo-Kosten, Partnerprovision, ausstehende Prämienverbindlichkeit, Steuer-/Rechnungspflichten und Rückbelastungsrisiko? Keine Vermischung von Partnerumsatz, Klar-Abonnementumsatz und Werbegutschriften.
- **Abrechnungsbuch:** Externe Belegreferenz, Vertrag/versioniertes Angebot, Entitlement-ID, Statuswechsel, Zeitbezug, Korrekturbeleg und signiertes append-only Audit. Reporting: `Net Commission`, `Reward Liability`, `Fraud/Support Cost`, `Refund/Chargeback`, unbestrittene und streitige Forderungen. Keine Roh-UID in Partnerausgaben.
- **Rückabwicklung:** Vor und nach `fulfilled` verschieden behandeln; keine automatische negative Klar+-Laufzeit oder stilles Löschen bereits gewährter Leistungen. Vier-Augen-Freigabe für manuelle Korrekturen, Kundeninformation/Beschwerdeweg.
- **Datenschutz & Aufbewahrung:** Rechtsgrundlage, DPA, Tokenweitergabe, Personendatenexport, Art.-17-/Legal-Hold-Ausnahmen, begrenzte Buyer-Claim-Frist und gesetzliche Finanzbelegaufbewahrung durch DPO/Legal genehmigen (P0 #56).

## 4. Akzeptanzmatrix (alle ausstehend)

| Nachweis/Owner | Aktueller Status |
|---|---|
| Product: schriftliche Klar+-Reward-Semantik, Kosten und Kundenterms | **PENDING** |
| Security: Buyer-/Purchase-Proof, Anti-Fraud, Key-Rotation, Replay | **PENDING** |
| Finance: klare Vertragspartner, Steuern, Net-Commission-/Liability-Policy, Reversal | **PENDING** |
| DPO/Legal: Datenschutzgrundlage, Datenempfänger, Retention und Verbraucherrechte | **PENDING** |
| SRE: Monitoring, Recovery, nachvollziehbare Staging- und Rollback-Nachweise | **PENDING** |
| Runtime: 10× Duplicate, Parallelanspruch, getrennte Event-IDs, Refund/Chargeback, Crash Recovery, Stripe/Klar+ Integration auf Emulator/Staging | **NOT EXECUTED / NOT VERIFIED** |
| Host Release: alle 15 freigegebenen Mandatory Gates am authentifizierten PR-SHA, 4 finale Freigaben | **0/15 PASS; 0/4 Sign-offs** |

## 5. Kostenfreie lokale Evidenz und Grenzen

Die vorhandenen gezielten Partner-Webhook- und Datenschutz-Regressionstests wurden mit separat Git-Blob-verifizierten Originalquellen erneut ausgeführt: **57/57 PASS** unter unqualifiziertem Node.js v22.16.0. Ein neuer isolierter, schreibgeschützter Reward-Dokumentations-/Quellvertragsprüfer bestand **14/14** positive/negative Tests, einschließlich einer anfänglich erkannten und korrigierten mehrfachen `proofStatus`-Fundstelle. Zusammen **71/71 lokale Tests**, **kein** qualifiziertes Enterprise-Host-Gate und **kein** tatsächlicher Kauf-/Klar+-Buchungsnachweis. Das neue Prüfskript ist bis zu einer gesonderten, hash-verifizierten Integration ausschließlich lokaler Audit-Kandidat.

## 6. Freigabe- und Änderungsgrenze

Das frühere App-Korrekturlimit bleibt erschöpft. **Keine** Produkt-API-, Firestore-Schema-, Stripe-, Klar+-Zeitraum-, CI-, Partnervertrag-, Cloud-, `main`- oder PR119-Änderung. Finance-/Security-/DPO-/Product-Freigaben werden nicht erfunden, geschätzt oder aus statischen Tests abgeleitet. Ohne explizite, dokumentierte Entscheidung und autorisierten kostenfreien Host: **Issue #57 OFFEN, P0 #55/#56 OFFEN; RELEASE NO-GO/HARD STOP**.

Siehe `ADR_PR119_PARTNER_PURCHASE_PROOF_CLAIM_REVERSAL_2026-10-23.md`, `PR119_P0_55_PARTNER_WEBHOOK_TRUST_SOURCE_AUDIT_2026-10-23.md`, `PR119_P0_56_PARTNER_TRACKING_PRIVACY_EVIDENCE_2026-10-23.md`.
