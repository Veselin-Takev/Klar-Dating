import { readFileSync, writeFileSync } from 'node:fs';

// Zeilenweiser Vergleich OHNE Leerzeichen am Rand: Beim Einfuegen ins
// Terminal gehen sie verloren. Mehrfaches Ausfuehren schadet nicht.
const AUFTRAG = [
 {
  "name": "d_lucide",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "import { Focus, Lock } from \"lucide-react\";"
  ],
  "neu": [
   "// Lock entfaellt mit dem alten Sperrbildschirm — noUnusedLocals braeche",
   "// sonst den Build, sobald @ts-nocheck aus dieser Datei verschwindet.",
   "import { Focus } from \"lucide-react\";"
  ],
  "merkmal": "// Lock entfaellt mit dem alten Sperrbildschirm — noUnusedLocals braeche"
 },
 {
  "name": "d_import",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "import { allProfiles } from \"../data\";"
  ],
  "neu": [
   "// ── 11.08.2026: Kontingent kommt ab jetzt vom Server ──────────────────────",
   "// Vorher lag der Kontostand in `localStorage['klar_contacts_left']`, samt",
   "// zweier Schaltflächen „Reset für Demo\". Ein Kontingent, das das Gerät",
   "// selbst setzt, ist keines — und die Anzeige oben in der Leiste las bereits",
   "// den echten Serverwert. Zwei Wahrheiten auf einem Bildschirm.",
   "//",
   "// `/api/contact` war vollständig gebaut und hatte null Aufrufer: eine",
   "// Firestore-Transaktion, die zählt, die Verifizierung prüft und über die",
   "// Dokument-ID `<von>_<an>` einen zweiten Kontakt an dieselbe Person",
   "// technisch unmöglich macht.",
   "//",
   "// FOLGE, DIE ICH BENENNE: Der Server verlangt `isVerified === true`. Ohne",
   "// Verifizierung antwortet er mit 409 `nicht_verifiziert`. Das ist dieselbe",
   "// Bedingung wie in den Firestore-Regeln — aber es heisst, dass ohne",
   "// Verifizierung niemand mehr kontaktiert werden kann. Die Meldung führt",
   "// deshalb zur Verifizierung, statt in einer Sackgasse zu enden.",
   "import { beginneKontakt, nimmKontaktZurueck } from \"../lib/klar\";",
   "import { meldeKontaktVerbraucht } from \"../components/KontingentAnzeige\";",
   "import { allProfiles } from \"../data\";"
  ],
  "merkmal": "// ── 11.08.2026: Kontingent kommt ab jetzt vom Server ──────────────────────"
 },
 {
  "name": "d_lock1",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "const [isSmartLockEnabled, setIsSmartLockEnabled] = useState(false);",
   "const [isLocked, setIsLocked] = useState(false);",
   "",
   "useEffect(() => {",
   "// If smart lock is enabled, we could lock if a date is soon, but for demo we just show the toggle",
   "if (isSmartLockEnabled) {",
   "// simulated check",
   "",
   "}",
   "}, [isSmartLockEnabled]);"
  ],
  "neu": [
   "  // ── 11.08.2026: toter Smart-Lock-Apparat entfernt ────────────────────────",
   "  // Hier standen drei Dinge, die zusammen nichts taten:",
   "  //",
   "  //   const [isSmartLockEnabled, setIsSmartLockEnabled] = useState(false);",
   "  //   const [isLocked, setIsLocked] = useState(false);",
   "  //   useEffect(() => { if (isSmartLockEnabled) { /* simulated check */ } },",
   "  //             [isSmartLockEnabled]);",
   "  //",
   "  // `setIsSmartLockEnabled` hatte im ganzen Projekt keinen Aufrufer, der",
   "  // Effekt einen leeren Rumpf, und der Kommentar sagte „for demo we just",
   "  // show the toggle\" — einen Schalter gab es nicht. `isLocked` wurde nur",
   "  // vom Sperrbildschirm gelesen, den niemand einschalten konnte.",
   "  //",
   "  // Der Sichtschutz liegt jetzt in `components/Sichtschutz.tsx` und ist in",
   "  // `App.tsx` über allen Routen eingehängt."
  ],
  "merkmal": "// ── 11.08.2026: toter Smart-Lock-Apparat entfernt ────────────────────────"
 },
 {
  "name": "d_state",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "const [showFilterSheet, setShowFilterSheet] = useState(false);"
  ],
  "neu": [
   "  const [showFilterSheet, setShowFilterSheet] = useState(false);",
   "  /** Wortlaut des Servers, wenn ein Kontakt abgelehnt wurde. `null` heisst:",
   "   *  keine Ablehnung — nicht „alles in Ordnung, aber unbekannt\". */",
   "  const [kontaktFehler, setKontaktFehler] = useState<string | null>(null);"
  ],
  "merkmal": "/** Wortlaut des Servers, wenn ein Kontakt abgelehnt wurde. `null` heisst:"
 },
 {
  "name": "d_effekt",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "useEffect(() => {",
   "// Try to load from localStorage",
   "const savedContacts = localStorage.getItem('klar_contacts_left');",
   "const savedDate = localStorage.getItem('klar_contacts_date');",
   "const savedSeenIds = localStorage.getItem('klar_seen_ids');",
   "const today = new Date().toDateString();",
   "",
   "if (savedDate === today && savedContacts !== null) {",
   "setContactsLeft(parseInt(savedContacts, 10));",
   "if (savedSeenIds) {",
   "try {",
   "setSeenIds(JSON.parse(savedSeenIds));",
   "} catch (e) {}",
   "}",
   "} else {",
   "",
   "// Reset for a new day",
   "setContactsLeft(DAILY_LIMIT);",
   "localStorage.setItem('klar_contacts_date', today);",
   "localStorage.setItem('klar_contacts_left', DAILY_LIMIT.toString());",
   "localStorage.removeItem('klar_seen_ids');",
   "",
   "",
   "}"
  ],
  "neu": [
   "    // ── Kontingent vom Server, nicht aus dem Gerät ────────────────────────",
   "    // Der Tageswechsel liegt bei 4 Uhr Berliner Zeit (`pure.ts:RESET_HOUR`),",
   "    // nicht um Mitternacht. Die alte Fassung hier verglich",
   "    // `new Date().toDateString()` — das setzte um Mitternacht zurück und",
   "    // schenkte damit jede Nacht vier Stunden lang zusätzliche Kontakte.",
   "    // Der Server rechnet richtig; der Browser braucht es nicht zu wissen.",
   "    let weg = false;",
   "    (async () => {",
   "      try {",
   "        const res = await fetch('/api/quota');",
   "        if (!res.ok) throw new Error(String(res.status));",
   "        const d = await res.json();",
   "        if (!weg && typeof d.uebrig === 'number') setContactsLeft(d.uebrig);",
   "      } catch {",
   "        // Kein erfundener Wert: Bei einem Fehler bleibt der Anfangswert",
   "        // stehen, und der erste Kontaktversuch bringt die Wahrheit vom",
   "        // Server. Eine geratene Restanzeige wäre schlechter als eine, die",
   "        // sich beim nächsten Versuch korrigiert.",
   "      }",
   "    })();",
   "",
   "    // `seenIds` bleibt lokal: Es ist eine Anzeigehilfe („schon gesehen\"),",
   "    // kein Anspruch. Der Server verhindert Doppelkontakte über die",
   "    // Dokument-ID, unabhängig davon, was das Gerät sich merkt.",
   "    const savedSeenIds = localStorage.getItem('klar_seen_ids');",
   "    if (savedSeenIds) {",
   "      try {",
   "        setSeenIds(JSON.parse(savedSeenIds));",
   "      } catch { /* unbrauchbarer Eintrag — dann eben ohne */ }"
  ],
  "merkmal": "// ── Kontingent vom Server, nicht aus dem Gerät ────────────────────────"
 },
 {
  "name": "d_kontakt",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "const handleContact = (profile: Profile, interaction: \"nachricht\" | \"pass\") => {",
   "// Analytics",
   "trackEvent('profile_interaction', { profileId: profile.id, interaction });",
   "",
   "if (interaction === \"nachricht\") {",
   "if (contactsLeft <= 0) return;",
   "",
   "const newContactsLeft = contactsLeft - 1;",
   "setContactsLeft(newContactsLeft);",
   "localStorage.setItem('klar_contacts_left', newContactsLeft.toString());",
   "",
   "const newSeenIds = [...seenIds, profile.id];",
   "setSeenIds(newSeenIds);",
   "localStorage.setItem('klar_seen_ids', JSON.stringify(newSeenIds));",
   "",
   "// Notification with Undo",
   "setNotification({",
   "id: 'kontakt_' + profile.id,",
   "message: 'Kontaktanfrage gesendet',",
   "onUndo: () => {",
   "// Revert contacts",
   "setContactsLeft(contactsLeft);",
   "localStorage.setItem('klar_contacts_left', contactsLeft.toString());",
   "",
   "// Revert seen",
   "setSeenIds(seenIds);",
   "localStorage.setItem('klar_seen_ids', JSON.stringify(seenIds));",
   "",
   "setNotification(null);",
   "if (undoTimerRef.current) clearTimeout(undoTimerRef.current);",
   "}",
   "});"
  ],
  "neu": [
   "  const handleContact = async (profile: Profile, interaction: \"nachricht\" | \"pass\") => {",
   "    trackEvent('profile_interaction', { profileId: profile.id, interaction });",
   "",
   "    if (interaction === \"nachricht\") {",
   "      if (contactsLeft <= 0) return;",
   "",
   "      // ── Der Server entscheidet, nicht der Browser ──────────────────────",
   "      // Vorher wurde hier `localStorage` heruntergezählt. Das war weder",
   "      // fälschungssicher noch mit der Anzeige oben synchron — und der",
   "      // Doppelkontakt an dieselbe Person war nicht verhindert.",
   "      let uebrig: number | null;",
   "      try {",
   "        const ergebnis = await beginneKontakt(profile.id);",
   "        uebrig = ergebnis.uebrig;",
   "      } catch (e) {",
   "        // Die Meldung kommt WÖRTLICH vom Server. Sie unterscheidet drei",
   "        // Fälle — Kontingent erschöpft, nicht verifiziert, bereits",
   "        // angeschrieben — und jeder braucht eine andere Reaktion. Eine",
   "        // eigene Formulierung hier würde diesen Unterschied einebnen.",
   "        const text = e instanceof Error ? e.message : 'Der Kontakt konnte nicht angelegt werden.';",
   "        setKontaktFehler(text);",
   "        // Restanzeige nachziehen: Vielleicht ist das Kontingent gerade auf",
   "        // einem anderen Gerät verbraucht worden.",
   "        meldeKontaktVerbraucht();",
   "        return;",
   "      }",
   "",
   "      setKontaktFehler(null);",
   "      if (typeof uebrig === 'number') setContactsLeft(uebrig);",
   "      meldeKontaktVerbraucht();",
   "",
   "      const newSeenIds = [...seenIds, profile.id];",
   "      setSeenIds(newSeenIds);",
   "      localStorage.setItem('klar_seen_ids', JSON.stringify(newSeenIds));",
   "",
   "      setNotification({",
   "        id: 'kontakt_' + profile.id,",
   "        message: 'Kontaktanfrage gesendet',",
   "        onUndo: async () => {",
   "          // Die Rücknahme geht ebenfalls an den Server — er setzt den",
   "          // Zähler zurück und löscht den Kontakt. Eine Rücknahme, die nur",
   "          // die Anzeige zurückdreht, ist keine.",
   "          try {",
   "            await nimmKontaktZurueck(profile.id);",
   "            setContactsLeft(contactsLeft);",
   "            meldeKontaktVerbraucht();",
   "          } catch (e) {",
   "            // Die Frist von 5 Sekunden prüft der Server. Ist sie abgelaufen,",
   "            // bleibt der Kontakt bestehen — und das ist zu sagen.",
   "            setKontaktFehler(e instanceof Error ? e.message : 'Die Rücknahme war nicht mehr möglich.');",
   "          }",
   "",
   "          setSeenIds(seenIds);",
   "          localStorage.setItem('klar_seen_ids', JSON.stringify(seenIds));",
   "",
   "          setNotification(null);",
   "          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);",
   "        }",
   "      });"
  ],
  "merkmal": "const handleContact = async (profile: Profile, interaction: \"nachricht\" | \"pass\") => {"
 },
 {
  "name": "d_batterie",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "const getBatteryIcon = () => {",
   "if (contactsLeft > 3) return <BatteryFull size={16} className=\"text-brand dark:text-brand-light\" />;",
   "if (contactsLeft > 1) return <BatteryMedium size={16} className=\"text-amber-500\" />;",
   "return <BatteryLow size={16} className=\"text-rose-500\" />;",
   "};"
  ],
  "neu": [
   "  // ── 11.08.2026: Farbwechsel entfernt ─────────────────────────────────────",
   "  // Hier stand `text-amber-500` ab 3 und `text-rose-500` ab 1. Das",
   "  // widerspricht der eigenen Vorgabe in KontingentAnzeige.tsx:14:",
   "  //   „BEWUSST NICHT: kein Countdown, kein Rot bei „1 übrig\", kein",
   "  //    pulsender Punkt. Künstliche Dringlichkeit ist in §12 verboten.\"",
   "  // Zwei Komponenten derselben App widersprachen sich in einer",
   "  // dokumentierten Entwurfsregel. Das Symbol zeigt weiterhin den Füllstand",
   "  // — nur ohne Warnfarbe. Wer acht Kontakte hat und noch einen übrig, soll",
   "  // ihn in Ruhe vergeben, nicht unter Zeitdruck.",
   "  const getBatteryIcon = () => {",
   "    const farbe = \"text-brand dark:text-brand-light\";",
   "    if (contactsLeft > 3) return <BatteryFull size={16} className={farbe} />;",
   "    if (contactsLeft > 1) return <BatteryMedium size={16} className={farbe} />;",
   "    return <BatteryLow size={16} className={farbe} />;",
   "  };"
  ],
  "merkmal": "// ── 11.08.2026: Farbwechsel entfernt ─────────────────────────────────────"
 },
 {
  "name": "d_sperre",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "if (isLocked) {",
   "return (",
   "<div className=\"h-full flex flex-col items-center justify-center bg-stone-900 text-white p-6 relative z-50\">",
   "<Lock size={48} className=\"text-brand mb-4 opacity-80\" />",
   "<h2 className=\"text-xl font-bold mb-2\">Smart-Lock Aktiv</h2>",
   "<p className=\"text-stone-400 text-center text-sm mb-8\">Deine Privatsphäre ist geschützt. Bitte entsperren (PIN / FaceID).</p>",
   "<button onClick={() => setIsLocked(false)} className=\"px-8 py-3 bg-brand text-white rounded-full font-medium shadow-lg\">",
   "Entsperren (Demo)",
   "</button>",
   "</div>",
   ");",
   "}"
  ],
  "neu": [
   "  // ── 11.08.2026: Sperrbildschirm hierher entfernt ────────────────────────",
   "  // Hier stand ein vollständiger Sperrbildschirm („Smart-Lock Aktiv\"), der",
   "  // sich nicht einschalten liess: `setIsLocked(true)` kam im ganzen Projekt",
   "  // nicht vor. Er deckte ausserdem nur das Dashboard ab, während die",
   "  // schutzbedürftigen Inhalte in den Gesprächen stehen.",
   "  //",
   "  // Sein Text versprach „Bitte entsperren (PIN / FaceID)\", der Knopf hiess",
   "  // „Entsperren (Demo)\" und entsperrte ohne Prüfung — dieselbe Klasse wie",
   "  // „End-to-End gesichert\" im Login (§ 5 UWG, entfernt am 09.08.2026).",
   "  //",
   "  // Der Sichtschutz liegt jetzt in `components/Sichtschutz.tsx` und ist in",
   "  // `App.tsx` über allen Routen eingehängt. Er hat einen sichtbaren",
   "  // Einstieg, verdeckt sich beim Wechsel in den Hintergrund selbst, und er",
   "  // sagt auf dem Bildschirm, wovor er NICHT schützt."
  ],
  "merkmal": "// ── 11.08.2026: Sperrbildschirm hierher entfernt ────────────────────────"
 },
 {
  "name": "d_ende1",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "<button",
   "onClick={() => {",
   "setContactsLeft(DAILY_LIMIT);",
   "setSeenIds([]);",
   "localStorage.setItem('klar_contacts_left', DAILY_LIMIT.toString());",
   "localStorage.setItem('klar_seen_ids', JSON.stringify([]));",
   "}}",
   "className=\"px-6 py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl font-medium shadow-md hover:opacity-90 transition-opacity\"",
   ">",
   "Reset für Demo",
   "</button>"
  ],
  "neu": [
   "        {/* 11.08.2026: Hier stand „Reset für Demo\" — eine Schaltfläche, die",
   "            das Tageslimit zurücksetzte. Das Limit IST das Produkt („Weniger",
   "            Swipes. Mehr echte Gespräche.\"); ein Knopf, der es aufhebt,",
   "            widerspricht dem Versprechen und hätte in einer ausgelieferten",
   "            Fassung nichts zu suchen. Der Zähler steht jetzt ohnehin auf dem",
   "            Server und liesse sich von hier gar nicht mehr zurücksetzen. */}",
   "        <p className=\"text-sm text-stone-500 dark:text-stone-500\">",
   "          Neue Kontakte gibt es morgen um 4 Uhr.",
   "        </p>"
  ],
  "merkmal": "{/* 11.08.2026: Hier stand „Reset für Demo\" — eine Schaltfläche, die"
 },
 {
  "name": "d_ende2",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "<button",
   "onClick={() => {",
   "setContactsLeft(DAILY_LIMIT);",
   "setSeenIds([]);",
   "localStorage.setItem('klar_contacts_left', DAILY_LIMIT.toString());",
   "localStorage.setItem('klar_seen_ids', JSON.stringify([]));",
   "}}",
   "className=\"px-6 py-3 bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-xl font-medium shadow-md hover:opacity-90 transition-opacity\"",
   ">",
   "Reset für Demo",
   "</button>"
  ],
  "neu": [
   "          {/* Zweite „Reset für Demo\"-Schaltfläche, entfernt am 11.08.2026 —",
   "              siehe Begründung oben. Was hier bleibt, ist das Zurücksetzen",
   "              der bereits gesehenen Profile: Das ist eine reine Anzeigehilfe",
   "              und hebt kein Limit auf. */}",
   "          <button",
   "            onClick={() => {",
   "              setSeenIds([]);",
   "              localStorage.setItem('klar_seen_ids', JSON.stringify([]));",
   "            }}",
   "            className=\"px-6 py-3 bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-xl font-medium shadow-md hover:opacity-90 transition-opacity\"",
   "          >",
   "            Bereits gesehene erneut zeigen",
   "          </button>"
  ],
  "merkmal": "{/* Zweite „Reset für Demo\"-Schaltfläche, entfernt am 11.08.2026 —"
 },
 {
  "name": "d_banner",
  "datei": "src/screens/Dashboard.tsx",
  "alt": [
   "<div className={`flex-1 flex-col overflow-hidden relative ${activeTab === 'discover' ? 'flex' : 'hidden'}`}>"
  ],
  "neu": [
   "      {/* ── Ablehnung des Servers, im Wortlaut ──────────────────────────────",
   "          Drei Fälle mit drei verschiedenen Antworten: Kontingent erschöpft,",
   "          nicht verifiziert, bereits angeschrieben. Die Verifizierung ist der",
   "          einzige, aus dem heraus es weitergeht — deshalb steht dort ein Weg",
   "          und keine Sackgasse. */}",
   "      {kontaktFehler && (",
   "        <div role=\"alert\" className=\"mb-3 shrink-0 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4\">",
   "          <p className=\"text-sm text-stone-700 dark:text-stone-300\">{kontaktFehler}</p>",
   "          {kontaktFehler.includes('Verifizierung') && (",
   "            <a",
   "              href=\"/verifizierung\"",
   "              className=\"mt-3 inline-block px-4 py-2 rounded-xl bg-brand dark:bg-brand-light text-white dark:text-stone-900 text-sm font-medium\"",
   "            >",
   "              Jetzt verifizieren",
   "            </a>",
   "          )}",
   "          <button",
   "            onClick={() => setKontaktFehler(null)}",
   "            className=\"mt-3 ml-3 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 underline\"",
   "          >",
   "            Schliessen",
   "          </button>",
   "        </div>",
   "      )}",
   "",
   "      <div className={`flex-1 flex-col overflow-hidden relative ${activeTab === 'discover' ? 'flex' : 'hidden'}`}>"
  ],
  "merkmal": "{/* ── Ablehnung des Servers, im Wortlaut ──────────────────────────────"
 },
 {
  "name": "a_import",
  "datei": "src/App.tsx",
  "alt": [
   "import { EinwilligungUndAlter } from \"./components/EinwilligungUndAlter\";"
  ],
  "neu": [
   "import { EinwilligungUndAlter } from \"./components/EinwilligungUndAlter\";",
   "import { Sichtschutz } from \"./components/Sichtschutz\";"
  ],
  "merkmal": "import { Sichtschutz } from \"./components/Sichtschutz\";"
 },
 {
  "name": "a_layout",
  "datei": "src/App.tsx",
  "alt": [
   "<Layout>",
   "",
   "<AnimatedRoutes />",
   "",
   "</Layout>"
  ],
  "neu": [
   "        <Layout>",
   "          {/* WIEDERHERGESTELLT 11.08.2026 — Sichtschutz.",
   "              Die Sperre lag bisher in Dashboard.tsx und hatte keinen",
   "              Einstieg: `setIsLocked(true)` kam im ganzen Projekt nicht vor.",
   "              Sie deckte ausserdem nur das Dashboard ab — die",
   "              schutzbedürftigen Inhalte stehen aber in den Gesprächen.",
   "              Deshalb steht sie jetzt hier, eine Ebene über den Routen, und",
   "              verdeckt alles. */}",
   "          <Sichtschutz />",
   "",
   "          <AnimatedRoutes />",
   "",
   "        </Layout>"
  ],
  "merkmal": "{/* WIEDERHERGESTELLT 11.08.2026 — Sichtschutz."
 }
];

