# EU AI Act, DSA & DSGVO Art. 9 Konformitätsdossier

**Produkt:** Klar Dating App  
**Status:** Validiert & Dokumentiert  
**Audit-Datum:** 24. September 2026  
**Standards:** EU AI Act (VO 2024/1689), DSA (VO 2022/2065), DSGVO (VO 2016/679), ISO 42001, NIST AI RMF, OWASP LLM Top 10  

---

## 1. Klassifizierung nach EU AI Act (VO 2024/1689)

### 1.1 Verbotene Praktiken (Art. 5 EU AI Act)
* **Keine biometrische Emotionserkennung am Arbeitsplatz oder in Bildungseinrichtungen:** Entfällt (reine Consumer Social / Matchmaking Applikation).
* **Kein Social Scoring:** Profile werden nicht auf Basis von allgemeinem Sozialverhalten diskriminierend gerankt.
* **Keine unzulässige biometrische Kategorisierung (Art. 5 Abs. 1 lit. g):** Es werden **keine** Rückschlüsse auf sensible Merkmale nach Art. 9 DSGVO (sexuelle Orientierung, Religion, ethnische Herkunft) durch KI-Modelle gezogen.
* **Keine manipulative Verhaltensbeeinflussung:** Keine Täuschung über Match-Chancen, keine künstlich erzeugten Fake-Likes oder Engagement-Fallen.

### 1.2 Einstufung als Hochrisiko-System (Art. 6 & Anhang III)
* Das Kern-Matchmaking und die Profil-Empfehlungen stützen sich auf deterministische Vektoren (`compatibility.ts`) und transparente Nutzerkriterien. Sie fungieren als Assistenzsysteme und fallen unter **Transparenzpflichten (Art. 50)**, nicht unter Hochrisiko-Systeme des Anhangs III (wie kritische Infrastruktur oder Strafverfolgung).
* Alters- und Verifikationsprozesse (`PhotoVerificationModal`, Challenge-Response-Geste) erfolgen server-autoritativ und ohne automatisierte Ablehnung ohne Einspruchsmöglichkeit.

### 1.3 Transparenz- und Informationspflichten (Art. 50 EU AI Act)
* Sämtliche KI-unterstützten Features (z. B. Icebreaker-Vorschläge, Bio-Tuning, Coach-Insights) sind in der Benutzeroberfläche eindeutig als **KI-generiert** gekennzeichnet.
* Bei Ausfall des Modells oder fehlender Einwilligung greifen transparente kuratierte Fallbacks (`src/server/kuratiert.ts`), die den Nutzer nicht über die Verfügbarkeit der KI täuschen.

---

## 2. DSA-Konformität (Digital Services Act - VO 2022/2065)

| DSA-Artikel | Gesetzliche Anforderung | Technische Implementierung in Klar |
|:---|:---|:---|
| **Art. 16** | Melde- und Abhilfeverfahren (Notice & Action) | `POST /api/report` speichert Meldungen atomar mit eindeutigem Aktenzeichen (`aktenzeichen`, 8-stellig), Eingangszeitpunkt und strukturiertem Meldegrund (`GRUENDE`). |
| **Art. 16 Abs. 4** | Unverzügliche Bestätigung | Rückgabe der Bestätigung inklusive Aktenzeichen im HTTP-Response zur Nachverfolgung. |
| **Art. 16 Abs. 6 & Art. 17** | Begründungspflicht bei Moderationsentscheidungen | Datenfelder `entscheidung` und `begruendung` in der Firestore-Collection `reports` zwingend vorgehalten; keine stillen Löschungen ohne Begründung. |
| **Jugendschutz & Zero-Tolerance** | Schutz von Minderjährigen vor Missbrauch | Meldungsgrund `minderjaehrig` löst sofortige Priorisierung (`priority: urgent`, `urgentMinorReview: true`) und automatische Markierung in `users` für die menschliche Sicherheitsprüfung aus. |
| **Art. 22** | Vertrauenswürdige Hinweisgeber & Eskalation | `evaluateAccountRisk` aggregiert Berichte, Blocks und Nachrichten-Geschwindigkeit zur automatischen Drosselung und Triage verdächtiger Accounts. |

---

## 3. Datenschutz & Art. 9 DSGVO (Besondere Datenkategorien)

