# P0 #55 — Partner-Conversion: native Firestore-Transaktionen unter Konkurrenzlast

**Stand:** 2026-10-31 · **Status:** DRAFT / BLOCKED / NO-GO
**Gestapelt auf:** [Draft #246](https://github.com/Veselin-Takev/Klar-Dating/pull/246), exakter Parent `7f310ab3bdae2f1f8ea607b544ae14dec438a218`, volle [Enterprise CI #41194811715 PASS](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41194811715).
**Quellzweig:** `test/55-partner-conversion-firestore-concurrency-20261031`.

## Geschlossene Nachweislücke

Der lokale HTTP-Test aus #246 beweist signierte 201→200-Replays und Negativfälle, aber verwendet bewusst eine **In-Memory-Firestore-Attrappe ohne echte konkurrierende Transaktionen**. Die Admin-SDK-Funktion `recordPartnerConversion` schreibt Event, buyer claim und HMAC-Audit-Ledger gemeinsam per `runTransaction`. Ob bei parallelen Requests tatsächlich genau eine gültige Claim-Zuordnung entsteht und keine zweite, nicht bezahlbare Partnerbehauptung die Transaktion umgeht, benötigt einen **realen Firestore-Emulator**, nicht nur Mock-Tests.

## Neue native Emulator-Regression

Die neue Datei `tests/partnerConversionFirestoreEmulator.spec.ts` ruft die echte `recordPartnerConversion`-Anwendungslogik direkt über `getDb()` mit dem Admin SDK auf. Die Test-Firestore-Instanz wird ausschließlich erzeugt, wenn `FIRESTORE_EMULATOR_HOST` auf dem lokalen Host und einem von `firebase.json`/`firebase.pruefung.json` freigegebenen Port zeigt. Nur `demo-klar`, kein Produktionsmodus und kein Durable-Store-Fallback sind zulässig. Testdatensätze nutzen pro Fall eindeutige synthetische IDs und werden gezielt bereinigt; **kein globales Emulator-Reset**, kein Zugriff auf reale Nutzer.

Prüfungen:

1. **Gleiche Provider-Aussage dreifach parallel:** Genau einer der echten `runTransaction`-Aufrufe erstellt Event/Claim/Ledger. Zwei wiederholte Aufrufe müssen als sichere Duplikate bestätigt werden. Der persistierte Beleg bleibt `partner_assertion_only / pending_verification`, der Kampagnenzähler bleibt 0.
2. **Zwei gleichzeitig signierbare Event-IDs für eine Käuferkennung:** Nur eine Aussage darf den stabilen Buyer-Claim anlegen; das unterlegene Ereignis muss mit `duplicate_conversion` (HTTP-Äquivalent 409) zurückgewiesen werden. Es bleiben genau ein Event, ein Claim, ein Auditbeleg und kein verdienter Reward.
3. **Einwilligungswiderruf nach einer Aussage:** Beim realen Firestore-Retry muss die veränderte Zustimmung im Transaktions-Snapshot erneut geprüft werden, sodass der erneute Aufruf mit 403 abgewiesen und das Ledger nicht erweitert wird.

Der normale bestehende `test:ci`-Job startet per `firebase emulators:exec --only auth,firestore,storage` bereits den lokalen Emulator und führt Vitest einschließlich dieser neuen Testdatei aus. Für eine **isolierte, fail-closed Reproduktion** gibt es außerdem `npm run test:partner-conversion-emulator`, mit explizitem Port-Preflight für `firebase.pruefung.json` (8085), einem eingeschränkten `run-partner-conversion-emulator.mjs` und einem Vitest-Lauf, der ohne lokale Firestore-Emulatorverbindung **nicht als PASS ausfallen darf**.

## Grenzen und Freigaberisiken

- **Echte lokale Transaktionskonkurrenz ist nicht Staging-/Produktionsnachweis.** Firestore-Emulator, IAM, Admin-SDK-Projekt, Cloud-Konnektivität, NAT-/Rate-Limits, Provider-Signing-Key, Partnervertragsdaten und Scheduler-Verhalten sind getrennt zu prüfen.
- Die Tests ändern **keine Laufzeit- oder Auszahlungslogik**. Der signierte Partner behauptet lediglich eine Conversion; `buyerUid` ist bislang keine unabhängig durch Klar bestätigte Käuferidentität und `proofStatus:'partner_assertion_only'` ist kein Zahlungseingang. Es dürfen keine Rewards/B2B-Abrechnungspositionen aus diesem Zustand entstehen.
- Ein unbestätigter Buyer-Claim kann neue legitime Aussagen derselben Käuferkennung blockieren. Serverautorisierte Buyer/Purchase-Bindung, Partnervertrag, zeitgebundene Claims, Unstimmigkeitsbehandlung, Refund-/Chargeback-Reversals sowie unabhängige AppSec/DPO/Finance/SRE-Abnahmen sind weiterhin erforderlich.
- Neues exaktes Head benötigt eigenen vollständigen CI-PASS und unabhängige Reviews; Parent-PASS ersetzt das nicht. Kein Commit auf `main`, keine Merges, produktiven Datensätze oder Deployments.

**P0 #55 bleibt OPEN und Production Readiness weiterhin BLOCKED / NO-GO.**
