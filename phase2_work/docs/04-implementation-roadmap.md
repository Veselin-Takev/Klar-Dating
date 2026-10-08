# Phase 4: Implementation Roadmap & Launch-Vorbereitung

## 1. Sprint-fähige Backlog-Struktur (Epics & User Stories)

### Epic 1: Core Mechanics & Identity (Woche 1-2)
- **Story 1.1:** Als Nutzer muss ich mich per Foto verifizieren (isVerified: true), um andere Profile sehen zu können (Vertrauen & Sicherheit).
- **Story 1.2:** Als System muss ich sicherstellen, dass maximal 8 "Vorschläge" pro Tag geladen werden (12 für Klar Plus) (Tageswechsel 4:00 Uhr).
- **Story 1.3:** Als Nutzer möchte ich maximal 8 "Kontakte" (Erstnachrichten) pro Tag versenden können, streng serverseitig in Firestore Rules limitiert.
- **Story 1.4:** Als Nutzer möchte ich innerhalb von 5 Sekunden eine Erstnachricht zurücknehmen können (Vollständiger Revert, Zähler wird erstattet).

### Epic 2: The Icebreaker-Gate & Chat (Woche 3)
- **Story 2.1:** Als Nutzer muss ich vor dem freien Chat 2 Icebreaker-Fragen des Gegenübers beantworten, um Qualität im Austausch zu sichern.
- **Story 2.2:** Als System muss ich Nachrichten unveränderlich speichern (DSA Art. 16) und Melde-Funktionen nahtlos anbinden.
- **Story 2.3:** Als Nutzer möchte ich eingehende Nachrichten echtzeit-übersetzt sehen, falls sie nicht in meiner Sprache sind (LibreTranslate/OpenSource).

### Epic 3: Monetarisierung (Zeit vs. Geld) (Woche 4)
- **Story 3.1:** Als Nutzer möchte ich zwischen "Werbung ansehen" (+3 Kontakte) und "Klar Plus Abo" (11,99€) wählen, bei visuell exakt gleicher Button-Darstellung.
- **Story 3.2:** Als System verbuche ich Werbe-Belohnungen ausschließlich über den serverseitigen AdMob-SSV-Callback (ECDSA-SHA-256 signiert).
- **Story 3.3:** Als Nutzer möchte ich gemäß § 312k BGB eine unmittelbar erreichbare Kündigungsschaltfläche für Klar Plus vorfinden.

### Epic 4: Compliance & Sicherheit (Woche 5)
- **Story 4.1:** Als System lösche ich Daten kaskadierend (Art. 17 DSGVO), behalte aber meldepflichtige Belege gemäß Aufbewahrungsfrist.
- **Story 4.2:** Als Nutzer muss ich vor der Erfassung von besonderen Kategorien (Art. 9 DSGVO) ausdrücklich einwilligen.
- **Story 4.3:** Als System sende ich bei jeder Nutzermeldung unverzüglich eine Eingangsbestätigung (DSA Art. 16) und bei Einschränkungen eine Begründung (DSA Art. 17).

---

## 2. Test-Strategie

| Test-Level | Werkzeuge | Fokus | CI/CD Integration |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | Vitest | Geschäftslogik (Limits, Zähler, Icebreaker-Gate, Altersberechnung). | Bei jedem Commit (Blocker bei < 85% Coverage). |
| **Integration** | Vitest + Firestore Emulator | Backend-Sicherheit, Firebase Rules (`dailyCount`, `isVerified`), SSV-Callbacks. | Nightly & vor PR-Merge. |
| **E2E Tests** | Playwright | Kritische Pfade: Onboarding, Kontakt-Versand inkl. 5-Sekunden-Revert, Bezahl-Flows. | Vor jedem Release. |
| **Security/Load** | k6 (Lasttests) | Rate-Limiting, SSV-Idempotenz, Translation-API Latenz (P95 < 1.5s). | Wöchentlich im Staging. |
| **Legal Tests** | Manuell / E2E-Assertions | Sichtbarkeit der Kündigungsschaltfläche, Opt-Ins (Art. 9), Lösch-Kaskaden in Firestore. | Freigabe-Gate vor App-Store. |

---

## 3. Launch-Checklist (Go/No-Go Kriterien)

### App-Store & Legal
- [ ] **Kündigungsbutton (§ 312k BGB):** Unmittelbar erreichbar, keine Dark Patterns.
- [ ] **Widerrufsbutton (§ 356a BGB):** Implementiert und rechtskonform beschriftet.
- [ ] **Alters- und Identitätsprüfung:** Foto-Pflicht hart im Backend erzwungen (`isVerified: true`).
- [ ] **Einwilligungen (Art. 9 DSGVO):** Opt-In-Dialoge für Dating-spezifische Daten dokumentiert.
- [ ] **Impressum & Datenschutzerklärung:** Native in App verlinkt, kein Login erforderlich für Ansicht.

### Technisch & Monitoring
- [ ] **SSV (Server-Side Verification):** AdMob-Callbacks sind auf ECDSA-Signatur geprüft, Replay-Attacken über `transaction_id` ausgeschlossen.
- [ ] **Firestore Rules:** `contactCount` Limit (8) wird in einer unteilbaren Transaktion geprüft. Client-seitiges Setzen des Limits ist blockiert.
- [ ] **Latenz:** Translation-API & Match-Generation P95 Latenz < 1500ms gemessen.
- [ ] **Fehler-Tracking:** Sentry (oder Alternative) ist konfiguriert (DSGVO-konform, keine PII-Daten im Stacktrace).

### UX & Content
- [ ] **Design-Audit:** Keine Farbverläufe, keine Schlagschatten, Buttons ≥ 44px, Kontrast ≥ 4.5:1 gemessen.
- [ ] **Glossar-Konsistenz:** Keine Erwähnung von "Swipes", "Likes", "Matches" im UI (ersetzt durch "Vorschläge", "Nachrichten", "Kontakte").
