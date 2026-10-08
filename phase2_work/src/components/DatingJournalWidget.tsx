import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Sparkles,
  Send,
  ChevronDown,
  ChevronUp,
  Download,
  Mic,
  Square,
} from 'lucide-react';
import { hapticFeedback } from '../lib/haptics';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { melde } from '../lib/fehler';

// ═══════════════════════════════════════════════════════════════════════════
// `// @ts-nocheck` ENTFERNT am 12.08.2026. Fünf Funde, zwei davon echte
// Fehler im Ablauf:
//
// ── 1. EIN ZUHÖRER FÜR EIN EREIGNIS, DAS NIEMAND AUSLÖST ──────────────────
// Hier hing ein `window.addEventListener('klar-request-value-proof', …)`,
// der Sätze der Form „Erlebnis passend zu … gefunden" in `proofValues`
// sammelte. Zwei Befunde dazu:
//   · Kein einziger Ort in `src/` löst dieses Ereignis aus.
//   · `proofValues` wurde nirgends angezeigt.
// Die Mechanik war also an beiden Enden tot. Ersatzlos entfernt. Wenn der
// Werte-Nachweis gebaut werden soll, gehört er neu und ganz gebaut.
//
// ── 2. DIE FEHLERBEHANDLUNG BEIM DIKTAT LIEF INS LEERE ────────────────────
// `processAudio` setzte `reader.onloadend = async () => { … }` und hatte
// `try/catch/finally` darum. Der Rückruf läuft aber SPÄTER. Folge:
//   · `finally { setIsProcessingAudio(false) }` lief sofort — die Anzeige
//     „wird verarbeitet" verschwand, bevor irgendetwas verarbeitet war.
//   · Ein Fehler im Rückruf wurde von diesem `catch` NIE gefangen.
// Jetzt wartet die Funktion auf das Auslesen (Promise um den FileReader).
//
// ── 3. FEHLERANTWORTEN WURDEN ALS ERGEBNIS BEHANDELT ──────────────────────
// `/api/journal-audio-dump` antwortet im Fehlerfall mit Status 500 und
// `{ error: … }`. Der Statuscode wurde nicht angesehen. Bei
// `/api/dating-journal` war die Prüfung vorhanden — an einer von zwei
// Stellen. Jetzt an beiden.
//
// ── 4. `data.mood` WURDE UNGEPRÜFT ÜBERNOMMEN ─────────────────────────────
// `moodHistory` ist auf „positive | neutral | negative" typisiert, bekam
// aber, was immer der Server schickte. Ein abweichender Wert hätte einen
// farblosen Balken ohne Höhe ergeben. Jetzt wird geprüft.
//
// ── 5. `audioChunks` ──────────────────────────────────────────────────────
// Gesetzt, nie gelesen. Die Aufnahmestücke liegen ohnehin lokal in
// `startRecording`. Entfernt.
// ═══════════════════════════════════════════════════════════════════════════

interface DatingJournalWidgetProps {
  userInterests: string[];
}

type Stimmung = 'positive' | 'neutral' | 'negative';

const STIMMUNGEN: readonly Stimmung[] = ['positive', 'neutral', 'negative'];

function istStimmung(wert: unknown): wert is Stimmung {
  return typeof wert === 'string' && (STIMMUNGEN as readonly string[]).includes(wert);
}

interface Auswertung {
  insights: string[];
  tips: string[];
  summary: string;
  mood?: Stimmung;
}

function nurZeichenketten(roh: unknown): string[] {
  return Array.isArray(roh) ? roh.filter((w): w is string => typeof w === 'string') : [];
}

/**
 * Aus einer unbekannten Antwort eine Auswertung machen — oder `null`.
 *
 * `summary` ist die Pflichtangabe: Sie steht als Zitat ganz oben. Ohne sie
 * gibt es nichts anzuzeigen.
 */
function leseAuswertung(roh: unknown): Auswertung | null {
  if (roh === null || typeof roh !== 'object') return null;
  const d = roh as Record<string, unknown>;
  const summary = d['summary'];
  if (typeof summary !== 'string' || summary.trim() === '') return null;
  const auswertung: Auswertung = {
    summary,
    insights: nurZeichenketten(d['insights']),
    tips: nurZeichenketten(d['tips']),
  };
  const mood = d['mood'];
  if (istStimmung(mood)) auswertung.mood = mood;
  return auswertung;
}

/** Zeichenketten-Liste aus dem lokalen Speicher, ohne Vertrauen in den Inhalt. */
function listeAusSpeicher(schluessel: string): string[] {
  try {
    return nurZeichenketten(JSON.parse(klarStorage.getItem(schluessel) ?? '[]') as unknown);
  } catch {
    return [];
  }
}

