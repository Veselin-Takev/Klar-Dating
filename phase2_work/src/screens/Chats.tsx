import { Link } from "react-router";
import type { Profile } from "../data";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Clock, ShieldCheck, Search } from "lucide-react";
import { fetchWithTimeout } from "../lib/api";


interface ChatListProfile extends Pick<Profile, 'id' | 'name' | 'bio' | 'age' | 'photoUrl'> {
  chatId: string;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function parseChatProfile(value: unknown): ChatListProfile | null {
  if (!isRecord(value)) return null;
  const profile = isRecord(value.profile) ? value.profile : {};
  const id = typeof value.id === 'string' ? value.id : '';
  if (!id) return null;
  return {
    id,
    chatId: id,
    name: typeof profile.name === 'string' && profile.name.trim() ? profile.name : 'Verbindung',
    bio: typeof profile.bio === 'string' ? profile.bio : '',
    age: typeof profile.age === 'number' && Number.isFinite(profile.age) ? profile.age : 0,
    photoUrl: typeof profile.photoUrl === 'string' ? profile.photoUrl : '',
  };
}
function DismissableChat({ profile, idx, onRemove }: { profile: ChatListProfile; idx: number; onRemove: (id: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, overflow: "hidden", marginBottom: 0 }}
      className="relative rounded-2xl mb-4"
    >
      <div className="absolute inset-0 bg-red-500 rounded-2xl flex justify-end items-center px-6">
        <Trash2 className="text-white" size={24} />
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        onDragEnd={(_e, { offset, velocity }) => {
          if (offset.x < -80 || velocity.x < -500) {
            onRemove(profile.id);
          }
        }}
        className="relative bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700"
      >
        <Link to={`/chat/${profile.chatId ?? profile.id}`} className="flex items-center gap-4 p-4 hover:border-brand/50 dark:hover:border-brand-light/50 transition-colors group">
          <div className="relative">
            <img src={profile.photoUrl} alt={profile.name} className="w-16 h-16 rounded-full object-cover border border-stone-100 dark:border-stone-700" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-stone-900 rounded-full"></div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-medium text-lg text-stone-900 dark:text-stone-100">{profile.name}</h3>
              <span className="text-xs text-stone-400 dark:text-stone-500">{idx + 1}h</span>
            </div>
            <p className="text-stone-500 dark:text-stone-400 text-sm mb-2 truncate">Tippe, um ein Gespräch zu beginnen...</p>
            <div className="flex items-center gap-1 text-[10px] font-medium text-stone-500 uppercase tracking-wider">
              <Clock size={12} />
              <span>Aktive Verbindung</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <ShieldCheck className="text-brand" size={22} aria-label="Verifizierte Verbindung" />
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

export default function Chats() {
  const [profiles, setProfiles] = useState<ChatListProfile[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchWithTimeout('/api/chats', { timeout: 10000, retries: 0 })
      .then(async response => response.ok ? response.json() : { chats: [] })
      .then((data: unknown) => {
        const chats = isRecord(data) && Array.isArray(data.chats) ? data.chats.map(parseChatProfile).filter((chat): chat is ChatListProfile => chat !== null) : [];
        if (!cancelled) setProfiles(chats);
      })
      .catch(() => { if (!cancelled) setProfiles([]); });
    return () => { cancelled = true; };
  }, []);
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(normalizedQuery) ||
    p.bio.toLowerCase().includes(normalizedQuery)
  );
  const handleRemove = (id: string) => setProfiles(p => p.filter(x => x.id !== id));