let fehler = 0;
for (const a of AUFTRAG) {
  const inhalt = readFileSync(a.datei, 'utf8');
  if (inhalt.includes(a.merkmal)) { console.log(`${a.name}: schon erledigt.`); continue; }
  const z = inhalt.split('\n');
  const s = a.alt;
  let gefunden = -1;
  for (let i = 0; i + s.length <= z.length; i++) {
    let ok = true;
    for (let k = 0; k < s.length; k++) if (z[i + k].trim() !== s[k]) { ok = false; break; }
    if (ok) { gefunden = i; break; }
  }
  if (gefunden < 0) {
    // Erkennung, ob schon eingespielt: NICHT an der ersten Zeile des neuen
    // Blocks — die ist bei mehreren Bloecken unveraendert, und dann haelt
    // das Skript eine noch offene Stelle faelschlich fuer erledigt und
    // fuegt beim naechsten Lauf ein zweites Mal ein. Genau das ist beim
    // ersten Versuch passiert (doppelter Sichtschutz-Import in App.tsx).
    // Geprueft wird deshalb gegen `merkmal`: eine Zeile, die es NUR in der
    // neuen Fassung gibt.
    const schon = readFileSync(a.datei, 'utf8').includes(a.merkmal);
    console.log(`${a.name}: ${schon ? 'schon erledigt.' : 'NICHT GEFUNDEN — bitte melden.'}`);
    if (!schon) fehler++;
    continue;
  }
  z.splice(gefunden, s.length, ...a.neu);
  writeFileSync(a.datei, z.join('\n'));
  console.log(`${a.name}: ersetzt (Zeile ${gefunden + 1}, ${s.length} -> ${a.neu.length}).`);
}
console.log(fehler ? `\n${fehler} Stelle(n) nicht gefunden.` : '\nAlle Stellen verarbeitet.');