/** Eine Datei als Data-URL lesen — als Promise, damit `await` möglich ist. */
function alsDataUrl(blob: Blob): Promise<string> {
  return new Promise((erfuellen, ablehnen) => {
    const reader = new FileReader();
    reader.onerror = () => ablehnen(new Error('Aufnahme nicht lesbar'));
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        erfuellen(reader.result);
      } else {
        ablehnen(new Error('Aufnahme nicht lesbar'));
      }
    };
    reader.readAsDataURL(blob);
  });
}

/** Höchstzahl gespeicherter Stimmungen. War als `.slice(-7)` versteckt. */
const STIMMUNGS_VERLAUF_LAENGE = 7;

export function DatingJournalWidget({ userInterests }: DatingJournalWidgetProps) {
  const [entry, setEntry] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Auswertung | null>(null);
  const [moodHistory, setMoodHistory] = useState<Stimmung[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
    };
  }, [mediaRecorder]);

  useEffect(() => {
    const savedHistory = klarStorage.getItem('klar_journal_mood_history');
    if (savedHistory) {
      try {
        const roh: unknown = JSON.parse(savedHistory);
        setMoodHistory(Array.isArray(roh) ? roh.filter(istStimmung) : []);
      } catch (e) {
        // Vorher ein leeres `catch {}`. Ein Fehler, den niemand sieht,
        // wiederholt sich, bis ihn jemand zufaellig bemerkt.
        melde('DatingJournalWidget/verlauf', e);
      }
    }
    const savedAnalysis = klarStorage.getItem('klar_latest_journal_analysis');
    if (savedAnalysis) {
      try {
        setAnalysis(leseAuswertung(JSON.parse(savedAnalysis) as unknown));
      } catch (e) {
        melde('DatingJournalWidget', e);
      }
    }
  }, []);

  const merkeStimmung = (stimmung: Stimmung) => {
    setMoodHistory((bisher) => {
      const neu = [...bisher, stimmung].slice(-STIMMUNGS_VERLAUF_LAENGE);
      klarStorage.setItem('klar_journal_mood_history', JSON.stringify(neu));
      return neu;
    });
  };

  const exportPDF = () => {
    if (!analysis) return;

    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(244, 63, 94);
    doc.text('Klar Dating-Journal Report', 20, 20);

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(new Date().toLocaleDateString('de-DE'), 20, 28);

    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'italic');
    const splitSummary = doc.splitTextToSize('"' + analysis.summary + '"', 170);
    doc.text(splitSummary, 20, 40);

    let yPos = 40 + splitSummary.length * 6 + 10;

    doc.setFont('helvetica', 'normal');

    if (analysis.insights.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Erkenntnisse', 20, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      for (const insight of analysis.insights) {
        const splitText = doc.splitTextToSize('• ' + insight, 170);
        doc.text(splitText, 20, yPos);
        yPos += splitText.length * 6;
      }
      yPos += 10;
    }

    if (analysis.tips.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Tipps für die Zukunft', 20, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      for (const tip of analysis.tips) {
        const splitText = doc.splitTextToSize('→ ' + tip, 170);
        doc.text(splitText, 20, yPos);
        yPos += splitText.length * 6;
      }
    }

    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text('Datenschutz-Audit-Bericht', 20, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Dieser Bericht zeigt, welche Datenpunkte Klar für die Verbindungsfindung verwendet.', 20, 30);

    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text('1. Kernwerte (Values):', 20, 45);
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    const werte = listeAusSpeicher('klar_user_values');
    doc.text(werte.length > 0 ? werte.join(', ') : 'Keine definiert', 20, 55);

    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text('2. No-Gos:', 20, 70);
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    const nogos = listeAusSpeicher('userNoGos');
    doc.text(nogos.length > 0 ? nogos.join(', ') : 'Keine definiert', 20, 80);

    doc.save('Klar-Dating-Journal.pdf');
  };

  const processAudio = async (blob: Blob, mimeType: string) => {
    if (blob.size > 600 * 1024) {
      melde('DatingJournalWidget/audio', new Error('Audioaufnahme ist zu groß. Maximal 30 Sekunden verwenden.'));
      return;
    }
    setIsProcessingAudio(true);
    try {
      // Vorher lief alles ab hier in `reader.onloadend` — also NACH dem
      // `finally` darunter. Jetzt wird gewartet.
      const dataUrl = await alsDataUrl(blob);
      const base64data = dataUrl.split(',')[1];
      if (!base64data) throw new Error('Aufnahme ohne Inhalt');

      const res = await fetch('/api/journal-audio-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64data, mimeType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      const daten = (text ? JSON.parse(text) : {}) as Record<string, unknown>;

      const transcript = daten['transcript'];
      if (typeof transcript === 'string' && transcript.trim() !== '') {
        setEntry((prev) => (prev ? prev + '\n' + transcript : transcript));
        const mood = daten['mood'];
        if (istStimmung(mood)) {
          hapticFeedback([50, 100, 150]);
          merkeStimmung(mood);
        }
      }
    } catch (e) {
      melde('DatingJournalWidget/audio', e);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }
        const audioBlob = new Blob(chunks, { type: recorder.mimeType });
        void processAudio(audioBlob, recorder.mimeType);
        stream.getTracks().forEach((t) => t.stop());
      };
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      recordingTimeoutRef.current = setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
        setIsRecording(false);
      }, 30_000);
      hapticFeedback([50]);
    } catch (e) {
      melde('DatingJournalWidget', e);
      alert('Mikrofon-Zugriff nicht möglich.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      setIsRecording(false);
      hapticFeedback([50, 50]);
    }
  };

  const handleAnalyze = async () => {
    if (!entry.trim()) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/dating-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journalEntry: entry, userInterests }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      const auswertung = leseAuswertung(text ? (JSON.parse(text) as unknown) : null);
      if (!auswertung) throw new Error('Antwort ohne lesbare Zusammenfassung');

      setAnalysis(auswertung);
      klarStorage.setItem('klar_latest_journal_analysis', JSON.stringify(auswertung));
      if (auswertung.mood) merkeStimmung(auswertung.mood);
      setEntry('');
      setIsExpanded(true);
      hapticFeedback([50, 100, 150]);
    } catch (e) {
      melde('DatingJournalWidget', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-5 border border-stone-200 dark:border-stone-700 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-bl-full -z-10" />

      <div
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
            <BookOpen size={20} />
          </div>
          <div>
            <h3 className="font-serif font-medium text-lg text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              Dating-Journal
              <Sparkles size={14} className="text-rose-500" />
            </h3>
            {moodHistory.length > 0 && (
              <div className="flex gap-1 mt-1">
                {moodHistory.map((m, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${m === 'positive' ? 'bg-emerald-400' : m === 'neutral' ? 'bg-amber-400' : 'bg-rose-400'}`}
                    title={m}
                  />
                ))}
              </div>
            )}
            <p className="text-xs text-stone-500 dark:text-stone-400">Reflektiere dein letztes Date</p>
          </div>
        </div>
        <div className="text-stone-400">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3">
              <div className="relative mb-3">
                <textarea
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="Wie lief dein Date? Was hast du gefühlt? Was lief gut, was weniger? (Oder nutze die Spracheingabe)"
                  className="w-full h-32 p-3 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/50 transition-all dark:text-stone-100"
                />
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessingAudio || isAnalyzing}
                  className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors flex items-center justify-center shadow-sm ${isRecording ? 'bg-rose-500 text-white ' : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-rose-500 hover:border-rose-200'}`}
                  title="KI-Coach Mind-Dump (Spracheingabe)"
                >
                  {isProcessingAudio ? (
                    <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                  ) : isRecording ? (
                    <Square size={16} className="fill-current" />
                  ) : (
                    <Mic size={16} />
                  )}
                </button>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !entry.trim()}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                    Analysiere...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Eintrag reflektieren
                  </>
                )}
              </button>

              {analysis && !isAnalyzing && (
                <div className="mt-4 flex flex-col gap-4">
                  {moodHistory.length > 0 && (
                    <div className="mt-4 p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700">
                      <h4 className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                        Wöchentlicher Gefühls-Trend
                      </h4>
                      <div className="flex items-end gap-1 h-12">
                        {moodHistory.map((mood, idx) => {
                          const height =
                            mood === 'positive' ? '100%' : mood === 'neutral' ? '50%' : '20%';
                          const color =
                            mood === 'positive'
                              ? 'bg-emerald-400'
                              : mood === 'neutral'
                                ? 'bg-amber-400'
                                : 'bg-rose-400';
                          return (
                            <div key={idx} className="flex-1 flex flex-col justify-end h-full">
                              <div
                                className={`w-full ${color} rounded-t-sm opacity-80`}
                                style={{ height }}
                              ></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end mb-[-8px]">
                    <button
                      onClick={exportPDF}
                      className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Download size={14} />
                      Als PDF exportieren
                    </button>
                  </div>
                  <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl">
                    <p className="text-sm text-rose-800 dark:text-rose-200 font-medium italic">
                      "{analysis.summary}"
                    </p>
                  </div>

                  {analysis.insights.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2">
                        Erkenntnisse
                      </h4>
                      <ul className="flex flex-col gap-2">
                        {analysis.insights.map((insight, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-300"
                          >
                            <span className="text-rose-500 mt-0.5">•</span>
                            <span className="leading-snug">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.tips.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2">
                        Tipps für die Zukunft
                      </h4>
                      <ul className="flex flex-col gap-2">
                        {analysis.tips.map((tip, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-300"
                          >
                            <span className="text-emerald-500 mt-0.5">→</span>
                            <span className="leading-snug">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
