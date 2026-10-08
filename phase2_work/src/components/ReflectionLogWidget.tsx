import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Calendar, Plus, X, Smile, Meh, Frown, Download, Sparkles, Brain, Mic, MicOff } from 'lucide-react';
import { askAICoach, analyzeReflection } from '../lib/api';
import { hapticFeedback, HAPTIC_PATTERNS } from '../lib/haptics';
import { melde } from "../lib/fehler";

interface LogEntry {
  id: string;
  date: number;
  personName: string;
  mood: 'good' | 'neutral' | 'bad';
  tags?: string[];
  notes: string;
}

export function ReflectionLogWidget() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const [personName, setPersonName] = useState('');
  const [mood, setMood] = useState<'good' | 'neutral' | 'bad' | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const availableTags = ['spannend', 'ruhig', 'anstrengend', 'lustig', 'tiefgründig', 'awkward'];

  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceRecognition, setVoiceRecognition] = useState<unknown>(null);

  useEffect(() => {
    interface SpeechRecognitionResultEventLike {
      results: ArrayLike<ArrayLike<{ transcript: string }>>;
    }
    interface SpeechRecognitionErrorEventLike {
      error: string;
    }
    interface SpeechRecognitionLike {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: SpeechRecognitionResultEventLike) => void | Promise<void>) | null;
      onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    }
    type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'de-DE';

      recognition.onresult = async (event: SpeechRecognitionResultEventLike) => {
        const transcript = event.results[0][0].transcript;
        setIsRecording(false);
        await processVoiceInput(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        melde("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      setVoiceRecognition(recognition);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      voiceRecognition?.stop();
      setIsRecording(false);
    } else {
      voiceRecognition?.start();
      setIsRecording(true);
    }
  };

  const processVoiceInput = async (text: string) => {
    setIsProcessingVoice(true);
    setNotes(prev => prev + (prev ? ' ' : '') + text);
    try {
      const data = await analyzeReflection(text);
      if (data.mood && ['good', 'neutral', 'bad'].includes(data.mood)) setMood(data.mood as "good"|"neutral"|"bad");
      if (data.tags && Array.isArray(data.tags)) {
        setSelectedTags(prev => Array.from(new Set([...prev, ...data.tags!.filter((t: string) => availableTags.includes(t))])));
      }
      if (data.personName && data.personName !== "Unbekannt") setPersonName(data.personName);
    } catch(e) {
      console.warn("Could not process voice input structure", e);
    } finally {
      setIsProcessingVoice(false);
    }
  };


  const generateSummary = async () => {
    if (logs.length < 2) return;
    setIsGeneratingSummary(true);
    try {
      const recentLogs = logs.slice(0, 5);
      const logText = recentLogs.map(l => `Date mit ${l.personName} (${l.mood}): ${l.notes}. Tags: ${l.tags?.join(', ')}`).join('\n');
      const res = await askAICoach(`Analysiere die letzten Dates des Nutzers und erstelle eine kurze Zusammenfassung über seine Dating-Muster (Was läuft gut, was wiederholt sich, worauf sollte er/sie achten?). Sei motivierend und direkt. Hier die Dates:\n${logText}`);
      setSummary(res);
    } catch(e) {
      melde("ReflectionLogWidget", e);
      setSummary("Konnte die Zusammenfassung leider nicht erstellen.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };


  useEffect(() => {
    const saved = klarStorage.getItem('klar_reflection_logs');
    if (saved) {
      const parsedLogs = JSON.parse(saved);
      setLogs(parsedLogs);
    }
  }, []);

  useEffect(() => {
    // Automatically generate summary if 5 or more logs and no summary yet
    if (logs.length >= 5 && !summary && !isGeneratingSummary) {
      generateSummary();
    }
  }, [logs.length]);


  const exportLog = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'klar-reflexionen.json';
    a.click();
    URL.revokeObjectURL(url);
    hapticFeedback(HAPTIC_PATTERNS.SUCCESS);
  };

  const saveLog = () => {
    if (!personName || !mood) return;
    const newLog: LogEntry = {
      id: Date.now().toString(),
      date: Date.now(),
      personName,
      mood,
      notes,
      tags: selectedTags
    };
    const updated = [newLog, ...logs];
    setLogs(updated);
    klarStorage.setItem('klar_reflection_logs', JSON.stringify(updated));
    hapticFeedback(HAPTIC_PATTERNS.SUCCESS);

    // Reset
    setIsAdding(false);
    setPersonName('');
    setMood(null);
    setNotes('');
    setSelectedTags([]);
  };

  const getMoodIcon = (m: 'good' | 'neutral' | 'bad', size = 16) => {
    switch (m) {
      case 'good': return <Smile size={size} className="text-emerald-500" />;
      case 'neutral': return <Meh size={size} className="text-amber-500" />;
      case 'bad': return <Frown size={size} className="text-rose-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-stone-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl">
            <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Reflexions-Log</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">Nach dem Date</p>
          </div>
        </div>

        <div className="flex gap-2">
          {logs.length > 0 && (
            <button
              onClick={exportLog}
              className="p-2 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              title="Als JSON exportieren"
            >
              <Download size={16} />
            </button>
          )}
          <button
            onClick={() => {
              hapticFeedback(HAPTIC_PATTERNS.LIGHT_TAP);
              setIsAdding(!isAdding);
            }}
            className="p-2 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
          >
            {isAdding ? <X size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>



      {logs.length >= 2 && (
        <div className="mb-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <Brain size={14} /> KI-Mustererkennung (letzte Dates)
            </h4>
            {!summary && !isGeneratingSummary && (
              <button onClick={generateSummary} className="text-[10px] bg-indigo-100 dark:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-md font-medium hover:bg-indigo-200 transition-colors">
                Analysieren
              </button>
            )}
          </div>

          {isGeneratingSummary && (
            <div className="flex items-center gap-2 text-xs text-indigo-600">
              <Sparkles size={12} className="" /> Analysiere Dating-Muster...
            </div>
          )}

          {summary && !isGeneratingSummary && (
            <div className="text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed">
              {summary}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>

        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl space-y-3">
              <input
                type="text"
                placeholder="Mit wem war das Date?"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />

              <div>
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">Wie hast du dich gefühlt?</p>
                <div className="flex gap-2">
                  {(['good', 'neutral', 'bad'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMood(m)}
                      className={`flex-1 py-2 flex justify-center items-center rounded-xl border ${mood === m ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-700/50' : 'bg-white border-stone-200 dark:bg-stone-800 dark:border-stone-700'}`}
                    >
                      {getMoodIcon(m, 20)}
                    </button>
                  ))}
                </div>
              </div>


              <div>
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-2">Stimmungs-Tags</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${selectedTags.includes(tag) ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700' : 'bg-white text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700'}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                  <textarea

                placeholder="Kurze Notizen..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none h-20"
               />
                  <button
                    onClick={toggleRecording}
                    type="button"
                    className={`absolute right-2 bottom-2 p-2 rounded-full transition-colors ${isRecording ? 'bg-rose-500 text-white ' : 'bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-700'}`}
                    title="Sprachnotiz aufnehmen"
                  >
                    {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                </div>
                {isProcessingVoice && <p className="text-xs text-indigo-500 flex items-center gap-1 mt-1"><span>KI verarbeitet...</span> KI strukturiert deine Gedanken...</p>}

              <button
                onClick={saveLog}
                disabled={!personName || !mood}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                Speichern
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {logs.length > 0 ? (
        <div className="space-y-3">
          {logs.slice(0, 3).map(log => (
            <div key={log.id} className="p-3 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-100 dark:border-stone-700/50">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{log.personName}</span>
                <span className="text-xs text-stone-500 flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(log.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>

              <div className="flex items-start gap-2 mb-2">
                <div className="mt-0.5">{getMoodIcon(log.mood)}</div>
                <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2">{log.notes}</p>
              </div>
              {log.tags && log.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {log.tags.map(t => (
                    <span key={t} className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 rounded text-[9px] uppercase tracking-wider">{t}</span>
                  ))}
                </div>
              )}

            </div>
          ))}
          {logs.length > 3 && (
            <button className="w-full text-center text-xs text-indigo-600 dark:text-indigo-400 font-medium pt-2">
              Alle {logs.length} Einträge ansehen
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-stone-500 dark:text-stone-400">Noch keine Einträge. Logge dein erstes Date!</p>
        </div>
      )}
    </div>
  );
}
