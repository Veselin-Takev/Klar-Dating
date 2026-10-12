import { klarStorage } from '../lib/userScopedStorage';
// FE-02 (Final Audit 08.08.2026): Hier stand
//   import { Languages, Globe, useState, useEffect } from "react";
// `Languages` und `Globe` sind lucide-Symbole, keine React-Exporte. Beide
// waren damit `undefined`; das erste <Languages /> in Zeile 683 haette
// „Element type is invalid" geworfen — jedes Mal, wenn jemand ein Gespraech
// oeffnet. Verdeckt durch `@ts-nocheck` in Zeile 1.
// `Globe` wurde nirgends verwendet und ist deshalb entfallen.
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
// 14 Symbole wurden importiert und nie gerendert: Phone, Video, Settings,
// Check, ChevronRight, Lightbulb, TrendingUp, TrendingDown, Target, Smile,
// HelpCircle, FileText, Info, MicOff. Entfernt.
import { Languages, Moon, HeartPulse, ArrowLeft, Sparkles, Send, CalendarDays, Clock, X, CheckCheck, History, Activity, Flag, AlertTriangle, Bookmark, Brain, ListChecks, MapPin, Bell, BellOff, Minimize2, Mic, MessageSquare, Download } from "lucide-react";
import { jsPDF } from "jspdf";


import { askAICoach } from "../lib/api";
// BEFUND 10.08.2026: translateMessage wurde in Zeile 281 und 359 aufgerufen,
// aber nie importiert. Der ReferenceError fiel nicht auf, weil beide Aufrufe
// in einem try/catch stehen -- die Uebersetzung schlug also seit jeher still
// fehl, und die Oberflaeche zeigte nur "Uebersetzung nicht verfuegbar".
// Genau die Fehlerklasse, die heute die teuerste war: kein Absturz, nur eine
// Zusage ohne Wirkung.
import { SPRACHEN, zielsprachenCode, setzeZielsprache } from "../lib/sprache";
import { NotificationService } from "../services/notificationService";

import { RelationshipProgressWidget } from "../components/RelationshipProgressWidget";
import { ChatQualityChart } from "../components/ChatQualityChart";
import { RecentIntrosWidget } from "../components/RecentIntrosWidget";
import { ChatDatePlanner, type DateIdee } from "../components/ChatDatePlanner";
import { DateProposalMessage } from "../components/DateProposalMessage";
import { DatePrepChecklistModal } from "../components/DatePrepChecklistModal";
import { ChatDateExtractorWidget } from "../components/ChatDateExtractorWidget";
import { QuickRepliesDrawer } from "../components/QuickRepliesDrawer";
import { spracherkennungHinweis } from "../lib/spracherkennung";




// P1-Zusatzbefund: wurde benutzt, aber nie importiert (@ts-nocheck hat es verdeckt).
import { MessageBubble } from "../components/MessageBubble";
import { useChatGate } from "../lib/useChatGate";
import { melde } from "../lib/fehler";
import { meldeKontoErforderlich, sollGateZeigen } from "../lib/gastGrenze";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { hapticFeedback } from "../lib/haptics";
import { enqueueOfflineMessage } from "../lib/offlineQueue";

// ═══════════════════════════════════════════════════════════════════════════
// `// @ts-nocheck` ENTFERNT am 12.08.2026. Was die Zeile verdeckt hat:
//
//   1. 14 Symbole aus `lucide-react` importiert und nie gerendert.
//   2. `chatDynamic` — ein Zustand, der weder gesetzt noch gelesen wurde.
//   3. `setTargetLanguage` — nie aufgerufen. Die Zielsprache steht damit
//      dauerhaft auf `undefined`, und `MessageBubble` übersetzt nur, wenn
//      sie gesetzt ist. Die vorgesehene Sprachauswahl gibt es nicht.
//   4. Sieben Mal `any`: die Spracherkennung des Browsers (viermal), die
//      Kontextauswertung, der Sicherheitshinweis und `proposalDetails`.
//      Alle durch benannte Typen ersetzt.
//   5. Zwölf Mal `JSON.parse` ohne jede Prüfung — darunter dreimal derselbe
//      Block im JSX, der den Stimmungsverlauf fortschreibt. Stand dort
//      etwas anderes als ein Array, warf `.push` einen TypeError mitten im
//      Klick. Jetzt eine Funktion, einmal geprüft.
//   6. Drei leere `catch (e) { console.warn(e); ; }`.
//   7. `<ChatDatePlanner verbindungName={profile.name} />` — die Komponente
//      kennt keine Eigenschaft dieses Namens; sie heisst `matchName`. Der
//      Name wurde also verworfen: Die Ueberschrift lautete „Date mit " ohne
//      Namen, und der Planer legte seine Vorbereitungs-Checkliste unter
//      the legacy chat checklist key ab — also fuer ALLE Gespraeche
//      dieselbe.
//   8. `onClick={handleSend}`. React uebergibt das Klick-Ereignis als
//      erstes Argument, und das erste Argument von `handleSend` heisst
//      `forceSend`. Ein MouseEvent ist wahr — also lief jeder Klick auf
//      Senden mit `forceSend === true` und ueberSPRANG die
//      Empathie-Pruefung. Ueber die Eingabetaste lief sie, ueber den Knopf
//      nicht. Zwei Wege, zwei Verhalten, kein Hinweis.
//   9. `profile` ist `Profil | undefined` (aus `allProfiles.find`). Die
//      Sperre steht in der Ausgabe; fuer die Funktionen darueber galt sie
//      nicht. Fuenf Funktionen sichern das jetzt selbst ab.
//
// ── WAS SICH SICHTBAR ÄNDERT ──────────────────────────────────────────────
// Nur eines: Fällt `/api/generate-date-plan` aus, zeigte diese Datei einen
// erfundenen Plan mit KONKRETER Uhrzeit („Samstag, 14:00 Uhr") und
// KONKRETEM Ort („Lokales Lieblingscafé am Park") — ohne Hinweis, dass
// niemand das geplant hat. Der Ersatzplan ist jetzt allgemein formuliert,
// und darüber steht, dass er nicht auf euch zugeschnitten ist.
//
// ── VIER BEFUNDE, DIE ICH NICHT ALLEIN ENTSCHEIDE ─────────────────────────
// Sie brauchen kein `@ts-nocheck`, um zu bestehen — aber sie gehören auf
// den Tisch:
//
//   A. Zwei Schaltflächen in der Werkzeugleiste erzeugen ERFUNDENE
//      Nachrichten der anderen Person: „Englische Nachricht empfangen"
//      und „Red Flag Message simulieren". Die zweite hängt zusätzlich
//      einen KI-Aufruf an, dessen Ergebnis nirgends erscheint.
//   B. Der „Context-Aware Coach" (Gehirn-Symbol) löst bei jeder neuen
//      Nachricht einen KI-Aufruf aus. `setContextAnalysis` schreibt das
//      Ergebnis in einen Zustand, den niemand liest. Das Symbol pulsiert,
//      der Aufruf kostet, angezeigt wird nichts.
//   B2. `/api/conversation-dynamics` läuft ebenfalls bei jeder neuen
//      Nachricht. Das Ergebnis landet in `chatDynamic` — auch das liest
//      niemand.
//   C. Dasselbe bei den „Reentry-Impulsen": berechnet, nie angezeigt.
//   D. Die Zielsprache (Punkt 3 oben) ist nicht einstellbar.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Die Spracherkennung des Browsers, beschraenkt auf das, was hier benutzt
 * wird. `SpeechRecognition` ist kein Standard und fehlt in den
 * TypeScript-Bibliotheken; frueher stand hier viermal `any`.
 */
