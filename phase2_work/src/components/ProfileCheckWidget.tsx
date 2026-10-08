import { useState, useEffect, useRef } from "react";
import { getUserStorageItem, setUserStorageItem, klarStorage } from '../lib/userScopedStorage';
import { Sparkles, AlertCircle, ChevronRight, X, TrendingUp, TrendingDown, Download, Check, History, Filter, ArrowRight, User, RefreshCw, Layers, Copy, Undo } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import jsPDF from "jspdf";
// 12.08.2026: `html2canvas` -> `html2canvas-pro`. Der urspruengliche
// Paketstand versteht die Farbfunktion `oklch()` nicht, die Tailwind v4
// durchgehend verwendet — jeder PDF-Export brach mit „Attempting to
// parse an unsupported color function oklch" ab. Der Fork kann sie.
import html2canvas from "html2canvas-pro";
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { melde } from "../lib/fehler";

interface ProfileCheckData {
  authenticityScore: number;
  expressivenessScore: number;
  compatibilityScore?: number;
  impression: string;
  suggestions: string[];
  factors?: string[];
  optimizedBio?: string;
  optimizationCategory?: "Sprachstil" | "Interessenfokus" | "Icebreaker-Qualität";
}

interface HistoryEntry {
  id: string;
  timestamp: number;
  date: string;
  bio: string;
  compatibilityScore: number;
  authenticityScore?: number;
  expressivenessScore?: number;
  suggestions: string[];
  factors?: string[];
  optimizedBio?: string;
  optimizationCategory?: "Sprachstil" | "Interessenfokus" | "Icebreaker-Qualität";
}

const datingTips = [
  "Tipp: Ein Lächeln auf dem ersten Foto erhöht Verbindungen spürbar.",
  "Tipp: Ehrliche Interessen ziehen gleichgesinnte an.",
  "Tipp: Verwende einen offenen, positiven Ton.",
  "Tipp: Weniger ist mehr – Qualität über Quantität beim Text.",
  "Tipp: Stelle eine Frage in der Bio, um Gespräche zu starten!"
];

const playSound = (type: 'start' | 'success') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) { console.warn(e); ; }
};

