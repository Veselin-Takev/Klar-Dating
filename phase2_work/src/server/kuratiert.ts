// ═══════════════════════════════════════════════════════════════════════════
// Klar — von Menschen geschriebene Ersatzinhalte
//
// Diese Datei importiert NICHTS. Sie enthält ausschliesslich Text, der von
// einer Person geschrieben wurde, und ist damit prüfbar wie Daten.
//
// ── WOFÜR ─────────────────────────────────────────────────────────────────
// `kiPolitik.ts` weist 18 Endpunkten die Strategie `kuratiert` zu. Fällt die
// KI dort aus, wird KEIN Ergebnis erfunden — es wird einer dieser Texte
// ausgeliefert, und `entscheideAntwort` setzt automatisch
// `herkunft: 'kuratiert'` und den Hinweis „Allgemeine Vorschläge — nicht auf
// dich zugeschnitten." dazu.
//
// ── DIE PRÜFUNG, DIE JEDER TEXT HIER BESTEHEN MUSS ────────────────────────
// Er darf NICHTS über die lesende Person oder ihr Gegenüber behaupten.
// Kein „Dein Profil wirkt sympathisch", kein „Alles bestens", keine Zahl,
// kein Urteil. Er darf allgemein gültig sein — mehr nicht.
//
// Gegenbeispiele aus dem Bestand, die genau daran scheitern und deshalb
// NICHT hierher übernommen wurden:
//   · „Vertraue dem Prozess und sei du selbst. Jeder Schritt ist ein
//     Fortschritt."  → wurde als persönlicher Tagesimpuls ausgeliefert,
//     nachdem eine Auswertung der eigenen Aktivitäten versprochen war.
//   · „Tolle Basis! Bereit für KI-Feedback?"  → ein Urteil über das Profil.
//   · „harmonisch, 70, Alles bestens."  → eine erfundene Auswertung von
//     Gesprächen, die eine belastende Dynamik überdecken kann.
//
// Die ersten beiden sind ersetzt, der dritte ersatzlos gestrichen:
// `/api/mood-monitor` steht auf `leer`.
// ═══════════════════════════════════════════════════════════════════════════

/** Tagesimpuls, wenn die persönliche Auswertung nicht erreichbar ist. */
export const COACH_IMPULS = {
  insight:
    'Eine konkrete Frage bringt ein Gespräch weiter als ein Kompliment. ' +
    'Frag nach etwas, das im Profil steht und dich wirklich interessiert.',
} as const;

/** Allgemeine Orientierung statt einer persönlichen Einschätzung. */
export const DATING_BEREITSCHAFT = {
  wisdom:
    'Wer ehrlich schreibt, was er sucht, spart sich und anderen Wochen. ' +
    'Klarheit ist keine Härte.',
  actionableAdvice:
    'Nimm dir heute ein Gespräch vor, das eingeschlafen ist, und schreib ' +
    'einen Satz dazu, warum es dir noch im Kopf ist — oder lass es bewusst ruhen.',
} as const;

/**
 * Für Endpunkte, die Gesprächsanfänge vorschlagen. Bewusst ohne Bezug auf
 * ein konkretes Profil: Diese Sätze passen zu jedem und behaupten deshalb
 * nichts über die angeschriebene Person.
 */
export const ICEBREAKER = {
  vorschlaege: [
    'Was hast du zuletzt gemacht, wovon du vorher dachtest, es wäre nichts für dich?',
    'Gibt es einen Ort in dieser Stadt, an dem du dich zuverlässig wohlfühlst?',
    'Woran merkst du, dass du einen guten Tag hattest?',
  ],
} as const;

// ── Fuer die fuenf Endpunkte mit Strategie `kuratiert`, die am 11.08.2026
//    umgestellt wurden ────────────────────────────────────────────────────
//
// Jeder dieser Texte ist allgemein. Keiner sagt etwas ueber die lesende
// Person oder ihr Gegenueber aus. Die alten Ersatzwerte taten das teils
// doch — „Entspann dich!" als Ergebnis einer Checkliste zum bevorstehenden
// Date ist ein Ratschlag an eine bestimmte Person in einer bestimmten Lage.