interface Spracherkennung {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
type SpracherkennungBauer = new () => Spracherkennung;

// ENTFERNT 12.08.2026: die Typen `Kontextauswertung` und
// `Sicherheitshinweis`. Sie beschrieben die Ergebnisse von `analyzeContext`
// und `simulateRedFlagMessage` — beide Funktionen sind entfallen.

const nurZeichenketten = (w: unknown): string[] =>
  Array.isArray(w) ? w.filter((x): x is string => typeof x === 'string') : [];

/**
 * Zeichenketten-Liste aus dem lokalen Speicher — ohne Vertrauen in den
 * Inhalt. Ersetzt neun Stellen, an denen `JSON.parse` ungeprueft lief.
 */
function listeAusSpeicher(schluessel: string): string[] {
  const roh = klarStorage.getItem(schluessel);
  if (!roh) return [];
  try {
    return nurZeichenketten(JSON.parse(roh) as unknown);
  } catch {
    return [];
  }
}

/** Aus einer Antwort die Liste unter `suggestions` holen. */
function vorschlaegeAus(text: string): string[] {
  if (!text) return [];
  const roh: unknown = JSON.parse(text);
  return roh !== null && typeof roh === 'object'
    ? nurZeichenketten((roh as Record<string, unknown>)['suggestions'])
    : [];
}

/** Ein Eintrag im Stimmungsverlauf ueber alle Gespraeche. */
interface Stimmungseintrag {
  id: string | undefined;
  sentiment: 'positive' | 'neutral' | 'negative';
  date: string;
}

/**
 * Stimmung zu einem Gespraech festhalten. Vorher stand dieser Ablauf
 * dreimal wortgleich im JSX, jedes Mal mit einem ungepruefeten
 * `JSON.parse` — stand dort etwas anderes als ein Array, warf `.push`
 * einen TypeError mitten im Klick.
 */
function merkeStimmung(id: string | undefined, sentiment: Stimmungseintrag['sentiment']): void {
  if (id) klarStorage.setItem(`klar_chat_sentiment_${id}`, sentiment);
  let verlauf: Stimmungseintrag[] = [];
  try {
    const roh: unknown = JSON.parse(klarStorage.getItem('klar_chat_sentiment_history') ?? '[]');
    if (Array.isArray(roh)) verlauf = roh as Stimmungseintrag[];
  } catch {
    verlauf = [];
  }
  verlauf.push({ id, sentiment, date: new Date().toISOString() });
  klarStorage.setItem('klar_chat_sentiment_history', JSON.stringify(verlauf));
}

/** Ein vom Server gelieferter Date-Vorschlag. */
interface Dateplan {
  title: string;
  time: string;
  location: string;
  plan: string;
}

function leseDateplan(text: string): Dateplan | null {
  if (!text) return null;
  const roh: unknown = JSON.parse(text);
  if (roh === null || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;
  if (typeof o['title'] !== 'string' || o['title'].trim() === '') return null;
  return {
    title: o['title'],
    time: typeof o['time'] === 'string' ? o['time'] : '',
    location: typeof o['location'] === 'string' ? o['location'] : '',
    plan: typeof o['plan'] === 'string' ? o['plan'] : '',
  };
}

interface ChatProfile {
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  photoUrl: string;
  interests: string[];
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'verbindung';
  text: string;
  originalText?: string;
  original_text?: string;
  translated_text?: string;

  audioUrl?: string;
  audioTranscription?: string;

  textOriginal?: string;
  translationStatus?: 'pending' | 'completed' | 'failed' | 'none';
  textTranslated?: string;
  sourceLang?: string;
  sourceLanguage?: string;
  targetLang?: string;
  isTranslated?: boolean;
  translationError?: boolean;
  isRead?: boolean;
  isDateProposal?: boolean;
  proposalDetails?: DateIdee;
  createdAt?: string | number | Date;
}

export default function ChatView() {


  const { id } = useParams();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<ChatProfile | null>(null);
  const profile = profileData ?? { id: id ?? '', name: 'Verbindung', age: 0, location: '', bio: '', photoUrl: '', interests: [] as string[] };
  const istBeispielGespraech = false;

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- API/auth subscription is an external source synchronized into view state. */
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setProfileData(null);
    setMessages([]);
    if (id && auth.currentUser) {
      auth.currentUser.getIdToken().then(token => fetch(`/api/chats/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      })).then(async response => response.ok ? response.json() : null)
        .then((data: unknown) => {
          if (!active) return;
          if (typeof data !== 'object' || data === null) { setProfileData(null); return; }
          const profile = (data as { profile?: unknown }).profile;
          if (typeof profile !== 'object' || profile === null) { setProfileData(null); return; }
          const p = profile as Record<string, unknown>;
          setProfileData({
            id: typeof p.id === 'string' ? p.id : id ?? '',
            name: typeof p.name === 'string' ? p.name : 'Verbindung',
            age: typeof p.age === 'number' ? p.age : 0,
            location: typeof p.location === 'string' ? p.location : '',
            bio: typeof p.bio === 'string' ? p.bio : '',
            photoUrl: typeof p.photoUrl === 'string' ? p.photoUrl : '',
            interests: Array.isArray(p.interests) ? p.interests.filter((v): v is string => typeof v === 'string') : [],
          });
        })
        .catch(() => { if (active) setProfileData(null); });
    }
    return () => { active = false; controller.abort(); };
  }, [id]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Offline replay is centralized in SyncBanner + IndexedDB. ChatView only enqueues.


  const [showProgressWidget, setShowProgressWidget] = useState(false);
  const [showIcebreakers, setShowIcebreakers] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSentimentCheck, setShowSentimentCheck] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  // P0-5: Uebermittlung, Fehler und Aktenzeichen sind Zustaende der Meldung.
  // Ohne sie ist ein Ausfall nicht von "nichts passiert" zu unterscheiden.
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportCaseId, setReportCaseId] = useState<string>("—");
  const [reportReason, setReportReason] = useState("");
  const { status: gateZustand, data: gateDaten, error: gateFehler,
    submitting: gateSubmitting, answer: answerGate, refresh: refreshGate } = useChatGate(id, auth.currentUser?.uid);
  const [gateInput, setGateInput] = useState('');
  useEffect(() => { setGateInput(''); }, [id]);
  const onGateSubmit = async () => {
    if (await answerGate(gateInput)) setGateInput('');
  };

  const [input, setInput] = useState(() => klarStorage.getItem(`klar_chat_draft_${id}`) || "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const activeChat = useRef(id);
  const pendingMessage = useRef<{ chatId: string; text: string; clientMessageId: string } | null>(null);
  useEffect(() => {
    activeChat.current = id;
    pendingMessage.current = null;
    setSendError(null);
    setIsSending(false);
    try { setInput(klarStorage.getItem(`klar_chat_draft_${id}`) || ''); }
    catch { setInput(''); }
  }, [id]);

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(Math.max(el.scrollHeight, 40), 128);
    el.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // BEFUND 10.08.2026: Der Mikrofon-Knopf benutzte toggleRecording und
  // isRecording. Beide gab es in dieser Datei nicht. Weil ein JSX-Attributwert
  // beim RENDERN ausgewertet wird und nicht erst beim Antippen, brach jedes
  // Oeffnen eines Gespraechs mit "ReferenceError: toggleRecording is not
  // defined" ab. Verdeckt durch @ts-nocheck in Zeile 1.
  //
  // Die Umsetzung folgt ReflectionLogWidget.tsx, wo dieselbe Spracheingabe
  // seit jeher funktioniert -- statt einer zweiten, abweichenden Variante.
  //
  // GRENZE, AUSDRUECKLICH: SpeechRecognition gibt es nicht in jedem Browser
  // (Firefox kennt es nicht). Fehlt es, bleibt der Knopf ohne Wirkung statt
  // abzustuerzen. Das Erkannte landet im Eingabefeld -- es wird nichts
  // automatisch abgeschickt.
  const [isRecording, setIsRecording] = useState(false);
  // const [voiceRecognition, setVoiceRecognition] = useState<Spracherkennung | null>(null);
  // BEFUND 14.08.2026: Fehlschlaege gingen ausschliesslich per `console.warn`
  // hinaus. Der Knopf blinkte und tat nichts. Die Ursache war am Ende banal —
  // die Berechtigungsabfrage des Browsers stand offen — aber das konnte
  // niemand wissen, weil die App es nicht gesagt hat.
  const [sprachHinweis, setSprachHinweis] = useState('');

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let chunks: BlobPart[] = [];

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        processAudioMessage(blob, recorder.mimeType);
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (e) {
      melde("ChatView.tsx", e, { message: "Mic error:" });
      setSprachHinweis('Mikrofon konnte nicht gestartet werden.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const processAudioMessage = async (blob: Blob, mimeType: string) => {

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        const token = auth.currentUser ? await auth.currentUser?.getIdToken() : '';

        // Show optimistic UI for audio message
        const tempId = Date.now().toString();
        const localAudioUrl = URL.createObjectURL(blob);
        setMessages(prev => [...prev, {
          id: tempId,
          role: 'user',
          text: 'Sprachnachricht',
          audioUrl: localAudioUrl,
          audioTranscription: 'Wird transkribiert...',
          isRead: false
        }]);

        const res = await fetch('/api/messages/send-audio', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`
          },
          body: JSON.stringify({ chatId: id, audioBase64: base64data, mimeType })
        });

        if (res.ok) {
           const data = await res.json();
           setMessages(prev => prev.map(m => m.id === tempId ? { ...m, audioTranscription: data.transcription || 'Transkription abgeschlossen' } : m));
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      melde("ChatView.tsx", e, { message: "Audio send error" });
    }
  };


  const [translationToast, setTranslationToast] = useState(false);

  useEffect(() => {
    // `SpeechRecognition` steht nicht in den TypeScript-Standardtypen.
    // Statt `any` das, was diese Datei tatsaechlich benutzt (siehe oben).
    const w = window as unknown as {
      SpeechRecognition?: SpracherkennungBauer;
      webkitSpeechRecognition?: SpracherkennungBauer;
    };
    const SpeechRecognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'de-DE';

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      setIsRecording(false);
      if (!transcript) return;
      setInput((vorher: string) => (vorher ? vorher + ' ' : '') + transcript);
    };
    recognition.onerror = (event) => {
      console.warn('Spracherkennung fehlgeschlagen:', event.error);
      setSprachHinweis(spracherkennungHinweis(event.error));
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);

    // setVoiceRecognition(recognition);
    return () => {
      try { recognition.stop(); } catch { /* schon beendet */ }
    };
  }, []);

//   // const toggleRecording = () => {
//     if (!voiceRecognition) {
//       setSprachHinweis(NICHT_VERFUEGBAR);
//       return;
//     }
//     setSprachHinweis('');
//     if (isRecording) {
//       voiceRecognition.stop();
//       setIsRecording(false);
//     } else {
//       voiceRecognition.start();
//       setIsRecording(true);
//     }
//   };