### 3.1 Zero-Tolerance-Politik für Art.-9-Daten
* **Keine Speicherung im KI-Kontext:** Prompts an LLM-Modelle (Gemini) enthalten strikte System-Instructions:  
  * *„Verarbeite niemals sensible Daten nach Art. 9 DSGVO (sexuelle Orientierung, Religion, Gesundheit, ethnische Herkunft).“*
* **Isolierte Datenverarbeitung:** Nutzerinhalte werden in separaten Content-Parts gekapselt (`contents: [{ role: 'user', parts: [{ text: ... }] }]`), um Prompt-Injection-Angriffe gegen Datenschutz-Leitplanken zu unterbinden.
* **Einwilligungs-Gate:** Der Zugriff auf KI-Endpunkte erfordert zwingend eine gültige, dokumentierte Einwilligung (`zweckErlaubt(..., 'ki_auswertung')`). Ohne Einwilligung verweigert das Backend den Aufruf (`403 Forbidden`).

### 3.2 Kaskadierte Löschung nach Art. 17 DSGVO (Recht auf Vergessenwerden)
Das Löschprotokoll (`handleDeleteAccount` in `src/server/trustAndSafety.ts`) auditiert und bereinigt ausnahmslos alle 28 Kollektionen des Servers:
* **Gelöschte Kollektionen (21):** `users`, `public_profiles`, `chats`, `messages`, `contacts`, `connections`, `reports` (eigene), `blocks`, `daily_coach`, `audio_analysis`, `readiness_history`, `quota_ledger`, `verification_challenges`, `verification_requests`, `verification_events`, `audit_logs`, `activation_events`, `referral_events`, `app_feedback`, `analytics_events`, `mail_queue`.
* **Pseudonymisierte DSA-Nachweise:** Meldungen Dritter über das gelöschte Profil werden nach DSA Art. 17 pseudonymisiert (`reportedProfileId: 'geloescht_...'`), um Beweise für Rechtsverletzungen vorzuhalten.
* **Rechtliche Aufbewahrungspflichten (GoBD/PCI-DSS - 7):** `processed_stripe_events` (Idempotenz-Schutz), `deletion_metrics` (Aggregierte Zeitmessung ohne Personenbezug), `deletion_log` (Hash-Audit).
* **Automatisierter Schwellenwert:** Das CI-Gate `scripts/loeschkaskade.mjs 0` garantiert, dass keine unentschiedenen Kollektionen existieren dürfen.

---

## 4. AI Governance, ISO 42001 & NIST AI RMF

### 4.1 Risikomanagement-Zyklus
1. **Map (Kontextualisierung):** Risiken durch Halluzination, toxische Sprache, Minderjährigen-Interaktion und Prompt-Injection wurden im Bedrohungsmodell erfasst.
2. **Measure (Messung & Monitoring):** Latenzen, Token-Verbrauch, Fehlerraten und Risikoscores (`assessRisk`, `evaluateAccountRisk`) werden fortlaufend gemessen.
3. **Manage (Kontrollen & Schutz):**
   * *OWASP LLM01 (Prompt Injection):* Klare Trennung von System-Instruktion und untrusted User-Data.
   * *OWASP LLM02 (Insecure Output Handling):* Zwingende JSON-Schemas (`responseSchema`) mit Typvalidierung für jede Modellantwort.
   * *OWASP LLM04 (Model Denial of Service):* Caching mit 36 Stunden Frist (`geminiCacheService`), globales Rate-Limiting (60 Calls/Stunde für KI) und Abort-Timeouts.
   * *OWASP LLM06 (Sensitive Information Disclosure):* Striktes PII-Filtering vor Modellübertragung.
4. **Govern (Leitungs- und Kontrollstrukturen):** Vollständige deterministische Ausfallstrategie (`STRATEGIE` in `src/server/kiPolitik.ts` und kuratierte Antworten in `src/server/kuratiert.ts`). Ein Ausfall externer KI-Provider führt niemals zu Systemstillstand oder unsicheren Default-Zuständen.

---

## 5. Audit-Freigabe & Verifikationsstempel

* **Build & Kompilierung:** `compile_applet` bestanden (0 Fehler).
* **Linter & Typisierung:** `lint_applet` & `tsc --noEmit` bestanden (0 Warnings).
* **Löschkaskade:** `check:loeschkaskade 0` bestanden (0 offene Sammlungen).
* **Enterprise Security & Compliance:** `npm run check:enterprise` bestanden (10/10 Prüf-Gates grün).
* **Plattform- & Risikotests:** `npm run test:enterprise` bestanden (5/5 Subtests erfolgreich).