/** Checkliste vor einem Date. Gilt fuer jedes Date, nicht fuer ein bestimmtes. */
export const DATE_CHECKLISTE = {
  items: [
    { category: 'Vorher', text: 'Ort und Uhrzeit noch einmal bestaetigen.' },
    { category: 'Vorher', text: 'Jemandem sagen, wo du bist und mit wem.' },
    { category: 'Unterwegs', text: 'Eigene Anreise und eigene Rueckfahrt planen.' },
    { category: 'Waehrend', text: 'Getraenk im Blick behalten.' },
    { category: 'Danach', text: 'Kurz aufschreiben, wie es war — bevor der Eindruck verblasst.' },
  ],
} as const;

/** Date-Vorschlaege ohne Ortsbezug: Sie passen ueberall im deutschsprachigen Raum. */
export const DATE_IDEEN = {
  ideas: [
    {
      title: 'Spaziergang mit Ziel',
      description: 'Ein Weg mit einem Punkt am Ende — Aussicht, Cafe, Buchladen. Reden faellt beim Gehen leichter als am Tisch.',
      category: 'Ruhig',
      whyItWorks: 'Kein Blickkontaktzwang, jederzeit beendbar.',
    },
    {
      title: 'Markt am Vormittag',
      description: 'Wochenmarkt, zwei Stunden, offenes Ende.',
      category: 'Alltagsnah',
      whyItWorks: 'Viel zu sehen, wenig Stille auszuhalten.',
    },
    {
      title: 'Etwas ausprobieren, das beide nicht koennen',
      description: 'Toepfern, Bouldern, ein Kochkurs. Gemeinsames Nichtkoennen verbindet schneller als gemeinsames Koennen.',
      category: 'Aktiv',
      whyItWorks: 'Der Fokus liegt auf der Sache, nicht auf der Bewertung.',
    },
  ],
} as const;

/** Gespraechsanfaenge ohne Bezug auf ein konkretes Profil. */
export const ICEBREAKER_VORSCHLAEGE = {
  suggestions: [
    'Was hast du zuletzt gemacht, wovon du vorher dachtest, es waere nichts fuer dich?',
    'Gibt es einen Ort in dieser Stadt, an dem du dich zuverlaessig wohlfuehlst?',
    'Woran merkst du, dass du einen guten Tag hattest?',
  ],
} as const;

/** Allgemeine Date-Konzepte. Bewusst ohne Zuschnitt auf ein Gespraech. */
export const VERBINDUNG_KONZEPTE = {
  concepts: [
    { title: 'Kurz und offen', description: 'Eine Stunde, ohne Plan fuer danach. Wer laenger will, verlaengert.', tag: 'Ruhig' },
    { title: 'Gemeinsam etwas erledigen', description: 'Einkauf, Flohmarkt, Pflanze aussuchen. Nebeneinander statt gegenueber.', tag: 'Alltagsnah' },
    { title: 'Etwas ansehen, ueber das man danach reden kann', description: 'Ausstellung, Konzert, Kino. Der Gespraechsstoff ist eingebaut.', tag: 'Kulturell' },
  ],
} as const;