  useEffect(() => {
    klarStorage.setItem(`klar_chat_draft_${id}`, input);
  }, [input, id]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isLiveTranslationEnabled, setIsLiveTranslationEnabled] = useState(false);
  // `setIsTranslating` ist am 14.08.2026 entfallen: Beim Senden wird nicht
  // mehr uebersetzt. Der Zustand bleibt als Lesewert bestehen, damit die
  // Absperre in `handleSend` unveraendert lesbar ist — sie ist seitdem
  // dauerhaft `false`, und das steht hier, damit es niemand fuer eine
  // vergessene Verdrahtung haelt.
  const [isTranslating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  // ── BEFUND 14.08.2026, im Browser beobachtet ────────────────────────
  // Bis heute landete eine FEHLERMELDUNG in `aiSuggestions`:
  //
  //   setAiSuggestions([e.message || "Fehler beim Generieren…"]);
  //
  // Vorschlaege sind antippbar und setzen den Text ins Eingabefeld. Im
  // Gespraech standen deshalb zwei abgeschickte Nachrichten mit dem
  // Inhalt „Fehler beim Laden der Vorschlaege" — sichtbar fuer den
  // Menschen auf der anderen Seite.
  //
  // Ein Fehler ist kein Vorschlag. Er bekommt einen eigenen Zustand und
  // eine eigene Darstellung, die man nicht abschicken kann.
  const [vorschlagFehler, setVorschlagFehler] = useState<string | null>(null);
  // ── BEFUND 14.08.2026, im Browser beobachtet ────────────────────────
  // Bei `429 Too Many Requests` (Gastgrenze: 15 KI-Aufrufe/Stunde) schrieb
  // der `catch` von `handleSmartIntro` einen ERFUNDENEN Satz ins
  // Eingabefeld:
  //
  //   setInput(`Hey ${profile.name}, interessantes Profil! Gemeinsamkeiten: …`)
  //
  // Das ist einer der 13 geduldeten Client-Ersatztexte (check:client-ersatz)
  // — und der mit Abstand heikelste: Er steht direkt vor dem Absenden an
  // einen Menschen. Wer nicht genau hinsieht, schickt einen Satz, den die
  // App sich ausgedacht hat, im eigenen Namen.
  //
  // Jetzt: keine Zeile ins Feld, sondern ein Hinweis darunter. Und bei
  // einem Gast fuehrt der Weg dorthin, wo er hingehoert — ins
  // Registrierungs-Gate.
  const [introFehler, setIntroFehler] = useState<string | null>(null);
  const [icebreakerHistory, setIcebreakerHistory] = useState<string[]>([]);
  const [replySuggestions, setReplySuggestions] = useState<string[]>([]);
  // `chatDynamic` ist mit dem Aufruf an /api/conversation-dynamics entfallen.

  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);
  const [showTuning, setShowTuning] = useState(false);
  const [tuningSuggestions, setTuningSuggestions] = useState<{style: string, text: string, explanation: string}[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [isAnalyzingHealth, setIsAnalyzingHealth] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsAnalyzingHealth(false), 3000);
    return () => clearTimeout(t);
  }, []);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [empathyAnalysis, setEmpathyAnalysis] = useState<{status: 'checking' | 'pass' | 'warning', message?: string, suggestion?: string} | null>(null);
  const [showSmartPauseSuggestion, setShowSmartPauseSuggestion] = useState(false);

  useEffect(() => {
    const currentHour = new Date().getHours();
    const isLateNight = currentHour >= 22 || currentHour <= 4;
    // Show suggestion if late night and more than 4 messages, or just for testing if messages > 6
    if ((isLateNight && messages.length >= 4) || messages.length === 8) {
      if (!isFocusMode) setShowSmartPauseSuggestion(true);
    } else {
      setShowSmartPauseSuggestion(false);
    }
  }, [messages.length, isFocusMode]);

  useEffect(() => {
    const savedTimer = klarStorage.getItem(`klar_chat_timer_${id}`);
    if (savedTimer === "true") setTimerEnabled(true);
  }, [id]);

  // ── BEFUND 14.08.2026, im Browser beobachtet ──────────────────────────
  // Im Gespraech mit Lena stand eine abgeschickte Nachricht, die mit
  // „Hi Clara" begann. Der Entwurf aus dem Gespraech mit Clara hatte den
  // Wechsel ueberlebt.
  //
  // URSACHE: `/chat/p3` und `/chat/p1` sind DIESELBE Route mit anderem
  // Parameter. React montiert `ChatView` dabei NICHT neu — der Zustand
  // bleibt, und `input` ist Zustand. Wer ein Gespraech verlaesst, ohne
  // abzuschicken, und ein anderes oeffnet, findet dort seinen alten
  // Entwurf im Feld.
  //
  // WARUM DAS SCHWERER WIEGT ALS EIN ANZEIGEFEHLER: Es geht nicht um eine
  // falsche Zahl, sondern um eine Nachricht an einen MENSCHEN — mit dem
  // Namen einer anderen darin. Bei einer App, deren Versprechen „niemals
  // mit deiner Wuerde" lautet, ist das der teuerste denkbare Fehler.
  //
  // Mit zuruecksetzen: alles, was zum vorigen Gespraech gehoerte und beim
  // Wechsel stehen bleiben wuerde.
  useEffect(() => {
    setAiSuggestions([]);
    setVorschlagFehler(null);
    setIntroFehler(null);
    setShowIcebreakers(false);
  }, [id]);

  const toggleTimer = () => {
    const newState = !timerEnabled;
    setTimerEnabled(newState);
    klarStorage.setItem(`klar_chat_timer_${id}`, newState.toString());
  };


  const [savedSmartIntros, setSavedSmartIntros] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'icebreakers' | 'savedIntros'>('icebreakers');

  // ENTFERNT 12.08.2026 auf Ihre Entscheidung: Hier lief bei jeder vierten
  // und jeder weiteren Nachricht ein Aufruf an /api/conversation-dynamics.
  // Das Ergebnis wurde in `chatDynamic` geschrieben und nirgends gelesen —
  // eine laufende Rechnung ohne Gegenwert. Der Endpunkt bleibt im Server
  // bestehen und ist ueber kiAufruf angebunden; er hat jetzt nur keinen
  // Aufrufer mehr.

  useEffect(() => {
    setSavedSmartIntros(listeAusSpeicher("klar_saved_smart_intros"));
  }, []);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ENTFERNT 12.08.2026: sechs Zustaende, die ausschliesslich zu den oben
  // gestrichenen Funktionen gehoerten. Keiner von ihnen wurde je gelesen.

  // ENTFERNT 14.08.2026: `const [intensity, setIntensity] = useState(50);`
  // Der Wert wurde ausschliesslich von der erfundenen Antwort erhoeht. Ohne
  // sie waere er eine feste 50 gewesen — eine Zahl, die eine Beobachtung
  // vortaeuscht. Siehe die Stelle in der Kopfzeile weiter unten.
  // BEHOBEN 14.08.2026. Vorher stand hier `const [targetLanguage] =
  // useState<string | undefined>(undefined)` ohne Setzer — die Zielsprache
  // war dauerhaft `undefined`, und `MessageBubble` uebersetzt nur, wenn sie
  // gesetzt ist. EINGEHENDE Nachrichten wurden also nie uebersetzt, seit es
  // die Funktion gibt. Der Knopf oben schaltete ausschliesslich den
  // ausgehenden Weg.
  //
  // Jetzt: eine waehlbare Sprache aus `src/lib/sprache.ts`, vorbelegt aus
  // dem Speicher bzw. der Browsersprache. Uebersetzt wird nur, wenn die
  // Live-Uebersetzung eingeschaltet ist — deshalb steht der Schalter
  // getrennt von der Sprachwahl.
  const [sprachCode, setSprachCode] = useState<string>(() => zielsprachenCode());
  const translationKeysRef = useRef<Set<string>>(new Set());
  const translationRunRef = useRef(0);

  // Live-Übersetzung ist eine reine Lesehilfe: Gesendet wird immer das Original.
  // Übersetzt werden ausschließlich eingehende Nachrichten, serverseitig nach
  // Art.-9/PII-Sanitization und nur über den authentifizierten /api/translate-Pfad.
  useEffect(() => {
    if (!isLiveTranslationEnabled || !id || !auth.currentUser || gateZustand !== 'offen') return;
    const runId = ++translationRunRef.current;
    const candidates = messages
      .filter(message => message.role === 'verbindung' && typeof message.text === 'string' && message.text.trim())
      .slice(-30);

    const translateOne = async (message: ChatMessage) => {
      const messageId = message.id;
      if (!messageId) return;
      const key = `${messageId}:${sprachCode}`;
      if (translationKeysRef.current.has(key)) return;
      translationKeysRef.current.add(key);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token || runId !== translationRunRef.current) return;
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: message.text, targetLang: sprachCode, sourceLang: 'auto' }),
          signal: AbortSignal.timeout(2200),
        });
        if (!response.ok) return;
        const result = await response.json() as {
          success?: boolean; textTranslated?: unknown; sourceLang?: unknown; usedFallback?: boolean; translationError?: boolean;
        };
        if (runId !== translationRunRef.current || result.success !== true || result.usedFallback === true || typeof result.textTranslated !== 'string') return;
        const translated = result.textTranslated.trim();
        if (!translated || translated === message.text.trim()) return;
        setMessages(previous => previous.map(current => current.id === messageId && current.text === message.text
          ? {
              ...current,
              originalText: message.text,
              text: translated,
              translated_text: translated,
              textTranslated: translated,
              targetLang: sprachCode,
              ...(typeof result.sourceLang === 'string' && result.sourceLang !== 'auto' ? { sourceLang: result.sourceLang, sourceLanguage: result.sourceLang } : {}),
              isTranslated: true,
              translationStatus: 'completed',
              translationError: result.translationError === true,
            }
          : current));
      } catch {
        // Translation is progressive enhancement; the original message remains authoritative.
      }
    };

    let cursor = 0;
    const workers = Array.from({ length: Math.min(3, candidates.length) }, async () => {
      while (cursor < candidates.length) {
        const candidate = candidates[cursor++];
        if (!candidate) continue;
        await translateOne(candidate);
      }
    });
    void Promise.all(workers);
    return () => {
      translationRunRef.current++;
    };
  }, [gateZustand, id, isLiveTranslationEnabled, messages, sprachCode]);


  const [isGeneratingSmartIntro, setIsGeneratingSmartIntro] = useState(false);

  const [showChecklist, setShowChecklist] = useState(false);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<{title: string, description: string}[]>([]);
  useEffect(() => {
    setUserInterests(listeAusSpeicher("userInterests"));
  }, []);

  useEffect(() => {
    setSavedSmartIntros(listeAusSpeicher("klar_saved_smart_intros").slice(0, 5));
  }, []);


  // ENTFERNT 12.08.2026 auf Ihre Entscheidung: `analyzeContext`.
  // Die Funktion rief `askAICoach` und schrieb Stimmung und Empfehlung in
  // einen Zustand, den niemand las. Mit dem Knopf daven ist sie entfallen;
  // `noUnusedLocals` haette sie sonst als ungenutzt gemeldet.

  const handleSmartIntro = async () => {
    if (!profile) return;
    setIsGeneratingSmartIntro(true);
    try {
      const gespeicherteInteressen = listeAusSpeicher("userInterests");
      const userInterests = gespeicherteInteressen.length > 0 ? gespeicherteInteressen.join(", ") : "Nicht angegeben";


      const savedSentiment = klarStorage.getItem(`klar_chat_sentiment_${id}`);
      const sentimentContext = savedSentiment
        ? `Beachte: Mein Eindruck vom bisherigen Gespräch mit dieser Person war "${savedSentiment === 'positive' ? 'sehr positiv' : savedSentiment === 'negative' ? 'eher negativ/zäh' : 'neutral/okay'}". `
        : '';

      const prompt = `Du bist ein Dating-Coach. ${sentimentContext}Erstelle EINEN (1) einzigen kurzen, personalisierten "Smart Intro" Gesprächseinstieg (Icebreaker) für eine Verbindung mit ${profile.name}.
Ihre Bio: "${profile.bio}"
Ihre Interessen: ${profile.interests.join(", ")}
Meine Interessen: ${userInterests}
Der Einstieg sollte kreativ, freundlich und auf eine Gemeinsamkeit oder etwas aus der Bio bezogen sein. Antworte NUR mit dem vorgeschlagenen Text. Keine Anführungszeichen, keine Erklärungen.`;

      const response = await askAICoach(prompt);
      const generatedText = response.trim();
      setInput(generatedText);

      setSavedSmartIntros(prev => {
        const updated = Array.from(new Set([generatedText, ...prev]));
        klarStorage.setItem("klar_saved_smart_intros", JSON.stringify(updated.slice(0, 5)));
        return updated.slice(0, 5);
      });
    } catch (e) {
      melde("ChatView", e);
      const text = e instanceof Error ? e.message : String(e);
      // Die Gastgrenze ist kein Fehler, sondern eine Grenze. Sie fuehrt in
      // denselben Dialog wie jede andere gesperrte Handlung — eine Aussage,
      // ein Weg.
      if (sollGateZeigen(e, auth.currentUser) || /kostenloses Konto/i.test(text)) {
        meldeKontoErforderlich({ herkunft: 'api', vorgang: text });
        setIntroFehler(null);
      } else {
        setIntroFehler(text || "Der Einstieg konnte nicht erzeugt werden. Bitte versuche es später noch einmal.");
      }
    } finally {
      setIsGeneratingSmartIntro(false);
    }
  };

  // ENTFERNT 12.08.2026 auf Ihre Entscheidung: `simulateSilence`.
  // Ein Klick auf das „Spannungs-Barometer" setzte die Intensitaet auf 15,
  // rief `askAICoach` fuer drei „Wiedereinstiegs-Impulse" — und schrieb sie
  // in einen Zustand, den niemand las. Der Aufruf kostete, angezeigt wurde
  // nichts.



  // ENTFERNT 12.08.2026 auf Ihre Entscheidung: `simulateForeignMessage`.
  // Die Funktion haengte eine erfundene englische Nachricht der anderen
  // Person in den Gespraechsverlauf.

  // ENTFERNT 12.08.2026 auf Ihre Entscheidung: `simulateRedFlagMessage`.
  // Die Funktion haengte eine erfundene uebergriffige Nachricht der anderen
  // Person in den Gespraechsverlauf und startete danach einen KI-Aufruf,
  // dessen Ergebnis nirgends erschien.


    const [isExporting, setIsExporting] = useState(false);

  const exportPDF = () => {
    if (messages.length === 0) return;
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica");
      doc.setFontSize(20);
      doc.text(`Chat mit ${profile?.name || 'Unbekannt'}`, 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Exportiert am: ${new Date().toLocaleDateString('de-DE')}`, 14, 30);

      let currentY = 40;
      doc.setTextColor(0);
      doc.setFontSize(12);

      messages.forEach((msg) => {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }

        const sender = msg.role === "user" ? "Ich" : (profile?.name || "Kontakt");
        const time = new Date(msg.createdAt ?? "").toLocaleTimeString('de-DE', { hour: '2-digit', minute:'2-digit' });

        doc.setFont("helvetica", "bold");
        doc.text(`${sender} (${time}):`, 14, currentY);
        currentY += 6;

        doc.setFont("helvetica", "normal");
        const splitText = doc.splitTextToSize(msg.text, 180);
        doc.text(splitText, 14, currentY);
        currentY += (splitText.length * 6) + 4;
      });

      doc.save(`Klar_Chat_${profile?.name || 'Kontakt'}.pdf`);
    } catch (e) {
      melde("ChatView.tsx", e, { message: "PDF Export error:" });
    } finally {
      setIsExporting(false);
    }
  };


  const previousMessagesLength = useRef(0);
  useEffect(() => {
    if (messages.length > previousMessagesLength.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'verbindung') {
        hapticFeedback('medium');
      }
    }
    previousMessagesLength.current = messages.length;

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'verbindung' && lastMsg.translationStatus === 'completed' && !lastMsg.isRead) {
        setTranslationToast(true);
        const timer = setTimeout(() => setTranslationToast(false), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [messages]);

  const handleSend = async (forceSend = false) => {
    if (gateZustand !== 'offen' || isSending || !id || !auth.currentUser) return;
    hapticFeedback('light');
    if (!forceSend) {
      setEmpathyAnalysis({ status: 'checking' });
      await new Promise(r => setTimeout(r, 600));
      const lowerInput = input.toLowerCase();
      if (lowerInput.includes("warum") || lowerInput.includes("nein") || lowerInput.includes("egal")) {
        setEmpathyAnalysis({
          status: 'warning',
          message: 'Deine Nachricht könnte etwas konfrontativ wirken.',
          suggestion: 'Wie wäre es stattdessen hiermit: "Ich habe da eine andere Perspektive, weil..."'
        });
        return;
      } else {
        setEmpathyAnalysis({ status: 'pass' });
        setTimeout(() => setEmpathyAnalysis(null), 1000);
      }
    }
    if (!input.trim() || isTranslating || gateZustand !== "offen") return;


    // ── ENTFERNT AM 14.08.2026: die stille Ersetzung beim Senden ──────────
    // Hier wurde der eingetippte Text durch eine maschinelle Uebersetzung
    // nach "Englisch" ERSETZT und diese als eigene Nachricht abgeschickt.
    // Zwei Dinge waren daran falsch:
    //
    //   1. Verschickt wurden nicht die Worte der schreibenden Person,
    //      sondern die einer Maschine — ohne Kennzeichnung, ohne Ansicht
    //      vorher, ohne Moeglichkeit zu widersprechen.
    //   2. Scheiterte die Uebersetzung, ging der deutsche Text hinaus, und
    //      angezeigt wurde derselbe Hinweis wie bei einem Netzproblem.
    //
    // Gesendet wird jetzt IMMER das Original. Uebersetzt wird auf der
    // lesenden Seite, sichtbar gekennzeichnet, mit dem Original darueber.
    // Das ist dieselbe Regel wie bei den KI-Antworten: Nichts anzeigen oder
    // verschicken, was wie eigener Inhalt aussieht, es aber nicht ist.
    const msgText = input;
    const sender = auth.currentUser.uid;
    if (pendingMessage.current?.chatId !== id || pendingMessage.current.text !== msgText) {
      pendingMessage.current = { chatId: id, text: msgText, clientMessageId: crypto.randomUUID() };
    }
    const submission = pendingMessage.current;

    const queueSubmission = async () => {
      await enqueueOfflineMessage({
        ownerUid: sender,
        chatId: submission.chatId,
        text: submission.text,
        clientMessageId: submission.clientMessageId,
      });
      if (activeChat.current !== id || auth.currentUser?.uid !== sender) return;
      pendingMessage.current = null;
      setInput(previous => previous === msgText ? '' : previous);
      setSendError('Offline gespeichert. Die Nachricht wird nach Wiederherstellung der Verbindung gesendet.');
    };

    if (!navigator.onLine) {
      try { await queueSubmission(); }
      catch (error) {
        setSendError('Die Offline-Nachricht konnte nicht sicher gespeichert werden. Dein Entwurf bleibt erhalten.');
        melde('ChatView.tsx/offline-queue', error);
      }
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(submission),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error('Message not acknowledged');
      if (activeChat.current !== id || auth.currentUser?.uid !== sender) return;
      pendingMessage.current = null;
      setInput(previous => previous === msgText ? '' : previous);
      // The Firestore subscription renders only persisted messages.
    } catch (error) {
      if (activeChat.current === id && auth.currentUser?.uid === sender) {
        // Unknown network outcomes are safe to retry because clientMessageId is stable and
        // the server persistence boundary is idempotent for that ID.
        if (!navigator.onLine || error instanceof TypeError) {
          try {
            await queueSubmission();
          } catch (queueError) {
            setSendError('Die Nachricht wurde nicht bestätigt und konnte nicht offline gespeichert werden. Dein Entwurf bleibt erhalten.');
            melde('ChatView.tsx/offline-queue', queueError);
          }
        } else {
          setSendError('Die Nachricht wurde nicht bestätigt. Dein Entwurf bleibt erhalten; bitte erneut senden.');
        }
        melde('ChatView.tsx', error);
      }
    } finally {
      if (activeChat.current === id) setIsSending(false);
    }

    // ── BEFUND 14.08.2026, beim ersten Rundgang im angemeldeten Zustand ──
    //
    // Hier stand:
    //
    //     // Simulate a delayed response
    //     setTimeout(() => {
        //       setIntensity(prev => Math.min(100, prev + 10));
    //       setMessages(prev => {
    //         const markedRead = prev.map(m => m.role === 'user'
    //                                          ? { ...m, isRead: true } : m);
    //         return [...markedRead,
    //                 { role: 'verbindung', text: "Hey! Schön von dir zu hören 😊" }];
    //       });
    //     }, 1500);
    //
    // 1,5 Sekunden nach JEDER gesendeten Nachricht erschien diese Antwort.
    // Der Text stand fest im Quelltext. Bestaetigt im Betrieb bei „Clara"
    // UND bei „Jonas" — beide erfunden (FUN-01, src/data.ts).
    //
    // Vier Signale behaupteten gleichzeitig, dort sei ein Mensch:
    //
    //   role: 'verbindung'   die andere Person hat geantwortet
    //   isRead: true         sie hat gelesen
        //   setIntensity(+10)    das Gespraech entwickelt sich
    //
    // Eine erfundene ZAHL ist eine falsche Anzeige. Eine erfundene
    // AEUSSERUNG einer Person ist etwas anderes — und sie widerspricht der
    // Zusage der App unmittelbar: „Echtes Dating ohne Spielchen … niemals
    // mit deiner Wuerde."
    //
    // Ersatzlos entfernt. Die Nachricht steht jetzt unbeantwortet da — das
    // ist der WAHRE Zustand. Warum niemand antwortet, sagt der Hinweis unter
    // dem Verlauf (`istBeispielGespraech`), nicht eine Nachricht in fremdem
    // Namen.
    //
    // Bewacht von scripts/erfundene-aeusserungen.mjs, Nulltoleranz.
  };




  const [showDatePlan, setShowDatePlan] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- Firestore is an external subscription; incoming snapshots must update local view state. */
  useEffect(() => {
    if (!id || gateZustand !== 'offen') return;
    let active = true;
    let unsubscribeMessages: (() => void) | null = null;

    // Firebase Auth restores persisted sessions asynchronously on a page reload.
    // Reading auth.currentUser once here can see null and permanently skip the
    // Firestore subscription because no auth state change was observed by this effect.
    // Subscribe to the SDK's auth state so the persisted chat is loaded as soon as
    // the restored user is available, without introducing a second token cache.
    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      unsubscribeMessages?.();
      unsubscribeMessages = null;
      if (!active) return;
      if (!user) {
        setMessages([]);
        return;
      }

      const viewer = user.uid;
      const messagesRef = query(collection(db, `chats/${id}/messages`), orderBy('createdAt', 'desc'), limit(100));
      unsubscribeMessages = onSnapshot(messagesRef, snapshot => {
        if (!active || auth.currentUser?.uid !== viewer) return;
        const unreadIds: string[] = [];
        const persisted: ChatMessage[] = snapshot.docs.slice().reverse().map(message => {
          const data = message.data();
          if (data.senderId !== viewer && data.isRead !== true) unreadIds.push(message.id);
          return {
            id: message.id,
            role: data.senderId === viewer ? 'user' : 'verbindung',
            text: typeof data.text === 'string' ? data.text : '',
            isRead: data.isRead === true,
            ...(typeof data.originalText === 'string' ? { originalText: data.originalText } : {}),
            ...(data.createdAt instanceof Timestamp
              ? { createdAt: data.createdAt.toDate() }
              : typeof data.createdAt === 'string' || typeof data.createdAt === 'number' || data.createdAt instanceof Date
                ? { createdAt: data.createdAt }
                : {}),
          };
        });
        setMessages(persisted);
        if (unreadIds.length) {
          user.getIdToken().then(token => {
            // Token resolution may outlive logout, chat navigation or account switch.
            if (!active || auth.currentUser?.uid !== viewer) return;
            return fetch('/api/messages/mark-read', {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ chatId: id, messageIds: unreadIds }),
            });
          }).catch(() => { /* Read receipts never acknowledge unsaved messages. */ });
        }
      }, error => {
        if (active) setSendError('Nachrichten konnten nicht geladen werden. Bitte lade das Gespräch erneut.');
        melde('ChatView.tsx', error);
      });
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeMessages?.();
    };
  }, [id, gateZustand]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [showQualityChart, setShowQualityChart] = useState(false);
  const [datePlan, setDatePlan] = useState<Dateplan | null>(null);
  // Kommt der Plan aus dem Ersatz statt von der KI? Der Hinweis haengt daran.
  const [planIstErsatz, setPlanIstErsatz] = useState(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);

  const generateDatePlan = async () => {
    setIsLoadingPlan(true);
    try {
      const userInterestsStr = listeAusSpeicher("userInterests");
      const userName = klarStorage.getItem("userName") || "Ich";

      const res = await fetch("/api/generate-date-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: profile?.name,
          targetInterests: profile?.interests,
          userName,
          userInterests: userInterestsStr,
          chatHistory: messages
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const plan = leseDateplan(await res.text());
      if (!plan) throw new Error("Antwort ohne verwertbaren Plan");
      setDatePlan(plan);
      setPlanIstErsatz(false);
    } catch (e) {
      melde("ChatView/dateplan", e);
      // BEFUND 12.08.2026: Dieser Ersatzplan nennt eine konkrete Uhrzeit
      // ("Samstag, 14:00 Uhr") und einen konkreten Ort ("Lokales
      // Lieblingscafé am Park") — beides erfunden und nicht als solches
      // gekennzeichnet. Der Plan wurde angezeigt, als haette die KI ihn
      // erstellt. Der Text bleibt (er ist harmlos und brauchbar), aber die
      // Herkunft steht ab jetzt darueber.
      setPlanIstErsatz(true);
      setDatePlan({
        title: "Kaffee & Spaziergang",
        time: "an einem Nachmittag",
        location: "ein Café in eurer Nähe",
        plan: "Ein entspannter Kaffee und danach ein kleiner Spaziergang — genug Zeit zum Reden, jederzeit beendbar."
      });
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const getDateLocations = async () => {
    try {
      const userInterests = listeAusSpeicher("userInterests");
      const userName = klarStorage.getItem("userName") || "Ich";

      const res = await fetch("/api/date-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: profile?.name,
          targetBio: profile?.bio,
          targetInterests: profile?.interests,
          userName,
          userInterests,
          chatHistory: messages
        })
      });

      if (!res.ok) throw new Error("API request failed");

      const roh: unknown = JSON.parse((await res.text()) || '{}');
      const liste =
        roh !== null && typeof roh === 'object'
          ? (roh as Record<string, unknown>)['suggestions']
          : null;
      setLocationSuggestions(
        Array.isArray(liste)
          ? liste.flatMap((e) =>
              e !== null && typeof e === 'object' &&
              typeof (e as Record<string, unknown>)['title'] === 'string'
                ? [{
                    title: String((e as Record<string, unknown>)['title']),
                    description: String((e as Record<string, unknown>)['description'] ?? ''),
                  }]
                : [],
            )
          : [],
      );
}
 catch (e) {
      console.warn("Failed to get location suggestions", e);
      setLocationSuggestions([
        { title: "Gemütliches Café", description: "Ein lokales Café bietet eine entspannte Atmosphäre für das erste Kennenlernen." },
        { title: "Spaziergang im Park", description: "Perfekt, um ungezwungen ins Gespräch zu kommen." },
        { title: "Museumsbesuch", description: "Es gibt immer etwas zu sehen und Gesprächsstoff geht nicht aus." }
      ]);
    } finally {
    }
  };


  const getConversationTuning = async () => {
    setIsLoadingAI(true);
    try {
      const userInterests = listeAusSpeicher("userInterests");
      const userName = klarStorage.getItem("userName") || "Ich";

      const res = await fetch("/api/conversation-tuning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: profile?.name,
          targetBio: profile?.bio,
          targetInterests: profile?.interests,
          userName,
          userInterests,
          chatHistory: messages
        })
      });

      if (!res.ok) {
        throw new Error("Fehler beim Laden der Tuning-Vorschläge");
      }

      const roh: unknown = JSON.parse((await res.text()) || '{}');
      const liste =
        roh !== null && typeof roh === 'object'
          ? (roh as Record<string, unknown>)['suggestions']
          : null;
      setTuningSuggestions(
        Array.isArray(liste)
          ? liste.flatMap((e) => {
              if (e === null || typeof e !== 'object') return [];
              const o = e as Record<string, unknown>;
              if (typeof o['text'] !== 'string') return [];
              return [{
                style: typeof o['style'] === 'string' ? o['style'] : '',
                text: o['text'],
                explanation: typeof o['explanation'] === 'string' ? o['explanation'] : '',
              }];
            })
          : [],
      );
}
 catch (e) {
      melde("ChatView", e);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const getReplySuggestions = async () => {
    if (messages.length === 0) return;
    setIsGeneratingReplies(true);
    try {
      const userName = klarStorage.getItem("userName") || "Ich";
      const res = await fetch("/api/reply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: profile?.name || "Verbindung",
          userName,
          chatHistory: messages.slice(-10) // Only send the last 10 messages for context
        })
      });

      if (!res.ok) throw new Error("Fehler beim Laden");
      setReplySuggestions(vorschlaegeAus(await res.text()));
    } catch (e) {
      melde("ChatView", e);
      setReplySuggestions(["Das klingt interessant!", "Erzähl mir mehr.", "Wie meinst du das genau?"]);
    } finally {
      setIsGeneratingReplies(false);
    }
  };

  const getIcebreakers = async () => {
    if (!profile) return;
    setIsLoadingAI(true);
    setVorschlagFehler(null);
    try {
      const userInterests = listeAusSpeicher("userInterests");
      const userName = klarStorage.getItem("userName") || "Ich";
      const savedSentiment = klarStorage.getItem(`klar_chat_sentiment_${id}`);

      const res = await fetch("/api/icebreakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: profile.name,
          targetBio: profile.bio,
          targetInterests: profile.interests,
          userName,
          userInterests,
          chatHistory: messages,
          previousSentiment: savedSentiment
        })
      });

      if (!res.ok) {
        throw new Error("Fehler beim Laden der Vorschläge");
      }

      const newSuggestions = vorschlaegeAus(await res.text());
      setAiSuggestions(newSuggestions);

      setIcebreakerHistory(prev => {
        const combined = [...newSuggestions, ...prev];
        return Array.from(new Set(combined));
      });

      // Update stats
      const currentCount = parseInt(klarStorage.getItem('klar_icebreaker_count') || '0', 10);
      klarStorage.setItem('klar_icebreaker_count', (currentCount + 1).toString());
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      melde("ChatView", e);
      setVorschlagFehler(
        (e instanceof Error ? e.message : String(e)) ||
          "Die Vorschläge konnten nicht geladen werden. Bitte versuche es später noch einmal.",
      );
}
 finally {
      setIsLoadingAI(false);
    }
  };

  // ── FE-07 (Final Audit 08.08.2026) ──────────────────────────────────
  // Diese Rückgabe stand in Zeile 148 — vor 14 weiteren Hooks. Sobald
  // `profile` einmal fehlt (unbekannte id in der Adresse, gelöschtes
  // Gespräch), ruft React in derselben Komponente weniger Hooks auf als
  // im Durchlauf davor: „Rendered fewer hooks than expected", der ganze
  // Bildschirm stürzt ab statt die Meldung zu zeigen.
  //
  // Bisher hat das niemand gesehen, weil `profile` aus vier fest
  // eingebauten Datensätzen kommt und immer gefunden wurde. Mit echten
  // Profilen wäre es sofort aufgetreten.
  //
  // GEPRÜFT VOR DEM VERSCHIEBEN: Kein useEffect- oder useMemo-Rumpf fasst
  // `profile` an (maschinell über den Syntaxbaum geprüft, 0 Treffer). Die
  // 19 Verwendungen darunter stehen in Klick-Handlern, die vor dieser
  // Rückgabe nie laufen. Das Verschieben ist deshalb gefahrlos.
  if (!profile) return (<div>

Verbindung nicht gefunden</div>);

  return (
    <div className="klar-page flex flex-col h-full relative">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-3.5 border-b border-stone-200 dark:border-stone-700 bg-white/95 dark:bg-stone-900/95 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center">
          <button onClick={() => {
            if (messages.length >= 2 && !klarStorage.getItem(`klar_chat_sentiment_${id}`)) {
              setShowSentimentCheck(true);
            } else {
              navigate("/chats");
            }
          }} className="klar-icon-button -ml-1 sm:-ml-2" aria-label="Zurück zu den Chats">
            <ArrowLeft size={24} className="text-stone-700 dark:text-stone-300" />
          </button>
          <img src={profile.photoUrl} alt={profile.name} className="w-10 h-10 rounded-full object-cover mx-3 border border-stone-200 dark:border-stone-700" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="font-serif font-medium text-lg text-stone-900 dark:text-stone-100 leading-tight">{profile.name}</h2>
              {isAnalyzingHealth && (
                <div className="flex items-center gap-1.5 bg-brand/10 dark:bg-brand/20 text-brand dark:text-brand-light px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider  shadow-sm">
                  <Brain size={12} /> Konversations-Gesundheit wird geprüft...
                </div>
              )}
            </div>
            {/* ── ENTFERNT 14.08.2026: die „Gespraechs-Intensitaet" ──────────
                Fuenf Punkte und ein Wort — „On Fire" / „Warm" / „Kuehl" —
                gespeist aus `intensity`. Der Wert startete bei 50 und wurde
                an GENAU EINER Stelle veraendert:

                    setIntensity(prev => Math.min(100, prev + 10));

                naemlich in der erfundenen Antwort, die mit diesem Commit
                entfaellt. Die Anzeige hat also nie ein Gespraech gemessen.
                Sie hat gemessen, wie oft die App sich selbst geantwortet hat.

                Mit der Erfindung faellt auch die Anzeige. Sie wieder
                aufzubauen — aus Nachrichtenzahl, Antwortzeiten, Laenge —
                waere moeglich, aber `src/screens/Chats.tsx:77` haelt fuer
                genau diesen Fall schon fest:

                  „Sobald es echte Gespraeche gibt, muessen diese Angaben aus
                   den Daten kommen oder verschwinden. Nicht vorher umbauen —
                   ohne echte Gespraeche gaebe es nichts anzuzeigen, und eine
                   leere Liste waere der ehrlichere, aber noch nicht baubare
                   Zustand."

                Also: verschwinden. */}
          </div>
        </div>
        {replySuggestions.length > 0 && (
        <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {replySuggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => { setInput(suggestion); setReplySuggestions([]); }}
              className="whitespace-nowrap px-3 py-1.5 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light text-xs rounded-full border border-brand/20 dark:border-brand-light/20 hover:bg-brand/20 transition-colors"
            >
              {suggestion}
            </button>
          ))}
          <button aria-label="Antwortvorschläge ausblenden" onClick={() => setReplySuggestions([])} className="p-1.5 text-stone-400 hover:text-stone-600 bg-stone-100 dark:bg-stone-800 rounded-full shrink-0">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`p-2 rounded-full transition-colors ${isFocusMode ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
            title={isFocusMode ? "Fokus-Modus beenden" : "Fokus-Modus aktivieren"}
          >
            {/* BEFUND 11.08.2026: Hier standen `EyeOff`/`Eye` — dasselbe
                Symbol, das der Sichtschutz in der Systemleiste benutzt.
                Zwei verschiedene Funktionen mit demselben Bild, beide
                „etwas ausblenden“: Der Fokus-Modus blendet Widgets in
                diesem Gespräch aus, der Sichtschutz verdeckt den ganzen
                Bildschirm. Das musste verwechselt werden — und wurde es.
                `Minimize2` — vier Pfeile nach innen — benennt, was dieser
                Knopf tut: zusammenklappen, weniger anzeigen. `Focus`
                (Kreis mit Eckwinkeln) war zuerst gewaehlt und wurde am
                11.08.2026 nach dem Blick in den Browser verworfen: bei
                20 px neben sechs weiteren Symbolen nicht lesbar. */}
            <Minimize2 size={20} />
          </button>
          <button
            onClick={() => setShowQualityChart(!showQualityChart)}
            className={`p-2 rounded-full transition-colors ${showQualityChart ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
            title="Gesprächsqualität">
            <HeartPulse size={20} />
          </button>
          <button
            onClick={toggleTimer}
            className={`p-2 rounded-full transition-colors ${timerEnabled ? 'bg-brand/10 text-brand dark:bg-brand-light/10 dark:text-brand-light' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
            title={timerEnabled ? "Conversation Timer aktiv" : "Conversation Timer aktivieren"}
          >
            {timerEnabled ? <Bell size={20} /> : <BellOff size={20} />}
          </button>
          <button onClick={() => setShowChecklist(true)} className="p-2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors" title="Date-Prep Checkliste"><ListChecks size={20} /></button>
          {/* ENTFERNT 12.08.2026 auf Ihre Entscheidung: der „Context-Aware
              Coach". Der Knopf loeste bei JEDER neuen Nachricht einen
              KI-Aufruf aus; das Ergebnis landete in einem Zustand, den
              niemand las. Das Symbol pulsierte, der Aufruf kostete,
              angezeigt wurde nichts. `analyzeContext` steht weiter unten
              vollstaendig im Code — wer die Anzeige bauen will, findet
              alles vor. */}
          <button
            onClick={() => setShowProgressWidget(!showProgressWidget)}
            disabled={messages.length < 2}
            className={`p-2 rounded-full transition-colors ${showProgressWidget ? 'bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'} disabled:opacity-50`}
            title="Chat analysieren (mind. 2 Nachrichten benötigt)"
          >
            <Activity size={20} />
          </button>
          <button
            onClick={exportPDF}
            disabled={isExporting}
            className="p-2 bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-brand dark:hover:text-brand-light rounded-full transition-colors disabled:opacity-50"
            title="Chat als PDF sichern"
          >
            <Download size={20} />
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="p-2 bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Nutzer melden"
          >
            <Flag size={20} />
          </button>
          {/* ENTFERNT 12.08.2026 auf Ihre Entscheidung: „Englische Nachricht
              empfangen" und „Red Flag Message simulieren". Beide haengten eine
              ERFUNDENE Nachricht der anderen Person dauerhaft in den
              Gespraechsverlauf — in einer App, deren Versprechen „Echtes
              Dating ohne Spielchen" lautet. Dieselbe Kategorie wie der
              Sentry-Testknopf vom 11.08. Die Red-Flag-Variante startete
              ausserdem einen KI-Aufruf, dessen Ergebnis nirgends erschien. */}

          <button
            onClick={() => {
              setShowLocationSuggestions(!showLocationSuggestions);
              if (!showLocationSuggestions && locationSuggestions.length === 0) {
                getDateLocations();
              }
            }}
            className={`p-2 rounded-full transition-colors ${showLocationSuggestions ? 'bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
            title="Date-Orte finden"
          >
            <MapPin size={20} />
          </button>


          <button
            onClick={() => {
              setShowDatePlan(!showDatePlan);
              if (!showDatePlan && !datePlan) {
                generateDatePlan();
              }
            }}
            className={`p-2 rounded-full transition-colors ${showDatePlan ? 'bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
            title="Konkreten Date-Plan generieren"
          >
            <Sparkles size={20} />
          </button>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="p-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title="Date vorschlagen"
          >
            <CalendarDays size={20} />
          </button>


        </div>
      </header>


      {/* Date Plan Widget */}
      {showDatePlan && (
        <div className="absolute top-[73px] left-0 right-0 bg-stone-50 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 p-4 z-10 shadow-lg animate-in slide-in-from-top-2">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <CalendarDays className="text-brand dark:text-brand-light" size={18} />
              Personalisierter Date-Plan
            </h3>
            <button aria-label="Date-Planung schließen" onClick={() => setShowDatePlan(false)} className="p-1 rounded-full hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500">
              <X size={16} />
            </button>
          </div>

          {isLoadingPlan ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <Sparkles className=" text-brand dark:text-brand-light mb-3" size={24} />
              <p className="text-sm text-stone-500">Generiere perfekten Plan aus dem Chatverlauf...</p>
            </div>
          ) : datePlan ? (
            <div className="bg-white dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-xl p-4">
              {planIstErsatz && (
                <p className="text-[11px] text-amber-700 dark:text-amber-500 mb-2">
                  Die KI ist gerade nicht erreichbar. Dieser Vorschlag ist allgemein und nicht auf euch zugeschnitten.
                </p>
              )}
              <h4 className="font-semibold text-lg text-stone-900 dark:text-stone-100 mb-2">{datePlan.title}</h4>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-stone-50 dark:bg-stone-800 p-3 rounded-lg flex items-start gap-2">
                  <Clock size={16} className="text-stone-400 mt-0.5" />
                  <div>
                    <span className="block text-[10px] text-stone-500 uppercase font-semibold">Wann</span>
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-200">{datePlan.time}</span>
                  </div>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800 p-3 rounded-lg flex items-start gap-2">
                  <MapPin size={16} className="text-stone-400 mt-0.5" />
                  <div>
                    <span className="block text-[10px] text-stone-500 uppercase font-semibold">Wo</span>
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-200">{datePlan.location}</span>
                  </div>
                </div>
              </div>
              <div className="bg-brand/5 dark:bg-brand-light/5 border border-brand/10 dark:border-brand-light/10 p-3 rounded-lg">
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                  {datePlan.plan}
                </p>
              </div>
              <button
                onClick={() => {
                  setInput(`Lass uns ${datePlan.title} machen! Wie wäre es mit ${datePlan.time} am ${datePlan.location}? ${datePlan.plan}`);
                  setShowDatePlan(false);
                }}
                className="w-full mt-4 py-2.5 bg-brand dark:bg-brand-light text-white dark:text-stone-900 font-medium rounded-lg text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Send size={16} />
                Als Nachricht vorschlagen
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Chat Analysis Widget */}
      {showQualityChart && !isFocusMode && (
        <div className="px-4">
          <ChatQualityChart />
        </div>
      )}
      {!isFocusMode && showProgressWidget && (
        <div className="absolute top-[73px] left-0 right-0 bg-stone-50 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 p-4 z-10 shadow-lg max-h-[80vh] overflow-y-auto">
          <RelationshipProgressWidget
            chatHistory={messages}
            userName={klarStorage.getItem("userName") || "Ich"}
            targetName={profile.name}
            onClose={() => setShowProgressWidget(false)}
          />
        </div>
      )}

            {/* Date Picker Drawer */}
      {showDatePicker && (
        <ChatDatePlanner
          userInterests={listeAusSpeicher("userInterests")}
          matchInterests={profile.interests || []}
          // BEFUND 12.08.2026: Hier stand `verbindungName={profile.name}`.
          // `ChatDatePlanner` kennt diese Eigenschaft nicht — sie heisst
          // `matchName`. Der Wert wurde also stillschweigend verworfen, und
          // die Ueberschrift im Planer lautete „Date mit " ohne Namen.
          // Ausserdem baut der Planer damit den Speicherschluessel
          // the legacy chat checklist key — die Vorbereitungs-Checkliste
          // war fuer alle Gespraeche dieselbe.
          matchName={profile.name}
          chatHistory={messages}
          onSelectDate={(proposal, details) => {
            setMessages([...messages, { role: 'user', text: proposal, isRead: false, isDateProposal: true, proposalDetails: details }]);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      <ChatDateExtractorWidget messages={messages} profileName={profile.name} />

      {/* Messages */}

      {showSmartPauseSuggestion && !isFocusMode && (
        <div className="mx-4 mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-indigo-500">
            <Moon size={16} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Spät dran?</h4>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1 mb-2">Du schreibst schon eine Weile. Möchtest du den Smart-Pause-Modus aktivieren, um offline als 'beschäftigt' zu erscheinen und ohne Druck zu antworten?</p>


          <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsFocusMode(true);
                  setShowSmartPauseSuggestion(false);
                }}
                className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600 transition-colors"
              >
                Smart-Pause aktivieren
              </button>
              <button
                onClick={() => setShowSmartPauseSuggestion(false)}
                className="px-3 py-1.5 bg-white dark:bg-stone-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
              >
                Vielleicht später
              </button>
            </div>
          </div>
        </div>
      )}


      {gateZustand !== "offen" ? (
        <div className="flex-1 overflow-y-auto bg-stone-50 dark:bg-black relative px-4 flex flex-col items-center justify-center min-h-[50vh]">
          <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm max-w-md w-full text-center">
            <h2 className="text-2xl font-serif text-stone-900 dark:text-stone-100 mb-2">Icebreaker-Gate</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
              Beide beantworten 2 Fragen. Erst danach öffnet sich der freie Chat.
            </p>

            {gateZustand === "lade" && (
              <div role="status" aria-label="Gesprächsstatus wird geprüft" className="space-y-4">
                <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-1/2 mx-auto"></div>
              </div>
            )}

            {gateFehler && <p role="alert" className="text-warn text-sm mb-4">{gateFehler}</p>}
            {(gateZustand === "fehler" || gateZustand === "wartet_auf_andere") && (
              <button type="button" onClick={refreshGate} className="min-h-11 px-4 py-3 rounded-xl border border-line-ui text-ink">
                Status erneut prüfen
              </button>
            )}

            {gateZustand === "du_bist_dran" && (
              <div>
                <p className="font-medium text-stone-800 dark:text-stone-200 mb-4">
                  {gateDaten?.fragen?.[gateDaten?.meine || 0] || "Was macht dich wirklich glücklich?"}
                </p>
                <label htmlFor="gate-answer" className="block text-sm mb-2">Deine Antwort</label>
                <textarea
                  id="gate-answer"
                  maxLength={1000}
                  disabled={gateSubmitting}
                  value={gateInput}
                  onChange={(e) => setGateInput(e.target.value)}
                  placeholder="Deine Antwort..."
                  className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-4 text-sm mb-4 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <button
                  onClick={onGateSubmit}
                  disabled={!gateInput.trim() || gateSubmitting}
                  className="w-full bg-brand text-white font-medium rounded-full py-3 disabled:opacity-50 transition-colors hover:bg-brand-light"
                >
                  {gateSubmitting ? "Senden..." : "Antworten"}
                </button>
              </div>
            )}

            {gateZustand === "wartet_auf_andere" && (
              <div className="py-8">
                <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 ">
                  <span className="text-2xl">⏳</span>
                </div>
                <h3 className="font-medium text-stone-800 dark:text-stone-200">Wartet auf Antwort</h3>
                <p className="text-sm text-stone-500 mt-2">Du hast deine Fragen beantwortet. Sobald die andere Person nachzieht, öffnet sich der Chat.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className={`klar-chat-scroll flex-1 overflow-y-auto px-3 py-5 sm:px-5 sm:py-6 space-y-1 relative transition-colors duration-500 ${isFocusMode ? 'bg-indigo-900/5 dark:bg-indigo-400/5' : ''}`}>

        {isFocusMode && (
          <div className="chat-focus-overlay absolute inset-0 pointer-events-none z-0 bg-indigo-500/5 dark:bg-indigo-400/10  mix-blend-multiply dark:mix-blend-screen transition-all duration-1000 -[1px]"></div>
        )}
        <div className="flex flex-col items-center justify-center p-8 text-center text-stone-500 mb-8">
          <img src={profile.photoUrl} alt="" className="w-24 h-24 rounded-full object-cover mb-4 shadow-sm border-2 border-white dark:border-stone-700" />
          <h3 className="font-serif text-xl text-stone-900 dark:text-stone-100 mb-2">Du hast eine Verbindung mit {profile.name}!</h3>
          <p className="text-sm mb-4">Schreib die erste Nachricht.</p>

          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-500/10 px-3 py-1.5 rounded-full">
                <Clock size={14} />
                <span>Verbindung verfällt in 72 Stunden ohne Nachricht</span>
              </div>
              <button
                onClick={handleSmartIntro}
                disabled={isGeneratingSmartIntro}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-full font-medium text-sm transition-opacity hover:opacity-90 shadow-sm disabled:opacity-50"
              >
                {isGeneratingSmartIntro ? (
                  <>
                    <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                    Generiere Intro...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Smart Intro
                  </>
                )}
              </button>

              {/* Der Hinweis steht direkt unter dem Knopf, der ihn ausgeloest
                  hat — und NICHT im Eingabefeld. Bis zum 14.08.2026 schrieb
                  der Fehlerfall einen erfundenen Satz dorthin, wo gleich
                  „Senden" gedrueckt wird. */}
              {introFehler && (
                <p role="note" className="mt-3 text-xs text-stone-600 dark:text-stone-300 max-w-[260px]">
                  {introFehler}
                </p>
              )}
            </div>
          )}

          {messages.length === 0 && (
            <div className="mt-8 text-left w-full">
              <RecentIntrosWidget onSelect={setInput} />
            </div>
          )}
        </div>



      <AnimatePresence>
        {translationToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-brand text-white px-4 py-2 rounded-full shadow-lg text-xs font-medium flex items-center gap-2">
            <Languages size={14} /> Nachricht wurde automatisch übersetzt.
          </motion.div>
        )}
      </AnimatePresence>

        {/* DSGVO & KI Hinweis */}
        <div className="flex justify-center mb-6 mt-4">
          <div className="bg-stone-100/50 dark:bg-stone-800/50 rounded-xl px-4 py-2.5 max-w-sm text-center border border-stone-200/50 dark:border-stone-700/50">
            <div className="flex items-center justify-center gap-1.5 text-stone-500 mb-1">
              <Languages size={12} />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Live-Übersetzung aktiv</span>
            </div>
            <p className="text-[11px] text-stone-500 leading-tight">
              Eingehende Nachrichten können zur maschinellen Übersetzung über europäische Server von Google (Gemini) verarbeitet werden. Es erfolgt kein Modell-Training. Mehr dazu in der <a href="#" className="underline hover:text-stone-700 dark:hover:text-stone-300">Datenschutzerklärung</a>.
            </p>
          </div>
        </div>

        {messages.map((msg, idx) => (
          <div key={idx} className={`relative z-10 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.isDateProposal && msg.proposalDetails ? (
              <DateProposalMessage
                msg={{
                  role: msg.role,
                  proposalDetails: {
                    title: typeof msg.proposalDetails?.title === 'string' ? msg.proposalDetails.title : '',
                    description: typeof msg.proposalDetails?.description === 'string' ? msg.proposalDetails.description : '',
                    time: typeof msg.proposalDetails?.time === 'string' ? msg.proposalDetails.time : '',
                  },
                  isRead: msg.isRead,
                }}
                profileName={profile?.name || ''}
              />
            ) : (
                            <MessageBubble msg={msg} />
            )}
          </div>
        ))}
      </div>

      {/* Konversations-Tuning Panel */}
      {!isFocusMode && showTuning && (
        <div className="p-4 bg-stone-50 dark:bg-stone-800 border-t border-stone-200 dark:border-stone-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <Sparkles size={16} className="text-brand dark:text-brand-light" />
              Konversations-Tuning
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={getConversationTuning} disabled={isLoadingAI} className="text-xs px-3 py-1 bg-stone-200 dark:bg-stone-800 rounded-full font-medium hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors">
                {isLoadingAI ? "Analysiere..." : "Neu generieren"}
              </button>
              <button aria-label="Feinschliff schließen" onClick={() => setShowTuning(false)} className="text-xs p-1 bg-stone-200 dark:bg-stone-800 rounded-full font-medium hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {tuningSuggestions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {tuningSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(suggestion.text);
                    setShowTuning(false);
                  }}
                  className="text-left flex flex-col gap-1 p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-brand dark:text-brand-light tracking-wide bg-brand/10 dark:bg-brand-light/10 px-2 py-0.5 rounded-md">
                      {suggestion.style}
                    </span>
                  </div>
                  <span className="text-sm text-stone-800 dark:text-stone-200">"{suggestion.text}"</span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">{suggestion.explanation}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              {isLoadingAI ? (
                <span className="text-sm text-stone-500 ">Ermittle beste Antwortmöglichkeiten...</span>
              ) : (
                <button
                  onClick={getConversationTuning}
                  className="px-4 py-2 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-full text-sm font-medium"
                >
                  Authentische Antworten generieren
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Suggestions Box */}
      {(messages.length === 0 || showIcebreakers) && (
        <div className="p-4 bg-white dark:bg-stone-800 border-t border-stone-100 dark:border-stone-700 flex flex-col gap-3">
          <div className="flex border-b border-stone-200 dark:border-stone-700">
            <button
              onClick={() => setActiveTab('icebreakers')}
              className={`flex-1 pb-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'icebreakers'
                  ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light'
                  : 'border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5"><Sparkles size={16} /> KI-Icebreaker</span>
            </button>
            <button
              onClick={() => setActiveTab('savedIntros')}
              className={`flex-1 pb-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'savedIntros'
                  ? 'border-brand text-brand dark:border-brand-light dark:text-brand-light'
                  : 'border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5"><Bookmark size={16} /> Gespeichert</span>
            </button>
          </div>

          {activeTab === 'icebreakers' && (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-stone-500">Vorschläge</span>
                <div className="flex gap-2">
                  {icebreakerHistory.length > 0 && (
                    <button onClick={() => setShowHistory(!showHistory)} className="text-xs px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-full font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center gap-1">
                      <History size={14} />
                      {showHistory ? "Schließen" : "Historie"}
                    </button>
                  )}
                  <button onClick={getIcebreakers} disabled={isLoadingAI} className="text-xs px-3 py-1 bg-stone-100 dark:bg-stone-800 rounded-full font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">
                    {isLoadingAI ? "Denke nach..." : "Neu generieren"}
                  </button>
                  {messages.length > 0 && (
                    <button aria-label="Gesprächsanfänge schließen" onClick={() => setShowIcebreakers(false)} className="text-xs p-1 bg-stone-100 dark:bg-stone-800 rounded-full font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {showHistory ? (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {icebreakerHistory.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInput(suggestion);
                        setShowHistory(false);
                        setShowIcebreakers(false);
                      }}
                      className="text-left text-sm p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : (
                vorschlagFehler ? (
                  /* Ein Hinweis, kein Knopf: Diese Zeile laesst sich nicht
                     antippen und damit nicht versehentlich abschicken. */
                  <div
                    role="note"
                    className="py-6 px-4 text-center text-sm text-stone-600 dark:text-stone-300"
                  >
                    <p className="mb-3">{vorschlagFehler}</p>
                    <button
                      onClick={() => { setVorschlagFehler(null); getIcebreakers(); }}
                      className="px-4 py-2 rounded-full border border-stone-300 dark:border-stone-600 text-sm min-h-[44px]"
                    >
                      Erneut versuchen
                    </button>
                  </div>
                ) : aiSuggestions.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {aiSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInput(suggestion);
                          setShowIcebreakers(false);
                        }}
                        className="text-left text-sm p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-brand/10 dark:bg-brand-light/10 rounded-full flex items-center justify-center mb-3">
                      <Sparkles size={24} className="text-brand dark:text-brand-light" />
                    </div>
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
                      Perfekter Einstieg gesucht?
                    </h4>
                    <p className="text-xs text-stone-500 max-w-[250px] mb-4">
                      {profile.interests.filter((i: string) => userInterests.includes(i)).length > 0
                        ? `Lass dir basierend auf euren gemeinsamen Interessen (${profile.interests.filter((i: string) => userInterests.includes(i)).join(', ')}) einen Icebreaker generieren.`
                        : "Lass dir basierend auf den Interessen deines Verbindungen einen personalisierten Icebreaker generieren."}
                    </p>
                    <button
                      onClick={getIcebreakers}
                      disabled={isLoadingAI}
                      className="px-5 py-2.5 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-full font-medium text-sm transition-colors hover:bg-brand/90 dark:hover:bg-brand-light/90 disabled:opacity-50"
                    >
                      {isLoadingAI ? "Generiere..." : "Icebreaker generieren"}
                    </button>
                  </div>
                )
              )}
            </>
          )}

          {activeTab === 'savedIntros' && (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {savedSmartIntros.length === 0 ? (
                <p className="text-sm text-center text-stone-500 py-4">Keine gespeicherten Intros. Nutze den "Smart Intro" Button oben!</p>
              ) : (
                savedSmartIntros.map((intro, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(intro);
                      setShowIcebreakers(false);
                    }}
                    className="text-left text-sm p-3 rounded-xl border border-brand/20 dark:border-brand-light/20 bg-brand/5 dark:bg-brand-light/5 hover:bg-brand/10 dark:hover:bg-brand-light/10 transition-colors"
                  >
                    {intro}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      {/* BEFUND 10.08.2026: relative fehlte hier. Der Schnellantworten-Auszug
          ist absolute bottom-full left-0 right-0 und suchte sich deshalb
          einen Vorfahren weiter oben -- er erschien mitten im
          Gespraechsverlauf und legte sich ueber "Du hast eine Verbindung mit
          ...". Mit relative an der Eingabeleiste sitzt er dort, wo er
          hingehoert: unmittelbar darueber. */}
      <div className="relative px-3 py-3 sm:px-4 sm:py-4 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-700">
        {/* ── BEFUND 14.08.2026 ────────────────────────────────────────
            Die vier Profile stammen aus src/data.ts und sind erfunden
            (FUN-01). Frueher verdeckte eine fest verdrahtete Antwort das —
            es sah aus, als schriebe jemand zurueck.

            Statt der Erfindung steht hier jetzt, was zutrifft. Der Hinweis
            verschwindet von selbst, sobald ein Gespraech nicht mehr auf ein
            Beispielprofil zeigt. */}
        {istBeispielGespraech && (
          <p className="mb-2 text-xs text-stone-500 dark:text-stone-400">
            Dieses Profil ist ein Beispiel — hier antwortet niemand. Echte
            Verbindungen gibt es, sobald andere Menschen dabei sind.
          </p>
        )}
        {/* Rueckmeldung zur Spracheingabe. `role="status"` statt `alert`:
            Es ist eine Auskunft, keine Warnung — sie soll vorgelesen werden,
            ohne die Person aus dem zu reissen, was sie gerade tut. */}
        {sprachHinweis && (
          <div role="status" className="mb-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-500">
            <span className="flex-1">{sprachHinweis}</span>
            <button
              type="button"
              onClick={() => setSprachHinweis('')}
              aria-label="Hinweis zur Spracheingabe schließen"
              className="shrink-0 px-1 text-amber-700/70 hover:text-amber-800 dark:text-amber-500/70 dark:hover:text-amber-400"
            >
              ×
            </button>
          </div>
        )}
        {/* QuickReplies drawer positioned absolutely above input area */}
        <QuickRepliesDrawer
          isOpen={showQuickReplies}
          onClose={() => setShowQuickReplies(false)}
          onSelectReply={(r) => {
            setInput(r);
            setTimeout(() => {
              adjustTextareaHeight();
              textareaRef.current?.focus();
            }, 50);
          }}
        />

        {/* Accessory action row for AI tuning, reply suggestions, and active translation controls */}
        {(messages.length > 0 || isLiveTranslationEnabled) && (
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar py-0.5 w-full">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!showTuning && tuningSuggestions.length === 0) {
                    getConversationTuning();
                  }
                  setShowTuning(!showTuning);
                  setShowIcebreakers(false);
                }}
                aria-pressed={showTuning}
                aria-label="Konversations-Tuning ein- oder ausschalten"
                title="Konversations-Tuning"
                className={`shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  showTuning
                    ? "bg-brand/15 text-brand dark:text-brand-light dark:bg-brand-light/15 ring-1 ring-brand/30"
                    : "bg-stone-100 dark:bg-stone-700/60 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
                }`}
              >
                <Sparkles size={13} aria-hidden="true" />
                <span>Konversations-Tuning</span>
              </button>
            )}

            {messages.length > 0 && (
              <button
                type="button"
                onClick={getReplySuggestions}
                disabled={isGeneratingReplies}
                aria-label="KI-Antwortvorschläge generieren"
                title="KI-Antwortvorschläge"
                className="shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-700/60 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-brand dark:hover:text-brand-light transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Sparkles size={13} className={isGeneratingReplies ? "animate-spin text-brand" : ""} aria-hidden="true" />
                <span>Antwortvorschläge</span>
              </button>
            )}

            {isLiveTranslationEnabled && (
              <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 text-xs">
                <Languages size={13} className="shrink-0 text-blue-500" aria-hidden="true" />
                <label htmlFor="chat-zielsprache" className="text-[11px] font-medium shrink-0 cursor-pointer">
                  Übersetzen in:
                </label>
                <select
                  id="chat-zielsprache"
                  name="zielsprache"
                  value={sprachCode}
                  onChange={(e) => {
                    setSprachCode(e.target.value);
                    setzeZielsprache(e.target.value);
                  }}
                  aria-label="Zielsprache für Live-Übersetzung"
                  title="Sprache, in die übersetzt wird"
                  className="bg-transparent text-xs font-semibold text-blue-800 dark:text-blue-200 focus:outline-none cursor-pointer pr-1"
                >
                  {SPRACHEN.map((s) => (
                    <option key={s.code} value={s.code} className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Primary chat input bar: flex-row, items-center, gap-2 */}
        <div className="flex flex-row items-center gap-1.5 sm:gap-2 w-full min-w-0">
          {/* Action icon buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsLiveTranslationEnabled(!isLiveTranslationEnabled)}
              aria-pressed={isLiveTranslationEnabled}
              aria-label={isLiveTranslationEnabled ? "Live-Übersetzung ausschalten" : "Live-Übersetzung aktivieren"}
              title={isLiveTranslationEnabled ? "Übersetzung ausschalten" : "Eingehende Nachrichten übersetzen"}
              className={`p-2 sm:p-2.5 rounded-full transition-colors min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center ${
                isLiveTranslationEnabled
                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                  : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700/60"
              }`}
            >
              <Languages size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setShowQuickReplies(!showQuickReplies)}
              aria-expanded={showQuickReplies}
              aria-label="Schnellantworten öffnen"
              title="Schnellantworten"
              className={`p-2 sm:p-2.5 rounded-full transition-colors min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center ${
                showQuickReplies
                  ? "bg-brand/10 text-brand dark:text-brand-light"
                  : "bg-stone-100 dark:bg-stone-700/60 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
              }`}
            >
              <MessageSquare size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              disabled
              onClick={isRecording ? stopRecording : startRecording}
              aria-label="Sprachnachrichten derzeit nicht verfügbar"
              title="Sprachnachrichten sind noch nicht verfügbar. Bitte eine Textnachricht senden."
              className={`p-2 sm:p-2.5 rounded-full transition-colors min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center ${
                isRecording
                  ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 animate-pulse"
                  : "bg-stone-100 dark:bg-stone-700/60 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
              }`}
            >
              <Mic size={18} aria-hidden="true" />
            </button>
          </div>

          {sendError && <p id="chat-send-error" role="alert" className="text-warn text-sm">{sendError}</p>}
          {/* Dynamic textarea: flex-1, min-w-0, auto-wrapping, resize-none, max-h-32 */}
          <div className="flex-1 min-w-0 relative">
            <textarea
              id="chat-input"
              name="chat-input"
              maxLength={4000}
              disabled={isSending}
              aria-describedby={sendError ? "chat-send-error" : undefined}
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Schreibe eine Nachricht..."
              aria-label="Nachricht eingeben"
              className="klar-input w-full px-4 py-3 text-base resize-none break-words max-h-36 overflow-y-auto leading-[1.55] focus:outline-none transition-all"
            />
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || isSending}
            aria-label="Nachricht senden"
            title="Nachricht senden"
            className="p-2.5 sm:p-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-full disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <Send size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

    {empathyAnalysis && empathyAnalysis.status === 'checking' && (
      <div className="fixed bottom-24 left-4 right-4 z-50 p-2 bg-stone-100 dark:bg-stone-800 rounded-lg flex items-center justify-center gap-2 text-xs text-stone-600 dark:text-stone-400  shadow-md border border-stone-200 dark:border-stone-700">
        <Brain size={14} /> Empathie-Check läuft...
      </div>
    )}
    {empathyAnalysis && empathyAnalysis.status === 'warning' && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40  px-4">
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm max-w-sm w-full animate-in fade-in zoom-in-95">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center justify-center mb-4 mx-auto">
            <AlertTriangle size={24} />
          </div>
          <h3 className="font-serif text-xl text-stone-900 dark:text-stone-100 text-center mb-2">Tonalitäts-Hinweis</h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 text-center mb-4 leading-relaxed">
            {empathyAnalysis.message}
          </p>

          {empathyAnalysis.suggestion && (
            <div className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-4 mb-6 border border-stone-100 dark:border-stone-700">
              <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider mb-2 block">Möglicher Vorschlag</span>
              <p className="text-sm font-medium text-stone-800 dark:text-stone-200 italic">"{empathyAnalysis.suggestion}"</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setEmpathyAnalysis(null);
                handleSend(true);
              }}
              className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-sm"
            >
              Trotzdem senden
            </button>
            {empathyAnalysis.suggestion && (
              <button
                onClick={() => {
                  setInput(empathyAnalysis.suggestion ?? "");
                  setEmpathyAnalysis(null);
                }}
                className="flex-1 py-3 bg-brand dark:bg-brand-light text-white rounded-full font-medium hover:opacity-90 transition-opacity text-sm"
              >
                Übernehmen
              </button>
            )}
          </div>

          <button
            onClick={() => setEmpathyAnalysis(null)}
            className="w-full mt-3 py-3 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors text-sm font-medium"
          >
            Abbrechen & Überarbeiten
          </button>
        </div>
      </div>
    )}

    {/* Report User Modal */}
    {showReportModal && (
      <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 w-full max-w-sm relative shadow-md">
          <button aria-label="Meldung schließen"
            onClick={() => {
              setShowReportModal(false);
              setReportSubmitted(false);
              setReportReason("");
            }}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            <X size={20} />
          </button>

          {reportSubmitted ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCheck size={32} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-stone-900 dark:text-stone-100 mb-2">Meldung eingegangen</h3>
              {/* P0-5: Diese Bestaetigung erscheint erst, wenn der Server die
                  Meldung gespeichert hat — und nennt das Aktenzeichen. Eine
                  Eingangsbestaetigung ohne Bezug ist wertlos (DSA Art. 16). */}
              <p className="text-sm text-stone-500 mb-2">Wir prüfen sie und teilen dir die Entscheidung mit Begründung mit.</p>
              <p className="text-sm text-stone-700 dark:text-stone-300 mb-6">
                Aktenzeichen: <span className="font-mono">{reportCaseId}</span>
              </p>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportSubmitted(false);
                }}
                className="w-full py-3 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-medium transition-colors hover:bg-stone-200 dark:hover:bg-stone-700"
              >
                Schließen
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/50 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100">Nutzer melden</h3>
                  <p className="text-xs text-stone-500">Warum möchtest du {profile?.name} melden?</p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {/* BEFUND 10.08.2026: Hier standen nur die deutschen
                    Beschriftungen, und genau die wurden als grund an den
                    Server geschickt. Der prueft gegen die Schluessel in
                    trustAndSafety.ts und lehnte deshalb JEDE Meldung mit
                    "Unbekannter Meldegrund." und 400 ab. Die Meldefunktion
                    war damit vollstaendig wirkungslos -- DSA Art. 16, und
                    derselbe Befund wie P0-5, nur an anderer Stelle.

                    ZWEITER BEFUND, schwerer: minderjaehrig nimmt der Server
                    entgegen, die Oberflaeche bot ihn nicht an. In einer
                    Dating-App ist das der Meldegrund, der am wenigsten
                    fehlen darf. Er steht jetzt an erster Stelle.

                    Schluessel und Beschriftung sind ab jetzt getrennt. Eine
                    Umformulierung im Text kann die Meldung nicht mehr
                    unbrauchbar machen. */}
                {[
                  { schluessel: 'minderjaehrig', text: 'Die Person ist minderjährig' },
                  { schluessel: 'belaestigung', text: 'Belästigung' },
                  { schluessel: 'unangemessenes_verhalten', text: 'Unangemessenes Verhalten' },
                  { schluessel: 'fakeprofil_spam', text: 'Fakeprofil / Spam' },
                  { schluessel: 'sonstiges', text: 'Sonstiges' },
                ].map(({ schluessel, text }) => (
                  <label key={schluessel} className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-700 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                    <input
                      type="radio"
                      name="reportReason"
                      value={schluessel}
                      checked={reportReason === schluessel}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="text-brand dark:text-brand-light focus:ring-brand dark:focus:ring-brand-light"
                    />
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{text}</span>
                  </label>
                ))}
              </div>

              {reportError ? (
                <p role="alert" className="mb-4 text-sm text-rose-700 dark:text-rose-300">
                  {reportError}
                </p>
              ) : null}

              <button
                disabled={!reportReason || reportSending}
                onClick={async () => {
                  // P0-5: Vorher setzte dieser Knopf ausschliesslich
                  // setReportSubmitted(true). Es gab keinen Schreibvorgang
                  // und keinen Serveraufruf — die Meldung existierte
                  // nirgends, die Bestaetigung war unzutreffend.
                  setReportError(null);
                  setReportSending(true);
                  try {
                    const res = await fetch("/api/report", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ targetUid: id, grund: reportReason, chatId: id }),
                    });
                    const roh: unknown = await res.json().catch(() => ({}));
                    const daten = (roh !== null && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
                    if (!res.ok) {
                      throw new Error(
                        typeof daten["error"] === "string" ? daten["error"] : `Server-Antwort ${res.status}`,
                      );
}

                    setReportCaseId(typeof daten["aktenzeichen"] === "string" ? daten["aktenzeichen"] : "—");
                    setReportSubmitted(true);
                  } catch (e) {
                    setReportError(e instanceof Error ? e.message : "Die Meldung konnte nicht übermittelt werden.");
                  } finally {
                    setReportSending(false);
                  }
                }}
                className="w-full py-3 bg-rose-600 text-white rounded-xl font-medium transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                {reportSending ? "Wird übermittelt …" : "Melden"}
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    {showSentimentCheck && (
      <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 w-full max-w-sm text-center shadow-md">
          <div className="w-16 h-16 mx-auto bg-brand/10 dark:bg-brand-light/10 rounded-full flex items-center justify-center mb-4">
            <Sparkles size={28} className="text-brand dark:text-brand-light" />
          </div>
          <h2 className="text-2xl font-serif font-medium text-stone-900 dark:text-stone-100 mb-2">Wie lief's?</h2>
          <p className="text-sm text-stone-500 mb-8">Dein Feedback hilft der KI, bessere Empfehlungen für dich zu finden.</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                merkeStimmung(id, 'positive');
                setShowSentimentCheck(false);

                setTimeout(() => {
                  NotificationService.triggerProactiveImpulse();
                }, 2000);

                navigate("/chats");
              }}
              className="w-full p-3 bg-stone-50 hover:bg-emerald-50 dark:bg-stone-800 dark:hover:bg-emerald-900/30 border border-stone-200 dark:border-stone-700 hover:border-emerald-200 dark:hover:border-emerald-800 rounded-xl transition-colors text-left flex items-center gap-3"
            >
              <span className="text-2xl">🔥</span>
              <span className="font-medium text-stone-700 dark:text-stone-300">Richtig gut!</span>
            </button>
            <button
              onClick={() => {
                merkeStimmung(id, 'neutral');
                  setShowSentimentCheck(false);

                  // Trigger proactive coach impulse shortly after sentiment check
                  setTimeout(() => {
                    NotificationService.triggerProactiveImpulse();
                  }, 2000);

                  navigate("/chats");

                }}
                className="w-full p-3 bg-stone-50 hover:bg-blue-50 dark:bg-stone-800 dark:hover:bg-blue-900/30 border border-stone-200 dark:border-stone-700 hover:border-blue-200 dark:hover:border-blue-800 rounded-xl transition-colors text-left flex items-center gap-3"
              >
                <span className="text-2xl">🤔</span>
                <span className="font-medium text-stone-700 dark:text-stone-300">War okay, bin noch unsicher</span>
              </button>
              <button
                onClick={() => {


                  merkeStimmung(id, 'negative');
                  setShowSentimentCheck(false);

                  // Trigger proactive coach impulse shortly after sentiment check
                  setTimeout(() => {
                    NotificationService.triggerProactiveImpulse();
                  }, 2000);

                  navigate("/chats");

                }}
                className="w-full p-3 bg-stone-50 hover:bg-rose-50 dark:bg-stone-800 dark:hover:bg-rose-900/30 border border-stone-200 dark:border-stone-700 hover:border-rose-200 dark:hover:border-rose-800 rounded-xl transition-colors text-left flex items-center gap-3"
              >
                <span className="text-2xl">😬</span>
                <span className="font-medium text-stone-700 dark:text-stone-300">Eher zäh, wenig Vibe</span>
              </button>
            </div>
            <button
              onClick={() => {
                setShowSentimentCheck(false);
                navigate("/chats");
              }}
              className="mt-6 text-sm font-medium text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              Überspringen
            </button>
          </div>
        </div>
      )}

            </>
      )}
      <DatePrepChecklistModal
        profile={profile}
        isOpen={showChecklist}
        onClose={() => setShowChecklist(false)}
        userInterests={userInterests}
      />
    </div>
  );
}
