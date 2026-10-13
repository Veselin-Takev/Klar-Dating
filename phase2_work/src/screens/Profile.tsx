import { resolveProfileDisplayName } from '../lib/profileDisplayName';
import { ConsentSettings } from '../components/ConsentSettings';
import { PartnerReferralWidget } from "../components/PartnerReferralWidget";
import { getUserStorageItem, setUserStorageItem, klarStorage, clearUserStorageForUid, clearSessionStorageForApp } from '../lib/userScopedStorage';
import { BiometricsVerificationModal } from '../components/BiometricsVerificationModal';
import { Heart, MessageSquare, Star } from 'lucide-react';
import { FeedbackFormWidget } from '../components/FeedbackFormWidget';
import { useId, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from '../components/ThemeProvider';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from "motion/react";
// `Heart` und `FileText` wurden importiert und nie gerendert — entfernt.
// `LogOut` bleibt: siehe die {t('profileSafety.signOut')}-Schaltflaeche weiter unten.
import { Settings, Download, Languages, Edit, BellRing, Moon, Sun, Monitor, LogOut, ShieldCheck, Trash2, Sparkles, Zap, Share2, Wand2, RefreshCw, ArrowRight, History, EyeOff, Eye, MessageCircle, Check, X, ChevronRight, Camera, RotateCcw } from "lucide-react";
import { ImageCropperModal } from "../components/ImageCropperModal";
import { ladeProfilfotoHoch } from "../lib/klar";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { askAICoach, askAIList, parseProfileImport, optimizeProfileApi } from "../lib/api";
// BEFUND 10.08.2026: downloadRadarImage war am Knopf "Als Bild exportieren"
// angebunden, aber nirgends definiert -- Absturz beim Rendern des Profils.
// Der Behaelter traegt bereits id="werte-radar-container"; die Funktion war
// also vorgesehen und nur nie geschrieben. toPng ist dieselbe Bibliothek,
// die WeeklyConsistencyTracker.tsx schon benutzt.
import { toPng } from 'html-to-image';

const VALUE_EXPLANATIONS: Record<string, string> = {
  'Abenteuer': 'Zeigt an, wie spontan und offen für neue, ungeplante Erlebnisse du bist.',
  'Achtsamkeit': 'Wie stark du auf emotionale Balance und bewusstes Leben achtest.',
  'Gemeinschaft': 'Der Stellenwert von Freunden, Familie und sozialem Umfeld.',
  'Ehrlichkeit': 'Wichtigkeit von transparenter, direkter Kommunikation ohne Spielchen.',
  'Kreativität': 'Wie viel Raum du für persönliche Entfaltung und kreative Hobbys brauchst.',
  'Karriere': 'Dein Fokus auf beruflichen Erfolg und finanzielle Stabilität.'
};

const DEEP_MATCH_INSIGHTS: Record<string, string[]> = {
  'Abenteuer': ['Ihr mögt beide unplante Wochenend-Trips.', 'Ausprobieren neuer Restaurants ist euch wichtig.'],
  'Achtsamkeit': ['Meditation & Yoga sind feste Bestandteile im Alltag.', 'Gemeinsames Reflektieren über den Tag.'],
  'Gemeinschaft': ['Familienzeit wird bei euch beiden großgeschrieben.', 'Ihr seid beide gerne Gastgeber.'],
  'Ehrlichkeit': ['Ihr schätzt direkte, klare Kommunikation.', 'Konflikte werden offen und schnell angesprochen.'],
  'Kreativität': ['Ihr habt beide ein Faible für Kunstausstellungen.', 'Gestalterische Hobbys verbinden euch.'],
  'Karriere': ['Ihr teilt den Drive für berufliche Ziele.', 'Verständnis für längere Arbeitszeiten ist gegeben.']
};

import { DatingMoodTrackerWidget } from "../components/DatingMoodTrackerWidget";
import { InsightsChart } from "../components/InsightsChart";
import { ProfileCheckWidget } from "../components/ProfileCheckWidget";
import { Meilensteine } from "../components/Meilensteine";
import { PDFResumeGenerator } from "../components/PDFResumeGenerator";
// ENTFERNT 12.08.2026: `ValuesQuizWidget` und `ProfileCompletionWidget`
// waren importiert, aber nirgends eingehaengt. Beides hat `@ts-nocheck`
// verdeckt — `noUnusedLocals` haette es sofort gemeldet.
import { ProfileCardThemeSelector } from "../components/ProfileCardThemeSelector";
import { FocusTimeSettingsWidget } from "../components/FocusTimeSettingsWidget";
// SmartPauseWidget und SmartPausePlanner sind am 14.08.2026 zu einer
// Komponente geworden — Begruendung im Kopf von SmartPause.tsx.
import { SmartPause } from "../components/SmartPause";
import { HapticSettings } from "../components/HapticSettings";
import { RitualReminderSetting } from "../components/RitualReminderSetting";
import { Reiterleiste, type Reiter } from "../components/Reiterleiste";
// ENTFERNT 12.08.2026: fuenf Widgets mit erfundenen Daten. Siehe die
// Stellen im Text weiter unten. Die Dateien unter src/components/ sind
// damit ohne Aufrufer und koennen geloescht werden.
import { MoodCalendarGridWidget } from "../components/MoodCalendarGridWidget";
import { SmartAuditWidget } from "../components/SmartAuditWidget";
import { saveSmartMatchSettings, isSmartMatchEnabled } from "../services/smartMatchService";
import { exportUserDataAsJSON } from "../services/dataExportService";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router";
import { AboVerwaltung } from "../components/AboVerwaltung";
// P1-Zusatzbefund: wurde benutzt, aber nie importiert (@ts-nocheck hat es verdeckt).
import { triggerHaptic } from "../lib/haptics";
// ENTFERNT: `auth` und `db` wurden hier nie benutzt.
import { Cloud, Database } from "lucide-react";
import { melde } from "../lib/fehler";
import { useModalAccessibility } from "../lib/useModalAccessibility";

function OfflineCacheStatus() {
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [cachedItems, setCachedItems] = useState<string[]>([]);

  useEffect(() => {
    const updateStatus = () => {
      // Find cached profile data
      const items = [];
      if (getUserStorageItem('klar_user_bio')) items.push('Bio');
      if (getUserStorageItem('userInterests')) items.push('Interessen');
      if (klarStorage.getItem('userNoGos')) items.push('No-Gos');

      setCachedItems(items);

      // Get last successful sync from sync logs
      const syncLogs = klarStorage.getItem('klar_sync_logs');
      if (syncLogs) {
        try {
          const roh: unknown = JSON.parse(syncLogs);
          const eintraege = Array.isArray(roh) ? (roh as Record<string, unknown>[]) : [];
          const letzter = eintraege.find(
            (l) => l !== null && typeof l === 'object' && l['status'] === 'success',
          );
          const zeit = letzter ? new Date(String(letzter['syncedAt'])) : null;
          // Eine unlesbare Zeitangabe ergaebe „Invalid Date" auf dem Schirm.
          if (zeit && !Number.isNaN(zeit.getTime())) {
            setLastSync(zeit.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        } catch (e) {
          melde('Profile/sync-protokoll', e);
        }
      }
    };

    updateStatus();
    // Re-check periodically
    const interval = setInterval(updateStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  if (cachedItems.length === 0 && !lastSync) return null;

  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2 items-center">


      <div className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded-lg text-[10px] font-medium border border-stone-200 dark:border-stone-700">
        <Database size={12} />
        Lokal: {cachedItems.join(', ') || 'Keine'}
      </div>
      {lastSync && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded-lg text-[10px] font-medium border border-stone-200 dark:border-stone-700" title="Letzter erfolgreicher Cloud-Sync">
          <Cloud size={12} className={navigator.onLine ? "text-emerald-500" : "text-stone-400"} />
          Sync: {lastSync}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// `// @ts-nocheck` ENTFERNT am 12.08.2026. Was die Zeile verdeckt hat:
//
// ── 1. ES GAB KEIN ABMELDEN ───────────────────────────────────────────────
// `logOut` aus dem AuthContext hatte keinen einzigen Aufrufer in der App.
// Das Symbol `LogOut` war hier importiert und wurde nie gerendert. Wer das
// Gerät aus der Hand gab, konnte seine Gespräche nicht schliessen — die
// einzige Möglichkeit, das Konto zu verlassen, war „t('profileSafety.deleteAccount')".
// Die Schaltfläche steht jetzt in den Einstellungen über „t('profileSafety.deleteAccount')".
//
// ── 2. ZWEI WIDGETS IMPORTIERT UND NIE EINGEHÄNGT ─────────────────────────
// `ValuesQuizWidget` und `ProfileCompletionWidget`. Dazu `auth` und `db`
// aus `../lib/firebase`, drei lucide-Symbole und `cycleTheme`.
//
// ── 3. DIE FOKUS-ZEIT KONNTE STILL AUSFALLEN ──────────────────────────────
// `parseInt(startParts[0]) * 60 + parseInt(startParts[1])` ohne Prüfung.
// Steht unter `klar_focus_time` etwas Unlesbares, ist das Ergebnis `NaN`,
// jeder Vergleich damit `false` — die Fokus-Zeit galt dann als „nicht
// aktiv", obwohl sie eingeschaltet war. Kein Fehler, keine Meldung.
//
// ── 4. NEUN MAL `JSON.parse` OHNE PRÜFUNG, SECHS LEERE `catch (e) { console.warn(e); ; }` ─────
// Darunter der Bio-Verlauf, der zwei Formate kennt (alte Zeichenketten,
// neue Objekte) und beide ungeprüft weiterreichte.
//
// ── 5. ZWEI ANFRAGEN OHNE STATUSPRÜFUNG ───────────────────────────────────
// `/api/nogo-suggestions` und `/api/optimize-bio-values`: Eine Fehlerantwort
// `{ error: … }` wurde geparst, `suggestions` war leer, und der Ersatz im
// `catch` lief nie. Es sah aus wie „keine Vorschläge", nicht wie ein Fehler.
//
// ── 6. `any` IM RADAR-TOOLTIP ─────────────────────────────────────────────
// Ersetzt durch die Felder, die er tatsächlich liest.
// ═══════════════════════════════════════════════════════════════════════════

export type BioHistoryItem = {
  text: string;
  timestamp: string;
};

const nurZeichenketten = (w: unknown): string[] =>
  Array.isArray(w) ? w.filter((x): x is string => typeof x === 'string') : [];

/** Zeichenketten-Liste aus dem lokalen Speicher, ohne Vertrauen in den Inhalt. */
function listeAusSpeicher(schluessel: string): string[] {
  const roh = klarStorage.getItem(schluessel);
  if (!roh) return [];
  try {
    return nurZeichenketten(JSON.parse(roh) as unknown);
  } catch {
    return [];
  }
}

/** Die Fokus-Zeit, wie `FocusTimeSettingsWidget` sie ablegt. */
interface Fokuszeit {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

function leseFokuszeit(): Fokuszeit | null {
  const roh = klarStorage.getItem('klar_focus_time');
  if (!roh) return null;
  try {
    const w: unknown = JSON.parse(roh);
    if (w === null || typeof w !== 'object') return null;
    const o = w as Record<string, unknown>;
    if (typeof o['startTime'] !== 'string' || typeof o['endTime'] !== 'string') return null;
    return { enabled: o['enabled'] === true, startTime: o['startTime'], endTime: o['endTime'] };
  } catch {
    return null;
  }
}

/** „HH:MM" in Minuten seit Mitternacht — oder `null`, wenn unlesbar. */
function alsMinuten(uhrzeit: string): number | null {
  const teile = uhrzeit.split(':');
  const stunden = Number(teile[0]);
  const minuten = Number(teile[1]);
  if (!Number.isFinite(stunden) || !Number.isFinite(minuten)) return null;
  return stunden * 60 + minuten;
}

/** Aus einer Antwort die Liste unter `suggestions` holen. */
function vorschlaegeAus(text: string): string[] {
  if (!text) return [];
  const roh: unknown = JSON.parse(text);
  return roh !== null && typeof roh === 'object'
    ? nurZeichenketten((roh as Record<string, unknown>)['suggestions'])
    : [];
}


/** Was recharts diesem Tooltip uebergibt — nur das, was hier benutzt wird. */
interface RadarTooltipEigenschaften {
  active?: boolean;
  payload?: { payload?: { subject?: string } }[];
}

const CustomRadarTooltip = ({ active, payload }: RadarTooltipEigenschaften) => {

  const data = active ? payload?.[0]?.payload : undefined;
  if (data?.subject) {
    return (
      <div className="bg-white dark:bg-stone-800 p-3 rounded-xl shadow-lg border border-stone-100 dark:border-stone-700 max-w-[200px]">
        <p className="font-bold text-stone-800 dark:text-stone-200 text-sm mb-1">{data.subject}</p>
        <p className="text-xs text-stone-600 dark:text-stone-400">
          {VALUE_EXPLANATIONS[data.subject] ?? ''}
        </p>
      </div>
    );
  }
  return null;
};

// Die drei Bereiche. Reihenfolge: was andere sehen, wie es laeuft, wie die
// App eingestellt ist — von aussen nach innen.
type ReiterId = "profil" | "entwicklung" | "partner" | "einstellungen";
const PROFIL_REITER: readonly Reiter<ReiterId>[] = [
  { id: "profil", beschriftung: "Profil" },
  { id: "entwicklung", beschriftung: "Entwicklung" },
  { id: "partner", beschriftung: "Klar & Partner" },
  { id: "einstellungen", beschriftung: "Einstellungen" },
];


export function ProfileFeedback() {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    setSubmitted(true);
    // In a real app this would post to backend
  };

  if (submitted) {
    return (
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-6 shadow-sm text-center">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart size={24} />
        </div>
        <h3 className="font-medium text-stone-900 dark:text-stone-100">Danke für dein Feedback!</h3>
        <p className="text-sm text-stone-500 mt-2">Deine Meinung hilft uns, Klar noch besser zu machen.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-6 shadow-sm">
      <h3 className="font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2 mb-4">
        <MessageSquare size={18} className="text-brand dark:text-brand-light" />
        Deine Meinung zu Klar
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-stone-600 dark:text-stone-400 mb-2">Wie zufrieden bist du?</label>
          <div className="flex gap-2">
            {[1,2,3,4,5].map(r => (
              <button
                key={r} type="button"
                onClick={() => setRating(r)}
                className={`p-2 rounded-full transition-colors ${rating >= r ? 'text-amber-400' : 'text-stone-300 dark:text-stone-700'}`}
              >
                <Star size={24} className={rating >= r ? "fill-current" : ""} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="feedback-textarea" className="block text-sm text-stone-600 dark:text-stone-400 mb-2">Verbesserungsvorschläge (optional)</label>
          <textarea id="feedback-textarea"
            className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand/50 min-h-[80px]"
            placeholder="Was können wir besser machen?"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={rating === 0}
          className="w-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          Feedback senden
        </button>
      </form>
    </div>
  );
}

export default function Profile() {

  const { t } = useTranslation();
  const { user, logOut, updateProfileData, profileData, refreshProfile } = useAuth();
  const [activeRadarValue, setActiveRadarValue] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [isCropping, setIsCropping] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [showBiometricsModal, setShowBiometricsModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutTitleId = useId();
  const { dialogRef: logoutDialogRef, onKeyDown: onLogoutKeyDown } = useModalAccessibility<HTMLDivElement>(() => setShowLogoutConfirm(false), showLogoutConfirm);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageToCrop(reader.result?.toString() || null));
      if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
      setIsCropping(true);
      e.target.value = ''; // Reset input
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsCropping(false);
    setImageToCrop(null);
    try {
      const url = await ladeProfilfotoHoch(croppedBlob);
      // Optional: force refresh of photo URL in auth context if needed
      updateProfileData({ photoURL: url });
    } catch(e: unknown) {
      melde('Profile/photo-upload', e);
      alert("Fehler beim Hochladen des Profilfotos: " + (e instanceof Error ? e.message : "Unbekannter Fehler"));
    }
  };

  /** Werte-Radar als PNG sichern. Rein im Browser -- das Bild verlaesst das
   *  Geraet nicht und wird nirgends hochgeladen. */
  const downloadRadarImage = async () => {
    const behaelter = document.getElementById('werte-radar-container');
    if (!behaelter) {
      console.warn('Werte-Radar nicht gefunden -- nichts zu exportieren.');
      return;
    }
    try {
      const datenUrl = await toPng(behaelter, {
        // Ohne Hintergrund waere das PNG durchsichtig und im Dunkelmodus
        // unlesbar. cacheBust verhindert veraltete Schriftschnitte.
        backgroundColor: document.documentElement.classList.contains('dark')
          ? '#1c1917'
          : '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href = datenUrl;
      a.download = 'klar-werte-radar.png';
      a.click();
    } catch (e) {
      melde("Profile.tsx", e, { message: "Export des Werte-Radars fehlgeschlagen:" });
    }
  };
  // radarAnimated wird nur geschrieben, nie gelesen. Deklaration ohne
  // Lesenamen haelt das Verhalten unveraendert und stoppt den Absturz.
  const [, setRadarAnimated] = useState(false);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [userBio, setUserBio] = useState<string>("Kaffeeliebhaber, verbringe meine Wochenenden gerne auf dem Fahrrad. Suche jemanden für tiefgründige Gespräche und spontane Ausflüge.");
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [suggestedBio, setSuggestedBio] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [newInterest, setNewInterest] = useState("");
  const [userNoGos, setUserNoGos] = useState<string[]>([]);
  const [newNoGo, setNewNoGo] = useState("");
  const [nogoSuggestions, setNogoSuggestions] = useState<string[]>([]);
  const [isLoadingNogoSuggestions, setIsLoadingNogoSuggestions] = useState(false);

  const [userValuesRadar, setUserValuesRadar] = useState<{subject: string, A: number, B?: number}[]>([]);
  const [showCompareRadar, setShowCompareRadar] = useState(false);
  const [radarColorA, setRadarColorA] = useState("#a855f7");
  const [radarColorB, setRadarColorB] = useState("#f59e0b");
  const [matchFilter, setMatchFilter] = useState("all");
  const [showRadarSettings, setShowRadarSettings] = useState(false);
  const [showRadarTutorial, setShowRadarTutorial] = useState(false);







  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isOptimizingValues, setIsOptimizingValues] = useState(false);
  const [valueBioSuggestions, setValueBioSuggestions] = useState<string[]>([]);
  const [auditScore, setAuditScore] = useState<number | null>(null);

  const [isCheckingBio, setIsCheckingBio] = useState(false);
  const [bioFeedback, setBioFeedback] = useState("");

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isFocusTimeActive, setIsFocusTimeActive] = useState(false);

  useEffect(() => {
    const checkFocusTime = () => {
      const fokus = leseFokuszeit();
      if (!fokus || !fokus.enabled) {
        setIsFocusTimeActive(false);
        return;
      }
      const start = alsMinuten(fokus.startTime);
      const ende = alsMinuten(fokus.endTime);
      // BEFUND 12.08.2026: Vorher `parseInt(startParts[0]) * 60 + …` ohne
      // Pruefung. Steht dort etwas Unlesbares, ist das Ergebnis `NaN`, jeder
      // Vergleich damit `false` — die Fokus-Zeit galt dann stillschweigend
      // als „nicht aktiv", obwohl sie eingeschaltet war.
      if (start === null || ende === null) {
        setIsFocusTimeActive(false);
        return;
      }
      const jetzt = new Date();
      const jetztMinuten = jetzt.getHours() * 60 + jetzt.getMinutes();
      setIsFocusTimeActive(
        start < ende
          ? jetztMinuten >= start && jetztMinuten <= ende
          : jetztMinuten >= start || jetztMinuten <= ende,
      );
    };
    checkFocusTime();
    const interval = setInterval(checkFocusTime, 60000);
    return () => clearInterval(interval);
  }, []);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedData, setOptimizedData] = useState<{bio: string, interests: string[]} | null>(null);
  const [bioHistory, setBioHistory] = useState<BioHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mustHaveInterests, setMustHaveInterests] = useState<string[]>([]);

  const [smartMatchAlerts, setSmartMatchAlerts] = useState(() => isSmartMatchEnabled());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // P0-6: Zustand der Loeschung sichtbar machen. Wer sein Konto loeschen
  // will und nichts sieht, muss annehmen, es sei geloescht.
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // P0-6: `handleDeleteAccount` wurde in Zeile 1645 aufgerufen, war aber
  // NIRGENDS definiert — der Knopf brach beim Klick ab. Die Kaskade laeuft
  // jetzt serverseitig (Art. 17 DSGVO); clientseitig war sie technisch nie
  // vollstaendig moeglich, weil der Client nach den Firestore-Regeln keinen
  // Schreibzugriff auf fremde Chatdokumente hat.
  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const daten = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(daten.error || t('profileSafety.serverResponse', { status: res.status }));
      setUserStorageItem('klar_deletion_receipt', JSON.stringify({ requestId: daten.requestId, status: daten.status }));
      const { signOut } = await import('firebase/auth');
      const uid = auth.currentUser?.uid;
      if (uid) clearUserStorageForUid(uid);
      await signOut(auth);
      window.location.reload();
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : t('profileSafety.deletionFailed'),
      );
    } finally {
      setDeleting(false);
    }
  };
  const [darkModeVariant] = useState<"gray" | "black">(() => {
    if (typeof window !== "undefined") {
      return (klarStorage.getItem("klar_dark_variant") as "gray" | "black") || "gray";
    }
    return "gray";
  });

  const [reiter, setReiter] = useState<ReiterId>("profil");
  const [settingsCategory, setSettingsCategory] = useState<"privacy" | "preferences" | "advanced">("privacy");

  const { theme, setTheme } = useTheme();

  // `hapticIntensity` und `updateHapticIntensity` sind am 14.08.2026
  // entfallen: Sie gehoerten zur zweiten Haptik-Bedienung, die es hier nicht
  // mehr gibt. Den Zustand haelt jetzt ausschliesslich <HapticSettings />.

  useEffect(() => {
    if (darkModeVariant === "black") {
      document.documentElement.classList.add("dark-theme-black");
    } else {
      document.documentElement.classList.remove("dark-theme-black");
    }
  }, [darkModeVariant]);


  useEffect(() => {
    if (!klarStorage.getItem('klar_radar_tutorial_seen')) {
      // Show tutorial after a short delay
      const timer = setTimeout(() => {
        setShowRadarTutorial(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissRadarTutorial = () => {
    setShowRadarTutorial(false);
    klarStorage.setItem('klar_radar_tutorial_seen', 'true');
  };


  // ENTFERNT 12.08.2026: `cycleTheme` hatte keinen Aufrufer mehr, seit die
  // vierfache Theme-Steuerung am 11.08. auf zwei Stellen reduziert wurde.

  useEffect(() => {
    setUserInterests(listeAusSpeicher("userInterests"));
    setMustHaveInterests(listeAusSpeicher("mustHaveInterests"));
    setIcebreakers(listeAusSpeicher("profile_icebreakers"));

    const savedBio = getUserStorageItem('klar_user_bio');
    if (savedBio) setUserBio(savedBio);

    // Der Bio-Verlauf lag frueher als reine Zeichenketten-Liste vor. Die
    // Umstellung auf { text, timestamp } bleibt erhalten — jetzt aber ohne
    // die Annahme, dass alle Eintraege dieselbe Form haben.
    const savedBioHistory = klarStorage.getItem("klar_bio_history");
    if (savedBioHistory) {
      try {
        const roh: unknown = JSON.parse(savedBioHistory);
        if (Array.isArray(roh)) {
          const jetzt = new Date().toISOString();
          setBioHistory(
            roh.flatMap((e): BioHistoryItem[] => {
              if (typeof e === 'string') return [{ text: e, timestamp: jetzt }];
              if (e === null || typeof e !== 'object') return [];
              const o = e as Record<string, unknown>;
              if (typeof o['text'] !== 'string') return [];
              return [{
                text: o['text'],
                timestamp: typeof o['timestamp'] === 'string' ? o['timestamp'] : jetzt,
              }];
            }),
          );
        }
      } catch (e) {
        melde('Profile/bio-verlauf', e);
      }
    }
  }, []);

  const handleShareProfile = async () => {
    const profileLink = `${window.location.origin}/profile/share/12345`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mein Klar Profil',
          text: 'Schau dir mein Klar Profil an!',
          url: profileLink,
        });
      } catch (err) {
        console.warn("Error sharing:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(profileLink);
        alert('Profil-Link in die Zwischenablage kopiert!');
      } catch (err) {
        console.warn("Failed to copy:", err);
        alert('Profil-Link konnte nicht kopiert werden.');
      }
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return;

    setIsImporting(true);
    try {
      const data = await parseProfileImport(importText);
      if (data.bio) {
        setUserBio(data.bio);
        setUserStorageItem('klar_user_bio', data.bio);
      }
      if (data.interests && Array.isArray(data.interests)) {
        // Merge with existing or replace? Let's append new ones, keep up to 10
        const combined = Array.from(new Set([...userInterests, ...data.interests])).slice(0, 10);
        setUserInterests(combined);
        setUserStorageItem('userInterests', JSON.stringify(combined));
      }
      setShowImport(false);
      setImportText("");
    } catch (e) {
      melde("Profile", e);
      alert((e instanceof Error ? e.message : String(e)) || "Es gab einen Fehler beim Importieren.");
    } finally {
      setIsImporting(false);
    }
  };




    useEffect(() => {
    if (userValuesRadar.length === 0) {
      setUserValuesRadar([
        { subject: 'Abenteuer', A: 80, B: 60 },
        { subject: 'Achtsamkeit', A: 45, B: 85 },
        { subject: 'Gemeinschaft', A: 70, B: 75 },
        { subject: 'Ehrlichkeit', A: 90, B: 85 },
        { subject: 'Humor', A: 85, B: 50 }
      ]);
    }
  }, []);

  useEffect(() => {
    if (userValuesRadar.length > 0) {
      setTimeout(() => setRadarAnimated(true), 300);
    }
  }, [userValuesRadar]);


  useEffect(() => {
    if (userValuesRadar.length > 0) {
      setTimeout(() => setRadarAnimated(true), 300);
    }
  }, [userValuesRadar]);

  const fetchNogoSuggestions = async () => {
    setIsLoadingNogoSuggestions(true);
    try {
      let journals: unknown = [];
      try {
        journals = JSON.parse(klarStorage.getItem("klar_dating_journals") ?? "[]");
      } catch {
        journals = [];
      }
      const res = await fetch("/api/nogo-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journals })
      });
      // NEU: Ohne diese Pruefung wurde eine Fehlerantwort `{ error: … }`
      // geparst, `suggestions` war leer, und der Ersatz im `catch` lief nie.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNogoSuggestions(vorschlaegeAus(await res.text()));
    } catch(e) {
      melde("Profile", e);
      setNogoSuggestions(["Unehrlichkeit", "Zu spät kommen", "Ghosting"]);
    } finally {
      setIsLoadingNogoSuggestions(false);
    }
  };



  const optimizeBioValues = async () => {
    if (!userBio.trim() || userValuesRadar.length === 0) return;
    setIsOptimizingValues(true);
    setValueBioSuggestions([]);
    try {
      const res = await fetch("/api/optimize-bio-values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: userBio,
          values: userValuesRadar
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const vorschlaege = vorschlaegeAus(await res.text());
      if (vorschlaege.length > 0) setValueBioSuggestions(vorschlaege);
    } catch(e) {
      melde("Profile", e);
    } finally {
      setIsOptimizingValues(false);
    }
  };

  const checkBio = async () => {
    if (!userBio.trim()) return;
    setIsCheckingBio(true);
    setBioFeedback("");
    try {
      const interestsText = userInterests.length > 0 ? userInterests.join(", ") : "Allgemeine Themen";
      const prompt = `Analysiere diese Dating-Profil-Bio: "${userBio}". Meine Interessen sind: ${interestsText}. Gib mir basierend auf diesen Interessen konkrete KI-generierte Vorschläge, wie ich die Bio spezifischer und ansprechender formulieren kann. Halte es kurz.`;
      const feedback = await askAICoach(prompt);
      setBioFeedback(feedback);
    } catch (e) {
      melde("Profile", e);
      setBioFeedback("Konnte die Bio nicht prüfen. Bitte versuche es später nochmal.");
    } finally {
      setIsCheckingBio(false);
    }
  };

  const generateBio = async () => {
    setIsGeneratingBio(true);
    try {
      const goal = getUserStorageItem('userGoal') || 'undecided';
      const interestsText = userInterests.length > 0 ? userInterests.join(", ") : "Allgemeine Themen";

      let goalDescription = "Offen bleiben & Entdecken";
      if (goal === 'relationship') goalDescription = "Feste Beziehung finden";
      if (goal === 'casual') goalDescription = "Lockere Dates";
      if (goal === 'friends') goalDescription = "Neue Leute kennenlernen";

      const prompt = `Erstelle einen ehrlichen, ansprechenden und flüssigen 'Über mich' Fließtext für mein Dating-Profil.
Meine Interessen sind: ${interestsText}.
Mein Dating-Ziel ist: ${goalDescription}.
Halte es natürlich, sympathisch und authentisch. Gib NUR den generierten Text zurück.`;

      const response = await askAICoach(prompt);
      const newBio = response.trim();
      setSuggestedBio(newBio);

      const newBioItem = { text: newBio, timestamp: new Date().toISOString() };
      const updatedHistory = [newBioItem, ...bioHistory.filter(b => b.text !== newBio)].slice(0, 10);
      setBioHistory(updatedHistory);
      klarStorage.setItem('klar_bio_history', JSON.stringify(updatedHistory));

      // Make sure we show the preview when generating a new one
      setShowPreview(true);
      setShowHistory(false);
    } catch (e) {
      console.warn("Failed to generate bio:", e);
      setSuggestedBio((e instanceof Error ? e.message : String(e)) || "Fehler beim Generieren. Bitte versuche es später nochmal.");
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const optimizeProfile = async () => {
    setIsOptimizing(true);
    setOptimizedData(null);
    try {
      const data = await optimizeProfileApi(userBio, userInterests);
      if (data.optimizedBio && data.suggestedInterests) {
        setOptimizedData({ bio: data.optimizedBio, interests: data.suggestedInterests });
      }
    } catch (e) {
      melde("Profile", e);
      alert((e instanceof Error ? e.message : String(e)) || "Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const generateIcebreakers = async () => {
    setIsGenerating(true);
    try {
      const interestsText = userInterests.length > 0 ? userInterests.join(", ") : "Allgemeine Themen";
      const prompt = `Erstelle 3 kreative, einladende Icebreaker-Fragen für mein Dating-Profil, um interessante Gespräche zu starten. Basiere sie auf meinen Interessen: ${interestsText}.
Antworte nur mit einer unformatierten Liste (jede Frage in einer neuen Zeile, ohne Aufzählungszeichen, ohne Einleitung, ohne Fazit).`;

      const suggestions = await askAIList(prompt);

      const limitedSuggestions = suggestions.slice(0, 3);
      if (limitedSuggestions.length > 0) {
        setIcebreakers(limitedSuggestions);
        setUserStorageItem('profile_icebreakers', JSON.stringify(limitedSuggestions));
      }
    } catch (e) {
      melde("Profile", e);
      setIcebreakers([(e instanceof Error ? e.message : String(e)) || "Fehler beim Generieren. Bitte versuche es später nochmal."]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
    <div className="p-6 h-full overflow-y-auto pb-24 bg-light-bg dark:bg-dark-bg">
      {isCropping && imageToCrop && (
        <ImageCropperModal
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setIsCropping(false);
            setImageToCrop(null);
          }}
        />
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-serif text-stone-900 dark:text-stone-100">Dein Profil</h1>
        <div className="flex items-center gap-2">


          <button
            onClick={() => setShowPreview(true)}
            className="p-2 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light rounded-full hover:bg-brand/20 dark:hover:bg-brand-light/20 transition-colors"
            title="Profil Vorschau"
          >
            <Eye size={20} />
          </button>

          <button
            onClick={handleShareProfile}
            className="p-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            title="Profil teilen"
          >
            <Share2 size={20} />
          </button>
        </div>
      </div>
      {/* ── KOPF EINZEILIG (14.08.2026) ──────────────────────────────────
          VORHER: Foto (96 px), Name, Ort und der Hinweis „Lokal: Bio,
          Interessen, No-Gos" untereinander, mittig, mit `mb-8`. Rund 380 px,
          bevor der erste Inhalt kam — und zwar auf JEDEM der drei Reiter.

          JETZT: Foto 56 px links, Name und Ort rechts daneben. Der Gewinn
          ist nicht einmalig, sondern bei jedem Reiterwechsel derselbe.

          `OfflineCacheStatus` ist in den Reiter „Einstellungen" gewandert:
          Das ist eine Diagnoseanzeige („Lokal: Bio, Interessen, No-Gos"),
          kein Profilinhalt. Im Kopf beantwortete sie eine Frage, die dort
          niemand stellt. */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative shrink-0">
          <label className="cursor-pointer block group">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoSelect} />
            <div className="w-14 h-[70px] bg-stone-200 dark:bg-stone-800 rounded-xl overflow-hidden border-2 border-white dark:border-stone-900 shadow-sm relative">
              <img
                src={(profileData?.photoURL && !profileData.photoURL.includes('/_/upload/')) ? profileData.photoURL : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200"}
                alt="Avatar"
                onError={(e) => {
                  e.currentTarget.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200";
                }}
                className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                <Camera size={16} className="text-white" />
              </div>
            </div>
          </label>
          {auditScore !== null && (
            <div className="absolute -bottom-1 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-1 border-2 border-white dark:border-stone-900" title="Deep-Verbindung Qualität">
              <Sparkles size={10} />
              {auditScore * 10}%
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-medium text-stone-900 dark:text-stone-100 truncate">{resolveProfileDisplayName(profileData?.name, user?.displayName, user?.email, user?.emailVerified === true)}{typeof profileData?.age === 'number' ? `, ${profileData.age}` : ''}</h2>
            {profileData?.isVerified === true && <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-1 rounded-full shrink-0" title="Verifiziert">
              <ShieldCheck size={16} />
            </div>}
          </div>
          <p className="text-stone-500 dark:text-stone-400 text-sm">{profileData?.location || 'Ort noch nicht angegeben'}</p>
          <button type="button" onClick={() => { setNameDraft(profileData?.name === 'Neu' ? '' : (profileData?.name || '')); setNameMessage(''); setEditingName(true); }}
            className="mt-1 min-h-11 rounded-lg px-3 py-2 text-sm font-medium text-stone-700 dark:text-stone-200 underline underline-offset-2 focus-visible:outline focus-visible:outline-2">
            Namen bearbeiten
          </button>
          {editingName && (
            <form className="mt-2 space-y-2" onSubmit={async event => {
              event.preventDefault();
              const value = nameDraft.trim();
              if (!value || value.length > 80) { setNameMessage('Bitte gib einen Namen mit maximal 80 Zeichen ein.'); return; }
              setNameSaving(true);
              setNameMessage('');
              try {
                await updateProfileData({ name: value });
                setEditingName(false);
                setNameMessage('Name gespeichert.');
              } catch (error) {
                melde('Profile/name-update', error);
                setNameMessage('Der Name konnte nicht gespeichert werden. Bitte versuche es erneut.');
              } finally {
                setNameSaving(false);
              }
            }}>
              <label className="block text-sm font-medium" htmlFor="profile-name-edit">Anzeigename</label>
              <input id="profile-name-edit" name="profile-name-edit" type="text" maxLength={80} required autoComplete="nickname"
                value={nameDraft} onChange={event => setNameDraft(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-stone-400 bg-white dark:bg-stone-800 px-3 text-stone-900 dark:text-stone-100" />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={nameSaving} className="min-h-11 rounded-xl bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 px-4 disabled:opacity-50">
                  {nameSaving ? 'Speichere …' : 'Speichern'}
                </button>
                <button type="button" disabled={nameSaving} onClick={() => setEditingName(false)}
                  className="min-h-11 rounded-xl border border-stone-300 px-4">Abbrechen</button>
              </div>
            </form>
          )}
          {nameMessage && <p role="status" aria-live="polite" className="mt-2 text-sm text-stone-700 dark:text-stone-200">{nameMessage}</p>}

        </div>
        {isFocusTimeActive && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full text-xs font-medium border border-stone-200 dark:border-stone-700 shrink-0">
            <Moon size={12} className="text-indigo-500" />
            Fokus-Zeit
          </div>
        )}
      </div>

      {/* ── DREI REITER (14.08.2026) ─────────────────────────────────
          Aus einer Seite mit 26 Abschnitten werden drei Bereiche, die
          zu verschiedenen Anlaessen aufgerufen werden. Der Zustand
          liegt in `reiter`; die Inhalte sind unveraendert, nur
          gruppiert. Siehe klar/27-profilseite-layout. */}
      {/* Am oberen Rand festgehalten: Wer unten in einem Reiter steht,
          musste zum Wechseln erst nach oben scrollen. `-mx-6 px-6` holt den
          Rand des Behaelters zurueck, damit nichts seitlich darunter
          durchscheint; die Hintergrundfarbe deckt den Inhalt ab, der
          darunter wegscrollt. */}
      <div className="sticky top-0 z-10 -mx-6 px-6 pt-1 bg-light-bg dark:bg-dark-bg">
        <Reiterleiste
          name="profil"
          reiter={PROFIL_REITER}
          aktiv={reiter}
          aufWechsel={setReiter}
        />
      </div>
      <div className="space-y-4">
        {reiter === "profil" && (
        <div role="tabpanel" id="profil-profil-inhalt" aria-labelledby="profil-profil" className="space-y-4">
        {/* Import Section */}
        <div className="p-4  from-brand/5 to-brand-light/5 border border-brand/20 rounded-2xl shadow-sm">
          {!showImport ? (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium flex items-center gap-2 text-stone-900 dark:text-stone-100 mb-1">
                  <Wand2 size={16} className="text-brand dark:text-brand-light" />
                  Profil automagisch ausfüllen
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Füge deinen LinkedIn-Text oder Notizen ein.
                </p>
              </div>
              <button
                onClick={() => setShowImport(true)}
                className="px-4 py-2 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-full text-sm font-medium"
              >
                Starten
              </button>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <h3 className="font-medium text-stone-900 dark:text-stone-100 mb-2">Text einfügen</h3>
              <textarea
                id="profil-import-text"
                name="profil-import-text"
                aria-label="Text zum Importieren"
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="z.B. 'Ich bin Softwareentwickler, spiele gerne Gitarre und liebe es zu reisen...'"
                className="w-full h-32 p-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-brand/50 mb-3 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImport(false)}
                  className="flex-1 py-2 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-sm font-medium transition-colors hover:bg-stone-300 dark:hover:bg-stone-700"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || !importText.trim()}
                  className="flex-1 py-2 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                  ) : (
                    <>Importieren <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>


        <div className="mt-8">
          {/* ENTFERNT: ChatResponseTimeWidget — die Reaktionszeiten kamen
              aus `0`. Bei jedem Neuladen ein anderer Verlauf. */}
        </div>
        <div className="mt-4">
          <MoodCalendarGridWidget />
        </div>

        {/* Optimization Section */}
        <div className="p-4  from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-medium flex items-center gap-2 text-stone-900 dark:text-stone-100 mb-1">
                <Sparkles size={16} className="text-indigo-500" />
                Profil optimieren
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Mach dein Profil ansprechender mit KI.
              </p>
            </div>
            <button
              onClick={optimizeProfile}
              disabled={isOptimizing}
              className="px-4 py-2 bg-indigo-500 text-white rounded-full text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {isOptimizing ? (
                <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
              ) : (
                "Optimieren"
              )}
            </button>
          </div>

          {optimizedData && (
            <div className="mt-4 pt-3 border-t border-indigo-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
              <h4 className="text-xs font-medium text-indigo-500 mb-2">Vorgeschlagene Bio:</h4>
              <p className="text-sm text-stone-600 dark:text-stone-400 mb-3 italic bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                "{optimizedData.bio}"
              </p>

              <h4 className="text-xs font-medium text-indigo-500 mb-2">Passende Interests:</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {optimizedData.interests.map(interest => (
                  <span key={interest} className="px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-medium">
                    {interest}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setOptimizedData(null)}
                  className="flex-1 py-2 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-sm font-medium transition-colors hover:bg-stone-300 dark:hover:bg-stone-700"
                >
                  Verwerfen
                </button>
                <button
                  onClick={() => {
                    setUserBio(optimizedData.bio);
                    setUserStorageItem('klar_user_bio', optimizedData.bio);

                    const combined = Array.from(new Set([...userInterests, ...optimizedData.interests])).slice(0, 15);
                    setUserInterests(combined);
                    setUserStorageItem('userInterests', JSON.stringify(combined));

                    const optCount = parseInt(klarStorage.getItem("stats_profile_optimized") || "0", 10);
                    klarStorage.setItem("stats_profile_optimized", (optCount + 1).toString());

                    setOptimizedData(null);
                  }}
                  className="flex-1 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Alles übernehmen
                </button>
              </div>
            </div>
          )}
        </div>

        {userInterests.length > 0 && (
          <div className="p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl shadow-sm">
            <h3 className="font-medium mb-1 text-stone-900 dark:text-stone-100">Deine Interessen</h3>
            <p className="text-xs text-stone-500 mb-3">Tippe auf ein Interesse, um es als 'Must-have' für Verbindungen zu markieren.</p>
            <div className="flex flex-wrap gap-2">
              {userInterests.map(interest => {
                const isMustHave = mustHaveInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    onClick={() => {
                      const newMustHaves = isMustHave
                        ? mustHaveInterests.filter(i => i !== interest)
                        : [...mustHaveInterests, interest];
                      setMustHaveInterests(newMustHaves);
                      klarStorage.setItem("mustHaveInterests", JSON.stringify(newMustHaves));
                      // Determine active radar value based on interest
                      const interestLower = interest.toLowerCase();
                      let mappedValue = null;
                      if (interestLower.includes("reise") || interestLower.includes("abenteuer")) mappedValue = "Abenteuer";
                      else if (interestLower.includes("yoga") || interestLower.includes("meditation") || interestLower.includes("achtsam")) mappedValue = "Achtsamkeit";
                      else if (interestLower.includes("freunde") || interestLower.includes("familie") || interestLower.includes("gemein")) mappedValue = "Gemeinschaft";
                      else if (interestLower.includes("ehrlich") || interestLower.includes("offen")) mappedValue = "Ehrlichkeit";
                      else if (interestLower.includes("humor") || interestLower.includes("lachen")) mappedValue = "Humor";
                      else if (interestLower.includes("kunst") || interestLower.includes("kreativ")) mappedValue = "Kreativität";
                      else if (interestLower.includes("karriere") || interestLower.includes("beruf")) mappedValue = "Karriere";

                      if (mappedValue) {
                        setActiveRadarValue(mappedValue);
                        triggerHaptic('SUCCESS');
                      }

                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      isMustHave
                        ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900 border border-transparent'
                        : 'bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light border border-brand/30 dark:border-brand-light/30'
                    }`}
                  >
                    {interest} {isMustHave && '★'}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                id="profil-neues-interesse"
                name="profil-neues-interesse"
                aria-label="Neues Interesse hinzufügen"
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                placeholder="Neues Interesse hinzufügen..."
                className="flex-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-1.5 text-sm text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-brand/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newInterest.trim()) {
                    const updated = [...userInterests, newInterest.trim()];
                    setUserInterests(updated);
                    setUserStorageItem('userInterests', JSON.stringify(updated));
                    setNewInterest("");
                  }
                }}
              />
              <button aria-label="Interesse hinzufügen"
                onClick={() => {
                  if (newInterest.trim()) {
                    const updated = [...userInterests, newInterest.trim()];
                    setUserInterests(updated);
                    setUserStorageItem('userInterests', JSON.stringify(updated));
                    setNewInterest("");
                  }
                }}
                className="bg-brand dark:bg-brand-light text-white dark:text-stone-900 px-3 py-1.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
              >
                +
              </button>
            </div>

          </div>
        )}

        {/* No-Gos */}
        <div className="p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl shadow-sm">
          <h3 className="font-medium mb-1 text-stone-900 dark:text-stone-100">Meine No-Gos</h3>
          <p className="text-xs text-stone-500 mb-3">Schließe Persönlichkeitsmerkmale oder Interessen aus, die der Deep-Verbindung Algorithmus priorisiert ignorieren soll.</p>
          <div className="flex flex-wrap gap-2">
            {userNoGos.map((nogo, idx) => (
              <div key={idx} className="px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-full text-xs flex items-center gap-1">
                {nogo}
                <button aria-label="No-Go entfernen" onClick={() => {
                  const newArr = userNoGos.filter((_, i) => i !== idx);
                  setUserNoGos(newArr);
                  klarStorage.setItem("userNoGos", JSON.stringify(newArr));
                }} className="ml-1 text-rose-400 hover:text-rose-600">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              id="profil-neues-nogo"
              name="profil-neues-nogo"
              aria-label="No-Go hinzufügen"
              type="text"
              value={newNoGo}
              onChange={(e) => setNewNoGo(e.target.value)}
              placeholder="No-Go hinzufügen (z.B. Raucher)"
              className="flex-1 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-1.5 text-sm text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newNoGo.trim()) {
                  const newArr = [...userNoGos, newNoGo.trim()];
                  setUserNoGos(newArr);
                  klarStorage.setItem("userNoGos", JSON.stringify(newArr));
                  setNewNoGo("");
                }
              }}
            />
            <button aria-label="No-Go hinzufügen"
              onClick={() => {
                if (newNoGo.trim()) {
                  const newArr = [...userNoGos, newNoGo.trim()];
                  setUserNoGos(newArr);
                  klarStorage.setItem("userNoGos", JSON.stringify(newArr));
                  setNewNoGo("");
                }
              }}
              disabled={!newNoGo.trim()}
              className="bg-rose-600 dark:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              +
            </button>
          </div>
          {nogoSuggestions.length === 0 ? (
            <button
              onClick={fetchNogoSuggestions}
              disabled={isLoadingNogoSuggestions}
              className="mt-3 text-xs flex items-center gap-1 text-brand dark:text-brand-light font-medium"
            >
              <Sparkles size={12} className={isLoadingNogoSuggestions ? "" : ""} />
              {isLoadingNogoSuggestions ? "Analysiere Journal..." : "KI-Vorschläge basierend auf Erfahrungen"}
            </button>
          ) : (
            <div className="mt-3">
              <p className="text-xs text-stone-500 mb-2 flex items-center gap-1"><Sparkles size={12}/> KI-Vorschläge (aus Journal & Chat):</p>
              <div className="flex gap-2 flex-wrap">
                {nogoSuggestions.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (!userNoGos.includes(sug)) {
                        const newArr = [...userNoGos, sug];
                        setUserNoGos(newArr);
                        klarStorage.setItem("userNoGos", JSON.stringify(newArr));
                      }
                      setNogoSuggestions(nogoSuggestions.filter(s => s !== sug));
                    }}
                    className="text-[10px] px-2 py-1 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-lg hover:bg-stone-200"
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-stone-900 dark:text-stone-100">Über mich</h3>
            <div className="flex gap-2">
              {bioHistory.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${showHistory ? 'bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'}`}
                >
                  <History size={14} />
                  Verlauf
                </button>
              )}

              <button
                onClick={checkBio}
                disabled={isCheckingBio || !userBio.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg shadow-sm hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
                title="Profil-Check durch KI-Coach"
              >
                {isCheckingBio ? <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span> : <ShieldCheck size={14} />}
                <span className="text-xs font-medium">Bio-Check</span>
              </button>

              <button
                onClick={optimizeBioValues}
                disabled={isOptimizingValues || !userBio.trim() || userValuesRadar.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                title="Bio basierend auf Werten optimieren"
              >
                {isOptimizingValues ? <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span> : <Sparkles size={14} />}
                <span className="text-xs font-medium">Werte-Boost</span>
              </button>
              <button
                onClick={generateBio}

                disabled={isGeneratingBio}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-lg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                title="Auto-Bio generieren"
              >
                {isGeneratingBio ? <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span> : <Wand2 size={14} />}
                <span className="text-xs font-medium">Auto-Bio</span>
              </button>
            </div>
          </div>
          {isEditingBio ? (
            <div className="mb-2 space-y-2">
              <textarea
                id="profil-bio"
                name="profil-bio"
                aria-label="Über mich"
                value={userBio}
                onChange={(e) => setUserBio(e.target.value)}
                className="w-full min-h-[100px] p-3 text-sm bg-stone-50 dark:bg-stone-800 border border-brand/30 dark:border-brand-light/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 resize-none text-stone-700 dark:text-stone-300"
              />
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setUserStorageItem('klar_user_bio', userBio);
                    if (updateProfileData) updateProfileData({ bio: userBio }).catch((e) => melde('Profile/updateProfileData', e));
                    setIsEditingBio(false);
                  }}
                  className="px-4 py-1.5 bg-brand dark:bg-brand-light text-white dark:text-stone-900 text-xs font-semibold rounded-lg hover:opacity-90"
                >
                  Speichern
                </button>
              </div>
            </div>
          ) : (
            <p role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsEditingBio(true); }} className="text-sm text-stone-600 dark:text-stone-400 mb-2 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 p-2 -mx-2 rounded-lg transition-colors" onClick={() => setIsEditingBio(true)} title="Klicken zum Bearbeiten">
              {userBio}
              <span className="inline-block ml-2 text-stone-400 opacity-50"><Edit size={12} className="inline" /></span>
            </p>
          )}

          {showHistory && bioHistory.length > 0 && (
            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-700 animate-in fade-in slide-in-from-top-2 duration-300">
              <h4 className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-3 uppercase tracking-wider">Vorherige Versionen</h4>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {bioHistory.map((item, idx) => {
                  const date = new Date(item.timestamp);
                  const formattedDate = date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                  <div key={idx} className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400">{formattedDate}</span>
                    </div>
                    <p className="text-sm text-stone-700 dark:text-stone-300 mb-3">{item.text}</p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setUserBio(item.text);
                          setUserStorageItem('klar_user_bio', item.text);
                          if (updateProfileData) {
                            updateProfileData({ bio: item.text }).catch((e) => melde('Profile/updateProfileData', e));
                          }
                          setShowHistory(false);
                          setSuggestedBio("");
                        }}
                        className="text-xs font-medium text-brand dark:text-brand-light hover:opacity-80 transition-opacity flex items-center gap-1"
                      >
                        <RefreshCw size={12} />
                        Wiederherstellen
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}



          {valueBioSuggestions.length > 0 && (
            <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-xl space-y-2">
              <h4 className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1 mb-2">
                <Sparkles size={12} /> Werte-Optimierung
              </h4>
              {valueBioSuggestions.map((sug, idx) => (
                <div key={idx} className="bg-white dark:bg-stone-800 p-2 rounded-lg text-[10px] text-stone-700 dark:text-stone-300 shadow-sm border border-stone-100 dark:border-stone-700">
                  {sug}
                </div>
              ))}
              <button onClick={() => setValueBioSuggestions([])} className="text-[10px] text-stone-500 underline mt-1">Schließen</button>
            </div>
          )}
          {bioFeedback && (

            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-700 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-3 bg-brand/5 dark:bg-brand-light/5 p-4 rounded-xl border border-brand/20 dark:border-brand-light/20">
                <div className="p-2 bg-brand/10 dark:bg-brand-light/10 rounded-full shrink-0 text-brand dark:text-brand-light mt-0.5">
                  <ShieldCheck size={16} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-brand dark:text-brand-light mb-1">KI-Coach Feedback</h4>
                  <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">{bioFeedback}</p>
                </div>
                <button aria-label="Rückmeldung schließen" onClick={() => setBioFeedback("")} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {suggestedBio && (
            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-700 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand dark:text-brand-light" />
                  <span className="text-xs font-medium text-brand dark:text-brand-light">Auto-Bio Preview</span>
                </div>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showPreview ? "Preview ausblenden" : "Preview anzeigen"}
                </button>
              </div>

              {showPreview ? (
                <div className="mb-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-sm">
                  <div className="h-32 bg-stone-200 dark:bg-stone-800 w-full relative">
                    <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=400&h=300" alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0  from-black/60 to-transparent"></div>
                    <div className="absolute bottom-3 left-4 text-white">
                      <h4 className="font-semibold text-lg drop-shadow-md">Du, 29</h4>
                      <p className="text-xs opacity-90 drop-shadow-md">{profileData?.location || 'Ort noch nicht angegeben'}</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-stone-800 dark:text-stone-200">
                      {suggestedBio}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-3 italic bg-brand/5 dark:bg-brand-light/5 p-3 rounded-xl border border-brand/10">"{suggestedBio}"</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSuggestedBio("");
                    setShowPreview(false);
                  }}
                  className="flex-1 py-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-xl text-xs font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  Verwerfen
                </button>
                <button
                  onClick={() => {
                    setUserBio(suggestedBio);
                    setUserStorageItem('klar_user_bio', suggestedBio);
                    if (updateProfileData) {
                      updateProfileData({ bio: suggestedBio }).catch((e) => melde('Profile/updateProfileData', e));
                    }
                    setSuggestedBio("");
                    setShowPreview(false);
                  }}
                  className="flex-1 py-2 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Icebreakers Section */}
        <div className="p-4 bg-white dark:bg-stone-800 border border-brand/30 dark:border-brand-light/30 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 dark:bg-brand-light/5 rounded-full blur-3xl -mr-16 -mt-16"></div>

          <div className="flex items-start justify-between mb-4 relative z-10">
            <div>
              <h3 className="font-medium flex items-center gap-2 text-stone-900 dark:text-stone-100 mb-1">
                <Sparkles size={16} className="text-brand dark:text-brand-light" />
                Deine Icebreaker
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Fragen, die Verbindungen auf deinem Profil sehen.
              </p>
            </div>

            <button
              onClick={generateIcebreakers}
              disabled={isGenerating}
              className="p-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
              title="Neu generieren"
            >
              <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
            </button>
          </div>

          <div className="space-y-2 relative z-10">
            {icebreakers.length > 0 ? (
              icebreakers.map((ib, idx) => (
                <div key={idx} className="p-3 bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 rounded-xl text-sm text-stone-700 dark:text-stone-300 flex items-start gap-3">
                  <MessageCircle size={16} className="text-stone-400 shrink-0 mt-0.5" />
                  <span>{ib}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-stone-500 mb-4">Noch keine Icebreaker generiert.</p>
                <button
                  onClick={generateIcebreakers}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-full text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Sparkles size={16} />
                  {isGenerating ? "Generiere..." : "Jetzt mit KI erstellen"}
                </button>
              </div>
            )}
          </div>
        </div>

        {userValuesRadar.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 dark:text-stone-100">Werte-Radar</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Deine Deep-Verbindung Ausrichtung</p>
              </div>
            </div>
            {/* BEFUND 12.08.2026 — endlich zugeordnet:
                Die Warnung „The width(0) and height(0) of chart should be
                greater than 0" verfolgt uns seit Tagen ohne Fundort. Sie
                kommt von HIER. Der Behaelter startete mit `scale: 0`; im
                ersten Bild misst `ResponsiveContainer` deshalb 0 x 0 und
                recharts beschwert sich. `h-64 w-full` half nicht — die
                Transformation verkleinert die gemessene Box trotzdem.
                Jetzt startet die Animation bei 0.98 statt 0. Sichtbar ist
                das kaum; die Warnung ist weg. */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, type: "spring", bounce: 0.4 }}
              id="werte-radar-container" className="h-64 w-full relative"
            >
                            <AnimatePresence>
                {showRadarTutorial && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-stone-900/60  rounded-3xl"
                  >
                    <div className="bg-white dark:bg-stone-800 p-5 rounded-2xl shadow-md max-w-sm w-full text-center relative">
                      <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Sparkles size={24} />
                      </div>
                      <h4 className="font-bold text-stone-900 dark:text-stone-100 mb-2">Dein Deep-Verbindung Radar</h4>
                      <p className="text-sm text-stone-600 dark:text-stone-300 mb-5">
                        Tippe auf die einzelnen Werte-Achsen (z.B. "Abenteuer"), um detaillierte Erklärungen und potenzielle Gemeinsamkeiten mit Verbindungen zu sehen.
                      </p>
                      <button
                        onClick={dismissRadarTutorial}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors"
                      >
                        Verstanden
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={userValuesRadar}>
                  <PolarGrid stroke="#e7e5e4" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={(props) => {
                      const { payload, x, y, textAnchor } = props;
                      const isActive = activeRadarValue === payload.value;
                      // Determine specific color for active axis
                      let tickColor = isActive ? '#a855f7' : '#78716c';
                      if (isActive && showCompareRadar) {
                         tickColor = '#d946ef'; // Fuchsia when active in compare mode
                      }

                      return (
                        <motion.g
                          className="recharts-layer recharts-polar-angle-axis-tick"
                          whileTap={{ scale: 1.15 }}
                        >
                          <text
                            x={x}
                            y={y}
                            textAnchor={textAnchor}
                            fill={tickColor}
                            fontSize={isActive ? 12 : 10}
                            fontWeight={isActive ? "bold" : "normal"}
                            onClick={() => {
                              triggerHaptic('LIGHT_TAP');
                              setActiveRadarValue(isActive ? null : payload.value);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <title>{VALUE_EXPLANATIONS[payload.value] || payload.value}</title>
                            <tspan x={x} dy="0em">{payload.value}</tspan>
                          </text>
                        </motion.g>
                      );
                    }}
                  />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <RechartsTooltip content={<CustomRadarTooltip />} />
                  <Radar name="Deine Werte" dataKey="A" stroke={activeRadarValue ? "#d946ef" : radarColorA} fill={activeRadarValue ? "#d946ef" : radarColorA} fillOpacity={0.4} />
                  {showCompareRadar && (
                    <Radar name="Verbindung Werte" dataKey="B" stroke={radarColorB} fill={radarColorB} fillOpacity={0.4} />
                  )}
                </RadarChart>
              </ResponsiveContainer>
            </motion.div>


            <div className="flex justify-between items-center mt-2 mb-4">
              <button
                onClick={() => setShowRadarSettings(!showRadarSettings)}
                className="text-xs flex items-center gap-1 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
              >
                <Settings size={14} /> Farben anpassen
              </button>
              <button
                onClick={downloadRadarImage}
                className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 font-medium"
              >
                <Download size={14} /> Als Bild exportieren
              </button>
            </div>

            <AnimatePresence>
              {showRadarSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl overflow-hidden"
                >
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label htmlFor="radar-farbe-a" className="text-xs font-medium text-stone-600 dark:text-stone-400 block mb-1">Dein Profil</label>
                      <input id="radar-farbe-a" name="radar-farbe-a" type="color" value={radarColorA} onChange={(e) => setRadarColorA(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="radar-farbe-b" className="text-xs font-medium text-stone-600 dark:text-stone-400 block mb-1">Verbindung Profil</label>
                      <input id="radar-farbe-b" name="radar-farbe-b" type="color" value={radarColorB} onChange={(e) => setRadarColorB(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Compare Toggle */}
            <div className="flex justify-between items-center mt-4 p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Mit Verbindung vergleichen</span>
              <button role="switch" aria-checked={showCompareRadar} aria-label="Mit Verbindung vergleichen"
                onClick={() => setShowCompareRadar(!showCompareRadar)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showCompareRadar ? 'bg-amber-500' : 'bg-stone-200 dark:bg-stone-700'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showCompareRadar ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>


            {/* Filter Chips */}
            {showCompareRadar && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => { triggerHaptic('LIGHT_TAP'); setMatchFilter('all'); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${matchFilter === 'all' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'}`}
                >
                  Alle
                </button>
                <button
                  onClick={() => { triggerHaptic('LIGHT_TAP'); setMatchFilter('similarities'); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${matchFilter === 'similarities' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'}`}
                >
                  Ähnlichkeiten
                </button>
                <button
                  onClick={() => { triggerHaptic('LIGHT_TAP'); setMatchFilter('complements'); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${matchFilter === 'complements' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'}`}
                >
                  Ergänzungen
                </button>
                <button
                  onClick={() => { triggerHaptic('LIGHT_TAP'); setMatchFilter('contrasts'); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${matchFilter === 'contrasts' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'}`}
                >
                  Kontraste
                </button>
              </div>
            )}

            {/* Deep Verbindung & Tooltip Details */}

            {/* Global Deep Verbindung List */}
            <AnimatePresence>
              {!activeRadarValue && showCompareRadar && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
                    <h4 className="font-semibold text-stone-800 dark:text-stone-200 mb-3">Deep Verbindung Übersicht</h4>
                    <ul className="flex flex-col gap-3">
                      {(matchFilter === 'all' || matchFilter === 'similarities') && (
                        <li className="flex gap-3 items-start bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                          <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-0.5">Ähnlichkeit (Achtsamkeit)</span>
                            <span className="text-xs text-stone-600 dark:text-stone-400">Ihr teilt eine hohe Ausprägung bei Achtsamkeit. Gute Basis für tiefgründige Gespräche.</span>
                          </div>
                        </li>
                      )}
                      {(matchFilter === 'all' || matchFilter === 'complements') && (
                        <li className="flex gap-3 items-start bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30">
                          <Sparkles size={16} className="text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 block mb-0.5">Ergänzung (Abenteuer)</span>
                            <span className="text-xs text-stone-600 dark:text-stone-400">Du bist eher ruhig, dein Verbindung bringt Abenteuerlust ein. Das kann euch beide bereichern.</span>
                          </div>
                        </li>
                      )}
                      {(matchFilter === 'all' || matchFilter === 'contrasts') && (
                        <li className="flex gap-3 items-start bg-rose-50 dark:bg-rose-900/10 p-3 rounded-lg border border-rose-100 dark:border-rose-800/30">
                          <Zap size={16} className="text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block mb-0.5">Kontrast (Karriere)</span>
                            <span className="text-xs text-stone-600 dark:text-stone-400">Sehr unterschiedliche Fokus-Bereiche bei Karriere. Offene Kommunikation ist hier wichtig.</span>
                          </div>
                        </li>
                      )}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {activeRadarValue && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded-xl">
                    <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-1 flex items-center gap-2">
                      <Sparkles size={16} /> {activeRadarValue}
                    </h4>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mb-3">
                      {VALUE_EXPLANATIONS[activeRadarValue]}
                    </p>

                    {showCompareRadar && DEEP_MATCH_INSIGHTS[activeRadarValue] && (
                      <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800/30">
                        <h5 className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">Deep Verbindung Gemeinsamkeiten:</h5>
                        <ul className="flex flex-col gap-1.5">
                          {DEEP_MATCH_INSIGHTS[activeRadarValue].map((insight, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-stone-600 dark:text-stone-400">
                              <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}

        <SmartAuditWidget
          bio={userBio}
          values={userValuesRadar}
          // ENTFERNT 12.08.2026: Hier stand fest verdrahtet
          // profileImageUrl="https://images.unsplash.com/photo-1535713875002-...".
          // Zwei Gruende:
          // 1. Das ist ein Stockfoto einer fremden Person. Der "Smart-Audit"
          //    hat also nicht das Profilbild der lesenden Person bewertet,
          //    sondern ein beliebiges Bild aus dem Netz.
          // 2. pruefeBildUrl (SEC-03) laesst nur Firebase Storage und
          //    Google-Profilbilder zu. Der Server antwortete deshalb mit
          //    400 "Diese Herkunft ist nicht freigegeben." - seit dem
          //    08.08. bei JEDEM Audit. Vorher fiel das nicht auf, weil die
          //    Fehlerantwort als Ergebnis angezeigt wurde ("undefined / 10").
          // Das Audit laeuft jetzt ohne Bild, also auf Bio und Werten.
          // Sobald es ein echtes Profilbild aus Firebase Storage gibt,
          // gehoert dessen Adresse hierher.
          onAuditComplete={setAuditScore}
        />

        <div className="mb-6">
          <ProfileCheckWidget />
        </div>
        <div className="mb-6">
          {/* ENTFERNT: ReflectionRadarWidget — die Stimmungswerte kamen
              aus `0`. */}
          {/* ENTFERNT: ConversationHealthWidget — im Quelltext standen
              `healthScore = 85`, `longMessages = 24`, `emojiOnly = 3` als
              Konstanten, angezeigt unter „So kommunizierst du diese Woche"
              mit dem Etikett „Sehr Gut". Die Zahlen aenderten sich nie,
              fuer niemanden. */}
          <ProfileCardThemeSelector />
        </div>
        </div>
        )}


        {reiter === "entwicklung" && (
        <div role="tabpanel" id="profil-entwicklung-inhalt" aria-labelledby="profil-entwicklung" className="space-y-4">
        {/* ── EINLEITUNG STATT LEERER RASTER (14.08.2026) ──────────────────
            Karten ohne Daten blenden sich seit heute selbst aus (siehe
            MoodCalendarGridWidget und DatingVibeChartWidget). Damit dieser
            Reiter bei einem frischen Konto nicht einfach leer ist, steht
            hier ein Satz, der in BEIDEN Faellen stimmt — mit und ohne Daten.
            Eine Meldung, die nur den leeren Fall beschreibt, muesste wissen,
            ob die Kinder etwas gerendert haben; das weiss der Elternteil in
            React nicht. */}
        <p className="text-sm text-stone-500 dark:text-stone-400 px-1">
          Hier siehst du, wie sich dein Dating-Alltag entwickelt. Auswertungen
          erscheinen von selbst, sobald es etwas auszuwerten gibt.
        </p>
        <div className="mb-6">
          <DatingMoodTrackerWidget />
          <div className="mt-6">
            <div className="mt-4">
            </div>
          </div>

        </div>

        {/* ENTFERNT: DatingProgressChartWidget — Interaktion und
            Kompatibilitaet kamen aus `0`. */}
        <InsightsChart />

        <Meilensteine />
        {/* ENTFERNT: DatingActivityDashboardWidget — eine feste
            4-Wochen-Tabelle im Quelltext, angezeigt als „Dating-Aktivitaet
            (30 Tage)". */}

        <PDFResumeGenerator userBio={userBio} userInterests={userInterests} />
        </div>
        )}

        {reiter === "partner" && (
          <div role="tabpanel" id="profil-partner-inhalt" aria-labelledby="profil-partner" className="space-y-4">
            <PartnerReferralWidget />
          </div>
        )}

        {reiter === "einstellungen" && (
        <div role="tabpanel" id="profil-einstellungen-inhalt" aria-labelledby="profil-einstellungen" className="space-y-4">
        <nav aria-label="Einstellungskategorien" className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200 dark:border-stone-700 p-2">
          {([['privacy', 'Sicherheit & Datenschutz'], ['preferences', 'Präferenzen & Hinweise'], ['advanced', 'Erweitert & Konto']] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={settingsCategory === id} onClick={() => setSettingsCategory(id)}
              className={`min-h-11 rounded-xl px-3 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:focus-visible:outline-stone-100 ${settingsCategory === id ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900' : 'text-stone-800 dark:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-800'}`}>
              {label}
            </button>
          ))}
        </nav>
        <div className={settingsCategory === 'privacy' ? 'space-y-4' : 'hidden'}>
        <ConsentSettings />
        </div>
        <div className={settingsCategory === 'preferences' ? 'space-y-4' : 'hidden'}>
        {/* Aus dem Kopf hierher: eine Diagnoseanzeige gehoert zu den
            Einstellungen, nicht ueber das Profilbild. */}
        <div className="flex justify-center"><OfflineCacheStatus /></div>
        <div className="mb-6">


          <SmartPause />
          {/* ENTFERNT 11.08.2026 — <ThemeSettingsWidget />.
              Dritte Hell/Dunkel/System-Wahl auf derselben Seite, und die
              dritte, die nach `klarStorage['theme']` schrieb statt nach
              `klar_theme`. Sie war damit ohne dauerhafte Wirkung und
              konnte einen anderen Zustand anzeigen als die beiden
              anderen. Geblieben sind die Systemleiste oben (schneller
              Wechsel) und "Einstellungen -> Erscheinungsbild" weiter
              unten (vollstaendige Wahl, ueber useTheme).
              Die Datei src/components/ThemeSettingsWidget.tsx wird damit
              von niemandem mehr benutzt und ist zu loeschen. */}
          {/* <HapticSettings /> ist am 14.08.2026 nach unten in den
              Abschnitt "Einstellungen" gewandert — siehe Begruendung dort.
              <SmartPauseWidget /> stand hier ein zweites Mal; beide Karten
              sind jetzt eine einzige <SmartPause />, die weiter oben steht. */}
          <FocusTimeSettingsWidget />
        <FeedbackFormWidget />
        </div>


        </div>
        <div className={settingsCategory === 'advanced' ? 'space-y-4' : 'hidden'}>
        {/* ── KLAR+ 14.08.2026 ─────────────────────────────────────────
            Vorher standen hier 75 Zeilen Vergleichstabelle (acht Zeilen mal
            drei Spalten, rund 600 px) zwischen der Fokuszeit und der
            Erscheinungsbild-Wahl — und darunter ein Knopf „Klar+ entdecken"
            ohne `onClick`.

            Jetzt: eine Zeile, die dauerhaft auffindbar ist, und die Seite
            `/klar-plus` fuer alles Weitere. Begruendung in klar/27,
            Abschnitt 9b: Ein Verkaufsangebot in der Mitte der Einstellungen
            ist die Bauform der Apps, gegen die Klar antritt.

            Die Zeile nennt den aktuellen Plan zuerst und das Angebot danach.
            Wer nur wissen will, was er hat, muss nichts anklicken. */}
        <Link
          to="/klar-plus"
          className="w-full mt-4 p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl shadow-sm flex items-center gap-3 min-h-[44px]"
        >
          <Zap size={18} className="text-brand dark:text-brand-light shrink-0" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-sm font-medium text-stone-900 dark:text-stone-100">
              Aktueller Plan: Klar
            </span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">
              Was Klar+ anders macht ansehen
            </span>
          </span>
          <ChevronRight size={18} className="text-stone-400 shrink-0" aria-hidden="true" />
        </Link>

        </div>
        <div className="w-full mt-4 p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl shadow-sm">

          <h3 className="font-medium text-stone-900 dark:text-stone-100 mb-4">Einstellungen</h3>

          <div className="mb-6">
            {/* ── Epic 3: Spracheinstellungen ──────────────────────────────── */}

            {/* Privacy Visibility Settings */}
            <div className={settingsCategory === 'privacy' ? 'mt-6' : 'hidden'}>
              <h4 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3 flex items-center gap-2">
                <ShieldCheck size={18} className="text-stone-500" />
                Datenschutz & Sichtbarkeit
              </h4>
              <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4 border border-stone-200 dark:border-stone-700">
                <p className="text-xs text-stone-500 mb-4">Lege fest, welche Profilinformationen für andere Nutzer sichtbar sind.</p>
                <div className="space-y-3">
                  {[
                    { id: 'showAge', label: 'Alter anzeigen' },
                    { id: 'showLocation', label: 'Standort anzeigen' },
                    { id: 'showInterests', label: 'Interessen anzeigen' },
                    { id: 'showBio', label: 'Bio anzeigen' }
                  ].map(setting => {
                    const isChecked = profileData?.visibilitySettings?.[setting.id] ?? true;
                    return (
                      <div key={setting.id} className="flex items-center justify-between">
                        <span className="text-sm text-stone-700 dark:text-stone-300">{setting.label}</span>
                        <button
                          aria-label={setting.label}
                          role="switch"
                          aria-checked={isChecked}
                          onClick={() => {
                            const newSettings = { ...profileData?.visibilitySettings, [setting.id]: !isChecked };
                            updateProfileData({ visibilitySettings: newSettings }).catch((e) => melde('Profile/updateProfileData', e));
                          }}
                          className={`w-10 h-6 rounded-full transition-colors relative ${isChecked ? 'bg-brand dark:bg-brand-light' : 'bg-stone-300 dark:bg-stone-600'}`}
                        >
                          <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${isChecked ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className={settingsCategory === 'preferences' ? 'space-y-4' : 'hidden'}>
            <h4 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3 flex items-center gap-2">
              <Languages size={18} className="text-stone-500" />
              Meine Chat-Sprache
            </h4>
            <div className="mb-6 flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
              {['de', 'en', 'es', 'fr'].map(lang => {
                const isActive = profileData?.preferredLanguage === lang || (!profileData?.preferredLanguage && lang === 'de');
                return (
                  <button
                    key={lang}
                    onClick={() => updateProfileData({ preferredLanguage: lang }).catch((e) => melde('Profile/updateProfileData', e))}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-colors ${isActive ? 'bg-white dark:bg-stone-700 text-brand shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'}`}
                  >
                    {lang.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <h4 className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-3 flex items-center gap-2">
              <Sun size={18} className="text-stone-500" />
              Erscheinungsbild
            </h4>
            <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-colors ${theme === 'light' ? 'bg-white dark:bg-stone-700 text-brand shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'}`}
              >
                <Sun size={14} />
                Hell
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-colors ${theme === 'dark' ? 'bg-white dark:bg-stone-700 text-brand shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'}`}
              >
                <Moon size={14} />
                Dunkel
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-colors ${theme === 'system' ? 'bg-white dark:bg-stone-700 text-brand shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'}`}
              >
                <Monitor size={14} />
                System
              </button>
            </div>
          </div>


          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BellRing size={20} className="text-stone-500 dark:text-stone-400" />
              <div>
                <span className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                  Smart Verbindung Benachrichtigungen
                </span>
                <span className="block text-xs text-stone-500 dark:text-stone-400">
                  Push-Alerts nur für Verbindungen über 90%
                </span>
              </div>
            </div>

            <button role="switch" aria-checked={smartMatchAlerts} aria-label="Smart-Verbindung-Hinweise"
              onClick={() => {
                const newValue = !smartMatchAlerts;
                setSmartMatchAlerts(newValue);
                saveSmartMatchSettings(undefined, newValue);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${smartMatchAlerts ? 'bg-brand dark:bg-brand-light' : 'bg-stone-200 dark:bg-stone-700'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  smartMatchAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>







          <RitualReminderSetting />

          {/* ── BEFUND 14.08.2026: HAPTIK STAND ZWEIMAL AUF DIESER SEITE ──
              Hier war eine ZWEITE, in Profile.tsx selbst gebaute Bedienung
              (Aus / Sanft / Stark), waehrend weiter oben bereits
              <HapticSettings /> stand. Beide schrieben denselben Schluessel
              `klar_haptic_intensity`, hielten den Wert aber in GETRENNTEN
              React-Zustaenden: Wer oben "Stark" waehlte, sah unten den alten
              Wert — bis zum Neuladen. Zwei Bedienelemente fuer eine
              Einstellung, die sich widersprechen koennen.

              Geblieben ist <HapticSettings />, weil es die vollstaendigere
              ist: Schalter, Muster UND Staerke, und es schreibt auch
              `klar_haptic_enabled`. Es steht jetzt HIER, unter
              "Einstellungen", statt mitten auf der Seite — das ist zugleich
              der erste Schritt zum Reiter "Einstellungen"
              (klar/27-profilseite-layout). */}
          <div className="mb-6">
            <HapticSettings />
          </div>

          </div>
          <div className={settingsCategory === 'advanced' ? 'mt-8 pt-6 border-t border-stone-200 dark:border-stone-700' : 'hidden'}>
            <h4 className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-4">{t('profileSafety.title')}</h4>

            {/* GEGENPRÜFUNG 09.08.2026: Diese beiden Schaltflächen hatten
                kein `onClick` — genau der Befund DSG-02 („Datenschutz-
                erklärung/AGB unerreichbar"). Der Commit davor legte die
                Seiten an, verlinkte sie aber nur aus dem Einwilligungs-
                dialog. Aus der laufenden App gab es weiterhin keinen Weg
                dorthin. Jetzt echte Verweise. */}
            <a href="/rechtstexte/datenschutz" className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl transition-colors mb-2">
              <span className="text-sm text-stone-700 dark:text-stone-300">{t('profileSafety.privacyPolicy')}</span>
              <ChevronRight size={18} className="text-stone-400" />
            </a>
            <button onClick={() => { triggerHaptic('MEDIUM_TAP'); exportUserDataAsJSON().catch(e => alert(t('profileSafety.exportFailed', { error: e instanceof Error ? e.message : 'Unbekannter Fehler' }))); }} className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl transition-colors mb-2">
              <span className="text-sm text-stone-700 dark:text-stone-300">{t('profileSafety.exportData')}</span>
              <Download size={18} className="text-stone-400" />
            </button>
            <a href="/rechtstexte/agb" className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl transition-colors mb-2">
              <span className="text-sm text-stone-700 dark:text-stone-300">{t('profileSafety.terms')}</span>
              <ChevronRight size={18} className="text-stone-400" />
            </a>

            <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl mb-2">
              <span className="text-sm text-stone-700 dark:text-stone-300">{t('profileSafety.appVersion')}</span>
              <span className="text-sm font-medium text-stone-500">0.1.0 (Alpha)</span>
            </div>

            {/* P1: § 312k und § 356a — unmittelbar erreichbar, ohne
                Zwischenschritte. */}
            <AboVerwaltung />

            {/* P1: Verifizierung — ohne sie lehnt jede Regel jeden Kontakt ab. */}
            <div className="mt-4 p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                  {t('profileSafety.verificationLevel')}
                </span>
                {profileData?.isVerified ? (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-brand/10 text-brand border-brand/20 dark:bg-brand-light/10 dark:text-brand-light dark:border-brand-light/20 flex items-center gap-1.5">
                    <ShieldCheck size={14} /> Verified
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-700 dark:text-stone-400 dark:border-stone-600">
                    Basic
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
                {profileData?.isVerified ? t('profileSafety.verifiedDescription') : t('profileSafety.basicDescription')}
              </p>

              <div className="flex gap-2">
                <Link
                  to="/verifizierung"
                  className="flex-1 flex items-center justify-between p-3 bg-stone-50 hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-lg transition-colors"
                >
                  <span className="text-sm text-stone-700 dark:text-stone-300">
                    {profileData?.isVerified ? t('profileSafety.viewVerification') : t('profileSafety.verifyNow')}
                  </span>
                  <ChevronRight size={18} className="text-stone-400" />
                </Link>
                <button
                  type="button"
                  onClick={() => setShowBiometricsModal(true)}
                  className="px-3 py-2 text-xs font-medium border border-line-ui rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors"
                  aria-label={t('kyc.refresh')}
                >
                  {t('kyc.refresh')}
                </button>
              </div>
            </div>

            <BiometricsVerificationModal
              isOpen={showBiometricsModal}
              onSuccess={() => {
                setShowBiometricsModal(false);
                void refreshProfile();
              }}
              onCancel={() => setShowBiometricsModal(false)}
            />


            <button
              id="btn-reset-app-data"
              onClick={() => {
                if (window.confirm(t('profileSafety.resetConfirm'))) {
                  const uid = auth.currentUser?.uid;
                  if (uid) clearUserStorageForUid(uid);
                  clearSessionStorageForApp();
                  window.location.reload();
                }
              }}
              className="w-full flex items-center justify-between p-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl transition-colors mt-2 text-stone-700 dark:text-stone-300"
            >
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-stone-400" />
                <span className="text-sm">{t('profileSafety.resetAppData')}</span>
              </div>
              <span className="text-xs text-stone-400">{t('profileSafety.clearStorage')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full min-h-11 flex items-center justify-between p-3 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors mt-2"
            >
              <span className="text-sm font-medium">Abmelden</span>
              <LogOut size={18} aria-hidden="true" />
            </button>

            {showLogoutConfirm ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
                <div
                  ref={logoutDialogRef}
                  onKeyDown={onLogoutKeyDown}
                  tabIndex={-1}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={logoutTitleId}
                  className="w-full max-w-md rounded-2xl bg-white dark:bg-stone-800 p-6 shadow-xl"
                >
                  <h3 id={logoutTitleId} className="text-xl font-semibold text-stone-900 dark:text-white">Abmelden?</h3>
                  <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                    Deine lokale Sitzung und nutzerbezogenen App-Daten werden bereinigt. Serverseitig werden bestehende Sitzungserneuerungen ebenfalls ungültig.
                  </p>
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 min-h-11 rounded-lg border border-stone-200 dark:border-stone-600 px-4 py-2 font-medium text-stone-700 dark:text-stone-200"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => { void logOut().finally(() => setShowLogoutConfirm(false)); }}
                      className="flex-1 min-h-11 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
                    >
                      Abmelden
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full flex items-center justify-between p-3 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-colors mt-4 disabled:opacity-60"
            >
              <span className="text-sm font-medium">
                {deleting ? t('profileSafety.deleting') : showDeleteConfirm ? t('profileSafety.confirmDelete') : t('profileSafety.deleteAccount')}
              </span>
              <Trash2 size={18} />
            </button>

            {showDeleteConfirm ? (
              <div className="mt-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                {/* P0-6: Die Zusage nennt genau das, was der Server tut —
                    einschliesslich dessen, was aus gesetzlichen Gruenden
                    bleibt (Art. 17 Abs. 3 lit. b DSGVO, § 147 AO). */}
                <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                  {t('profileSafety.deletionDeletes')}
                </p>
                <p className="text-xs text-amber-700/80 dark:text-red-300/80">
                  {t('profileSafety.deletionRetains')}
                </p>
                {deleteError ? (
                  <p role="alert" className="mt-3 text-xs text-red-700 dark:text-red-300">{deleteError}</p>
                ) : null}
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="mt-3 text-xs text-stone-600 dark:text-stone-400 underline"
                >
                  {t('actions.cancel')}
                </button>
              </div>
            ) : null}

          </div>
        </div>
        </div>
        )}
    </div>
    </div>
    </>

  );
};

