# P0 #55 – Signierte Partner-Webhook-HTTP-Nachweise und ihre Grenzen

**Stand:** 2026-10-31 · **Status:** DRAFT / BLOCKED / NO-GO · **Unabhängiger Branch:** `test/55-partner-webhook-http-authentication-20261031` auf `main` SHA `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Verifizierter Ausgangspunkt

[Issue #55](https://github.com/Veselin-Takev/Klar-Dating/issues/55) verlangt eine unabhängige vertrauenswürdige Käufer-/Kaufzuordnung. Die aktuell auf `main` vorhandene `recordPartnerConversion`-Implementierung prüft signierte Webhook-Ereignisse und die aktuellen Einwilligungs-/Alters-/Kampagnenzustände; **ein signierter Partner-Webhook belegt aber nur die Behauptung eines Schlüsselinhabers**. Das System setzt inzwischen bewusst nur `proofStatus:'partner_assertion_only'` und `rewardStatus:'pending_verification'`, ohne eine Belohnung oder einen `qualifiedConversions`-Zähler zu buchen. Diese sichere Grenze wird nicht aufgeweicht.

Das bisherige Testinventar aus `partnerReferralService.spec.ts` enthält bereits die Transaktions- und Zustandsautomatenfälle, aber keine positive, lokal signierte **HTTP-Transport**-Probe für den vollständigen 201→200-HMAC-/Replay-Pfad. Vorhandene `partnerReferralRoutes.spec.ts` fokussieren Admin-Gates, Response-Privacy-Header, ungültige Klicktokens und Infrastrukturausfälle. Dies ist eine nachvollziehbare Test-/Evidenzlücke, kein Beweis eines produktiven Missbrauchs.

## Eng begrenzter Test-Nachtrag

Neue `tests/partnerWebhookHttpProof.spec.ts` startet ausschließlich einen lokalen Express-HTTP-Server mit `express.json`, der bestehenden `createPartnerReferralPublicRouter`-Route und einer in-memory Firestore-Attrappe mit synthetischen Erwachsenen-/Consent-/Kampagnendaten. Die echte Service-/Core-/Rate-Limiter-Anwendungslogik wird durchlaufen. Der Test verwendet signierte `x-klar-partner-*`-Header und prüft:

1. **Echte HTTP-Signatur-/Replay-Grenze:** Die erste gültige Meldung antwortet mit 201 und `pending_verification`; identische Wiederholung liefert 200 und `already_recorded`. Die Datenbank hält genau ein Conversion-Dokument, einen Buyer-Claim und einen auditierbaren Eintrag; ohne automatische Belohnung oder Conversion-Zählung.
2. **Käufermanipulation:** Dasselbe Ereignis mit anderer Käufer-UID und erneut gültiger HMAC-Signatur wird durch den Event-Binding-Abgleich mit HTTP 409 zurückgewiesen. Kein zweiter Buyer-Claim, kein zusätzlicher Audit-Ledger-Eintrag.
3. **Kampagnenzuordnung:** Eine korrekt signierte Meldung an den falschen Partner-Slug wird mit HTTP 403 abgewiesen; kein Conversion-Dokument.
4. **Zeitfenster/Integrität:** ±301 Sekunden Abweichung sowie gefälschte Signatur führen zu HTTP 401 und keiner Conversion.
5. **Provider-Key-Rotation:** Nach Änderung des aktuell gültigen Webhook-Schlüssels bleibt das bereits unter dem stabilen Audit-Secret gespeicherte Ereignis idempotent (200/duplicate).
6. **10× sequentieller Replay:** nur eine nicht zahlungswirksame Partnerbehauptung und kein qualifizierter Conversion-Zähler.

Keine Produktiv- oder Produktionsdaten werden abgefragt. Weder der Webhook-Vertrag noch die serverseitige Reward-Verarbeitung oder das Partner-Tracking werden in dieser PR verändert.

## Was die Tests **nicht** belegen

- Die In-Memory-Attrappe garantiert **keine realen Firestore-Emulator-Transaktionen**, keine simultanen konkurrierenden `tx.create`-Operationen und keine Recovery-/Netzwerk-Rennen. Der 10×-Test ist **sequentiell**, kein Lasttest.
- Eine korrekt signierte Partnerbehauptung ist **kein Nachweis** eines tatsächlich erfolgten Kaufs, einer bestimmten Käuferidentität, eines Zahlungsbelegs, vertragskonformer Verarbeitung oder Betrugsfreiheit. Der Partner ist als teilweise unvertrauenswürdige Quelle zu behandeln. Vor einer Auszahlung/Reward-Zuteilung ist eine eigene autoritative Käufer-/Purchase-Bindung plus Refund-/Chargeback-/Dispute-Verarbeitung erforderlich.
- `partner_referral_buyer_claims` werden bereits bei `pending_verification` gesetzt. Ein nicht unabhängig bestätigter Partnerdatensatz kann somit einen späteren Anspruch derselben Käuferkennung sperren; dieser Missbrauchs-/Reconciliation-Fall muss im P0-Vertrauensmodell explizit bewertet und unter DPO-/Finance-/Security-Genehmigung behoben werden.
- Kein Nachweis für deployed Secrets, Cloud IAM, signaturvalidierende Partnerkonfiguration, 10× Peak, IP-Limits/NAT-Fairness, tatsächliche Datenschutzvereinbarungen oder produktive Retention und Art.-17-Kaskaden.
- Die tatsächliche Produktionsfreigabe benötigt unabhängige AppSec, DPO/Legal, Finance, Operations/SRE und Release-Owner-Signoffs sowie eine vollständige **CI auf dem exakten neuen Commit**.

**Keine direkte `main`-Änderung, keine Commits/Merges in fremde Branches, kein Deployment und kein Zugriff auf produktive Kundendaten. #55 bleibt P0 / BLOCKED / NO-GO.**
