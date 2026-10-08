# Prompt-Templates für Coding-Agenten

Diese Prompts sind so formuliert, dass sie deterministische, spezifikationsgetreue Ergebnisse ohne "AI Slop" erzeugen.

## Prompt 1: Kontakt-Zähler und Serverseitige Limits (Epic 1)

**System-Rolle:** Du bist Backend Security Engineer. Du schreibst TypeScript und Firebase Rules.
**Kontext:** In der Dating-App "Klar" gibt es ein hartes Limit von 8 Erstkontakten pro Tag. Wir nennen sie "Kontakte", nicht "Swipes" oder "Likes".
**Aufgabe:**
1. Schreibe eine Firebase Admin SDK Funktion `sendInitialContact(senderId, receiverId)`, die:
   - Prüft, ob der User im `quota_ledger` für heute noch Kontakte übrig hat (< 8).
   - In einer Firestore Transaction den Zähler erhöht UND den Chat/die Kontaktanfrage anlegt.
2. Implementiere die Rücknahmefunktion `revertContact(contactId)`: Wenn der Zeitstempel < 5 Sekunden in der Vergangenheit liegt, wird der Datensatz hart gelöscht und der Zähler im `quota_ledger` wieder um 1 reduziert.
**Regeln:**
- Client darf seinen eigenen Kontaktzähler NIEMALS über `update()` manipulieren können (Rules prüfen).
- Keine "Swipes" oder "Matches" im Code nennen. Verwende `Contact` und `Connection`.
- Output als kopierbare `.ts` Datei.

---

## Prompt 2: Icebreaker-Gate (Epic 2)

**System-Rolle:** Du bist React Frontend Engineer mit Fokus auf UI/UX.
**Kontext:** Bevor zwei Personen in "Klar" frei chatten können, müssen sie das Icebreaker-Gate durchlaufen.
**Aufgabe:**
1. Erstelle die Komponente `IcebreakerGate.tsx`. Sie wird im Chat angezeigt, solange der Status `icebreakerCompleted: false` ist.
2. Zeige zwei Fragen an, die von beiden Nutzern beantwortet werden müssen.
3. Bis beide geantwortet haben, ist das reguläre Texteingabefeld deaktiviert.
**Design-Vorgaben (Strikt!):**
- Nutze Tailwind CSS.
- Keine Farbverläufe, kein Glassmorphism, keine Schlagschatten.
- Nutze reine, entsättigte Farben (z.B. stone-50, stone-900).
- Radien maximal 16px für Karten, 24px für primäre Buttons.
- Trefffläche der Buttons mind. 44px. Textkontrast > 4.5:1.
**Output:** React-Komponente (TypeScript) ohne Dummy-Texte, aber mit klaren Props.

---

## Prompt 3: AdMob SSV Callback (Epic 3)

**System-Rolle:** Du bist Backend Security Engineer.
**Kontext:** Nutzer können Werbung schauen, um +3 Kontakte zu erhalten. Die Bestätigung erfolgt rein serverseitig via AdMob SSV.
**Aufgabe:**
1. Schreibe einen Express-Endpunkt `POST /api/admob-ssv`, der den Google AdMob Server-Side-Verification (SSV) Callback entgegennimmt.
2. Überprüfe die ECDSA-SHA-256 Signatur des Requests gegen die öffentlichen Google-Schlüssel (fetch von der offiziellen Google-URL).
3. Stelle Idempotenz über die `transaction_id` sicher, indem diese in Firestore (`ad_transactions`) gespeichert wird (einmalig).
4. Nach Verifikation: Schreibe einen Grant-Eintrag (type: 'ad_reward', value: 3) in den `quota_ledger` des Nutzers.
**Regeln:**
- Nutze die Krypto-Bibliothek von Node.js.
- Akzeptiere NIEMALS clientseitige Bestätigungen.
- Behandle Edge-Cases (z.B. Keys nicht erreichbar, Duplikat).
