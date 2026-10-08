/* eslint-disable */
/* eslint-disable react-hooks/set-state-in-effect */
import { klarStorage } from '../lib/userScopedStorage';
import { Star } from "lucide-react";
import { useState, useEffect } from "react";
import { BookOpen, CheckCircle, ShieldAlert, Heart, MessageSquare, CheckSquare, Square, PenLine, Trash2, CalendarPlus, Lightbulb, HeartHandshake, Sparkles, Bookmark, BookmarkCheck } from "lucide-react";
import { motion } from "motion/react";
import { fetchDateIdeas } from "../lib/api";
import { UserCircle, Wind } from "lucide-react";
import { MindfulDatingExercisesWidget } from "../components/MindfulDatingExercisesWidget";
import { melde } from "../lib/fehler";
import { useAuth } from "../lib/AuthContext";
import { DATE_PREP_CHECKLIST_DEFAULTS, enqueueDatePrepChecklist, flushDatePrepChecklist, loadQueuedDatePrepChecklist } from "../lib/offlineQueue";

function KlarManifest() {
  const pillars = [
    ['01 · LIMITIERUNG', 'Nur 8–12 Profile am Tag', 'Ruhe statt Reizüberflutung: weniger Auswahl, mehr Aufmerksamkeit.'],
    ['02 · TRANSPARENZ', 'Klare Absichten statt Spielchen', 'Beziehungsziele und Erwartungen werden früh und verständlich sichtbar.'],
    ['03 · SICHERHEIT', 'Verifizierung und respektvolle Grenzen', 'Echte Konten, klare Grenzen und ein sicherer Rahmen für Begegnungen.'],
    ['04 · FAIRNESS', 'Kernfunktionen ohne Paywall-Druck', 'Klar hält den Kern zugänglich; monetäre Optionen dürfen keine Manipulation ersetzen.'],
    ['05 · ATMOSPHÄRE', 'Ruhiges Design', 'Weniger Dopaminmechanik, mehr Lesen, Nachdenken und echte Gespräche.'],
  ];
  return (
    <section className="mt-10 border-t border-stone-200 dark:border-stone-700 pt-8" aria-labelledby="klar-manifest-heading">
      <div className="rounded-3xl bg-stone-900 text-white p-6 md:p-8">
        <p className="text-xs uppercase tracking-widest text-amber-200 font-semibold">Das Klar-Manifest</p>
        <h3 id="klar-manifest-heading" className="mt-2 text-3xl font-serif leading-tight">Weniger tippen. Mehr echte Verbindungen.</h3>
        <p className="mt-4 text-sm md:text-base text-stone-200 leading-relaxed">Klar ersetzt Katalog-Mentalität durch eine begrenzte Tagesauswahl, klare Absichten und Gespräche mit echtem Gegenüber. Das Produktversprechen ist Ruhe, Transparenz, Sicherheit und Respekt vor der Zeit der Menschen.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="p-5 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
          <h4 className="font-semibold mb-3">Klassische Auswahlmechanik</h4>
          <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400 list-disc pl-5">
            <li>Viele Profile und schnelle Katalogentscheidungen</li><li>Leere Verbindungen ohne Gespräch</li><li>Unklare Absichten und Ghosting</li><li>Paywall- und Engagement-Druck</li><li>Fakes und ungeprüfte Konten als Risiko</li>
          </ul>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-800 border-2 border-stone-900 dark:border-stone-300">
          <h4 className="font-semibold mb-3">Das Klar-Prinzip</h4>
          <ul className="space-y-2 text-sm text-stone-700 dark:text-stone-300 list-disc pl-5">
            <li><strong>8–12</strong> Vorschläge pro Tag statt Katalog</li><li><strong>Gespräch zuerst</strong> statt Auswahl-Schleife</li><li><strong>Klare Absichten</strong> statt Ratespiel</li><li><strong>Freier Kernzugang</strong> ohne manipulativen Druck</li><li><strong>Verifizierung</strong> als Schutzschicht für echte Begegnungen</li>
          </ul>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        {pillars.map(([eyebrow, title, text]) => <article key={eyebrow} className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700"><p className="text-xs font-bold text-amber-900 dark:text-amber-200">{eyebrow}</p><h4 className="mt-2 font-serif text-lg text-stone-900 dark:text-stone-100">{title}</h4><p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{text}</p></article>)}
      </div>
      <p className="mt-6 text-xs text-stone-500 dark:text-stone-400">Produktprinzipien sind keine Leistungs- oder Rechtsgarantie. Verfügbare Funktionen und rechtlich bindende Texte findest du in Profil → Rechtstexte.</p>
    </section>
  );
}

function KlarPrinciplesCards() {

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(klarStorage.getItem('klar_tips_favorites') || '[]');
    } catch {
      return [];
    }
  });

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      klarStorage.setItem('klar_tips_favorites', JSON.stringify(next));
      return next;
    });
  };

  const principles = [
    {
      id: 'authentic',
      icon: CheckCircle,
      title: 'Bleib authentisch',
      description: 'Verstelle dich nicht, um jemandem zu gefallen. Ein Date ist kein Vorstellungsgespräch, sondern die Chance herauszufinden, ob ihr wirklich zueinander passt.',
      examples: [
        { label: 'Statt Vorwände:', text: '"Ich bin eher der gemütliche Typ und verbringe meine Wochenenden lieber im Café oder Museum. Was fasziniert dich so am Wandern?"' }
      ]
    },
    {
      id: 'communication',
      icon: MessageSquare,
      title: 'Klare Kommunikation',
      description: 'Keine Spielchen. Wenn du Interesse hast, zeige es. Wenn es nicht passt, kommuniziere das respektvoll und direkt. Ghosting ist ein No-Go.',
      examples: [
        { label: 'Nach einem tollen Date:', text: '"Mir hat der Abend heute wirklich gut gefallen und ich würde dich gerne wiedersehen."' },
        { label: 'Wenn es nicht gepasst hat:', text: '"Danke für die schöne Zeit heute. Ich hatte einen netten Abend, habe aber gemerkt, dass der Funke bei mir nicht übergesprungen ist. Ich wünsche dir alles Gute!"' }
      ]
    },
    {
      id: 'transparency',
      icon: CheckSquare,
      title: 'Transparenz',
      description: 'Kommuniziere deine Absichten von Anfang an klar. So vermeidest du Missverständnisse und triffst Menschen, die dasselbe suchen wie du.',
      examples: [
        { label: 'Beim Kennenlernen:', text: '"Ich suche gerade nach etwas Festem und möchte eine ernsthafte Beziehung aufbauen. Wonach hältst du momentan Ausschau?"' },
        { label: 'Wenn es anders ist:', text: '"Ich bin momentan viel unterwegs und suche eher nach lockeren Begegnungen, aus denen sich kein Druck entwickelt. Ich möchte da von Anfang an ehrlich sein."' }
      ]
    },
    {
      id: 'safety',
      icon: ShieldAlert,
      title: 'Sicherheit & Grenzen',
      description: 'Trefft euch an öffentlichen Orten, kommuniziere deine Grenzen klar und akzeptiere ein "Nein" des anderen sofort und ohne Diskussion.',
      examples: [
        { label: 'Grenzen setzen:', text: '"Ich finde dich sehr sympathisch, aber ich möchte es langsam angehen lassen und heute noch nicht zu dir nach Hause gehen."' },
        { label: 'Grenzen respektieren:', text: '"Das verstehe ich total. Lass uns doch stattdessen noch einen Spaziergang machen, wenn du Lust hast."' }
      ]
    },
    {
      id: 'openness',
      icon: Heart,
      title: 'Offenheit & Neugier',
      description: 'Begegne deinem Gegenüber mit echtem Interesse. Gehe ohne starre Checkliste in das Date und lass dich überraschen.',
      examples: [
        { label: 'Interesse zeigen:', text: '"Statt klassische Interview-Fragen wie \'Wo siehst du dich in 5 Jahren?\' abzuarbeiten, frag lieber nach Leidenschaften: \'Was war das Letzte, wofür du dich so richtig begeistern konntest?\'"' }
      ]
    },
    {
      id: 'focus',
      icon: HeartHandshake,
      title: 'Fokus im Hier und Jetzt',
      description: 'Schenke deinem Date deine volle Aufmerksamkeit. Lass das Handy in der Tasche und sei präsent im Moment.',
      examples: [
        { label: 'Beim Date:', text: 'Das Handy bleibt während des gesamten Dates in der Tasche. Wenn du auf einen wichtigen Anruf wartest, kommuniziere das direkt zu Beginn: "Ich erwarte heute Abend noch einen wichtigen Anruf, deshalb lasse ich mein Handy auf dem Tisch. Ich hoffe, das ist okay für dich."' }
      ]
    }
  ];

  return (
    <div className="flex flex-col gap-5 pb-safe">
      {principles.map((p, index) => {
        const Icon = p.icon;
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
            className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 dark:bg-brand-light/5 rounded-bl-full -mr-16 -mt-16 transition-transform group- pointer-events-none"></div>

            <div className="flex flex-col md:flex-row gap-4 md:gap-6 relative z-10">
              <div className="flex-none">
                <div className="bg-brand/10 dark:bg-brand-light/10 p-3 rounded-2xl inline-flex group-hover:bg-brand/15 dark:group-hover:bg-[#A9BDA5]/15 transition-colors">
                  <Icon size={28} className="text-brand dark:text-brand-light" />
                </div>
              </div>

              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
     <h3 className="font-serif text-xl md:text-2xl text-brand dark:text-brand-light">{p.title}</h3>
     <button aria-label="Tipp merken" onClick={() => toggleFavorite(p.id)} className="text-stone-400 hover:text-amber-500 transition-colors">
       <Star size={24} className={favorites.includes(p.id) ? "fill-amber-500 text-amber-500" : ""} />
     </button>
   </div>
                <p className="text-sm md:text-base text-stone-600 dark:text-stone-400 mb-5 leading-relaxed">
                  {p.description}
                </p>

                <div className="bg-stone-50 dark:bg-dark-bg rounded-xl p-4 border border-stone-200 dark:border-stone-700/50 group-hover:border-brand/20 dark:group-hover:border-[#A9BDA5]/20 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand dark:text-brand-light mb-3 flex items-center gap-1.5">
                    <Lightbulb size={14} />
                    Dating-Beispiel
                  </p>
                  <div className="space-y-4">
                    {p.examples.map((ex, i) => (
                      <div key={i} className="bg-white/50 dark:bg-black/20 p-3 rounded-lg">
                        {p.examples.length > 1 && (
                          <span className="font-medium text-stone-500 text-xs block mb-1.5 uppercase tracking-wide">{ex.label}</span>
                        )}
                        <p className="text-sm text-stone-700 dark:text-stone-300 italic leading-relaxed">
                          {ex.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function Tips() {
  const [activeTab, setActiveTab] = useState<'principles' | 'checklist' | 'ideas' | 'history'>('principles');
  const { user } = useAuth();
  const checklistUid = user?.uid ?? null;
  const [checklistSyncState, setChecklistSyncState] = useState<'loading' | 'saved' | 'offline' | 'error'>('loading');

  // Date Ideas State
  const [interests, setInterests] = useState("");
  const [dateIdeas, setDateIdeas] = useState<{title: string, description: string, saved?: boolean}[]>([]);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [savedIdeas, setSavedIdeas] = useState<{title: string, description: string}[]>(() => {
    try {
      const saved = klarStorage.getItem('klar_saved_ideas');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    klarStorage.setItem('klar_saved_ideas', JSON.stringify(savedIdeas));
  }, [savedIdeas]);

  const toggleSaveIdea = (idea: {title: string, description: string}) => {
    const isSaved = savedIdeas.some(i => i.title === idea.title);
    if (isSaved) {
      setSavedIdeas(savedIdeas.filter(i => i.title !== idea.title));
    } else {
      setSavedIdeas([...savedIdeas, idea]);
    }
  };

  const generateDateIdeas = async () => {
    if (!interests.trim()) return;
    setIsGeneratingIdeas(true);
    try {
      const ideas = await fetchDateIdeas(interests);
      if (ideas && ideas.length > 0) {
        setDateIdeas(ideas);
      }
    }
    catch (e) {
      melde("Tips", e);
      alert((e instanceof Error ? e.message : String(e)) || "Es gab einen Fehler beim Generieren der Date-Ideen.");
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null);

  useEffect(() => {
    if (!reminderDate || !reminderTime) {
      setTimeLeft(null);
      return;
    }

    const target = new Date(`${reminderDate}T${reminderTime}`).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = target - now;

      if (distance < 0) {
        setTimeLeft(null);
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000) });
    }, 1000);

    return () => clearInterval(interval);
  }, [reminderDate, reminderTime]);

  const [checklist, setChecklist] = useState<Record<string, boolean>>(DATE_PREP_CHECKLIST_DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    const loadChecklist = async () => {
      if (!checklistUid) { setChecklist(DATE_PREP_CHECKLIST_DEFAULTS); setChecklistSyncState('loading'); return; }
      setChecklistSyncState('loading');
      try {
        const queued = await loadQueuedDatePrepChecklist(checklistUid);
        if (queued && !cancelled) setChecklist(queued);
        const token = await user!.getIdToken();
        const response = await fetch('/api/checklists/date_prep', { headers: { 'X-Firebase-Token': token } });
        if (!response.ok) throw new Error('checklist_load_failed');
        const data = await response.json() as { checklist?: Record<string, boolean> };
        if (!cancelled) setChecklist({ ...DATE_PREP_CHECKLIST_DEFAULTS, ...(data.checklist ?? {}) });
        await flushDatePrepChecklist({ ownerUid: checklistUid, token });
        if (!cancelled) setChecklistSyncState('saved');
      } catch {
        if (!cancelled) setChecklistSyncState(navigator.onLine ? 'error' : 'offline');
      }
    };
    void loadChecklist();
    return () => { cancelled = true; };
  }, [checklistUid, user]);

  const [journalEntries, setJournalEntries] = useState<{id: string, date: string, person: string, note: string, mood?: string}[]>(() => {
    try {
      const saved = klarStorage.getItem('klar_journal');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [newPerson, setNewPerson] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newMood, setNewMood] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editPerson, setEditPerson] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editMood, setEditMood] = useState<string | null>(null);

  useEffect(() => {
    klarStorage.setItem('klar_journal', JSON.stringify(journalEntries));
  }, [journalEntries]);

  const toggleCheck = (key: keyof typeof checklist) => {
    if (!checklistUid) return;
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);
    setChecklistSyncState(navigator.onLine ? 'loading' : 'offline');
    void enqueueDatePrepChecklist(checklistUid, next).then(async () => {
      if (!navigator.onLine) return;
      try {
        const token = await user!.getIdToken();
        const result = await flushDatePrepChecklist({ ownerUid: checklistUid, token });
        setChecklistSyncState(result.synced ? 'saved' : 'offline');
      } catch { setChecklistSyncState('error'); }
    }).catch(() => setChecklistSyncState('error'));
  };

  useEffect(() => {
    const onOnline = () => {
      if (!checklistUid || !user) return;
      void user.getIdToken().then(token => flushDatePrepChecklist({ ownerUid: checklistUid, token })).then(result => setChecklistSyncState(result.synced ? 'saved' : 'offline')).catch(() => setChecklistSyncState('error'));
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [checklistUid, user]);


  const addJournalEntry = () => {
    if (!newNote.trim()) return;
    const newEntry = {
      id: Date.now().toString(),
      date: new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date()),
      person: newPerson.trim() || 'Unbekannt',
      note: newNote.trim(),
      mood: newMood || undefined };
    setJournalEntries([newEntry, ...journalEntries]);
    setNewPerson("");
    setNewNote("");
    setNewMood(null);
    setActiveTab('history');
  };

  const deleteEntry = (id: string) => {
    setJournalEntries(journalEntries.filter(e => e.id !== id));
  };

  const startEditing = (entry: {id: string, person: string, note: string, mood?: string}) => {
    setEditingEntryId(entry.id);
    setEditPerson(entry.person);
    setEditNote(entry.note);
    setEditMood(entry.mood || null);
  };

  const saveEdit = () => {
    if (!editNote.trim() || !editingEntryId) return;
    setJournalEntries(journalEntries.map(e =>
      e.id === editingEntryId
        ? { ...e, person: editPerson.trim() || 'Unbekannt', note: editNote.trim(), mood: editMood || undefined }
        : e
    ));
    setEditingEntryId(null);
  };

  const getMoodCounts = () => {
    const counts: Record<string, number> = {};
    journalEntries.forEach(entry => {
      if (entry.mood) {
        counts[entry.mood] = (counts[entry.mood] || 0) + 1;
      }
    });
    return counts;
  };

  const handleCalendarAdd = () => {
    if (!reminderDate || !reminderTime) {
      alert("Bitte Datum und Uhrzeit auswählen.");
      return;
    }

    const start = new Date(`${reminderDate}T${reminderTime}`);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const formatDate = (d: Date) => {
      return d.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';
    };

    const icsData = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nURL:${window.location.origin}\nDTSTART:${formatDate(start)}\nDTEND:${formatDate(end)}\nSUMMARY:Date: ${reminderTitle || 'Klar Dating'}\nDESCRIPTION:Dein geplantes Date. Denk an die Klar-Checkliste!\nEND:VEVENT\nEND:VCALENDAR`;

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'date_reminder.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="flex flex-col h-full bg-light-bg dark:bg-dark-bg">
      <div className="flex items-center p-4 border-b border-stone-100 dark:border-stone-700 bg-white/80 dark:bg-black/80  sticky top-0 z-10">
        <BookOpen size={24} className="text-brand dark:text-brand-light mr-3" />
        <h2 className="font-medium text-lg font-serif">Klar Dating-Tipps</h2>
      </div>

      <div className="flex border-b border-stone-200 dark:border-stone-700 bg-white/50 dark:bg-black/50  sticky top-[65px] z-10 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('principles')}
          className={`flex-none px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'principles' ? 'border-brand dark:border-brand-light text-brand dark:text-brand-light' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
        >
          Klar Prinzipien
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`flex-none px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex justify-center items-center gap-1.5 ${activeTab === 'checklist' ? 'border-brand dark:border-brand-light text-brand dark:text-brand-light' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
        >
          <CheckSquare size={16} /> Checkliste
        </button>
        <button
          onClick={() => setActiveTab('ideas')}
          className={`flex-none px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex justify-center items-center gap-1.5 ${activeTab === 'ideas' ? 'border-brand dark:border-brand-light text-brand dark:text-brand-light' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
        >
          <Sparkles size={16} /> KI-Ideen
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-none px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex justify-center items-center gap-1.5 ${activeTab === 'history' ? 'border-brand dark:border-brand-light text-brand dark:text-brand-light' : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
        >
          <PenLine size={16} /> Date-Journal
        </button>
      </div>
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {activeTab === 'principles' ? (
          <div className="p-6 pb-safe animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
              <h3 className="font-serif text-2xl mb-2 text-brand dark:text-brand-light">Warum Klar?</h3>
              <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-6">
                Klar steht für Transparenz, Authentizität und direkte, ehrliche Kommunikation. Hier sind die Kernprinzipien für stressfreie und respektvolle Dates, übersichtlich aufbereitet.
              </p>
            </div>
            <KlarPrinciplesCards />
            <KlarManifest />
          </div>
        ) : false ? (
          <div className="p-6 pb-safe animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8">
              <h3 className="font-serif text-2xl mb-2 text-brand dark:text-brand-light">Achtsames Dating</h3>
              <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
                Tägliche Übungen, um mit der richtigen Haltung an neue Begegnungen heranzugehen.
              </p>
            </div>
            <MindfulDatingExercisesWidget />
          </div>
        ) : activeTab === 'checklist' ? (

          <div className="p-6 pb-safe animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-serif text-2xl mb-2 text-brand dark:text-brand-light">Erstes Date Checkliste</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400" role="status">{checklistSyncState === 'saved' ? 'Gespeichert und synchronisiert' : checklistSyncState === 'offline' ? 'Offline gespeichert – wird beim nächsten Online-Moment synchronisiert' : checklistSyncState === 'error' ? 'Synchronisierung derzeit nicht verfügbar' : 'Synchronisierung wird vorbereitet …'}</p>
            <p className="text-sm text-stone-500 mb-6">Hake diese Dinge vor dem Date ab, um Vorbereitungsstress zu reduzieren.</p>

            {[
              {
                title: "Praktisches",
                items: [
                  { key: "location", label: "Ort & Treffpunkt sind geklärt" },
                  { key: "battery", label: "Handyakku ist voll geladen" },
                  { key: "trustedPerson", label: "Vertrauensperson weiß Bescheid" },
                  { key: "money", label: "Ausreichend Bargeld/Karten dabei" },
                ]
              },
              {
                title: "Outfit & Styling",
                items: [
                  { key: "outfit_comfort", label: "Ich fühle mich wohl in meinem Outfit" },
                  { key: "outfit_weather", label: "Outfit ist dem Wetter angepasst" },
                  { key: "outfit_ready", label: "Gestylt und frisch gemacht" },
                ]
              },
              {
                title: "Mindset",
                items: [
                  { key: "mindset", label: "Ich bin entspannt und offen" },
                  { key: "boundaries", label: "Ich kenne meine Grenzen" },
                  { key: "authenticity", label: "Ich nehme mir vor, authentisch zu sein" },
                  { key: "curiosity", label: "Ich bin neugierig auf mein Gegenüber" },
                  { key: "openMind", label: "Ich lasse mich nicht stressen" },
                ]
              },
              {
                title: "Gesprächsthemen (optional)",
                items: [
                  { key: "topics_hobbies", label: "2-3 Hobbys/Geschichten parat" },
                  { key: "topics_questions", label: "Paar offene Fragen überlegt" },
                  { key: "topics_no_ex", label: "Ex-Partner-Themen vermeiden" },
                ]
              }
            ].map(group => (
              <div key={group.title} className="mb-6 last:mb-0">
                <h4 className="font-medium text-stone-900 dark:text-stone-100 mb-3 text-sm uppercase tracking-wider">{group.title}</h4>
                <div className="space-y-2.5">
                  {group.items.map(item => (
                    <button
                      key={item.key}
                      onClick={() => toggleCheck(item.key as any)}
                      className={`w-full flex items-center justify-between p-3.5 border rounded-xl transition-all ${
                        checklist[item.key]
                          ? 'bg-brand/5 dark:bg-brand-light/5 border-brand/30 dark:border-brand-light/30 text-stone-900 dark:text-stone-100'
                          : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <span className={`text-sm ${checklist[item.key] ? 'line-through opacity-70' : ''}`}>{item.label}</span>
                      {checklist[item.key] ? <CheckSquare size={20} className="text-brand dark:text-brand-light flex-shrink-0 ml-3" /> : <Square size={20} className="text-stone-300 flex-shrink-0 ml-3" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'ideas' ? (
          <div className="p-6 pb-safe animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-serif text-2xl mb-2 text-brand dark:text-brand-light">KI-Date-Ideen</h3>
            <textarea
              id="ideen-interessen"
              name="ideen-interessen"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="Interessen..."
              className="w-full p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 mb-4"
            />
            <button
              onClick={generateDateIdeas}
              disabled={isGeneratingIdeas || !interests.trim()}
              className="w-full py-4 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl flex justify-center items-center gap-2"
            >
              {isGeneratingIdeas ? <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700  mb-3"></div> : <Sparkles size={20} />}
              Ideen generieren
            </button>
            <div className="mt-6 space-y-4">
              {dateIdeas.map((idea, idx) => (
                <div key={idx} className="p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-brand dark:text-brand-light">{idea.title}</h4>
                    <button onClick={() => toggleSaveIdea(idea)}>
                      {idea.saved ? <BookmarkCheck size={20} className="text-brand dark:text-brand-light" /> : <Bookmark size={20} className="text-stone-400" />}
                    </button>
                  </div>
                  <p className="text-sm text-stone-600 dark:text-stone-400">{idea.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="p-6 pb-safe animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-serif text-2xl mb-2 text-brand dark:text-brand-light">Date-Journal</h3>
            <div className="mb-6 p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl space-y-4">
              <input
                id="journal-person"
                name="journal-person"
                type="text"
                placeholder="Mit wem?"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                className="w-full p-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-light-bg dark:bg-dark-bg"
              />
              <textarea
                id="journal-notiz"
                name="journal-notiz"
                placeholder="Notizen..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="w-full p-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-light-bg dark:bg-dark-bg"
              />
              <div>
                <p className="text-xs text-stone-500 mb-2">Stimmung:</p>
                <div className="flex flex-wrap gap-2">
                  {['Inspiriert', 'Entspannt', 'Unsicher', 'Erschöpft', 'Klar', 'Überrascht'].map(mood => (
                    <button
                      key={mood}
                      onClick={() => setNewMood(newMood === mood ? null : mood)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium ${newMood === mood ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={addJournalEntry}
                className="w-full py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-lg"
              >
                Eintrag speichern
              </button>
            </div>

            <div className="mb-6 p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl space-y-4">
              <h4 className="font-medium text-brand dark:text-brand-light mb-2">Date Erinnerung</h4>
              <input type="text" id="erinnerung-titel" name="erinnerung-titel" placeholder="Titel" value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} className="w-full p-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-light-bg dark:bg-dark-bg mb-2" />
              <div className="flex gap-2">
                <input type="date" id="erinnerung-datum" name="erinnerung-datum" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="flex-1 p-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-light-bg dark:bg-dark-bg" />
                <input type="time" id="erinnerung-uhrzeit" name="erinnerung-uhrzeit" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="flex-1 p-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-light-bg dark:bg-dark-bg" />
              </div>
              {timeLeft && (
                <div className="flex gap-2 justify-center py-2 text-brand dark:text-brand-light font-medium">
                  {timeLeft.days}T {timeLeft.hours}H {timeLeft.minutes}M
                </div>
              )}
              <button onClick={handleCalendarAdd} className="w-full py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-lg flex items-center justify-center gap-2">
                <CalendarPlus size={20} /> Kalender
              </button>
              <p className="text-xs text-stone-500 text-center">Dein Kalender erinnert dich — Klar schickt keine Benachrichtigungen.</p>
            </div>

            <div className="mb-8">
              <h4 className="font-medium text-brand dark:text-brand-light mb-4">Date-Stimmungen</h4>
              <p className="text-xs text-stone-500 mb-4">Gezählt wird ausschließlich, was du selbst ausgewählt hast — nichts wird aus deinen Notizen abgeleitet.</p>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(getMoodCounts()).map(([mood, count]) => (
                  <div key={mood} className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 p-4 rounded-xl flex flex-col items-center justify-center gap-1">
                    <span className="text-sm font-medium">{mood}</span>
                    <span className="text-2xl font-serif text-brand dark:text-brand-light">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-brand dark:text-brand-light mb-2">Historie</h4>
              {journalEntries.map(entry => (
                <div key={entry.id} className="p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl relative group">
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex gap-2">
                    <button aria-label="Eintrag bearbeiten" onClick={() => startEditing(entry)}><PenLine size={16} className="text-stone-400" /></button>
                    <button aria-label="Eintrag löschen" onClick={() => deleteEntry(entry.id)}><Trash2 size={16} className="text-rose-500" /></button>
                  </div>
                  {editingEntryId === entry.id ? (
                    <div className="space-y-3">
                      <input id={`journal-bearbeiten-person-${entry.id}`} name="journal-bearbeiten-person" value={editPerson} onChange={(e) => setEditPerson(e.target.value)} className="w-full p-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-light-bg dark:bg-dark-bg" />
                      <textarea id={`journal-bearbeiten-notiz-${entry.id}`} name="journal-bearbeiten-notiz" value={editNote} onChange={(e) => setEditNote(e.target.value)} className="w-full p-2 border border-stone-200 dark:border-stone-700 rounded-lg bg-light-bg dark:bg-dark-bg" />
                      <div className="flex flex-wrap gap-2">
                        {['Inspiriert', 'Entspannt', 'Unsicher', 'Erschöpft', 'Klar', 'Überrascht'].map(mood => (
                          <button key={mood} onClick={() => setEditMood(editMood === mood ? null : mood)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${editMood === mood ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}>
                            {mood}
                          </button>
                        ))}
                      </div>
                      <button onClick={saveEdit} className="w-full py-2 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-lg">Speichern</button>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-medium text-brand dark:text-brand-light">{entry.person}</h4>
                      <p className="text-xs text-stone-400 mb-2">{entry.date}</p>
                      {entry.mood && <span className="px-2 py-1 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light text-xs rounded-md mb-2 inline-block">{entry.mood}</span>}
                      <p className="text-sm text-stone-600 dark:text-stone-400">{entry.note}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
