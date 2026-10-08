# Klar — Fahrplan zur Enterprise-Abnahme

**Stand:** 09.08.2026 · **Grundlage:** Verbindlicher Arbeitsauftrag
(Enterprise-Ready-Abnahme), Final Audit & Release Report vom 08.08.2026,
`Prompts_Instructions`, Projektunterlagen `klar/01`–`klar/11`

**Vorgabe des Auftraggebers:** Alle Funktionen aus `klar_09.08.2026` bleiben
erhalten und werden geprüft. Entfernt wird nur, wofür ein triftiger Grund
vorliegt — und der ist zu benennen, nicht zu behaupten.

---

## 1. Ausgangslage — gezählt, nicht geschätzt

| | |
|:--|--:|
| Bildschirme | 14 |
| Komponenten und Widgets | 178 |
| API-Endpunkte | 82 |
| davon mit Gemini | 53 |
| Widgets allein im Dashboard | 92 |
| Automatisierte Tests | 73 Logik + 53 Regeln |
| Befunde des Abnahmeberichts | 45 — **30 behoben, 15 offen** |

**Was belegt ist:** `npm run verify` läuft grün — Typprüfung über beide
tsconfigs, 26 Kontrastpaare, 73 Logiktests, 53 Firestore-Regeltests gegen den
Emulator.

**Was nicht belegt ist:** Keine einzige Funktion wurde je über den vollen Weg
geprüft — *User Interface → Frontend → API → Backend → Datenbank → Response →
Frontend*. Genau das verlangt § 4 des Arbeitsauftrags. Die App lief bisher
ohne Datenbank; das ist seit heute behoben (`npm run dev:lokal`).

---

## 2. Zielbild — die zwölf Abnahmekriterien (§ 13)

| # | Kriterium | Heute |
|:--|:--|:--|
| 1 | Kritische/hohe Fehler behoben oder bewertet | **teilweise** — 30 von 45 |
| 2 | Alle Kernfunktionen erfolgreich getestet | **nein** — keine Funktion end-to-end |
| 3 | Keine bekannten kritischen Sicherheitslücken | **fast** — SEC-09, SEC-11 offen |
| 4 | Berechtigungen und Zugriffskontrollen korrekt | **ja, belegt** — 53 Regeltests |
| 5 | Datenintegrität gewährleistet | **teilweise** |
| 6 | Datenschutz technisch berücksichtigt | **weitgehend** — DSG-06/07/08 offen |
| 7 | Performance und Stabilität nachgewiesen | **nein** — nie gemessen |
| 8 | Build und Deployment reproduzierbar | **teilweise** — Build nie gelaufen |
| 9 | Regressionstests abgeschlossen | **teilweise** — 126 automatisiert, keine E2E |
| 10 | Keine kritischen Blocker für den Produktivbetrieb | **unklar** bis Phase 1 |
| 11 | Technische Dokumentation aktualisiert | **teilweise** |
| 12 | Nachvollziehbarer Test- und Abnahmebericht | **veraltet** — Stand 08.08. |

Vier Kriterien lassen sich erst nach Phase 1 überhaupt beurteilen. Deshalb
steht sie vorn.

---

## 3. Vier Widersprüche — vor dem Weiterbauen zu entscheiden

Diese vier stammen **nicht** aus dem Abnahmebericht. Sie sind beim Abgleich
der Unterlagen mit dem Code aufgefallen und sind je eine Produktentscheidung,
keine technische Frage.

### W-1 · Verifizierung: ADR-008 gegen K-1

`klar/01-architektur.md`, ADR-008 legt fest: **kein Referenzbild**, kein
biometrisches Template — nur `verification_status`, `verified_at`, `method`
und die Vorgangs-ID eines Anbieters. Empfohlen: **IDnow**, Server in
Deutschland.

Gebaut ist etwas anderes: K-1 legt ein **Verifizierungsfoto in Firebase
Storage** ab und lässt die Moderation daraufschauen. Das erzeugt genau die
Art-9-Datenhaltung, die ADR-008 vermeiden wollte, und verlagert die Prüfung
auf eigenes Personal.

*Zu entscheiden:* K-1 bleibt (dann gehört ADR-008 überschrieben, samt DSFA
nach Art. 35) — oder K-1 weicht einem Anbieter (dann Kosten, Vertrag,
Vorlauf).

### W-2 · Live-Übersetzung: Spezifikation gegen Umsetzung

Die Feature-Spezifikation ist eindeutig: *„Ausschließlich Einsatz der besten
kostenlosen / Open-Source-Tools (keine kostenpflichtigen APIs mit laufenden
Kosten)."* Genannt: LibreTranslate, NLLB-200, OPUS-MT, Argos — **selbst
gehostet**. Dazu: *„Keine Weitergabe an Drittanbieter-APIs mit
Datenverarbeitung außerhalb der EU."*

