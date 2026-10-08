import { useState, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { askAICoach } from "../lib/api";
import { melde } from "../lib/fehler";

export function VoiceJournalWidget({ onSave }: { onSave: (text: string, analysis: string) => void }) {
  const [uiError, setUiError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef<unknown>(null);

  const startRecording = () => {
    try {
      const SpeechRecognition = (window as unknown).SpeechRecognition || (window as unknown).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech Recognition wird von deinem Browser nicht unterstützt.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'de-DE';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: unknown) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      setTranscript("");
    } catch(e) {
      melde("VoiceJournalWidget", e);
    }
  };

  const stopRecording = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);

    if (transcript.trim().length > 10) {
      setIsProcessing(true);
      try {
        const analysis = await askAICoach(`Fasse diese Gedanken nach einem Date als kurzes Journal-Learning zusammen (max 2 Sätze): "${transcript}"`);
        onSave(transcript, analysis.trim());
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
      setIsProcessing(false);
      setTranscript("");
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <h3 className="text-lg font-medium mb-2 text-stone-900 dark:text-stone-100 flex items-center gap-2">
        <Mic className="text-brand dark:text-brand-light" size={20} />
        Sprachnotiz zum Date
      </h3>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
        Erzähle einfach frei heraus, wie dein letztes Date war. KI fasst deine Gedanken für das Tagebuch zusammen.
      </p>

      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700 text-sm text-stone-700 dark:text-stone-300 italic min-h-[60px]"
          >
            {transcript || "Ich höre zu..."}
          </motion.div>
        )}
      </AnimatePresence>

      {isProcessing ? (
        <div className="w-full py-3 bg-stone-100 dark:bg-stone-800 text-stone-500 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700  mb-3"></div> KI verarbeitet Notiz...
        </div>
      ) : isRecording ? (
        <button
          onClick={stopRecording}
          className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm shadow-rose-500/20 "
        >
          <Square size={16} className="fill-current" /> Aufnahme stoppen & speichern
        </button>
      ) : (
        <button
          onClick={startRecording}
          className="w-full py-3 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Mic size={18} /> Sprachnotiz starten
        </button>
      )}
    </div>
  );
}