/** Allgemeine Tuning-Vorschläge für Gespräche ohne Annahmen über den Kontext. */
export const CONVERSATION_TUNING = {
  suggestions: [
    {
      style: 'Offen & Interessiert',
      text: 'Das klingt spannend! Wie bist du eigentlich dazu gekommen?',
      explanation: 'Offene Fragen regen zum Erzählen an und nehmen Druck heraus.',
    },
    {
      style: 'Entspannt & Humorvoll',
      text: 'Haha, das kenne ich zu gut. Klingt nach einem echten Abenteuer!',
      explanation: 'Gemeinsamer Humor baut schnell Sympathie und Verbundenheit auf.',
    },
    {
      style: 'Wertschätzend',
      text: 'Schön, dass du das so offen teilst. Das zeigt echt Haltung.',
      explanation: 'Bestätigung vermittelt Sicherheit im Gespräch.',
    },
  ],
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ERGÄNZT 12.08.2026 — für die zehn Endpunkte mit Strategie `kuratiert`,
// die an diesem Tag von der Zwischenstufe auf den vollen Weg gehoben wurden.
//
// Jeder Text unten ist von Hand geschrieben und hält dieselbe Prüfung ein
// wie die Texte darüber:
//
//   Er darf NICHTS über die lesende Person, ihr Gegenüber oder deren
//   Gespräch behaupten — und er darf keinen Ort nennen, den es geben muss.
//
// Der zweite Teil ist neu und kam durch einen Befund an diesem Tag zustande:
// `/api/city-trend-radar` lieferte bei einem Ausfall „Secret Garden Café"
// und „Urban Art Walk" samt Beschreibung. Ein erfundener Ratschlag ist
// ärgerlich; eine erfundene Adresse schickt jemanden los. Deshalb steht in
// diesen Texten nie ein Ortsname, sondern immer eine Art von Ort — „ein Café
// in eurer Nähe" statt eines Namens.
// ═══════════════════════════════════════════════════════════════════════════

/** `/api/daily-icebreakers` — drei Gesprächsanfänge ohne Profilbezug. */
export const DAILY_ICEBREAKER = {
  icebreakers: [
    'Was hat dich in den letzten Tagen positiv überrascht?',
    'Gibt es etwas, das du gerade lernst oder ausprobierst?',
    'Woran merkst du, dass ein Tag gut gelaufen ist?',
  ],
} as const;

/**
 * `/api/icebreaker` — ein einzelner Gesprächsanfang.
 *
 * Die Begründung sagt bewusst, WARUM die Frage allgemein funktioniert, und
 * behauptet nicht, sie sei auf ein bestimmtes Profil zugeschnitten.
 */
export const ICEBREAKER_EINZELN = {
  icebreaker: 'Was hast du zuletzt gemacht, wovon du vorher dachtest, es wäre nichts für dich?',
  reasoning:
    'Die Frage lässt sich beantworten, ohne etwas preiszugeben, und führt fast immer zu einer Geschichte statt zu einem Wort.',
} as const;

/** `/api/feeling-question` — eine Frage an die eigene Verfassung. */
export const GEFUEHLSFRAGE = {
  question: 'Was würdest du im Moment eher brauchen: mehr Gespräche oder mehr Ruhe?',
} as const;

/** `/api/reflection-questions` — nach einem Date, ohne Bezug auf dessen Verlauf. */
export const REFLEXIONSFRAGEN = {
  questions: [
    'Wann hast du dich während des Treffens am wohlsten gefühlt?',
    'Gab es einen Moment, in dem du etwas nicht gesagt hast, das du sagen wolltest?',
    'Was davon hat mit der anderen Person zu tun — und was mit dir?',
  ],
} as const;

/** `/api/smart-date-planner` — drei Arten von Orten, keine konkreten. */
export const SMART_DATE_VORSCHLAEGE = {
  suggestions: [
    {
      title: 'Café am Vormittag',
      description: 'Kurz, hell, jederzeit beendbar. Der unaufgeregteste erste Rahmen, den es gibt.',
      type: 'Indoor',
    },
    {
      title: 'Spaziergang mit Ziel',
      description: 'Ein Weg mit einem Punkt am Ende. Reden fällt beim Gehen leichter als am Tisch.',
      type: 'Outdoor',
    },
    {
      title: 'Ausstellung oder Markt',
      description: 'Etwas zu sehen heisst: wenig Stille auszuhalten und Gesprächsstoff eingebaut.',
      type: 'Indoor / Outdoor',
    },
  ],
} as const;

/**
 * `/api/generate-date-plan` — ein Plan ohne erfundene Angaben.
 *
 * BEFUND 12.08.2026: Hier stand als Vorgabe „Samstag, 14:00 Uhr" und
 * „Lokales Lieblingscafé am Park". Beides klingt nach Absprache. Zeit und
 * Ort stehen jetzt als das da, was sie sind: offen.
 */
export const DATE_PLAN = {
  title: 'Kaffee und ein kurzer Spaziergang',
  time: 'an einem Nachmittag, an dem ihr beide Zeit habt',
  location: 'ein Café in eurer Nähe',
  plan: 'Erst eine Stunde bei einem Getränk, danach ein Stück zu Fuss. Wer länger will, verlängert; wer nicht, verabschiedet sich am Ende des Wegs.',
} as const;

/** `/api/date-locations` — drei Arten von Orten für ein erstes Treffen. */
export const DATE_ORTE = {
  suggestions: [
    { title: 'Café', description: 'Öffentlich, kurz, ohne Verpflichtung für den Rest des Tages.' },
    { title: 'Wochenmarkt', description: 'Nebeneinander statt gegenüber — das nimmt Druck aus dem ersten Treffen.' },
    { title: 'Ausstellung', description: 'Der Gesprächsstoff ist eingebaut, Stille fällt nicht ins Gewicht.' },
  ],
} as const;

/** `/api/date-planner` — dieselbe Idee, anderes Feldschema. */
export const DATE_IDEEN_ORT = {
  ideas: [
    {
      title: 'Café am Nachmittag',
      description: 'Kurz und unaufgeregt. Wetterunabhängig und jederzeit beendbar.',
      locationType: 'Indoor / Café',
    },
    {
      title: 'Spaziergang mit Ziel',
      description: 'Ein Weg mit einem Punkt am Ende — Aussicht, Buchladen, Kiosk.',
      locationType: 'Outdoor / Park',
    },
    {
      title: 'Ausstellung oder Konzert',
      description: 'Etwas ansehen, über das man danach reden kann.',
      locationType: 'Indoor / Kultur',
    },
  ],
} as const;

/**
 * `/api/nogo-suggestions` — Vorschläge zum Auswählen, keine Diagnose.
 *
 * Der Endpunkt heisst „Welche No-Gos könnte ich festlegen?". Die Antwort
 * darf deshalb allgemeine Muster nennen — sie darf aber nicht behaupten,
 * die lesende Person habe diese Muster erlebt.
 */
export const NOGO_VORSCHLAEGE = {
  suggestions: [
    'Absagen ohne Nachricht',
    'Gespräche, die nur in eine Richtung laufen',
    'Druck, schneller zu werden, als du möchtest',
  ],
} as const;

/**
 * `/api/optimize-bio-values` — allgemeine Hinweise zum Schreiben einer Bio.
 *
 * Bewusst KEINE Aussage über die vorliegende Bio: Ohne die KI hat niemand
 * sie gelesen. Was bleibt, sind Hinweise, die für jede Bio gelten.
 */
export const BIO_WERTE_HINWEISE = {
  suggestions: [
    'Nenne eine konkrete Sache, die du regelmässig tust, statt eines Adjektivs über dich. „Ich koche jeden Sonntag" sagt mehr als „kreativ".',
    'Schreib einen Satz darüber, was du suchst. Wer das ausspart, wird häufiger angeschrieben — aber seltener von den Passenden.',
  ],
} as const;

/**
 * `/api/ai-coach` — allgemeine Dating- und Kommunikationsratschläge ohne Personenbezug.
 * Gilt für Ausfälle oder Kontingentengpässe der KI.
 */
export const AI_COACH_BASIS = {
  text: 'Im modernen Dating ist Klarheit die größte Stärke:\n\n' +
    '• Sei authentisch: Versuche nicht zu gefallen, sondern herauszufinden, ob ihr wirklich zusammenpasst.\n' +
    '• Tempo bestimmen: Nimm dir die Zeit, die du brauchst. Ein gutes Kennenlernen entwickelt sich ohne künstlichen Druck.\n' +
    '• Grenzen respektieren: Höre auf deine Intuition – wenn etwas nicht passt, darfst du das jederzeit klar und respektvoll ansprechen.',
  preferences: 'Klarheit, gegenseitiger Respekt, Entschleunigung',
} as const;

/**
 * Liefert kuratierte, von Hand geschriebene Coaching-Antworten je nach Themengebiet,
 * ohne Spekulationen oder erfundene persönliche Urteile über den Nutzer.
 */
export function kuratierteCoachAntwort(prompt?: string, context?: string): { text: string; preferences?: string } {
  const p = (prompt || '').toLowerCase();
  const c = (context || '').toLowerCase();
  const kombiniert = `${p} ${c}`;

  // 1. Date-Planung / Orte / Aktivitäten
  if (kombiniert.includes('date-plan') || kombiniert.includes('date-idee') || kombiniert.includes('location') || kombiniert.includes('standort') || kombiniert.includes('plane') || kombiniert.includes('ideen für ein date')) {
    return {
      text: 'Hier sind drei bewährte, entspannte Date-Ideen ohne Verpflichtungsdruck:\n\n' +
        '1. **Spaziergang mit Ziel (Café oder Aussichtspunkt):**\n' +
        '   • *Warum es funktioniert:* Nebeneinander zu gehen nimmt den Druck des ständigen Blickkontakts. Es fällt leichter, ungezwungen ins Gespräch zu kommen.\n' +
        '   • *Gesprächsaufhänger:* „Was machst du in dieser Gegend am liebsten, wenn du den Kopf frei bekommen möchtest?"\n\n' +
        '2. **Besuch eines Wochenmarkts oder einer offenen Ausstellung:**\n' +
        '   • *Warum es funktioniert:* Die Umgebung liefert kontinuierlich Gesprächsstoff, wodurch keine peinliche Stille entsteht.\n' +
        '   • *Gesprächsaufhänger:* Gemeinsames Probieren oder Betrachten lädt zu spontanem Austausch ein.\n\n' +
        '3. **Kurzer Kaffee am Nachmittag:**\n' +
        '   • *Warum es funktioniert:* Niederschwellig, zeitlich flexibel (ca. 45–60 Minuten) und bei gutem Vibe jederzeit verlängerbar.\n' +
        '   • *Gesprächsaufhänger:* „Welches Projekt oder Thema begeistert dich zurzeit?"',
      preferences: 'Entspannte Aktivitäten im Freien, Café-Kultur, authentischer Austausch',
    };
  }

  // 2. Date-Debriefing / Feedback / Recap
  if (kombiniert.includes('debrief') || kombiniert.includes('feedback') || kombiniert.includes('recap') || kombiniert.includes('pros') || kombiniert.includes('cons') || kombiniert.includes('key learnings')) {
    return {
      text: '### Date Debrief (Kuratiertes Coaching)\n\n' +
        '**1. Key Learnings:**\n' +
        '• Achte primär auf dein eigenes Wohlbefinden während des Treffens: Konntest du ganz du selbst sein?\n' +
        '• Unterschiedliche Kommunikationsstile sind normal – entscheidend ist gegenseitige Wertschätzung und Aufmerksamkeit.\n\n' +
        '**2. Connection Highlights:**\n' +
        '• Gemeinsame Interessen und unbeschwerte Momente bilden das verlässlichste Fundament für eine echte Bindung.\n' +
        '• Ehrliche Momente, in denen man sich authentisch zeigt, wiegen schwerer als perfekte Selbstdarstellung.\n\n' +
        '**3. Potential Next Steps:**\n' +
        '• Wenn die Chemie stimmte: Schlage innerhalb der nächsten 48 Stunden ein konkretes, unaufgeregtes Wiedersehen vor.\n' +
        '• Wenn der Funke fehlte: Formuliere eine ehrliche, freundliche Nachricht – Klarheit schafft Respekt auf beiden Seiten.',
      preferences: 'Ehrliche Kommunikation, gegenseitige Aufmerksamkeit, entspannte Taktung',
    };
  }

  // 3. Rollenspiel / Szenario
  if (kombiniert.includes('rollenspiel') || kombiniert.includes('szenario') || kombiniert.includes('simuliere') || kombiniert.includes('spielst mein date')) {
    return {
      text: 'Hallo! Schön, dass wir uns heute treffen. Der Platz hier im Café ist wirklich gemütlich. Wie war dein Tag bis jetzt – hattest du eine gute Anreise?',
      preferences: '',
    };
  }

  // 4. Profil-Optimierung / Bio
  if (kombiniert.includes('profil') || kombiniert.includes('bio') || kombiniert.includes('fotos') || kombiniert.includes('optimier')) {
    return {
      text: 'Hier sind drei Grundregeln für ein authentisches Profil:\n\n' +
        '1. **Konkrete Aktivitäten statt Adjektive:** Schreibe nicht „ich bin reisefreudig und humorvoll", sondern nenne dein letztes Abenteuer oder worüber du herzlich lachen kannst.\n' +
        '2. **Klar formulieren, was du suchst:** Wer ehrlich benennt, welche Art von Begegnung er sich wünscht, zieht genau die passenden Kontakte an.\n' +
        '3. **Offene Aufhänger bieten:** Gib deinem Gegenüber eine einfache Vorlage für die erste Nachricht (z.B. ein besonderes Interesse oder eine Lieblingsfrage).',
      preferences: 'Authentische Selbstdarstellung, klare Suchabsicht',
    };
  }

  // 5. Eisbrecher / Erste Nachricht
  if (kombiniert.includes('icebreaker') || kombiniert.includes('anschreiben') || kombiniert.includes('erste nachricht') || kombiniert.includes('eröffnungsnachricht')) {
    return {
      text: 'Ein starker Einstieg bezieht sich immer auf ein konkretes Detail im Profil:\n\n' +
        '• „Mir ist aufgefallen, dass du gerne wanderst – welcher Weg in der Region hat dich zuletzt am meisten begeistert?"\n' +
        '• „Deine Antwort zu deinen Werten fand ich spannend: Was bedeutet das für dich im Alltag?"\n\n' +
        'Vermeide Standard-Floskeln wie „Hey, wie geht\'s?". Stelle eine offene Frage, die leicht zu beantworten ist und echte Neugier weckt.',
      preferences: 'Offene Fragen, konkreter Profilbezug',
    };
  }

  return { ...AI_COACH_BASIS };
}

