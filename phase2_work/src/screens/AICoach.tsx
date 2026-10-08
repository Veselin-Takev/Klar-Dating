import { melde } from "../lib/fehler";
import { getUserStorageItem, klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Search, Archive, Sparkles, BookOpen, Send, CalendarHeart, MapPin, MessageCircle, ChevronDown, Calendar as CalendarIcon, ClipboardCheck, Theater, Mic, Bookmark, Copy, Check, Trash2 } from 'lucide-react';
import { askAICoach, askAICoachStructured } from "../lib/api";
import { allProfiles } from "../data";

import { VoiceJournalWidget } from "../components/VoiceJournalWidget";
import { DateCalendar } from "../components/DateCalendar";
import { CoachGoalTracker } from "../components/CoachGoalTracker";
import { BioOptimizerWidget } from "../components/BioOptimizerWidget";
import { UserCircle } from "lucide-react";
import { Target, TrendingUp } from "lucide-react";
import { SentimentAnalyticsWidget } from "../components/SentimentAnalyticsWidget";
import { DailyCheckinWidget } from "../components/DailyCheckinWidget";
import { CheckinTimelineWidget } from "../components/CheckinTimelineWidget";
import { Antworttext } from "../components/Antworttext";

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string; isFinal: boolean }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function isJournalEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string'
    && typeof entry.profileId === 'string'
    && typeof entry.date === 'string'
    && Array.isArray(entry.pros) && entry.pros.every(item => typeof item === 'string')
    && Array.isArray(entry.cons) && entry.cons.every(item => typeof item === 'string')
    && typeof entry.recap === 'string'
    && (typeof entry.preferencesExtracted === 'undefined' || typeof entry.preferencesExtracted === 'string');
}

function readJournalEntries(raw: string | null): JournalEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isJournalEntry) : [];
  } catch {
    return [];
  }
}

function readStringList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readDailyMood(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    const today = new Date().toISOString().split('T')[0];
    return value.date === today && typeof value.mood === 'string' ? value.mood : null;
  } catch {
    return null;
  }
}

type JournalEntry = {
  id: string;
  profileId: string;
  date: string;
  pros: string[];
  cons: string[];
  recap: string;
  preferencesExtracted?: string;
};