  return (
    <div className="p-6 h-full overflow-y-auto pb-24 bg-light-bg dark:bg-dark-bg">
      <div className="flex justify-between items-end mb-6">
        <h1 className="text-3xl font-serif text-stone-900 dark:text-stone-100">Deine Verbindungen</h1>
        <Link to="/profile" className="flex items-center gap-1.5 text-brand dark:text-brand-light text-sm font-medium bg-brand/10 dark:bg-brand-light/10 px-3 py-1.5 rounded-full hover:bg-brand/20 dark:hover:bg-brand-light/20 transition-colors">
          <ShieldCheck size={16} /> Verifiziert
        </Link>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-stone-400" />
        </div>
        <input
          type="text"
          placeholder="Nach Namen oder Schlagworten suchen..."
          className="block w-full pl-10 pr-3 py-3 border border-stone-200 dark:border-stone-700 rounded-xl leading-5 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand sm:text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>


      {/* ── ENTFERNT 14.08.2026 — <RewardedAdButton /> ────────────────────
          ENTSCHEIDUNG DES AUFTRAGGEBERS:
            „Fuer das MVP gilt: Streichen. Besser eine schlanke, voll
             funktionsfaehige und ehrliche User Journey als unfertige
             Monetarisierungs-Features."

          Der Knopf hiess „Video ansehen (+3 Kontakte)". Er zeigte kein
          Video: Er wartete drei Sekunden (`setTimeout`, mit dem Kommentar
          „Simulate AdMob rewarded video") und rief dann

              alert("Gratuliere! Du hast 3 zusaetzliche Kontakte erhalten.");
              // Actual API integration would happen here

          Drei Fehler in vier Zeilen — es lief keine Werbung, es kam keine
          Belohnung an, und der Text behauptete beides. Dazu widersprachen
          die drei Zusatzkontakte dem Kontingent von acht (klar/27, 9c) und
          die Werbung dem Transparenz-Modell.

          Mit entfernt: `src/components/RewardedAdButton.tsx`, der Endpunkt
          `/api/admob-ssv` (server.ts) und `extraContacts`/`extraTag` aus
          `entscheideKontakt` (src/server/pure.ts).

          WIEDERVORLAGE: Wenn die Zahlungsabwicklung steht, gehoert neu
          entschieden, ob es einen Weg „mit Zeit zahlen" geben soll — und
          wenn ja, welchen. Nicht Werbung; klar/27 Abschnitt 9c empfiehlt
          dafuer die Verifizierung. Siehe klar/29-mvp-schnitt. */}

      {/* ── ENTFERNT 14.08.2026 — „3 Personen mögen dich" ────────────────
          Die Karte hatte drei Fehler auf einmal, und jeder einzelne haette
          gereicht:

          1. Die Drei kam aus dem Quelltext. Kein Aufruf, keine Abfrage — die
             Zahl stand fest da, fuer jedes Konto, an jedem Tag. Genau die
             Bauform, die `klar/14-ki-ersatz-matrix` und `klar/17` seit dem
             10.08.2026 aus der App entfernen.
          2. „Wer hat dich gemocht" ist in klar/27, Abschnitt 9c,
             AUSDRUECKLICH nicht empfohlen: Es ist eine Aussage ueber andere
             Menschen, die diese nicht getroffen haben — und der klassische
             Weg, mit dem Dating-Apps ihr Versprechen aufweichen.
          3. Der Knopf „Premium" hatte kein `onClick`. Er versprach einen
             Weg, den es nicht gab.

          Ersatzlos gestrichen statt ersetzt: Ein ehrlicher Zaehler waere
          moeglich, aber er stuende dann fuer eine Funktion, die es nach
          heutigem Stand nicht geben soll. Der Einstieg zu Klar+ steht auf
          der Profilseite und unter /klar-plus.

          Der `RewardedAdButton`, der hier darueber stand, ist am selben Tag
          mitgegangen — siehe den Block oben. */}

      {/* ── OFFEN, KEIN TEIL DIESES BLOCKS ────────────────────────────────
          Die Liste unten laeuft auf `allProfiles` aus `src/data` — festen
          Beispielprofilen. Drei Angaben je Zeile sind aus dem Listenplatz
          gerechnet und bedeuten nichts:

            „Verfaellt in {72 - i * 2}h"   „{i + 1}h"   „{75 + i * 5}% Fit"

          Das ist dieselbe Familie wie „3 Personen moegen dich" (am
          14.08.2026 entfernt) — nur unauffaelliger, weil die Zahlen von
          Zeile zu Zeile verschieden sind und dadurch echt wirken.

          WIEDERVORLAGE: Sobald es echte Gespraeche gibt, muessen diese drei
          Angaben aus den Daten kommen oder verschwinden. Nicht vorher
          umbauen — ohne echte Gespraeche gaebe es nichts anzuzeigen, und
          eine leere Liste waere der ehrlichere, aber noch nicht baubare
          Zustand. */}
      <div className="">
        <AnimatePresence>
          {filteredProfiles.map((profile, i) => (
            <DismissableChat key={profile.id} profile={profile} idx={i} onRemove={handleRemove} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
