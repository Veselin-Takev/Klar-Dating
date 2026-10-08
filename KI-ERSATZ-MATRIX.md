# KI-Ersatz-Matrix — Klar

Stand: 10.08.2026. Grundlage: `server.ts` (53 Endpunkte mit `ai.models.generateContent`),
Client-Zuordnung per Suche in `src/`.

**Regel über allem:** Eine erfundene personenbezogene Auswertung ist niemals zulässig.
Wo ein Endpunkt etwas über die nutzende Person oder ihr Gegenüber aussagt (Stimmung,
Kompatibilität, Fortschritt, Persönlichkeit, Risiko), kommt nur `kein_ersatz`,
`zwischenspeicher` oder `leer` in Frage — nie `kuratiert`.

## Matrix

| Endpunkt | Was er liefert | Client | Strategie | Begründung (1 Satz) |
|---|---|---|---|---|
| `/api/messages/send-audio` | `kein_ersatz` | Kein Ersatz für echte Transkription | Dürfte unmöglich simuliert werden |
| `/api/check-safety` | `isFlagged`, Erklärung, Deeskalations-Vorschläge zu einer Nachricht | kein Aufrufer in `src/` gefunden | `kein_ersatz` | Ein „unauffällig" ohne Prüfung ist eine Sicherheitsaussage, die niemand geprüft hat — heute liefert der Endpunkt ohne Schlüssel genau das (`isFlagged:false`). |
| `/api/chat` | Freitext-Antwort des KI-Coachs auf eine Nutzerfrage | `src/lib/api.ts` (`askAICoach`) → `Dashboard.tsx` | `kein_ersatz` | Eine Antwort auf eine unbekannte Frage lässt sich weder zwischenspeichern noch kuratieren; der Coach muss sagen, dass er gerade nicht da ist. |
| `/api/compatibility-radar` | Kompatibilitäts-Scores 0–100 in 5 Kategorien | `src/lib/api.ts` (`fetchCompatibilityRadar`) → Radar-Diagramm | `zwischenspeicher` | Zahlen über die Passung zu realen Verbindungen dürfen nicht erfunden werden, ändern sich aber langsam genug für „Stand von gestern". |
| `/api/gemini/daily-coach-insight` | Ein Tagestipp | `src/components/DailyCoachInsightWidget.tsx` | `kuratiert` | Ein Tipp ist allgemeiner Inhalt, keine Bewertung — eine feste Tippliste mit Hinweis „nicht auf dich zugeschnitten" ist ehrlich. |
| `/api/gemini/dating-readiness` | `wisdom` + `actionableAdvice` (Tagesweisheit) | `src/components/DatingReadinessWidget.tsx` | `kuratiert` | Trotz des Namens keine Reifeprüfung, sondern ein allgemeiner Spruch mit Handlungstipp. |
| `/api/dating-success-score` | Scores 0–100 in 4 Kategorien, Trendverlauf, Insight | `src/lib/api.ts` (`fetchDatingSuccessScore`) | `zwischenspeicher` | Bewertet die Person selbst; der heutige Ersatz erfindet „Kommunikation: 80". |
| `/api/dating-journal` | Insights, Tipps, Zusammenfassung, **Stimmung** zu einem Journal-Eintrag | `DatingJournalWidget.tsx`, `SmartDatingJournalWidget.tsx` | `kein_ersatz` | Bezieht sich auf genau den eben abgeschickten Eintrag — ein alter Stand gehört zu einem anderen Text, ein kuratierter zu niemandem. |
| `/api/daily-icebreakers` | 3 Icebreaker-Fragen | `src/components/DailyIcebreakerWidget.tsx` | `kuratiert` | Reiner Gesprächsanstoß, ohne Aussage über eine Person. |
| `/api/klar-compass` | Charakterzüge, ergänzende Interessen, Fokus-Rat zur eigenen Person | `src/components/KlarCompassWidget.tsx` | `zwischenspeicher` | Persönlichkeitsaussage über die nutzende Person; das Profil ändert sich langsam, der heutige Ersatz erfindet „Offenheit, Tiefgründigkeit". |
| `/api/smart-vibe-map` | 3 Location-Typen + Vibe + Begründung aus eigenen Reflexionen | `SmartVibeMapWidget.tsx`, `src/lib/api.ts` | `zwischenspeicher` | Die `reason` behauptet etwas über die eigene Date-Historie („Spaziergänge wurden positiv bewertet") — das darf nicht erfunden, wohl aber veraltet gezeigt werden. |
| `/api/smart-date-planner` | 3 Date-Vorschläge nach Wetter/Zeit/Interessen | `SmartDatePlannerWidget.tsx`, `src/lib/api.ts` | `kuratiert` | Date-Ideen sind allgemeiner Inhalt; eine wetterneutrale Standardliste mit Kennzeichnung genügt. |
| `/api/city-trend-radar` | 3 angesagte, namentlich genannte Orte in einer Stadt | `src/lib/api.ts` (`fetchCityTrendRadar`) | `leer` | Der Wert liegt allein in der Ortsbindung; der heutige Ersatz erfindet Lokalnamen („Secret Garden Café") als echte Tipps. |
| `/api/icebreaker` | 1 Icebreaker + `reasoning` zum Verbindungs-Kontext | `src/lib/api.ts`, `src/screens/ChatView.tsx` | `kuratiert` | Der Text selbst ist allgemeiner Inhalt — die Begründung muss beim Ersatz entfallen, sonst behauptet sie einen Bezug, den es nicht gibt. |
| `/api/verbindung-context-analysis` | 3 Themen mit Potenzial-Score 0–100 aus eigenen Dates | `src/lib/api.ts` (`fetchMatchContextAnalysis`) | `zwischenspeicher` | Scores über die eigene Date-Historie; der heutige Ersatz erfindet „Gemeinsamer Humor: 85". |
| `/api/date-archive-analysis` | 3 Erfolgsmuster + 1 Lernpunkt aus eigenen Reflexionen | `src/lib/api.ts` (`fetchDateArchiveAnalysis`) | `zwischenspeicher` | Auswertung des eigenen Verhaltens, ändert sich mit jedem neuen Eintrag nur wenig. |
| `/api/date-checklist` | 5–7 Vorbereitungstipps (Outfit/Mindset/Gespräch) | `src/lib/api.ts` (`fetchDateChecklist`) | `kuratiert` | Verhaltensregeln gegen Nervosität sind allgemeingültig und von Menschen schreibbar. |
| `/api/gemini/date-inspiration` | 3 Date-Ideen (Titel, Beschreibung, Kategorie, „warum es wirkt") | `src/components/DateInspirationTab.tsx` | `kuratiert` | Allgemeine Ideensammlung ohne Personenbezug. |
| `/api/date-ideas` | 3 Date-Ideen (Titel + Beschreibung) | `DatingWheelWidget.tsx`, `src/lib/api.ts` | `kuratiert` | Wie oben; der heutige Ersatz („Spaziergang / Im Park") ist bereits faktisch eine kuratierte Liste, nur ohne Kennzeichnung. |
| `/api/feeling-question` | 1 Reflexionsfrage zur eigenen Verfassung | `src/components/TodayFeelingTrackerWidget.tsx` | `kuratiert` | Der Endpunkt bekommt gar keine Eingabe — eine feste Fragenliste leistet exakt dasselbe. |
| `/api/profile-summary` | „Verbindungs-Tipp": warum ihr zusammenpasst | `src/lib/api.ts` → `Dashboard.tsx` | `leer` | Eine erfundene Passungs-Begründung zu einem konkreten fremden Profil ist genau der verbotene Fall; die Kachel entfällt ersatzlos. |
| `/api/generate-date-plan` | 1 konkreter Date-Plan (Titel, Zeit, Ort, Ablauf) | `src/screens/ChatView.tsx` | `kuratiert` | Ein Date-Vorschlag ist Inhalt, keine Bewertung — als „Standardvorschlag, nicht auf euren Chat bezogen" gekennzeichnet zulässig. |
| `/api/date-locations` | 3 Orte/Aktivitäten fürs erste Date mit Begründung | `src/screens/ChatView.tsx` | `kuratiert` | Ortstypen sind allgemein; die Begründung muss beim Ersatz allgemein formuliert sein. |
| `/api/ai-passgenauigkeit` | Pro Profil: Score 0–100 + Begründung | `Dashboard.tsx` KI-Deep-Kontakt | `kein_ersatz` | Serververtrag wiederhergestellt: strikte Input-/Output-Validierung; bei Ausfall oder unvollständiger Modellantwort keine erfundenen Scores. |
| `/api/conversation-tuning` | 3 Antwort-Optionen mit Stil + Erklärung | `src/screens/ChatView.tsx` | `kuratiert` | Formulierungshilfen sind Inhalt; gekennzeichnet als „allgemein, nicht auf euren Verlauf bezogen" tragbar. |
| `/api/icebreakers` | 3 kontextbezogene Eröffnungsnachrichten | `src/screens/ChatView.tsx` | `kuratiert` | Wie oben; der heutige Ersatz („Hallo, wie gehts?") widerspricht sogar der eigenen Anweisung und gehört ersetzt. |
| `/api/verbindung-optimizer` | 3 Date-Konzepte mit Tag | `src/components/VerbindungOptimizerWidget.tsx` | `kuratiert` | Konzeptideen ohne Aussage über die Zielperson. |
| `/api/analyze-relationship` | Tonalitäts-Score 0–100 über Zeit + Themenhäufigkeit | `src/components/RelationshipProgressWidget.tsx` | `zwischenspeicher` | Beziehungsfortschritt ist eine Aussage über zwei Personen; ein erkennbar alter Verlauf ist ehrlich, ein erfundener nicht. |
| `/api/quick-insight` | 1 kurzer, positiver Satz zur eigenen Bio | `src/components/ProfileCheckWidget.tsx` | `leer` | Auch ein Anreißer wie „Tolle Basis!" ist ein Urteil über das Profil — ohne Prüfung darf er nicht erscheinen. |
| `/api/profile-check` | 3 Scores 0–100, Wirkung, Vorschläge, Faktoren, optimierte Bio | `src/components/ProfileCheckWidget.tsx` | `kein_ersatz` | Der heutige Ersatz erfindet 80/75/85 und eine „optimierte Bio" — genau das darf es nicht geben. |
| `/api/mood-monitor` | Stimmungs-Kategorie, Score, Kommentar aus den letzten Chats | `src/components/MoodMonitorWidget.tsx` | `leer` | Stimmung ändert sich schnell, ein alter Stand führt in die Irre — und der heutige Ersatz („harmonisch, 70, Alles bestens") kann eine belastende Dynamik überdecken. |
| `/api/parse-profile-import` | Bio + 3–5 Interessen aus eingefügtem Text | `src/lib/api.ts` (`parseProfileImport`) | `kein_ersatz` | Der heutige Ersatz erfindet Bio und Interessen („Musik, Reisen, Kochen"), die die Person anschließend als ihre eigenen speichert. |
| `/api/optimize-profile` | Umgeschriebene Bio + 5 Interest-Tags | `src/lib/api.ts` (`optimizeProfileApi`) | `kein_ersatz` | Der Ersatz hängt „(Optimierte Version)" an und erfindet ein „Neues Hobby" — Profiltext über eine Person darf nicht erfunden werden. |
| `/api/translate` | Übersetzung einer Chat-Nachricht | `src/services/translationService.ts` | `kein_ersatz` | Eine erfundene Übersetzung ist eine Falschaussage darüber, was ein Mensch gesagt hat — hier bereits korrekt umgesetzt (503/502 statt Platzhalter). |
| `/api/date-summary` | Momente + Lerneffekte zu einem Date-Eintrag | `src/lib/api.ts` (`fetchDateSummary`) | `leer` | Bezieht sich auf genau diesen Eintrag; ein fremder oder alter Stand wäre schlicht falsch, der Abschnitt entfällt. |
| `/api/reflection-questions` | 3 Reflexionsfragen nach dem Date | `PrePostDateVibeWidget.tsx`, `src/lib/api.ts` | `kuratiert` | Gute Reflexionsfragen sind allgemeingültig und brauchen die Bewertung nicht. |
| `/api/mood-insight` | Stimmungstrend-Zusammenfassung + Tipp | `src/components/MoodInsightWidget.tsx` | `zwischenspeicher` | Trend über mehrere Dates ändert sich langsam; der heutige Ersatz behauptet ungeprüft „Deine Stimmung war positiv". |
| `/api/reflection-insight` | 3 personalisierte Kommunikations-Verbesserungen | `src/components/ReflectionInsightDashboard.tsx` | `zwischenspeicher` | Leitet aus dem eigenen Verhalten der Vorwoche ab — veraltet vertretbar, erfunden nicht. |
| `/api/competence-radar` | 4 Kompetenz-Scores 0–100 | `src/components/CompetenceRadarWidget.tsx` | `zwischenspeicher` | Der heutige Ersatz erfindet feste Werte (80/65/70/60), die im Diagramm nicht von echten zu unterscheiden sind. |
| `/api/summarize-voice` | Zusammenfassung eines transkribierten Sprachtexts | `src/components/DatingTimelineWidget.tsx` | `leer` | Ohne KI gibt es keine Zusammenfassung dieses einen Texts; der Rohtext bleibt ohnehin erhalten. |
| `/api/timeline-summary` | Zusammenfassung + Trend über vergangene Dates | `src/components/DatingTimelineWidget.tsx` | `zwischenspeicher` | Rückblick über einen längeren Zeitraum, dessen alte Fassung noch weitgehend zutrifft. |
| `/api/date-planner` | 3 Date-Ideen nach Ort, Zeit, Wetter | **kein Aufrufer in `src/` gefunden** | `kuratiert` | Liefert Aktivitäts-Typen, keine benannten Lokale — eine wetterneutrale Standardliste ist ehrlich möglich. |
| `/api/city-insider` | 3 namentlich benannte, ruhige Orte in einer Stadt | `src/components/CityInsiderWidget.tsx` | `leer` | Wie beim Trend-Radar: ohne echte Ortskenntnis wären es erfundene Lokale, und generische Angaben haben keinen Wert. |
| `/api/generate-reflection-from-emojis` | 2–3 Sätze Tagebuch-Entwurf in der Ich-Form | `src/components/SmartDatingJournalWidget.tsx` | `kein_ersatz` | Der Text landet als eigene Aufzeichnung im Tagebuch — erfundene Sätze in der Ich-Form über ein Date sind unzulässig. |
| `/api/dating-journal-analysis` | Date-Dynamik, **Verhaltensmuster**, Ratschlag | `src/components/SmartDatingJournalWidget.tsx` | `kein_ersatz` | „Erkannte Muster im Beziehungsverhalten" ist eine Persönlichkeitsaussage und darf nicht aus dem Nichts kommen. |
| `/api/conversation-dynamics` | **Retired** — früher unsichtbare Chat-Dynamik-Analyse | kein aktiver Caller | `410 Gone` | Caller am 12.08.2026 entfernt, weil das Ergebnis nirgends angezeigt wurde. Der Server blockiert Legacy-Aufrufe explizit, damit keine unsichtbaren KI-Kosten zurückkehren. |
| `/api/date-check` | **Retired** — früher KI-Sicherheitscheck gegen persönliche No-Gos | kein aktiver Caller | `410 Gone` | `runDateCheck` wurde als toter Code entfernt; repositoryweite Suche findet keinen aktiven Caller. Legacy-Aufrufe bleiben explizit blockiert. |
| `/api/deep-verbindung-info` | **Retired** — frühere KI-Erklärung einer angeblich tiefen Verbindung | kein aktiver Caller | `410 Gone` | Repositoryweite Suche findet keinen `src/`-Consumer. Legacy-Aufrufe werden blockiert, damit keine unbeobachteten KI-Kosten oder unbegründeten Passungsaussagen zurückkehren. |
| `/api/nogo-suggestions` | 3 vorgeschlagene No-Gos aus dem eigenen Journal | `src/screens/Profile.tsx` | `kuratiert` | Ergebnis ist eine Auswahlliste, die die Person selbst annimmt oder verwirft — eine gekennzeichnete Liste häufiger No-Gos leistet dasselbe. |
| `/api/weekly-review` | Motivierender Wochenrückblick | `src/screens/Dashboard.tsx` | `leer` | „Diese Woche hast du tolle Fortschritte gemacht" ist eine Behauptung über die vergangene Woche der Person, die niemand geprüft hat. |
| `/api/extract-success-factors` | **Retired** — frühere KI-Extraktion von Erfolgsfaktoren | kein aktiver Netzwerk-Caller; `klar_success_factors` wird nur gelesen | `410 Gone` | Der UI-Bereich blendet sich bei leerem Zustand aus. Legacy-Aufrufe werden blockiert, damit keine unsichtbaren KI-Kosten entstehen. |
| `/api/optimize-bio-values` | 2 Vorschläge zur Bio-Optimierung anhand des Werte-Radars | `src/screens/Profile.tsx` | `kuratiert` | Vorschläge zur eigenen Textgestaltung, die die Person prüft und selbst übernimmt — keine Bewertung. |
| `/api/journal-audio-dump` | Transkript + Stimmung + Stimmungs-Einordnung | `src/components/DatingJournalWidget.tsx` | `kein_ersatz` | Ein Transkript ist eine Tatsachenbehauptung über gesprochene Worte; dazu kommt eine Stimmungsbewertung. |
| `/api/smart-audit` | Stärken, Vorschläge, Gesamt-Score 1–10 zu Bio und Profilbild | `src/components/SmartAuditWidget.tsx` | `kein_ersatz` | Benotet Bio und Foto einer Person mit einer Zahl — dafür gibt es keinen ehrlichen Ersatz. |

## Zusammenfassung

| Strategie | Anzahl |
|---|---|
| `kuratiert` | 18 |
| `kein_ersatz` | 13 |
| `zwischenspeicher` | 11 |
| `leer` | 11 |
| **Summe** | **53** |

### Verteilung im Detail

**`kein_ersatz` (13):** `/api/check-safety`, `/api/chat`, `/api/dating-journal`,
`/api/ai-passgenauigkeit`, `/api/profile-check`, `/api/parse-profile-import`,
`/api/optimize-profile`, `/api/translate`, `/api/generate-reflection-from-emojis`,
`/api/dating-journal-analysis`, `/api/journal-audio-dump`,
`/api/smart-audit`

**`zwischenspeicher` (11):** `/api/compatibility-radar`, `/api/dating-success-score`,
`/api/klar-compass`, `/api/smart-vibe-map`, `/api/verbindung-context-analysis`,
`/api/date-archive-analysis`, `/api/analyze-relationship`, `/api/mood-insight`,
`/api/reflection-insight`, `/api/competence-radar`, `/api/timeline-summary`

**`kuratiert` (18):** `/api/gemini/daily-coach-insight`, `/api/gemini/dating-readiness`,
`/api/daily-icebreakers`, `/api/smart-date-planner`, `/api/icebreaker`,
`/api/date-checklist`, `/api/gemini/date-inspiration`, `/api/date-ideas`,
`/api/feeling-question`, `/api/generate-date-plan`, `/api/date-locations`,
`/api/conversation-tuning`, `/api/icebreakers`, `/api/verbindung-optimizer`,
`/api/reflection-questions`, `/api/date-planner`, `/api/nogo-suggestions`,
`/api/optimize-bio-values`

**`leer` (11):** `/api/profile-summary`, `/api/quick-insight`, `/api/mood-monitor`,
`/api/city-trend-radar`, `/api/city-insider`, `/api/date-summary`,
`/api/summarize-voice`,
`/api/weekly-review`, `/api/extract-success-factors`

## Schwierige Entscheidungen

1. **`/api/mood-monitor` — `leer` statt `zwischenspeicher`.** Es ist die einzige
   personenbezogene Auswertung, bei der ich den Zwischenspeicher ausdrücklich
   ablehne: Stimmung aus den letzten Chats ändert sich in Stunden. Ein als „Stand
   von gestern" gekennzeichnetes „harmonisch" neben einem heute eskalierenden Chat
   wäre nicht nur veraltet, sondern beruhigend falsch.

2. **`/api/city-trend-radar` und `/api/city-insider` — `leer` statt `kuratiert`.**
   Diese beiden liefern *benannte* Orte in einer *bestimmten* Stadt. Eine kuratierte
   Liste müsste entweder erfundene Lokalnamen enthalten (unzulässige Tatsachenaussage
   über die Welt) oder nur Ortstypen — dann bleibt vom „Insider-Radar" nichts übrig.
   `/api/date-planner` und `/api/smart-date-planner` habe ich dagegen `kuratiert`
   zugeordnet, weil deren Schema Aktivitäts-*Typen* verlangt, keine Lokalnamen.

3. **`/api/icebreaker` und `/api/date-locations` — `kuratiert` mit Auflage.** Beide
   Schemata enthalten ein Begründungsfeld (`reasoning`, `description`), das auf den
   konkreten Gegenüber Bezug nimmt. Kuratiert zulässig sind sie nur, wenn die
   Begründung im Ersatzfall allgemein formuliert ist oder ganz entfällt — sonst
   behauptet der Ersatz einen Personenbezug, den er nicht hat.

4. **`/api/chat` — `kein_ersatz` statt `leer`.** Der Coach ist kein Widget, das sich
   ausblenden kann: Die Person hat eine Frage gestellt und wartet. Der heutige
   Ersatz („Das ist eine simulierte Antwort…") ist immerhin gekennzeichnet, gibt
   aber trotzdem Ratschläge, die niemand geprüft hat.

5. **`/api/nogo-suggestions` und `/api/optimize-bio-values` — `kuratiert`, knapp.**
   Beide leiten aus persönlichem Material ab, liefern aber Vorschläge zur Auswahl,
   keine Bewertung. Ausschlaggebend war, dass die Person jeden Vorschlag aktiv
   annehmen muss; sie werden nirgends automatisch übernommen. Bei
   `/api/optimize-profile` und `/api/parse-profile-import` ist es umgekehrt
   `kein_ersatz`, weil dort ein fertiger Profiltext entsteht, den man in einem
   Zug speichert.

6. **`/api/quick-insight` — `leer` trotz nur einem Halbsatz.** „Tolle Basis!" ist
   kurz, aber es ist ein Urteil über das Profil. Die strenge Lesart der Regel lässt
   hier nichts übrig, was ehrlich stehen bleiben könnte.

7. **Fünf Endpunkte ohne auffindbaren Client.** `/api/check-safety`,
   `/api/ai-passgenauigkeit`, `/api/date-planner`,
   `/api/extract-success-factors`. Die Zuordnung stützt sich hier allein auf
   `systemInstruction` und `responseSchema` — **es fehlt die Information, wie und ob
   das Ergebnis je angezeigt wird.** Falls diese Endpunkte noch angebunden werden,
   ist die Zuordnung gegen die tatsächliche Darstellung zu prüfen.

## Nebenbefunde aus der Durchsicht

- **`/api/check-safety` hat keinen Aufrufer.** Die Sicherheitsprüfung von Nachrichten
  ist serverseitig vorhanden, wird aber aus `src/` nirgends aufgerufen. Zusätzlich
  gibt sie ohne `GEMINI_API_KEY` stillschweigend `{ isFlagged: false }` zurück
  (`server.ts:550`) — eine Freigabe ohne Prüfung.
- **`/api/ai-passgenauigkeit` ist wieder mit dem Dashboard verbunden; der Server validiert Eingabe und Modellantwort strikt.**
  Der KI-Deep-Kontakt-Pfad in `src/screens/Dashboard.tsx` sendet an
  `/api/ai-passgenauigkeit`. Der Server verlangt genau einen validen Score pro
  angefragtem Profil und liefert bei unvollständigen oder ungültigen Modellantworten
  `502` statt erfundener Passungswerte.
- **`/api/reply-suggestions` (`server.ts:1621`) enthält gar keinen KI-Aufruf.** Die
  „Batch-Verarbeitung" liefert nach 500 ms drei fest verdrahtete Sätze
  („Das klingt super spannend!" …) und ist im Code selbst als Simulation
  gekennzeichnet. Er taucht in dieser Matrix nicht auf, weil er kein KI-Endpunkt ist —
  faktisch ist er heute schon `kuratiert`, nur ohne Kennzeichnung gegenüber der
  nutzenden Person.
- **`/api/extract-success-factors` schreibt niemand, `/api/date-check`s Anzeige liest
  nur.** `ChatDatePlanner.tsx:39` liest `localStorage["klar_success_factors"]`; kein
  Codepfad in `src/` schreibt diesen Schlüssel.
- **Für `zwischenspeicher` gibt es bereits Infrastruktur, aber sie taugt so nicht.**
  `fetchWithCache` in `src/lib/api.ts` legt Antworten 15 Minuten im
  `localStorage` ab (`CACHE_EXPIRY_MS`, Zeile 10) — ohne Altersanzeige und mit einer
  Laufzeit, die für „Stand von gestern" zu kurz ist. Für die Strategie
  `zwischenspeicher` braucht es einen eigenen, dauerhaften Speicher mit sichtbarem
  Zeitstempel.