export default function AICoach() {


  const [activeTab, setActiveTab] = useState<'chat' | 'planner' | 'calendar' | 'recap' | 'scenario' | 'goals' | 'bio' | 'analytics' | 'icebreakers'>('chat');
  const [savedIcebreakers, setSavedIcebreakers] = useState<string[]>([]);
  const [copiedIcebreaker, setCopiedIcebreaker] = useState<string | null>(null);

  useEffect(() => {
    const loadIcebreakers = () => {
      const stored = klarStorage.getItem('klar_saved_icebreakers');
      if (stored) {
        const parsed = readStringList(stored);
        if (parsed.length > 0 || stored === '[]') setSavedIcebreakers(parsed);
        else melde("AICoach.loadIcebreakers", new Error('Ungültige gespeicherte Icebreaker-Daten'));
      }
    };
    loadIcebreakers();
    window.addEventListener('storage', loadIcebreakers);
    return () => window.removeEventListener('storage', loadIcebreakers);
  }, []);

  const deleteIcebreaker = (text: string) => {
    const updated = savedIcebreakers.filter(t => t !== text);
    setSavedIcebreakers(updated);
    klarStorage.setItem('klar_saved_icebreakers', JSON.stringify(updated));
  };

  const copyIcebreaker = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIcebreaker(text);
    setTimeout(() => setCopiedIcebreaker(null), 2000);
  };

  const [coachTone, setCoachTone] = useState(() => klarStorage.getItem('klar_coach_tone') || 'motivierend');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([
    { role: 'ai', text: 'Hallo! Ich bin dein Klar KI-Coach. Ich helfe dir dabei, ein authentisches Profil zu erstellen, Icebreaker zu finden oder dir Feedback zu geben. Wie kann ich dir helfen?' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recognition, setRecognition] = useState<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const speechWindow = window as Window & {
        SpeechRecognition?: BrowserSpeechRecognitionConstructor;
        webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
      };
      const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "de-DE";

      rec.onresult = (event) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i]?.[0];
          if (result?.isFinal) finalTranscript += result.transcript;
        }
        if (finalTranscript) {
          setInput(prev => prev + (prev ? " " : "") + finalTranscript);
        }
      };

      rec.onend = () => {
        setIsRecordingVoice(false);
      };

      setRecognition(rec);
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (!recognition) {
      alert("Dein Browser unterstützt keine Spracheingabe.");
      return;
    }
    if (isRecordingVoice) {
      recognition.stop();
      setIsRecordingVoice(false);
    } else {
      recognition.start();
      setIsRecordingVoice(true);
    }
  };

  const [dailyMood, setDailyMood] = useState<string | null>(null);

  // Date Planner State
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [datePlans, setDatePlans] = useState<string>("");
  const [dateMood, setDateMood] = useState<'Casual' | 'Romantic' | 'Adventure'>('Casual');
  const [dateLocation, setDateLocation] = useState<string>("");
  const [isPlanning, setIsPlanning] = useState(false);

  // Date Recap / Journal State
  const [recapProfileId, setRecapProfileId] = useState<string>("");
  const [pros, setPros] = useState<string[]>(['', '', '']);
  const [cons, setCons] = useState<string[]>(['', '', '']);
  const [recapResult, setRecapResult] = useState<string>("");
  const [, setShowParticles] = useState(false);

  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect -- klarStorage is an external persistence boundary hydrated after mount. */
  useEffect(() => {
    const savedMood = klarStorage.getItem('klar_daily_mood');
    if (savedMood) {
      const mood = readDailyMood(savedMood);
      if (mood) setDailyMood(mood);
    }
    const saved = klarStorage.getItem('klar_journal_entries');
    if (saved) {
      const entries = readJournalEntries(saved);
      setJournalEntries(entries);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Scenario State
  const [scenario, setScenario] = useState<string>("erstes_date");
  const [scenarioMessages, setScenarioMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [scenarioInput, setScenarioInput] = useState("");
  const [isScenarioLoading, setIsScenarioLoading] = useState(false);
  const [scenarioStarted, setScenarioStarted] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: 'user', text: input } as const];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const tonePrompt = "Bitte antworte im folgenden Tonfall: " + coachTone + ".\n\n";
      const response = await askAICoach(tonePrompt + input);
      setMessages([...newMessages, { role: 'ai', text: response }]);
    } catch (e) {
      setMessages([...newMessages, { role: 'ai', text: (e instanceof Error ? e.message : String(e)) || 'Entschuldigung, es gab ein Problem bei der Verarbeitung.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanDate = async () => {
    if (!selectedProfileId) return;

    const verbindung = allProfiles.find(p => p.id === selectedProfileId);
    if (!verbindung) return;

    setIsPlanning(true);
    setDatePlans("");

    const savedInterests = getUserStorageItem('userInterests');
    const userInterests = readStringList(savedInterests).join(", ") || "Nicht angegeben";

    const savedDatePrefs = klarStorage.getItem("datePreferences");
    const datePreferences = savedDatePrefs ? savedDatePrefs : "Keine spezifischen Präferenzen gespeichert.";

    const prompt = `Erstelle als Dating-Coach 3 lokale, thematisch passende Date-Ideen für ein Treffen mit ${verbindung.name} (Alter: ${verbindung.age}).
    Das Date soll diesen Vibe haben: ${dateMood}.
    Standort: ${dateLocation ? dateLocation : 'Nicht spezifisch angegeben, bitte allgemeine aber konkrete Orte vorschlagen.'}
    Das Profil von ${verbindung.name}: "${verbindung.bio}"
    Interessen von ${verbindung.name}: ${verbindung.interests.join(", ")}
    Meine Interessen: ${userInterests}
    Meine Date-Präferenzen (aus vergangenem Feedback): ${datePreferences}

    Gib für jede Idee an:
    1. Einen spezifischen, unverfänglichen Ort / Art von Location (wenn Standort angegeben, dann realistische Beispiele dafür).
    2. Warum diese Idee besonders gut zu unseren gemeinsamen Interessen, den Interessen des Verbindungen oder meinen Date-Präferenzen passt.
    3. 1-2 spezifische Icebreaker oder Gesprächsaufhänger für genau dieses Date.

    Antworte in einem übersichtlichen, freundlichen und motivierenden Format, formatiere die 3 Ideen strukturiert.`;

    try {
      const response = await askAICoach(prompt);
      setDatePlans(response);
      klarStorage.setItem(`klar_date_plan_${verbindung.id}`, response);

      const datesPlanned = parseInt(klarStorage.getItem("stats_dates_planned") || "0", 10);
      klarStorage.setItem("stats_dates_planned", (datesPlanned + 1).toString());
    } catch (e) {
      setDatePlans((e instanceof Error ? e.message : String(e)) || "Fehler bei der Date-Planung. Bitte versuche es später noch einmal.");
    } finally {
      setIsPlanning(false);
    }
  };

  const handleVoiceSave = (rawText: string, analysis: string) => {
    const newEntry: JournalEntry = {
      id: "0".substring(7),
      profileId: recapProfileId || allProfiles[0]?.id || 'p1',
      date: new Date().toISOString(),
      pros: [],
      cons: [],
      recap: `Sprachnotiz: "${rawText}"\n\nKI-Fazit: ${analysis}`,
    };
    const updated = [newEntry, ...journalEntries];
    setJournalEntries(updated);
    klarStorage.setItem("klar_journal_entries", JSON.stringify(updated));
    setShowParticles(true);
    setTimeout(() => setShowParticles(false), 2000);

  };

  const handleGenerateRecap = async () => {
    if (!recapProfileId || pros.every(p => !p.trim()) && cons.every(c => !c.trim())) return;

    const verbindung = allProfiles.find(p => p.id === recapProfileId);
    if (!verbindung) return;

    setIsGeneratingRecap(true);
    setRecapResult("");

    const prompt = `Analysiere als Dating-Coach dieses Date-Feedback und erstelle ein "AI Date Debrief" für das Date mit ${verbindung.name} (Alter: ${verbindung.age}).

Das Profil von ${verbindung.name}: "${verbindung.bio}"
Feedback vom Date:
Pros (Was lief gut):
${pros.filter(p => p.trim()).map((p, i) => `${i + 1}. ${p}`).join('\n')}
Cons (Was lief nicht so gut):
${cons.filter(c => c.trim()).map((c, i) => `${i + 1}. ${c}`).join('\n')}

Bitte formatiere die Antwort klar strukturiert in drei Hauptbereiche:
1. Key Learnings (Was können wir aus diesem Date über deine Präferenzen lernen?)
2. Connection Highlights (Was war besonders an der Dynamik?)
3. Potential Next Steps (Vorschläge für ein nächstes Date oder wie man am besten im Kontakt bleibt)

Halte es ermutigend und hilfreich.`;

    try {
      const response = await askAICoachStructured(prompt);

      let cleanResponse = response.text || "";
      let extractedPrefs = response.preferences || "";

      if (extractedPrefs) {
        klarStorage.setItem("datePreferences", extractedPrefs);
      }

      const newEntry: JournalEntry = {
        id: Date.now().toString(),
        profileId: recapProfileId,
        date: new Date().toISOString(),
        pros: pros.filter(p => p.trim()),
        cons: cons.filter(c => c.trim()),
        recap: cleanResponse,
        preferencesExtracted: extractedPrefs
      };

      const updatedEntries = [newEntry, ...journalEntries];
      setJournalEntries(updatedEntries);
      klarStorage.setItem('klar_journal_entries', JSON.stringify(updatedEntries));
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 2000);


      setRecapResult(cleanResponse);
    } catch (e) {
      setRecapResult((e instanceof Error ? e.message : String(e)) || "Fehler beim Erstellen der Zusammenfassung. Bitte versuche es später nochmal.");
    } finally {
      setIsGeneratingRecap(false);
    }
  };

  const handleStartScenario = async () => {
    setScenarioStarted(true);
    setIsScenarioLoading(true);
    setScenarioMessages([]);

    let systemPrompt = "";
    if (scenario === 'erstes_date') {
      systemPrompt = "Lass uns ein erstes Date simulieren. Du spielst mein Date. Beginne das Gespräch mit einer Begrüßung im Café.";
    } else if (scenario === 'peinliches_schweigen') {
      systemPrompt = "Wir sind auf einem Date und es ist gerade ein peinliches Schweigen entstanden. Du schaust mich fragend an. Antworte kurz als mein Date und warte auf meine Reaktion.";
    } else if (scenario === 'ghosting') {
      systemPrompt = "Ich möchte üben, jemandem höflich abzusagen (Ghosting vermeiden). Du hast mich nach einem zweiten Date gefragt. Wie reagierst du auf meine Absage?";
    } else if (scenario === 'flirten') {
      systemPrompt = "Lass uns flirten üben. Schreibe mir als Verbindung auf einer Dating-App eine leicht flirtende Eröffnungsnachricht.";
    }

    try {
      const response = await askAICoach(`Simuliere ein Dating-Rollenspiel. Szenario: ${systemPrompt}. Antworte in der Rolle als mein Date/Verbindung. Gib mir kein Coaching in dieser Nachricht, sondern spiele nur die Rolle.`);
      setScenarioMessages([{ role: 'ai', text: response }]);
    } catch (e) {
      setScenarioMessages([{ role: 'ai', text: "Fehler beim Starten des Szenarios." }]);
    } finally {
      setIsScenarioLoading(false);
    }
  };

  const handleScenarioSend = async () => {
    if (!scenarioInput.trim()) return;

    const newMessages = [...scenarioMessages, { role: 'user', text: scenarioInput } as const];
    setScenarioMessages(newMessages);
    setScenarioInput("");
    setIsScenarioLoading(true);

    const conversationHistory = newMessages.map(m => `${m.role === 'user' ? 'Ich' : 'Du'}: ${m.text}`).join('\n');

    try {
      const response = await askAICoach(`Wir sind in einem Dating-Rollenspiel.\nBisheriger Verlauf:\n${conversationHistory}\n\nAntworte als mein Date auf meine letzte Nachricht. Bleibe in deiner Rolle.`);
      setScenarioMessages([...newMessages, { role: 'ai', text: response }]);
    } catch (e) {
      setScenarioMessages([...newMessages, { role: 'ai', text: "Fehler beim Verarbeiten." }]);
    } finally {
      setIsScenarioLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-light-bg dark:bg-dark-bg">
      <div className="flex flex-col p-4 border-b border-stone-100 dark:border-stone-700 bg-white/80 dark:bg-black/80  sticky top-0 z-10 gap-4">
        <div className="flex items-center">
          <Sparkles size={24} className="text-brand dark:text-brand-light mr-3" />
          <h2 className="font-medium text-lg font-serif">Klar Coach</h2>
        </div>

        <div className="flex bg-stone-100 dark:bg-stone-800 rounded-xl p-1 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}`}
          >
            <MessageCircle size={16} />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('planner')}
            className={`flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'planner' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}`}
          >
            <CalendarHeart size={16} />
            Planner
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'calendar' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}`}
          >
            <CalendarIcon size={16} />
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('recap')}
            className={`flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'recap' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}`}
          >
            <BookOpen size={16} />
            Journal
          </button>
          <button
            onClick={() => setActiveTab('scenario')}
            className={`flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'scenario' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}`}
          >
            <Theater size={16} />
            Szenarien
          </button>
          <button
            onClick={() => setActiveTab('goals')}
            className={`flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'goals' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}`}
          >
            <Target size={16} />
            Ziele
          </button>
                    <button
            onClick={() => setActiveTab('bio')}
            className={`flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'bio' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}`}
          >
            <UserCircle size={16} />
            Bio-Tuning
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab === 'analytics' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}`}
          >
            <TrendingUp size={16} />
            Analyse
          </button>
        </div>
      </div>

      {activeTab === 'chat' && (
        <>


          <div className="px-4 pt-2 flex justify-between items-center">
            <div className="flex gap-2">
              <button aria-label="Suche ein- oder ausblenden"
                onClick={() => setShowSearch(!showSearch)}
                className={`p-1.5 rounded-full ${showSearch ? 'bg-brand/10 text-brand dark:bg-brand-light/10 dark:text-brand-light' : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
              >
                <Search size={16} />
              </button>
              <button
                onClick={() => {
                  alert('Chat archiviert!');
                  setMessages([{ role: 'ai', text: 'Neuer Chat gestartet! Wie kann ich helfen?' }]);
                }}
                className="p-1.5 rounded-full text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                title="Chat archivieren"
              >
                <Archive size={16} />
              </button>
            </div>
            <select
              id="coach-tonfall"
              name="coach-tonfall"

              value={coachTone}
              onChange={(e) => {
                setCoachTone(e.target.value);
                klarStorage.setItem('klar_coach_tone', e.target.value);
              }}
              className="text-xs bg-stone-100 dark:bg-stone-800 border-none rounded-full px-3 py-1.5 text-stone-600 dark:text-stone-300 focus:ring-0 cursor-pointer outline-none"
            >
              <option value="motivierend">Motivierend 🌟</option>
              <option value="humorvoll">Humorvoll 😄</option>
              <option value="direkt">Direkt & Klar 🎯</option>
            </select>
          </div>

          {showSearch && (
            <div className="px-4 py-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  id="coach-verlaufsuche"
                  name="coach-verlaufsuche"
                  type="text"
                  placeholder="Verlauf durchsuchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-brand/20 outline-none"
                />
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">


            {messages.filter(msg => (msg?.text || '').toLowerCase().includes((searchQuery || '').toLowerCase())).map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-tr-sm'
                    : 'bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-tl-sm shadow-sm'
                }`}>
                  {/* 14.08.2026: Hier stand `{msg.text}` mit
                      `whitespace-pre-wrap`. Das Modell antwortet in Markdown,
                      und auf dem Bildschirm standen die Sternchen wörtlich:
                      „* **Option 1 (Werte):** …". Die eigene Nachricht bleibt
                      unveraendert — was der Mensch getippt hat, wird nicht
                      umgedeutet. */}
                  {msg.role === 'user'
                    ? <span className="whitespace-pre-wrap">{msg.text}</span>
                    : <Antworttext text={msg.text} />}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full " style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full " style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full " style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pt-2">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {dailyMood && (
                <button
                  onClick={() => {
                    const text = `Ich fühle mich heute in Bezug auf mein Dating-Leben ${dailyMood}. Bitte gib mir 3 konkrete, personalisierte Tipps für den heutigen Abend, wie ich mit dieser Stimmung am besten umgehe (z.B. bezüglich Self-Care, Chat-Verhalten oder Date-Vorbereitung).`;
                    setInput(text);
                  }}
                  className="whitespace-nowrap px-3 py-1.5 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light rounded-full text-xs font-bold hover:bg-brand/20 transition-colors flex items-center gap-1"
                >
                  <Sparkles size={12} /> Tipps für heute
                </button>
              )}
              <button
                onClick={() => {
                  const goal = getUserStorageItem('userGoal');
                  const goalContext = goal === "relationship" ? "für eine feste Beziehung" : "für ein entspanntes Kennenlernen";
                  const text = `Schreibe mir 3 witzige und lockere Eisbrecher-Nachrichten ${goalContext}.`;
                  setInput(text);
                }}
                className="whitespace-nowrap px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full text-xs font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              >
                😂 Witzig & Locker
              </button>
              <button
                onClick={() => {
                  const goal = getUserStorageItem('userGoal');
                  const goalContext = goal === "relationship" ? "für eine feste Beziehung" : "für ein entspanntes Kennenlernen";
                  const text = `Schreibe mir 3 tiefgründige und aufrichtige Eisbrecher-Nachrichten ${goalContext}.`;
                  setInput(text);
                }}
                className="whitespace-nowrap px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full text-xs font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              >
                🥰 Aufrichtig & Tiefgründig
              </button>
              <button
                onClick={() => {
                  const goal = getUserStorageItem('userGoal');
                  const goalContext = goal === "relationship" ? "für eine feste Beziehung" : "für ein entspanntes Kennenlernen";
                  const text = `Schreibe mir 3 direkte und selbstbewusste Eisbrecher-Nachrichten ${goalContext}, die schnell auf ein Date abzielen.`;
                  setInput(text);
                }}
                className="whitespace-nowrap px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full text-xs font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              >
                🎯 Direkt & Selbstbewusst
              </button>
              <button
                onClick={() => {
                  const bio = getUserStorageItem('klar_user_bio') || "Keine Bio";
                  const interests = getUserStorageItem('userInterests') || "Keine Interessen";
                  const goal = getUserStorageItem('userGoal');
                  const goalContext = goal === "relationship" ? "eine feste Beziehung" : "ein entspanntes Kennenlernen";

                  const text = `Bitte mache eine Deep Analysis meines Profils. Bio: "${bio}". Interessen: ${interests}. Ziel: ${goalContext}. Gib mir 3 datenbasierte, spezifische Verbesserungsvorschläge, um mein Profil attraktiver zu machen.`;
                  setInput(text);
                }}
                className="whitespace-nowrap px-3 py-1.5 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light rounded-full text-xs font-medium hover:bg-brand/20 dark:hover:bg-brand-light/20 transition-colors"
              >
                🔍 Deep Analysis
              </button>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-stone-800 pb-safe">
            <div className="flex gap-2">
              <button
                onClick={toggleVoiceRecording}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors shrink-0 ${isRecordingVoice ? 'bg-rose-100 text-rose-500 ' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
              >
                {/* BEFUND 14.08.2026: Im RUHEZUSTAND stand hier ein
                    durchgestrichenes Mikrofon. Das liest sich wie
                    „abgeschaltet" — dabei ist es die Aufforderung, zu
                    sprechen. Der laufende Zustand ist schon am Puls und an
                    der Farbe erkennbar (siehe className oben). */}
                <Mic size={20} />
              </button>
              <input
                id="coach-nachricht"
                name="coach-nachricht"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Frag nach Tipps oder sprich..."
                className="flex-1 bg-stone-100 dark:bg-stone-800 rounded-xl px-4 py-3 text-sm focus:outline-none"
              />
              <button
                aria-label="Nachricht senden"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-4 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl disabled:opacity-50 transition-opacity"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </>
      )}
      {activeTab === 'planner' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-lg font-medium mb-2 text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <MapPin className="text-brand dark:text-brand-light" size={20} />
              AI Date Planner
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
              Wähle ein Verbindung aus, um maßgeschneiderte Date-Ideen mit passenden Icebreakern zu erhalten.
            </p>

            <div className="space-y-3">
              <div className="relative">
                <select
                  id="dateplaner-verbindung"
                  name="dateplaner-verbindung"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 appearance-none"
                >
                  <option value="" disabled>Wähle ein Verbindung aus...</option>
                  {allProfiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.age})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-500">
                  <ChevronDown size={16} />
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-2 block">Stadt / Region (optional):</span>
                <div className="relative">
                  <input
                    id="dateplaner-ort"
                    name="dateplaner-ort"
                    type="text"
                    value={dateLocation}
                    onChange={(e) => setDateLocation(e.target.value)}
                    placeholder="z.B. Berlin Kreuzberg oder München"
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl p-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-stone-500">
                    <MapPin size={16} />
                  </div>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-2 block">Date Vibe wählen:</span>
                <div className="flex gap-2">
                  {(['Casual', 'Romantic', 'Adventure'] as const).map(mood => (
                    <button
                      key={mood}
                      onClick={() => setDateMood(mood)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-colors border ${
                        dateMood === mood
                          ? 'bg-brand/10 dark:bg-brand-light/10 border-brand/30 dark:border-brand-light/30 text-brand dark:text-brand-light'
                          : 'bg-stone-50 dark:bg-stone-950 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handlePlanDate}
                disabled={!selectedProfileId || isPlanning}
                className="w-full py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPlanning ? (
                  <>
                    <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                    Plane Date...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Ideen generieren
                  </>
                )}
              </button>
            </div>
          </div>

          {datePlans && (
            <div className="bg-white dark:bg-stone-800 border border-brand/20 dark:border-brand-light/20 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                <div className="whitespace-pre-wrap text-stone-700 dark:text-stone-300">
                  {datePlans}
                </div>
              </div>
              <button
                onClick={() => setActiveTab('calendar')}
                className="w-full py-3 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-xl text-sm font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center justify-center gap-2"
              >
                <CalendarIcon size={18} />
                In den Date Kalender eintragen
              </button>
            </div>
          )}
        </div>
      )}
      {activeTab === 'calendar' && (
        <DateCalendar />
      )}
      {activeTab === 'recap' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-lg font-medium mb-2 text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <ClipboardCheck className="text-brand dark:text-brand-light" size={20} />
              AI Date Debrief
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
              Wie lief das Date? Trage bis zu 3 positive (Pros) und 3 negative (Cons) Dinge ein. Der KI-Coach fasst deine Key Learnings zusammen!
            </p>

            <div className="space-y-4">
              <div className="relative">
                <select
                  id="debrief-verbindung"
                  name="debrief-verbindung"
                  value={recapProfileId}
                  onChange={(e) => setRecapProfileId(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 appearance-none"
                >
                  <option value="" disabled>Mit wem warst du auf einem Date?</option>
                  {allProfiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.age})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-500">
                  <ChevronDown size={16} />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-emerald-600 dark:text-emerald-500 mb-2">Pros (Was lief gut?)</label>
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <input
                        id={`debrief-pro-${i + 1}`}
                        name={`debrief-pro-${i + 1}`}
                        key={`pro-${i}`}
                        type="text"
                        placeholder={`Pro ${i + 1}`}
                        value={pros[i]}
                        onChange={(e) => {
                          const newPros = [...pros];
                          newPros[i] = e.target.value;
                          setPros(newPros);
                        }}
                        className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-rose-600 dark:text-rose-500 mb-2">Cons (Was lief nicht so gut?)</label>
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <input
                        id={`debrief-con-${i + 1}`}
                        name={`debrief-con-${i + 1}`}
                        key={`con-${i}`}
                        type="text"
                        placeholder={`Con ${i + 1}`}
                        value={cons[i]}
                        onChange={(e) => {
                          const newCons = [...cons];
                          newCons[i] = e.target.value;
                          setCons(newCons);
                        }}
                        className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleGenerateRecap}
                disabled={!recapProfileId || (pros.every(p => !p.trim()) && cons.every(c => !c.trim())) || isGeneratingRecap}
                className="w-full py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGeneratingRecap ? (
                  <>
                    <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                    Analysiere Date...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Key Learnings erstellen
                  </>
                )}
              </button>
            </div>
          </div>

          {recapResult && (
            <div className="bg-white dark:bg-stone-800 border border-brand/20 dark:border-brand-light/20 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-stone-700 dark:text-stone-300">
                  {recapResult}
                </div>
              </div>
            </div>
          )}

          <VoiceJournalWidget onSave={handleVoiceSave} />

          {journalEntries.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <BookOpen className="text-brand dark:text-brand-light" size={20} />
                Dein Dating-Journal
              </h3>

              <div className="space-y-4">
                {journalEntries.map(entry => {
                  const profile = allProfiles.find(p => p.id === entry.profileId);
                  return (
                    <div key={entry.id} className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-medium text-stone-900 dark:text-stone-100">
                          Date mit {profile ? profile.name : 'Unbekannt'}
                        </div>
                        <div className="text-xs text-stone-500">
                          {new Date(entry.date).toLocaleDateString('de-DE')}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {entry.pros.map((p, i) => (
                          <span key={`pro-${i}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            + {p}
                          </span>
                        ))}
                        {entry.cons.map((c, i) => (
                          <span key={`con-${i}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                            - {c}
                          </span>
                        ))}
                      </div>

                      {entry.preferencesExtracted && (
                        <div className="mt-3 p-3 bg-brand/5 dark:bg-brand-light/5 rounded-xl border border-brand/10">
                          <p className="text-xs font-medium text-brand dark:text-brand-light mb-1">Gelerntes Muster:</p>
                          <p className="text-sm text-stone-700 dark:text-stone-300">"{entry.preferencesExtracted}"</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'scenario' && (
        <div className="flex-1 flex flex-col h-[calc(100vh-140px)] relative overflow-hidden">
          {!scenarioStarted ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
                <h3 className="text-lg font-medium mb-2 text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Theater className="text-brand dark:text-brand-light" size={20} />
                  Szenarien-Modus
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
                  Wähle ein Dating-Szenario, um mit dem KI-Coach ein interaktives Rollenspiel zu starten.
                </p>

                <div className="space-y-4">
                  <div className="relative">
                    <select
                      id="szenario-auswahl"
                      name="szenario-auswahl"
                      value={scenario}
                      onChange={(e) => setScenario(e.target.value)}
                      className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 appearance-none"
                    >
                      <option value="erstes_date">Erstes Date im Café</option>
                      <option value="peinliches_schweigen">Peinliches Schweigen überbrücken</option>
                      <option value="flirten">Flirten & Neckisch schreiben</option>
                      <option value="ghosting">Höflich absagen (kein Ghosting)</option>
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-500">
                      <ChevronDown size={16} />
                    </div>
                  </div>

                  <button
                    onClick={handleStartScenario}
                    disabled={isScenarioLoading}
                    className="w-full py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isScenarioLoading ? (
                      <>
                        <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                        Starte Rollenspiel...
                      </>
                    ) : (
                      <>
                        <Theater size={16} />
                        Rollenspiel beginnen
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full relative">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
                <div className="flex justify-center mb-4 sticky top-0 z-10">
                  <button
                    onClick={() => {
                      setScenarioStarted(false);
                      setScenarioMessages([]);
                    }}
                    className="text-xs font-medium text-stone-600 dark:text-stone-300 bg-white/90 dark:bg-stone-800/90  border border-stone-200 dark:border-stone-700 px-4 py-2 rounded-full shadow-sm hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
                  >
                    Szenario beenden
                  </button>
                </div>
                {scenarioMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-tr-sm'
                        : 'bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-tl-sm shadow-sm'
                    }`}>
                      {/* Siehe oben — dieselbe Stelle im Uebungsgespraech. */}
                      {msg.role === 'user'
                        ? <span className="whitespace-pre-wrap">{msg.text}</span>
                        : <Antworttext text={msg.text} />}
                    </div>
                  </div>
                ))}
                {isScenarioLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-stone-300 rounded-full " style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-stone-300 rounded-full " style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-stone-300 rounded-full " style={{ animationDelay: '300ms' }}></span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 bg-white/95 dark:bg-stone-800/95  pb-safe border-t border-stone-100 dark:border-stone-700 absolute bottom-0 left-0 right-0">
                <div className="flex gap-2">
                  <input
                    id="szenario-antwort"
                    name="szenario-antwort"
                    type="text"
                    value={scenarioInput}
                    onChange={(e) => setScenarioInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScenarioSend()}
                    placeholder="Antworte auf die Situation..."
                    className="flex-1 bg-stone-100 dark:bg-stone-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 border border-transparent dark:border-stone-700"
                  />
                  <button
                    aria-label="Antwort senden"
                    onClick={handleScenarioSend}
                    disabled={!scenarioInput.trim() || isScenarioLoading}
                    className="px-4 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl disabled:opacity-50 transition-opacity flex items-center justify-center shrink-0"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'goals' && (
        <CoachGoalTracker />
      )}
      {activeTab === 'bio' && (
        <BioOptimizerWidget />
      )}

        {activeTab === 'icebreakers' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto space-y-6">
            <div className="bg-white dark:bg-stone-800 p-6 rounded-3xl border border-stone-200 dark:border-stone-700 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl">
                  <Bookmark size={24} className="fill-current" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-medium text-stone-900 dark:text-stone-100">Gespeicherte Icebreaker</h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400">Deine Sammlung für den perfekten Gesprächseinstieg.</p>
                </div>
              </div>

              {savedIcebreakers.length === 0 ? (
                <div className="text-center py-10 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700">
                  <MessageCircle size={32} className="mx-auto text-stone-300 dark:text-stone-600 mb-3" />
                  <p className="text-sm text-stone-500 dark:text-stone-400">Noch keine Icebreaker gespeichert.</p>
                  <p className="text-xs text-stone-400 mt-1">Speichere sie aus dem Daily Icebreaker Widget auf dem Dashboard.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedIcebreakers.map((text, i) => (
                    <div key={i} className="flex gap-3 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700 group">
                      <p className="flex-1 text-sm text-stone-700 dark:text-stone-300 font-medium leading-relaxed">
                        "{text}"
                      </p>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => copyIcebreaker(text)}
                          className={`p-2 rounded-xl transition-colors ${copiedIcebreaker === text ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'}`}
                          title="Kopieren"
                        >
                          {copiedIcebreaker === text ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        <button
                          onClick={() => deleteIcebreaker(text)}
                          className="p-2 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-900/50 transition-colors"
                          title="Löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'analytics' && (

        <div className="max-w-md mx-auto space-y-6 pb-6 pt-4 h-[calc(100vh-140px)]">
          <SentimentAnalyticsWidget />
          {/* ── ENTFERNT 14.08.2026 — <CoachInsightsWidget /> ───────────────
              Die Karte war vollstaendig erfunden. Ihr eigener Kopfkommentar
              sagte es seit dem 10.08.2026:

                „P2-BEFUND, NICHT BEHOBEN: Dieses Widget erzeugt Daten, die
                 es nicht gibt. Angezeigte Verlaeufe, Werte und Trends sind
                 erfunden — fuer die bedienende Person aber nicht von echten
                 zu unterscheiden."

              Konkret: eine Flaechengrafik aus `mockData` (Mo–So, feste
              Zahlen), dazu „Gespraechstiefe: Hoch, +24% vs letzte Woche"
              und „Antwortzeit: 2.4h, -45m vs letzte Woche". Alles fest im
              Quelltext.

              Damals ausdruecklich stehen gelassen, weil es eine Produkt-
              entscheidung sei. Die ist am 14.08.2026 gefallen: „Fuer das
              MVP gilt: Streichen. Besser eine schlanke, voll funktions-
              faehige und ehrliche User Journey als unfertige Features."

              WIEDERVORLAGE: Gespraechstiefe und Antwortzeit sind sinnvolle
              Kennzahlen. Sie brauchen aber erhobene Daten (Zeitstempel je
              Nachricht, ausgewertet je Woche) — das ist eine Aufgabe im
              Datenmodell, keine Anzeigefrage. */}
        <DailyCheckinWidget />
        <CheckinTimelineWidget />

          <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <CalendarHeart className="text-amber-500" size={20} />
              <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Pausierte Unterhaltungen</h3>
            </div>
            {(() => {
              let pausedList: { name: string; daysAgo: number }[] = [];
              try {
                const saved = klarStorage.getItem("klar_paused_chats");
                if (saved) {
                  const parsed: unknown = JSON.parse(saved);
                  if (Array.isArray(parsed)) {
                    pausedList = parsed.filter((item): item is { name: string; daysAgo: number } =>
                      Boolean(item) && typeof item === 'object'
                      && typeof (item as Record<string, unknown>).name === 'string'
                      && typeof (item as Record<string, unknown>).daysAgo === 'number'
                    );
                  }
                }
              } catch {
                pausedList = [];
              }

              if (pausedList.length === 0) {
                return (
                  <p className="text-xs text-stone-500 dark:text-stone-400 py-3 text-center bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700">
                    Aktuell keine pausierten Unterhaltungen vorhanden.
                  </p>
                );
              }

              return pausedList.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700 mb-2 last:mb-0">
                  <div>
                    <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Mit {item.name} (vor {item.daysAgo} Tagen)</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">Ist das Thema noch relevant?</p>
                  </div>
                  <button
                    onClick={() => {
                      setInput(`Hilf mir, das Gespräch mit ${item.name} wieder aufzunehmen. Wir haben vor ${item.daysAgo} Tagen zuletzt geschrieben.`);
                      setActiveTab('chat');
                    }}
                    className="px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-300 shadow-sm hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                  >
                    Hilfe anfragen
                  </button>
                </div>
              ));
            })()}
          </div>

        </div>
      )}
    </div>
  );
}
