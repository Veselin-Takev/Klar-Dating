# Klar — Mobile Geburtsdatum-Eingabe und barrierefreie Altersprüfung

**Datum:** 07.11.2026 · **Status:** Review-only · **Backend-Blocker:** VES-11 P0 · **Freigabe:** NO-GO, `productionApproved=false`

## Anlass und Befund

Ein Android-Screenshot aus der Vercel-Vorschau zeigt einen blockierten Registrierungsablauf mit der Meldung „Die Altersprüfung ist derzeit nicht verfügbar“ sowie großer leerer Fläche über der Spracheinstellung und dem Geburtsdatum. Personenbezogene Bildinhalte werden **nicht** als Screenshot ins Repository hochgeladen.

Das bereits dokumentierte [VES-11](https://linear.app/takev/issue/VES-11/p0-vercel-altersprufung-blockiert-durch-fehlende-api-und-asset-404) trennt diesen Backend-Fehler von Datumsvalidierung: Auf der betroffenen Bereitstellung fehlte eine funktionierende API-Weiterleitung, und die Vercel-Variablen für einen freigegebenen Upstream sind nicht konfiguriert. Der übergeordnete [Draft PR #337](https://github.com/Veselin-Takev/Klar-Dating/pull/337) hat einen ausdrücklich fail-closed arbeitenden API-Proxy. **Vercel-Status READY bedeutet nicht, dass der Altersprüfungs-Backend-Dienst funktioniert.**

## Mobil- und Accessibility-Verbesserungen

- Kompaktes, oben ausgerichtetes Mobil-Layout statt vertikaler Zentrierung mit großer Leerfläche; größere Displays behalten eine zentrierte Darstellung.
- Standardmäßig drei klar beschriftete, logisch gruppierte Felder **Tag / Monat / Jahr**. Monat als native Auswahl mit lokalisiertem Monatsnamen, Tag und Jahr mit numerischer Tastatur; keine jahrzehntelange Scroll-Navigation.
- Wahlweise **„Kalender verwenden“** über die bisherige native Date-Picker-Komponente. Beim Wechsel bleiben gültige Angaben als ISO-Datum erhalten, ohne Monats-/Zeitzonenverschiebung.
- Mindestens 52 px hohe Haupt-Eingaben, sichtbarer Tastaturfokus, zugeordnete Labels, `fieldset`/`legend`, Autofill-Hinweise und Inline-Fehler mit `role="alert"`.
- Fehlermeldung für einen API-Ausfall markiert die Geburtsdatum-Felder **nicht** mehr fälschlich als ungültig. Die eingegebene Angabe bleibt für einen manuellen erneuten Versuch erhalten; kein automatisches Dauersenden.
- Lokal wird nur das Kalenderformat geprüft (einschließlich Schalttag). Minderjährige werden **nicht** durch eine browserseitige Entscheidung freigegeben oder gesperrt. Alle Benutzerkontroll- und Altersentscheidungen bleiben zwingend beim serverseitigen `POST /api/account/alter` plus bestätigtem `refreshProfile()` für dieselbe UID und das gleiche Geburtsdatum.
- Vollständige Beschriftung in DE/EN/ES/FR, ohne DOB-Logging oder Speicherung in Local Storage.

## Tests und Abnahme

- `src/lib/birthdateEntry.test.ts`: ISO-Konversion, Schalttage, unmögliche Daten, unvollständige Eingaben, Kalender-Roundtrip und keine browserseitige Unteraltersperre.
- `src/components/EinwilligungUndAlter.test.tsx`: Accessibility-Gruppe, beschriftete Eingaben, Kalenderwechsel, API 503, POST-Body als ISO und kein Übergang bei nicht bestätigter Serveridentität.
- Aktualisierter `e2e/e2e-critical-flows.spec.ts`: unterstützt neue Direktfelder und serverseitige Unteraltersprüfung.
- Vollständige Typecheck-/Enterprise-/Browser-CI auf dem exakten PR-Head erforderlich. Auf dem mobilen Browser mit Screenreader, 200 % Zoom, Tastatur und echter Backend-Vorschau erneut prüfen.

## Nicht durch diese UI-Änderung behoben

**VES-11 bleibt P0:** Für echte Registrierung braucht die Vercel-Vorschau einen unabhängig genehmigten, per Host-Pinning geschützten HTTPS-Backend-Ursprung, funktionsfähige Firebase-Identitäten/Firestore/Auth/App Check und einen authentifizierten E2E-Smoke-Test. Eine API-Antwort 503 bleibt ohne diesen Dienst ein korrektes Fail-Closed-Ergebnis. Keine Variable mit geratenem Host anlegen und keinen Frontend-Bypass implementieren.

**VES-5 bleibt P0:** Firestore/GCS-All-Writer-Fencing blockiert die generelle Produktionsfreigabe weiterhin. Keine Änderung an Sicherheitsregeln, kein Merge, keine produktive Bereitstellung und keine Änderung an `productionApproved=false`.