Gebaut ist `POST /api/translate` **über Google Gemini**. Das verletzt beide
Vorgaben: laufende Kosten je Nachricht, und Chatinhalte gehen an einen
Drittanbieter.

*Zu entscheiden:* Spezifikation gilt (dann eigener Übersetzungsdienst,
Aufwand mehrere Tage plus Betrieb) — oder die Spezifikation wird geändert
(dann gehören Kosten und AVV in die Unterlagen).

### W-3 · Vorschläge sind erfunden

Die Vorschläge im Dashboard kommen aus `src/data.ts`: **vier erfundene
Profile**. Ein Matching gegen echte Nutzer existiert nicht. „Alle Funktionen
prüfen" ist für Vorschläge, Kontaktkontingent und Icebreaker-Gate deshalb
heute gar nicht durchführbar — es gibt niemanden zu kontaktieren.

*Zu entscheiden:* Prüfung mit erzeugten Testkonten (schnell, reicht für die
Abnahme) — oder K-2 zuerst bauen (echte Vorschläge, größerer Umfang).

### W-4 · Umfang gegen Produktversprechen

92 Widgets auf einem Bildschirm, 178 Komponenten, 53 KI-Endpunkte. Das
Versprechen lautet *„Weniger Swipes. Mehr echte Gespräche."*, und die
Design-Richtlinie verbietet in § 12 erfundene Dringlichkeit und
Aufmerksamkeitsfänger.