export function ProfileCheckWidget() {

  const [data, setData] = useState<ProfileCheckData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "success" | "7days" | "30days">("all");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "Sprachstil" | "Interessenfokus" | "Icebreaker-Qualität">("All");
  const [hoveredHistoryIndex, setHoveredHistoryIndex] = useState<number | null>(null);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);
  const [showScoreExplanation, setShowScoreExplanation] = useState(false);

  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [aiFocus, setAiFocus] = useState<number>(50);
  const [tonality, setTonality] = useState<"Ehrlich" | "Humorvoll" | "Professionell">("Ehrlich");
  const [isHovered, setIsHovered] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewDataUrl, setPdfPreviewDataUrl] = useState<string | null>(null);
  const [previousBio, setPreviousBio] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [aiQuickInsight, setAiQuickInsight] = useState<string | null>(null);
  const [currentTip, setCurrentTip] = useState(datingTips[0]);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const savedHistory = JSON.parse(klarStorage.getItem('klar_profile_optimizations') || '[]');
      setHistory(savedHistory);
      const profile = JSON.parse(getUserStorageItem('klar_profile') || '{}');
      setBio(profile.bio || "");
      setName(profile.name || "");
    } catch (e) { console.warn(e); ; }

    const handleProfileUpdate = () => {
      try {
        const profile = JSON.parse(getUserStorageItem('klar_profile') || '{}');
        setBio(profile.bio || "");
      } catch (e) { console.warn(e); ; }
    };

    window.addEventListener('profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('profile_updated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    if (!bio || bio.length < 5) return;
    const fetchQuick = async () => {
      try {
        const res = await fetch("/api/quick-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bio })
        });
        if (res.ok) {
          const { insight } = await res.text().then(text => text ? JSON.parse(text) : {});
          setAiQuickInsight(insight);
        }
      } catch (e) { console.warn(e); ; }
    };
    const timer = setTimeout(fetchQuick, 1000);
    return () => clearTimeout(timer);
  }, [bio]);

  const fetchProfileCheck = async () => {
    setIsLoading(true);
    setError(null);
    setShowPreview(false);
    setCurrentTip(datingTips[Math.floor(0 * datingTips.length)]);
    playSound('start');

    try {
      const interestsRaw = getUserStorageItem('userInterests');
      const interests = interestsRaw ? JSON.parse(interestsRaw) : [];

      if (!bio && interests.length === 0) {
        setError("Bitte fülle zuerst dein Profil (Bio oder Interessen) aus.");
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/profile-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, interests, name, aiFocus, tonality })
      });

      if (!res.ok) {
        const errorData = await res.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
        throw new Error(errorData.error || "Fehler beim Laden des Profil-Scans.");
      }

      const result = await res.text().then(text => text ? JSON.parse(text) : {});
      setData(result);
      setAnalysisSuccess(true);
      playSound('success');

            setTimeout(() => setAnalysisSuccess(false), 3000);

      if (result.compatibilityScore) {
        const newEntry: HistoryEntry = {
          id: "0".substring(7),
          timestamp: Date.now(),
          date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
          bio: bio,
          compatibilityScore: result.compatibilityScore || 0,
          authenticityScore: result.authenticityScore,
          expressivenessScore: result.expressivenessScore,
          suggestions: result.suggestions,
          factors: result.factors,
          optimizedBio: result.optimizedBio,
          optimizationCategory: result.optimizationCategory
        };
        const newHistory = [...history, newEntry].slice(-15);
        setHistory(newHistory);
        klarStorage.setItem('klar_profile_optimizations', JSON.stringify(newHistory));
      }

    } catch (e) {
      melde("ProfileCheckWidget", e);
      setError(e instanceof Error ? e.message : "Profil-Analyse konnte leider nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAnalysis = () => {
    setIsModalOpen(true);
    fetchProfileCheck();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-rose-500";
  };

  const getIcebreakerScore = (comp: number, auth?: number, expr?: number) => {
    if (!comp) return 0;
    const a = auth || comp;
    const e = expr || comp;
    const ib = Math.round((comp - (a * 0.4) - (e * 0.4)) / 0.2);
    return Math.min(100, Math.max(0, ib));
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 dark:bg-emerald-500/20";
    if (score >= 50) return "bg-amber-500/10 dark:bg-amber-500/20";
    return "bg-rose-500/10 dark:bg-rose-500/20";
  };

  const getPreviewInsight = () => {
    if (data?.impression) return data.impression;
    if (aiQuickInsight) return aiQuickInsight;
    const wordCount = bio.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount === 0) return "Dein Profil ist noch leer. Füge Text hinzu, um KI-Feedback zu erhalten.";
    if (wordCount < 10) return "Kurze Bio erkannt. KI kann helfen, mehr Persönlichkeit und Tiefe zu zeigen.";
    const lowerBio = bio.toLowerCase();
    if (lowerBio.includes('sport') || lowerBio.includes('fitness') || lowerBio.includes('gym')) return "Sportlich aktiv! Lass uns das für Verbindungen optimal hervorheben.";
    if (lowerBio.includes('reisen') || lowerBio.includes('travel') || lowerBio.includes('meer')) return "Weltenbummler-Vibes! KI optimiert deine Geschichten für beste Resonanz.";
    if (lowerBio.includes('hund') || lowerBio.includes('katze') || lowerBio.includes('tier')) return "Tierliebhaber! Das kommt super an, lass uns das perfekt in Szene setzen.";
    if (lowerBio.includes('musik') || lowerBio.includes('konzert') || lowerBio.includes('festival')) return "Musikfan! KI zeigt dir, wie du damit die richtigen Verbindungen anziehst.";
    return "Authentische Basis erkannt. Klicke hier für eine tiefergehende Profil-Analyse.";
  };

  const handleExport = async () => {
    const modalElement = document.querySelector('.compatibility-score-modal > div:last-child') as HTMLElement;
    if (!modalElement) {
      window.print();
      return;
    }

    try {
      const elementsToHide = modalElement.querySelectorAll('.print\\:hidden');
      elementsToHide.forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      const canvas = await html2canvas(modalElement, {
        scale: 2,
        backgroundColor: '#ffffff'
      });

      elementsToHide.forEach(el => {
        (el as HTMLElement).style.display = '';
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      setPdfPreviewDataUrl(pdf.output('datauristring'));
      setShowPdfPreview(true);
    } catch (e) {
      console.error("PDF generation failed", e);
      window.print();
    }
  };

  const handleApplySuggestion = (suggestion: string | undefined) => {
    if (!suggestion) return;
    try {
      setPreviousBio(bio);
      const profile = JSON.parse(getUserStorageItem('klar_profile') || '{}');
      profile.bio = suggestion;
      setUserStorageItem('klar_profile', JSON.stringify(profile));
      setBio(suggestion);

      window.dispatchEvent(new Event('profile_updated'));

      setShowPreview(false);
      // alert("Erfolgreich angewendet! Deine Bio wurde aktualisiert."); // replaced with undo toast in UI

      // Optionally refetch analysis for the new bio
      // fetchProfileCheck(); // Let user decide if they want to re-analyze
    } catch (e) {
      console.error("Error applying suggestion", e);
    }
  };

  const handleUndoBio = () => {
    if (!previousBio) return;
    try {
      const profile = JSON.parse(getUserStorageItem('klar_profile') || '{}');
      profile.bio = previousBio;
      setUserStorageItem('klar_profile', JSON.stringify(profile));
      setBio(previousBio);

      window.dispatchEvent(new Event('profile_updated'));

      setPreviousBio(null);
    } catch (e) {
      console.error("Error undoing suggestion", e);
    }
  };

  const renderDiff = (oldText: string, newText: string) => {
    if (!oldText || !newText) return newText;
    const oldWords = oldText.split(' ');
    const newWords = newText.split(' ');

    return newWords.map((word, i) => {
      const isNew = !oldWords.includes(word);
      return (
        <span key={i} className={isNew ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-0.5 mx-0.5 rounded transition-colors duration-500" : ""}>


          {word}{" "}
        </span>
      );
    });
  };

  const sortedHistory = [...history]
  .filter(entry => {
    const categoryMatch = categoryFilter === "All" || entry.optimizationCategory === categoryFilter;
    if (!categoryMatch) return false;

    if (historyFilter === "7days") {
      return Date.now() - entry.timestamp <= 7 * 24 * 60 * 60 * 1000;
    }
    if (historyFilter === "30days") {
      return Date.now() - entry.timestamp <= 30 * 24 * 60 * 60 * 1000;
    }
    return true;
  })
  .sort((a, b) => {
    if (historyFilter === "success") return b.compatibilityScore - a.compatibilityScore;
    return a.timestamp - b.timestamp;
  });

  const trend = history.length >= 2
    ? ((history[history.length - 1]?.compatibilityScore || 0) - (history[history.length - 2]?.compatibilityScore || 0))
    : 0;

  return (
    <>
      <div
        ref={buttonRef}
        onClick={handleOpenAnalysis}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`smart-verbindung-analysis-button ${analysisSuccess ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/50' : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700'} rounded-3xl p-6 shadow-sm overflow-hidden h-full flex flex-col justify-center cursor-pointer hover:shadow-md  transition-all duration-500 group relative`}
      >
        {isLoading ? (
           <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-brand/5 dark:bg-brand/10">
             <div className="absolute inset-0 overflow-hidden">
               <motion.div
                 className="h-full w-full  from-transparent via-brand/20 to-transparent"
                 animate={{ x: ["-100%", "100%"] }}
                 transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
               />
             </div>
             <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-[280px]">
               <div className="text-sm font-semibold text-brand dark:text-brand-light  flex items-center gap-2">
                 <Sparkles size={16} /> Analysiere Profil...
               </div>
               <div className="w-full h-1.5 bg-brand/10 dark:bg-brand/20 rounded-full overflow-hidden relative ">
                 <motion.div
                   className="absolute top-0 left-0 h-full  from-brand to-brand/80"
                   animate={{ width: ["0%", "100%", "0%"], left: ["0%", "0%", "100%"] }}
                   transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
                 />
               </div>
               <motion.div
                 initial={{ opacity: 0, y: 5 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="text-[11px] text-stone-500 dark:text-stone-400 font-medium text-center mt-2"
               >
                 {currentTip}
               </motion.div>
             </div>
           </div>
        ) : (
          <>
            <div className="absolute inset-0  from-brand/5 to-transparent dark:from-brand/10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4 w-full">
                <div className="relative w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 border-white dark:border-stone-700 shadow-sm">
                  <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150&h=150" alt="Avatar" className="w-full h-full object-cover" />
                  {analysisSuccess && (
                    <div className="absolute inset-0 bg-emerald-500/80 flex items-center justify-center  z-20">
                      <Check size={24} className="text-white drop-shadow-md" />
                    </div>
                  )}
                </div>
                <div className="flex-1 pr-2">
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-lg">
                    {analysisSuccess ? 'Analyse erfolgreich!' : 'Profil-Scan'}
                  </h3>
                  <div className="text-sm text-stone-500 dark:text-stone-400 mt-0.5 min-h-[40px] flex items-center">
                    <AnimatePresence mode="wait">
                      {isHovered && !analysisSuccess ? (
                        <motion.span
                          key="insight"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="text-brand dark:text-brand-light font-medium block leading-snug"
                        >
                          <Sparkles size={12} className="inline mr-1 -mt-0.5" />
                          {getPreviewInsight()}
                        </motion.span>
                      ) : analysisSuccess && trend > 0 ? (
                        <motion.span key="success-trend" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-600 dark:text-emerald-400 font-medium">
                          +{trend} Verbindung-Potenzial-Punkte!
                        </motion.span>
                      ) : analysisSuccess ? (
                        <motion.span key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Bereit für mehr Verbindungen!
                        </motion.span>
                      ) : (
                        <motion.span key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>KI-Analyse für ein echteres Auftreten</motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-stone-50 dark:bg-stone-800 flex items-center justify-center text-stone-400 group-hover:bg-brand group-hover:text-white transition-colors shrink-0">
                <ChevronRight size={20} />
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="compatibility-score-modal fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static print:bg-transparent">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60  print:hidden"
              onClick={() => !isLoading && setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-stone-800 rounded-3xl shadow-md overflow-hidden max-h-[90vh] flex flex-col print:shadow-none print:max-h-none print:w-full"
            >
              <div className="p-4 sm:p-6 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/20 print:hidden">
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowHistory(false)}
                    className={`font-bold text-lg transition-colors ${!showHistory ? 'text-brand dark:text-brand-light' : 'text-stone-400'}`}
                  >
                    Analyse
                  </button>
                  <button
                    onClick={() => setShowHistory(true)}
                    className={`font-bold text-lg flex items-center gap-2 transition-colors ${showHistory ? 'text-brand dark:text-brand-light' : 'text-stone-400'}`}
                  >
                    Score-Verlauf {history.length > 0 && <span className="text-xs bg-stone-200 dark:bg-stone-700 px-2 py-0.5 rounded-full">{history.length}</span>}
                  </button>
                </div>
                {!isLoading && (
                  <button aria-label="Fenster schließen"
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1 print:p-0 relative">
                {!showHistory ? (
                  <>
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className="relative w-32 h-32 rounded-3xl bg-stone-100 dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 overflow-hidden mb-8 shadow-inner flex items-center justify-center">
                          <User size={64} className="text-stone-300 dark:text-stone-600" />
                          <motion.div
                            animate={{ top: ["-10%", "110%"] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                            className="absolute left-0 w-full h-1 bg-brand shadow-[0_0_15px_3px_rgba(var(--brand-rgb),0.5)] z-10"
                          />
                          <div className="absolute inset-0 bg-brand/10 " />
                        </div>
                        <p className="text-sm font-medium text-stone-600 dark:text-stone-400  flex items-center gap-2">
                          <Sparkles size={16} /> Gemini scannt Profil...
                        </p>
                      </div>
                    ) : error ? (
                      <div className="text-center py-12 text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 rounded-2xl flex flex-col items-center gap-3">
                        <AlertCircle size={28} className="text-rose-400" />
                        <p className="max-w-[250px]">{error}</p>
                        <button
                          onClick={fetchProfileCheck}
                          className="mt-4 px-4 py-2 bg-stone-200 dark:bg-stone-700 rounded-lg font-medium hover:bg-stone-300 dark:hover:bg-stone-600 transition-colors"
                        >
                          Erneut versuchen
                        </button>
                      </div>
                    ) : data && (
                      <div className="space-y-6 relative">
                        {previousBio && (
                          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center justify-between">
                            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                              <Check size={16} /> Bio erfolgreich aktualisiert!
                            </span>
                            <button onClick={handleUndoBio} className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 flex items-center gap-1 bg-white dark:bg-stone-800 px-2 py-1 rounded shadow-sm">
                              <Undo size={14} /> Rückgängig machen
                            </button>
                          </motion.div>
                        )}
                        {showPreview ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-stone-800 border border-brand/20 dark:border-brand/30 rounded-2xl p-5 shadow-lg relative"
                          >
                            <h3 className="text-lg font-bold mb-4 text-stone-900 dark:text-stone-100 flex items-center gap-2">
                              <Layers className="text-brand" size={20} />
                              Vorschau: Optimierte Bio
                            </h3>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 relative">
                                <span className="absolute -top-3 left-4 bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                  Aktuell
                                </span>
                                <p className="text-sm text-stone-700 dark:text-stone-300 mt-1 whitespace-pre-wrap">
                                  {bio}
                                </p>
                              </div>
                              <div className="p-4 bg-brand/5 dark:bg-brand/10 rounded-xl border border-brand/20 relative group">
                                <span className="absolute -top-3 left-4 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <Sparkles size={10} /> Optimiert
                                </span>
                                <button
                                  onClick={() => {
                                    if (data.optimizedBio) {
                                      navigator.clipboard.writeText(data.optimizedBio);
                                      setCopySuccess(true);
                                      setTimeout(() => setCopySuccess(false), 2000);
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-white dark:bg-stone-800 rounded-lg shadow-sm border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-brand transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="In Zwischenablage kopieren"
                                >
                                  {copySuccess ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                                <p className="text-sm text-stone-900 dark:text-stone-100 mt-1 whitespace-pre-wrap font-medium">
                                  {data.optimizedBio ? renderDiff(bio, data.optimizedBio) : "Keine Vorschau verfügbar"}
                                </p>
                              </div>
                            </div>

                            <div className="flex justify-end gap-3">
                              <button
                                onClick={() => setShowPreview(false)}
                                className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg text-sm font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                              >
                                Abbrechen
                              </button>
                              <button
                                onClick={() => handleApplySuggestion(data.optimizedBio)}
                                disabled={!data.optimizedBio}
                                className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm shadow-brand/20 hover:opacity-90 transition-opacity disabled:opacity-50"
                              >
                                <Check size={16} /> Jetzt anwenden
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className={`p-4 rounded-2xl border border-stone-100 dark:border-stone-700 flex flex-col items-center justify-center text-center ${getScoreBg(data.authenticityScore)}`}>
                                <span className="text-xs uppercase font-bold text-stone-500 dark:text-stone-400 mb-1">Authentizität</span>
                                <span className={`text-4xl font-bold ${getScoreColor(data.authenticityScore)}`}>{data.authenticityScore}%</span>
                              </div>
                              <div className={`p-4 rounded-2xl border border-stone-100 dark:border-stone-700 flex flex-col items-center justify-center text-center ${getScoreBg(data.expressivenessScore)}`}>
                                <span className="text-xs uppercase font-bold text-stone-500 dark:text-stone-400 mb-1">Community Verbindung</span>
                                <span className={`text-4xl font-bold ${getScoreColor(data.expressivenessScore)}`}>{data.expressivenessScore}%</span>
                              </div>
                            </div>

                            {data.compatibilityScore !== undefined && (
                              <>
                              <div className="mt-4 bg-stone-50 dark:bg-stone-800/50 p-5 rounded-2xl border border-stone-100 dark:border-stone-700 relative">
                                <div className="absolute top-4 right-4">
                                  <button onClick={() => setShowScoreExplanation(!showScoreExplanation)} className="text-stone-400 hover:text-brand transition-colors p-1" title="Berechnungsgrundlage">
                                    <AlertCircle size={18} />
                                  </button>
                                </div>
                                <div className="flex justify-between items-center mb-3 pr-8">
                                  <span className="text-sm uppercase font-bold text-stone-700 dark:text-stone-300 flex items-center gap-2">
                                    Kompatibilitäts-Score
                                    {trend !== 0 && (
                                      <span className={`flex items-center text-xs px-1.5 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                        {trend > 0 ? <TrendingUp size={12} className="mr-1"/> : <TrendingDown size={12} className="mr-1"/>}
                                        {Math.abs(trend)}%
                                      </span>
                                    )}
                                  </span>
                                  <span className={`text-2xl font-bold ${getScoreColor(data.compatibilityScore)}`}>{data.compatibilityScore}%</span>
                                </div>
                                <div className="h-4 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden shadow-inner">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${data.compatibilityScore}%` }}
                                    transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                                    className={`h-full rounded-full ${data.compatibilityScore >= 80 ? 'bg-emerald-500' : data.compatibilityScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  />
                                </div>

                                <AnimatePresence>
                                  {showScoreExplanation && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700">
                                        <h5 className="text-xs font-bold uppercase text-stone-500 mb-3">Gewichtete Hauptfaktoren (Berechnungsgrundlage)</h5>
                                        <div className="space-y-3">
                                          <div>
                                            <div className="flex justify-between text-xs mb-1"><span className="font-medium text-stone-700 dark:text-stone-300">Authentizität</span><span className="font-bold text-stone-900 dark:text-stone-100">40%</span></div>
                                            <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden"><div className="h-full bg-blue-500 w-[40%]"></div></div>
                                          </div>
                                          <div>
                                            <div className="flex justify-between text-xs mb-1"><span className="font-medium text-stone-700 dark:text-stone-300">Community Verbindung</span><span className="font-bold text-stone-900 dark:text-stone-100">40%</span></div>
                                            <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden"><div className="h-full bg-purple-500 w-[40%]"></div></div>
                                          </div>
                                          <div>
                                            <div className="flex justify-between text-xs mb-1"><span className="font-medium text-stone-700 dark:text-stone-300">Icebreaker-Potenzial</span><span className="font-bold text-stone-900 dark:text-stone-100">20%</span></div>
                                            <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden"><div className="h-full bg-amber-500 w-[20%]"></div></div>
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>

                              <div className="mt-6 bg-brand/5 dark:bg-brand/10 border border-brand/20 rounded-2xl p-5">
                                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-3 flex items-center gap-2">
                                  <Sparkles size={16} className="text-brand" /> Quick-Insights
                                </h4>
                                <ul className="space-y-2">
                                  {data.suggestions?.slice(0, 3).map((insight: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-300">
                                      <div className="min-w-[1.25rem] mt-0.5"><Check size={14} className="text-brand" /></div>
                                      <span className="leading-snug">{insight}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              </>
                            )}

                            {data.factors && data.factors.length > 0 && (
                              <div className="bg-brand/5 dark:bg-brand/10 rounded-2xl p-4 border border-brand/10 dark:border-brand/20">
                                <h4 className="text-xs font-semibold text-brand dark:text-brand-light uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <Sparkles size={14} /> Warum dieser Score?
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {data.factors.map((factor, i) => (
                                    <span key={i} className="px-3 py-1 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs rounded-full border border-stone-200 dark:border-stone-700 shadow-sm">
                                      {factor}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="bg-stone-50 dark:bg-stone-800/30 rounded-2xl p-5 relative italic">
                              <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-sm">
                                "{data.impression}"
                              </p>
                            </div>

                            <div className="bg-stone-50 dark:bg-stone-800/30 p-4 rounded-xl border border-stone-100 dark:border-stone-700 mt-2 mb-4">
                              <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">KI-Fokus für Optimierung</label>
                                <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                                  {aiFocus < 50 ? 'Authentizität' : aiFocus > 50 ? 'Attraktivität' : 'Ausgewogen'}
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0" max="100" step="10"
                                value={aiFocus}
                                onChange={(e) => setAiFocus(parseInt(e.target.value))}
                                className="w-full accent-brand h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <div className="flex justify-between text-[10px] text-stone-500 mt-1 mb-3">
                                <span>100% Authentisch</span>
                                <span>100% Attraktiv</span>
                              </div>

                              <div className="flex justify-between items-center mb-2 mt-4">
                                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">Tonalität</label>
                              </div>
                              <select
                                value={tonality}
                                onChange={(e) => setTonality(e.target.value as unknown)}
                                className="w-full text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-2 mb-4 text-stone-700 dark:text-stone-300 focus:outline-none focus:border-brand"
                              >
                                <option value="Ehrlich">Ehrlich & Direkt</option>
                                <option value="Humorvoll">Humorvoll & Locker</option>
                                <option value="Professionell">Professionell & Seriös</option>
                              </select>

                              <button
                                onClick={fetchProfileCheck}
                                className="w-full text-xs text-stone-700 dark:text-stone-300 font-medium hover:bg-stone-200 dark:hover:bg-stone-700 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-3 py-2 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1"
                              >
                                <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span> Mit neuem Fokus analysieren
                              </button>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                                  Personalisierte Vorschläge
                                </h4>
                                {data.optimizedBio && (
                                  <button
                                    onClick={() => setShowPreview(true)}
                                    className="text-xs flex items-center gap-1 font-medium bg-brand text-white px-3 py-1.5 rounded-full shadow-sm hover:opacity-90 transition-opacity"
                                  >
                                    <Sparkles size={12} /> Vorschau ansehen
                                  </button>
                                )}
                              </div>
                              <ul className="space-y-3">
                                {data.suggestions.map((suggestion, idx) => (
                                  <motion.li
                                    key={idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="text-sm text-stone-700 dark:text-stone-300 flex items-start gap-3 bg-white dark:bg-stone-800/80 p-4 rounded-xl border border-stone-100 dark:border-stone-700 shadow-sm"
                                  >
                                    <ArrowRight size={16} className="text-brand dark:text-brand-light shrink-0 mt-0.5" />
                                    <span className="leading-snug">{suggestion}</span>
                                  </motion.li>
                                ))}
                              </ul>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center print:hidden">
                      <h4 className="font-bold text-stone-900 dark:text-stone-100">Score-Verlauf</h4>
                      <div className="flex gap-2">
                        <div className="relative group/filter">
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                          >
                            <Filter size={14} />
                            {historyFilter === "all" ? "Sortieren/Filtern" :
                             historyFilter === "success" ? "Nach Erfolg" :
                             historyFilter === "7days" ? "Letzte 7 Tage" : "Letzte 30 Tage"}
                          </button>
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-lg opacity-0 invisible group-hover/filter:opacity-100 group-hover/filter:visible transition-all z-50 overflow-hidden flex flex-col">
                            <button onClick={() => setHistoryFilter("all")} className={`text-left px-4 py-2 text-xs hover:bg-stone-50 dark:hover:bg-stone-800 ${historyFilter === 'all' ? 'font-bold text-brand bg-brand/5' : 'text-stone-700 dark:text-stone-300'}`}>Alle / Chronologisch</button>
                            <button onClick={() => setHistoryFilter("success")} className={`text-left px-4 py-2 text-xs hover:bg-stone-50 dark:hover:bg-stone-800 ${historyFilter === 'success' ? 'font-bold text-brand bg-brand/5' : 'text-stone-700 dark:text-stone-300'}`}>Nach Erfolg sortieren</button>
                            <button onClick={() => setHistoryFilter("7days")} className={`text-left px-4 py-2 text-xs hover:bg-stone-50 dark:hover:bg-stone-800 ${historyFilter === '7days' ? 'font-bold text-brand bg-brand/5' : 'text-stone-700 dark:text-stone-300'}`}>Letzte 7 Tage</button>
                            <button onClick={() => setHistoryFilter("30days")} className={`text-left px-4 py-2 text-xs hover:bg-stone-50 dark:hover:bg-stone-800 ${historyFilter === '30days' ? 'font-bold text-brand bg-brand/5' : 'text-stone-700 dark:text-stone-300'}`}>Letzte 30 Tage</button>
                          </div>
                        </div>
                        <button
                          onClick={handleExport}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-xs font-medium hover:bg-brand/20 transition-colors"
                        >
                          <Download size={14} /> Bericht exportieren
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 print:hidden mb-4">
                      <button onClick={() => setCategoryFilter("All")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${categoryFilter === "All" ? "bg-stone-800 text-white dark:bg-white dark:text-stone-900" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"}`}>
                        Alle
                      </button>
                      <button onClick={() => setCategoryFilter("Sprachstil")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${categoryFilter === "Sprachstil" ? "bg-stone-800 text-white dark:bg-white dark:text-stone-900" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"}`}>
                        Sprachstil
                      </button>
                      <button onClick={() => setCategoryFilter("Interessenfokus")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${categoryFilter === "Interessenfokus" ? "bg-stone-800 text-white dark:bg-white dark:text-stone-900" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"}`}>
                        Interessenfokus
                      </button>
                      <button onClick={() => setCategoryFilter("Icebreaker-Qualität")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${categoryFilter === "Icebreaker-Qualität" ? "bg-stone-800 text-white dark:bg-white dark:text-stone-900" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"}`}>
                        Icebreaker-Qualität
                      </button>
                    </div>

                    {history.length > 0 ? (
                      <>
                        <div className="flex flex-col md:flex-row gap-6 mb-8">
                          <div className="h-48 w-full md:w-2/3 bg-stone-50 dark:bg-stone-800/30 rounded-2xl p-4 border border-stone-100 dark:border-stone-700 print:h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={history}
                                onMouseMove={(state) => {
                                  if (state && state.activeTooltipIndex !== undefined) {
                                    setHoveredHistoryIndex(Number(state.activeTooltipIndex));
                                  }
                                }}
                                onMouseLeave={() => setHoveredHistoryIndex(null)}
                              >
                                <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                                  cursor={{ fill: 'var(--brand)', opacity: 0.1 }}
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const d = payload[0]?.payload;
                                      return (
                                        <div className="bg-white dark:bg-stone-800 p-3 rounded-xl shadow-lg border border-stone-100 dark:border-stone-700 max-w-[200px]">
                                          <p className="font-bold text-sm text-stone-900 dark:text-white mb-1">{d.date}</p>
                                          <p className="text-brand font-bold text-lg mb-2">{d.compatibilityScore}%</p>
                                          <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 italic">
                                            "{d.bio}"
                                          </p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Bar dataKey="compatibilityScore" radius={[4, 4, 0, 0]}>
                                  {history.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={hoveredHistoryIndex === index || hoveredHistoryIndex === null ? 'var(--brand)' : 'var(--brand)'} fillOpacity={hoveredHistoryIndex === index ? 1 : (hoveredHistoryIndex === null ? 0.8 : 0.4)} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="w-full md:w-1/3 bg-brand/5 dark:bg-brand/10 p-5 rounded-2xl border border-brand/20">
                             <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100 mb-3 flex items-center gap-2">
                               <RefreshCw size={16} className="text-brand" />
                               {hoveredHistoryIndex !== null ? "Score-Zusammensetzung" : "Trend-Legende"}
                             </h4>
                             <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
                               {hoveredHistoryIndex !== null ? "Die spezifische Zusammensetzung des Scores an diesem Punkt:" : "Das Diagramm zeigt deinen Kompatibilitäts-Score. Ein Anstieg bedeutet, dass deine Bio authentischer und passender für die Community wurde."}
                             </p>

                             {hoveredHistoryIndex !== null && history[hoveredHistoryIndex] ? (
                               <div className="space-y-3">
                                 <div className="flex items-center justify-between">
                                   <span className="text-xs font-medium text-stone-500">Authentizität</span>
                                   <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{history[hoveredHistoryIndex]?.authenticityScore || '-'}%</span>
                                 </div>
                                 <div className="w-full bg-stone-200 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden">
                                   <div className="bg-brand h-full" style={{ width: `${history[hoveredHistoryIndex]?.authenticityScore || 0}%` }} />
                                 </div>

                                 <div className="flex items-center justify-between pt-1">
                                   <span className="text-xs font-medium text-stone-500">Community Verbindung</span>
                                   <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{history[hoveredHistoryIndex]?.expressivenessScore || '-'}%</span>
                                 </div>
                                 <div className="w-full bg-stone-200 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden">
                                   <div className="bg-brand h-full" style={{ width: `${history[hoveredHistoryIndex]?.expressivenessScore || 0}%` }} />
                                 </div>

                                 <div className="flex items-center justify-between pt-1">
                                   <span className="text-xs font-medium text-stone-500">Icebreaker-Potenzial</span>
                                   <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{getIcebreakerScore(history[hoveredHistoryIndex]?.compatibilityScore, history[hoveredHistoryIndex]?.authenticityScore, history[hoveredHistoryIndex]?.expressivenessScore)}%</span>
                                 </div>
                                 <div className="w-full bg-stone-200 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden">
                                   <div className="bg-brand h-full" style={{ width: `${getIcebreakerScore(history[hoveredHistoryIndex]?.compatibilityScore, history[hoveredHistoryIndex]?.authenticityScore, history[hoveredHistoryIndex]?.expressivenessScore)}%` }} />
                                 </div>
                               </div>
                             ) : null}

                             {history[hoveredHistoryIndex !== null ? hoveredHistoryIndex : history.length - 1]?.factors && (
                               <div className="mt-4 pt-4 border-t border-brand/10">
                                  <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">
                                    {hoveredHistoryIndex !== null ? "Wirkende Erfolgsfaktoren" : "Aktuelle Erfolgsfaktoren"}
                                  </span>
                                  <ul className="space-y-1.5">
                                    {history[hoveredHistoryIndex !== null ? hoveredHistoryIndex : history.length - 1]?.factors?.map((f: string, i: number) => (
                                      <li key={i} className="text-xs flex items-center gap-2 text-stone-700 dark:text-stone-300">
                                        <Check size={12} className="text-brand shrink-0" /> <span className="leading-tight">{f}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  {history[hoveredHistoryIndex !== null ? hoveredHistoryIndex : history.length - 1]?.optimizationCategory && (
                                    <div className="mt-4 pt-4 border-t border-brand/10">
                                      <span className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                                        Fokus der Optimierung
                                      </span>
                                      <span className="inline-block px-2 py-1 bg-white dark:bg-stone-800 rounded-md text-xs font-semibold text-brand shadow-sm">
                                        {history[hoveredHistoryIndex !== null ? hoveredHistoryIndex : history.length - 1]?.optimizationCategory}
                                      </span>
                                    </div>
                                  )}
                               </div>
                             )}
                          </div>
                        </div>

                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-stone-200 dark:before:bg-stone-800">
                          {sortedHistory.map((entry, idx) => (
                            <motion.div
                              key={entry.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                            >
                              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-stone-900 bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 group-[.is-active]:bg-brand group-[.is-active]:text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                                <span className="text-xs font-bold">{entry.compatibilityScore}</span>
                              </div>
                              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800/80 shadow-sm print:w-full print:mb-4">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-stone-500 dark:text-stone-400">{entry.date}</span>
                                  <button onClick={() => handleApplySuggestion(entry.optimizedBio || entry.bio)} className="flex items-center gap-1 text-[10px] bg-brand/10 text-brand px-2 py-1 rounded hover:bg-brand/20 transition-colors font-bold uppercase tracking-wider">
                                    <Check size={12} /> Anwenden
                                  </button>
                                </div>
                                {entry.optimizationCategory && (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-brand/10 text-brand mb-2">
                                    {entry.optimizationCategory}
                                  </span>
                                )}
                                {entry.optimizedBio ? (
                                  <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-lg border border-stone-200 dark:border-stone-700 relative">
                                      <span className="text-[9px] font-bold uppercase text-stone-500 block mb-1">Vorher</span>
                                      <p className="text-xs text-stone-700 dark:text-stone-300 italic">"{entry.bio}"</p>
                                    </div>
                                    <div className="bg-brand/5 dark:bg-brand/10 p-3 rounded-lg border border-brand/20 relative">
                                      <span className="text-[9px] font-bold uppercase text-brand block mb-1 flex items-center gap-1"><Sparkles size={10} /> KI-Optimiert</span>
                                      <p className="text-xs text-stone-900 dark:text-stone-100 font-medium">"{entry.optimizedBio}"</p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-stone-800 dark:text-stone-200 mb-3 italic">"{entry.bio}"</p>
                                )}

                                <div className="mt-3 mb-3 pt-3 border-t border-stone-100 dark:border-stone-700 grid grid-cols-3 gap-2">
                                  <div>
                                    <div className="flex justify-between text-[9px] mb-1"><span className="text-stone-500">Authentizität</span><span className="font-bold">{entry.authenticityScore || entry.compatibilityScore}%</span></div>
                                    <div className="h-1 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${entry.authenticityScore || entry.compatibilityScore}%`}}></div></div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[9px] mb-1"><span className="text-stone-500">Community</span><span className="font-bold">{entry.expressivenessScore || entry.compatibilityScore}%</span></div>
                                    <div className="h-1 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden"><div className="h-full bg-purple-500" style={{width: `${entry.expressivenessScore || entry.compatibilityScore}%`}}></div></div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[9px] mb-1"><span className="text-stone-500">Icebreaker</span><span className="font-bold">{getIcebreakerScore(entry.compatibilityScore, entry.authenticityScore, entry.expressivenessScore)}%</span></div>
                                    <div className="h-1 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden"><div className="h-full bg-amber-500" style={{width: `${getIcebreakerScore(entry.compatibilityScore, entry.authenticityScore, entry.expressivenessScore)}%`}}></div></div>
                                  </div>
                                </div>
                                {entry.factors && entry.factors.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {entry.factors.map((f, i) => (
                                      <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {entry.suggestions && entry.suggestions.length > 0 && (
                                  <div className="text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 p-2 rounded-lg border border-stone-100 dark:border-stone-700/50">
                                    <span className="font-semibold text-brand block mb-1">KI Tipp:</span>
                                    {entry.suggestions[0]}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-stone-500">
                        <History size={32} className="mx-auto mb-3 opacity-20" />
                        <p>Noch keine Optimierungen vorhanden.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!isLoading && (
                <div className="p-4 border-t border-stone-100 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/20 flex justify-end print:hidden">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-xl font-medium shadow-sm hover:opacity-90 transition-opacity"
                  >
                    Schließen
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPdfPreview && pdfPreviewDataUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 ">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-4xl h-[90vh] bg-white dark:bg-stone-800 rounded-2xl overflow-hidden flex flex-col shadow-md">
              <div className="p-4 border-b border-stone-200 dark:border-stone-700 flex justify-between items-center bg-stone-50 dark:bg-stone-800">
                <h3 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Download size={18} className="text-brand" /> PDF Vorschau
                </h3>
                <div className="flex gap-3">
                   <button onClick={() => {
                     const a = document.createElement('a');
                     a.href = pdfPreviewDataUrl;
                     a.download = `Klar_Bio_Optimierung_${new Date().toISOString().split('T')[0]}.pdf`;
                     a.click();
                     setShowPdfPreview(false);
                   }} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 shadow-sm transition-all">
                     Jetzt herunterladen
                   </button>
                   <button aria-label="PDF-Vorschau schließen" onClick={() => setShowPdfPreview(false)} className="p-2 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 bg-stone-200 dark:bg-stone-800 rounded-lg transition-colors">
                     <X size={18} />
                   </button>
                </div>
              </div>
              <iframe src={pdfPreviewDataUrl} className="w-full flex-1 bg-stone-100 dark:bg-stone-950" title="PDF Preview" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
