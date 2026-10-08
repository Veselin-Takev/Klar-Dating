import { useState } from 'react';
import { Search, ChevronDown, BookOpen, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const GLOSSARY_TERMS = [
  {
    term: "Ghosting",
    definition: "Der plötzliche Kontaktabbruch ohne Erklärung. Bei Klar setzen wir auf Transparenz: Ein kurzes \"Es hat für mich nicht gepasst, dir alles Gute\" ist immer besser als Schweigen und zeigt Respekt.",
    category: "Verhalten",
    isRedFlag: true
  },
  {
    term: "Love Bombing",
    definition: "Jemanden extrem früh in der Kennenlernphase mit Zuneigung, Komplimenten und Versprechungen überschütten. Dient oft der Manipulation, um schnell Abhängigkeit zu erzeugen.",
    category: "Warnsignale",
    isRedFlag: true
  },
  {
    term: "Benching",
    definition: "Jemanden \"auf die lange Bank schieben\" – also als Plan B warmhalten, während man andere Optionen abwägt. Ehrlichkeit bedeutet hier, von Anfang an klare Intentionen zu kommunizieren statt Hoffnungen zu schüren.",
    category: "Verhalten",
    isRedFlag: true
  },
  {
    term: "Breadcrumbing",
    definition: "Nur winzige \"Brotkrumen\" an Aufmerksamkeit streuen (z.B. sporadische Nachricht oder kurze Nachrichten), um den anderen bei der Stange zu halten. Authentisches Interesse zeigt sich durch konsistente und echte Interaktion.",
    category: "Verhalten",
    isRedFlag: true
  },
  {
    term: "Situationship",
    definition: "Mehr als Freundschaft, aber weniger als eine definierte Beziehung. Eine Grauzone, die oft zu Unsicherheit führt, wenn die Erwartungen nicht offen kommuniziert werden.",
    category: "Beziehungsstatus",
    isRedFlag: false
  },
  {
    term: "Orbiting",
    definition: "Nach einem Kontaktabbruch (z.B. Ghosting) weiterhin die Social-Media-Storys schauen oder Beiträge nachricht, ohne direkten Kontakt aufzunehmen.",
    category: "Verhalten",
    isRedFlag: true
  },
  {
    term: "Gaslighting",
    definition: "Eine Form der psychologischen Manipulation, bei der die Realitätswahrnehmung der anderen Person systematisch infrage gestellt wird (\"Das bildest du dir nur ein\").",
    category: "Warnsignale",
    isRedFlag: true
  },
  {
    term: "Klartext",
    definition: "Die direkte, aber stets respektvolle Kommunikation der eigenen Gefühle und Bedürfnisse. Klartext vermeidet Missverständnisse und ist die absolute Grundlage für authentische Verbindungen ohne Spielchen.",
    category: "Gesundes Dating",
    isRedFlag: false
  },
  {
    term: "Red Flags vs. Pink Flags",
    definition: "Während 'Red Flags' absolute Ausschlusskriterien (wie toxisches Verhalten) signalisieren, sind 'Pink Flags' kleine Warnsignale oder Inkompatibilitäten. Wir empfehlen, Pink Flags offen anzusprechen.",
    category: "Konzept",
    isRedFlag: false
  },
  {
    term: "Cuffing Season",
    definition: "Die Zeit im Herbst und Winter, in der viele Singles nach einer kurzfristigen Beziehung suchen, um die kalten Monate nicht allein zu verbringen.",
    category: "Phänomen",
    isRedFlag: false
  },
  {
    term: "Soft Launching",
    definition: "Das schrittweise und subtile Zeigen eines neuen Partners auf Social Media, ohne direkt das Gesicht oder den Namen zu posten (z.B. zwei Kaffeetassen).",
    category: "Verhalten",
    isRedFlag: false
  },
  {
    term: "Dry Texting",
    definition: "Sehr kurze, einsilbige Antworten beim Schreiben (wie \"Ok\", \"Haha\", \"Ja\"), die oft Desinteresse signalisieren und die Konversation abwürgen.",
    category: "Verhalten",
    isRedFlag: true
  },
  {
    term: "Haunting",
    definition: "Wenn ein \"Ghost\" plötzlich aus dem Nichts wieder auftaucht und subtil Kontakt sucht, ohne jemals das anfängliche Verschwinden zu erklären.",
    category: "Verhalten",
    isRedFlag: true
  },
  {
    term: "Catfishing",
    definition: "Sich im Internet mit falschen Bildern und erfundener Identität als jemand anderes ausgeben. Überprüfe bei Verdacht immer die Authentizität (z.B. durch Video-Calls).",
    category: "Sicherheit",
    isRedFlag: true
  },
  {
    term: "Green Flags",
    definition: "Positive Verhaltensweisen und Eigenschaften, die auf emotionale Reife und gute Beziehungskompatibilität hindeuten (z.B. aktives Zuhören, Respekt für Grenzen).",
    category: "Gesundes Dating",
    isRedFlag: false
  }
];

export function DatingGlossaryWidget() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  const filteredTerms = GLOSSARY_TERMS.filter(item =>
    item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.definition.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.term.localeCompare(b.term));

  const toggleTerm = (term: string) => {
    if (expandedTerm === term) {
      setExpandedTerm(null);
    } else {
      setExpandedTerm(term);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-stone-400" />
        </div>
        <input
          type="text"
          placeholder="Glossar durchsuchen (z.B. Ghosting)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand dark:focus:ring-brand-light focus:border-transparent transition-all dark:text-white"
        />
      </div>

      <div className="space-y-3">
        {filteredTerms.length > 0 ? (
          filteredTerms.map((item) => (
            <div
              key={item.term}
              className={`bg-white dark:bg-stone-800 border rounded-2xl overflow-hidden transition-all duration-300 ${expandedTerm === item.term ? 'border-brand/30 dark:border-brand-light/30 shadow-md' : 'border-stone-100 dark:border-stone-700 shadow-sm'}`}
            >
              <button
                onClick={() => toggleTerm(item.term)}
                className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${item.isRedFlag ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' : 'bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light'}`}>
                    {item.isRedFlag ? <ShieldAlert size={18} /> : <BookOpen size={18} />}
                  </div>
                  <div>
                    <h4 className={`font-medium text-base transition-colors ${expandedTerm === item.term ? 'text-brand dark:text-brand-light' : 'text-stone-900 dark:text-stone-100'}`}>
                      {item.term}
                    </h4>
                    <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                      {item.category}
                    </span>
                  </div>
                </div>
                <div className={`text-stone-400 transition-transform duration-300 ${expandedTerm === item.term ? 'rotate-180 text-brand dark:text-brand-light' : ''}`}>
                  <ChevronDown size={20} />
                </div>
              </button>

              <AnimatePresence>
                {expandedTerm === item.term && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-1 text-sm text-stone-600 dark:text-stone-400 leading-relaxed border-t border-stone-100 dark:border-stone-700 mt-2">
                      <div className="pt-3">
                        {item.definition}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-stone-500">
            Keine Begriffe gefunden für "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