Ihre Vorgabe ist klar: **alles bleibt**. Ich halte mich daran. Der Widerspruch
gehört trotzdem benannt, weil er zwei messbare Folgen hat — die Ladezeit
(§ 8 des Auftrags) und die Kosten der 53 KI-Endpunkte (§ 3 des
Prüfberichts: „unbegrenzte Gemini-Kosten möglich").

---

## 4. Der Fahrplan

Jede Phase endet an einem **Tor**: einem prüfbaren Ergebnis. Ohne das Tor
beginnt die nächste Phase nicht.

### Phase 0 — Die App läuft · *heute, erledigt*

`npm run dev:lokal` startet Auth-Emulator, Firestore-Emulator, Server und
Frontend in einem Zug. Moderator-Anspruch über `scripts/dev-moderator.mjs`.

**Tor:** Anmeldung, Altersprüfung, Einwilligung und Dashboard sind einmal
durchlaufen. *(Ihr nächster Schritt.)*

### Phase 1 — Funktionsprüfung aller Features · *das Kernstück*

Für **jede** der 14 Ansichten und jede Funktion darin der volle Weg:
Oberfläche → API → Datenbank → Antwort → Oberfläche. Dazu die in § 4 des
Auftrags genannten Fälle: neue und bestehende Nutzer, nicht angemeldet,
verschiedene Berechtigungen, ungültige Eingaben, fehlende Pflichtfelder,
doppelte Anfragen, Netzunterbrechung, Zeitüberschreitung, Serverfehler,
leere Datensätze, große Datenmengen, parallele Zugriffe.

**Ergebnis:** eine Funktionsmatrix — Funktion, Weg, Status, Befund. Sie ist
zugleich die Antwort auf Abnahmekriterium 2 und die Grundlage für 10.

**Erwartung, offen ausgesprochen:** Das wird die längste Phase und die mit den
meisten neuen Befunden. Bisher hat *jeder* Schritt, der die App tatsächlich
laufen ließ, Fehler gefunden, die kein Werkzeug gefunden hatte — die weiße
Seite, die falsche Verschlüsselungszusage, zwei Rules-of-Hooks-Abstürze.

**Tor:** Funktionsmatrix vollständig, jeder Eintrag mit Beleg.

### Phase 2 — Unterlagen abgleichen, Widersprüche entscheiden

Die dreizehn ungelesenen Dokumente durcharbeiten (`klar/01`–`08`,
`docs/specs.md`, `docs/04`, `docs/05`, `docs/templates`,
`sus-testing-guide.md`) und den gebauten Stand dagegen halten. W-1 bis W-4
entscheiden.

**Tor:** Abgleichbericht; jede Abweichung entweder behoben oder als bewusste
Änderung in den Unterlagen nachgetragen.

### Phase 3 — Die 15 offenen Abnahmebefunde

SEC-09 (Schema-Validierung), SEC-11 (App Check), FUN-01/03/04 (erfundene
Daten und flüchtiger Serverzustand), BT-04/05 (Widget-Duplikate, toter Code —
darunter der Parallelbaum `app/applet/`), DSG-06/07/08 (Log-Bereinigung, AVV,
Backup), DAT-02-Folgearbeit (`public_profiles` befüllen).

**Tor:** 45 von 45 behoben oder ausdrücklich bewertet und akzeptiert.

### Phase 4 — Echte Daten statt Simulation

FUN-01 ist der größte Einzelposten: Matching, Vorschläge, Monitoring und
43 × `Math.random()` in 26 Dateien liefern erfundene Zahlen, die für die
bedienende Person nicht von echten zu unterscheiden sind. § 4 des Auftrags
verbietet genau das.

**Tor:** Keine Anzeige zeigt mehr eine Zahl, die nicht aus echten Daten
stammt.

### Phase 5 — Testpyramide und Regression

Heute: 126 automatisierte Tests, davon keiner über die Oberfläche. Nötig:
Komponententests für die kritischen Bildschirme, E2E über Playwright für die
Kernwege (Registrierung → Alter → Einwilligung → Kontakt → Gespräch →
Meldung → Löschung), Abdeckungsschwelle in der CI.

**Tor:** Abnahmekriterium 9 erfüllt; die CI bricht bei Rückschritten.

### Phase 6 — Performance messen

§ 8 verlangt Zahlen: Ladezeiten, API-Antwortzeiten, Datenbankverhalten,
Speicher, parallele Nutzer. Heute gibt es dazu **keine einzige Messung** —
die angezeigten Kennzahlen sind erfunden (FUN-03).

**Tor:** P95-Werte für die fünf wichtigsten Wege, gemessen und dokumentiert.

### Phase 7 — Betrieb

Backup und Wiederherstellung (Firestore PITR), echte Health-Probe,
strukturierte Protokolle ohne personenbezogene Daten, Monitoring,
Wiederanlaufplan. Dazu die vier manuellen Punkte, die kein Code löst:
Gemini-Schlüssel rotieren, Moderator-Anspruch in Produktion, Versender an
`mail_queue`, 30-Tage-Löschung der Verifizierungsfotos.

**Tor:** Ein Deployment ist reproduzierbar durchgeführt und wieder
zurückgerollt worden.

### Phase 8 — Abnahme

Neuer Final Audit & Release Report nach § 15 gegen die zwölf Kriterien.
Dazu die Dokumentation und der wiederverwendbare Skill.

**Tor:** Go-Live-Empfehlung — oder eine begründete Ablehnung.

---

## 5. Was automatisiert wird

Ihr Ziel ist, sich auf den Kern zu konzentrieren. Diese fünf Dinge nehmen
Ihnen wiederkehrende Arbeit ab; vier davon stehen bereits.

| | Stand |
|:--|:--|
| **`npm run verify`** — Typprüfung, Kontraste, Logik, Regeln in einem Befehl | **steht** |
| **CI bei jedem Push** — dieselbe Kette, plus Emulator | **steht** |
| **`npm run dev:lokal`** — ganze App inklusive Datenbank mit einem Befehl | **steht** |
| **Audit-Prompt** (`klar/09`) — deterministisch, mit Glossar und Selbstprüfung | **steht** |
| **Testdaten-Skript** — Konten, Profile, Gespräche auf Knopfdruck | Phase 1 |
| **Skill** — das Vorgehen dieser Sitzung als wiederverwendbare Anleitung | Phase 8 |

Der Skill entsteht bewusst zuletzt. Er wird schärfer, wenn er aus dem
abgeschlossenen Vorgehen abgeleitet wird, statt nebenher mitzuwachsen.

---

## 6. Risiken

| Risiko | Wirkung | Umgang |
|:--|:--|:--|
| Phase 1 fördert viele neue Befunde zutage | Zeitplan verschiebt sich | Funktionsmatrix zuerst vollständig, dann priorisieren — nicht unterwegs reparieren |
| 53 KI-Endpunkte × echte Nutzung | laufende Kosten, schwer vorhersehbar | Kontingent je Konto steht (60/Stunde); belastbare Tagesgrenze in Phase 3 |
| W-1 zugunsten eines Anbieters entschieden | K-1 wird verworfen, Vorlauf mehrere Wochen | früh entscheiden, Phase 2 nicht verschieben |
| Rechtstexte fehlen | kein Store-Eintrag | `klar/05-backlog.md` nennt **3–4 Wochen Vorlauf** — jetzt anstoßen, nicht in Phase 8 |
| Alles bleibt erhalten | Ladezeit und Wartung | messen statt vermuten (Phase 6), dann entscheiden |

---

## 7. Nächster Schritt

```bash
npm run dev:lokal
```

Registrieren, Alter angeben, **„KI-Auswertung" anhaken**, Dashboard öffnen.
Danach den KI-Coach unter `/ai-coach` ausprobieren.

Was dabei auffällt — Fehler, leere Bildschirme, Knöpfe ohne Wirkung — bitte
notieren. Das ist der Anfang der Funktionsmatrix aus Phase 1.
