import { Skeleton } from "../components/States";
import { getUserStorageItem, setUserStorageItem, klarStorage } from '../lib/userScopedStorage';
import { useUsageAnalytics } from "../lib/useUsageAnalytics";
import { LocalLaunchWidget } from "../components/LocalLaunchWidget";
// FE-05: haengt Widgets erst ein, wenn sie in Sichtnaehe kommen.
import { BeiSicht } from "../components/BeiSicht";
// `useRef` fehlte hier und wird in Zeile 156 benutzt (`undoTimerRef`).
// Ergebnis war ein weisser Bildschirm: ReferenceError: useRef is not defined.
// Unsichtbar, weil `@ts-nocheck` oben in dieser Datei den Compiler abschaltet.
// `scripts/check-hooks.mjs` prüft das jetzt bei jedem `npm run verify`.
import { useState, useEffect, useMemo, useRef, lazy, useCallback, Profiler } from "react";
// ── 11.08.2026: Kontingent kommt ab jetzt vom Server ──────────────────────
// Vorher lag der Kontostand in `klarStorage['klar_contacts_left']`, samt
// zweier Schaltflächen „Reset für Demo". Ein Kontingent, das das Gerät
// selbst setzt, ist keines — und die Anzeige oben in der Leiste las bereits
// den echten Serverwert. Zwei Wahrheiten auf einem Bildschirm.
//
// `/api/contact` war vollständig gebaut und hatte null Aufrufer: eine
// Firestore-Transaktion, die zählt, die Verifizierung prüft und über die
// Dokument-ID `<von>_<an>` einen zweiten Kontakt an dieselbe Person
// technisch unmöglich macht.
//
// FOLGE, DIE ICH BENENNE: Der Server verlangt `isVerified === true`. Ohne
// Verifizierung antwortet er mit 409 `nicht_verifiziert`. Das ist dieselbe
// Bedingung wie in den Firestore-Regeln — aber es heisst, dass ohne
// Verifizierung niemand mehr kontaktiert werden kann. Die Meldung führt
// deshalb zur Verifizierung, statt in einer Sackgasse zu enden.
import { beginneKontakt, nimmKontaktZurueck } from "../lib/klar";
import { meldeKontaktVerbraucht } from "../components/KontingentAnzeige";
import type { Profile } from "../data";
// Entfernt, weil nie gerendert: BatteryFull, BatteryMedium, BatteryLow
// (gehoerten zum geloeschten `getBatteryIcon`), Sun und Moon (zum
// geloeschten `toggleTheme`).
import {
  Info,
  X,
  Heart,
  Sparkles,
  Filter,
  ShieldCheck,
  MapPin,
  ChevronDown,
  Star,
} from "lucide-react";
import { MatchCompatibilityInsights } from "../components/MatchCompatibilityInsights";
import { VerbindungOptimizerWidget } from "../components/VerbindungOptimizerWidget";
import { MonetizationChoiceModal } from "../components/MonetizationChoiceModal";
import {
  calculateMatchScore,
  isInterestShared,
  calculateDeepMatch,
} from "../services/matchScore";
// `HAPTIC_PATTERNS` wurde nur vom entfernten Herz-Knopf benutzt und ist
// hier mit entfallen. Die Datei hat `@ts-nocheck` — ein ungenutzter Import
// waere hier nie aufgefallen.
import { hapticFeedback } from "../lib/haptics";
import {
  sortProfilesByRecommendation,
  recordInteraction,
} from "../services/recommendationEngine";
import { motion, AnimatePresence } from "motion/react";
import { DailyPulseWidget } from "../components/DailyPulseWidget";
import { SocialEnergyWidget } from "../components/SocialEnergyWidget";
import { UpcomingDateWidget } from "../components/UpcomingDateWidget";
import { DailyGoalTracker } from "../components/DailyGoalTracker";
import { WeeklyConsistencyTracker } from "../components/WeeklyConsistencyTracker";
import { DailyAffirmationWidget } from "../components/DailyAffirmationWidget";
import { TrendingInterestsWidget } from "../components/TrendingInterestsWidget";
import { SuccessDashboardWidget } from "../components/SuccessDashboardWidget";
import { DatingGoalProgressWidget } from "../components/DatingGoalProgressWidget";
import { MonthlyMoodAreaWidget } from "../components/MonthlyMoodAreaWidget";
import { DateTypePieChartWidget } from "../components/DateTypePieChartWidget";
import { MoodInsightWidget } from "../components/MoodInsightWidget";
import { MiniCalendarWidget } from "../components/MiniCalendarWidget";

import { SmartVorschlaegeWidget } from "../components/SmartVorschlaegeWidget";
import { DateSuccessRadarWidget } from "../components/DateSuccessRadarWidget";
import { DashboardDateBanner } from "../components/DashboardDateBanner";
// ENTFERNT 12.08.2026: vier Importe ohne Verwendung — AICoachMoodCheckWidget,
// Focus, SuccessRadarWidget und RelationshipJourneyWidget. Alle vier
// Komponenten existieren, werden aber nirgends eingehaengt.
import { ReflectionInsightDashboard } from "../components/ReflectionInsightDashboard";

import { DatingGoalRoadmapWidget } from "../components/DatingGoalRoadmapWidget";
import { DatingSuccessArchiveWidget } from "../components/DatingSuccessArchiveWidget";
import { DatingKarmaWidget } from "../components/DatingKarmaWidget";
import { WeeklyMoodSummaryWidget } from "../components/WeeklyMoodSummaryWidget";

// Lock entfaellt mit dem alten Sperrbildschirm — noUnusedLocals braeche
// sonst den Build, sobald @ts-nocheck aus dieser Datei verschwindet.
// ENTFERNT 12.08.2026: DatingProgressChartWidget — Interaktion und
// Kompatibilitaet kamen aus `0`.
import { WeeklyTimelineWidget } from "../components/WeeklyTimelineWidget";
import { ProfileCheckWidget } from "../components/ProfileCheckWidget";
import { QuickPreparationCountdownWidget } from "../components/QuickPreparationCountdownWidget";
// ENTFERNT 13.08.2026: ConversationStatsWidget — Gespraeche je Tag und
// Antwortrate kamen aus `0`. Bei jedem Neuladen ein anderer
// Verlauf, ueber der Ueberschrift "Letzte 30 Tage".
import { DatePlannerWidget } from "../components/DatePlannerWidget";
import { CityTrendRadarWidget } from "../components/CityTrendRadarWidget";
import { DateReflectionJournalWidget } from "../components/DateReflectionJournalWidget";
import { PastDatesArchiveWidget } from "../components/PastDatesArchiveWidget";
import { DateMemoriesWidget } from "../components/DateMemoriesWidget";
import { DatingHappinessScoreWidget } from "../components/DatingHappinessScoreWidget";
import { VerbindungContextAnalysisWidget } from "../components/VerbindungContextAnalysisWidget";
import { DatingFocusModeWidget } from "../components/DatingFocusModeWidget";
import { BreathingExerciseWidget } from "../components/BreathingExerciseWidget";
import { WeeklyMilestoneRevealWidget } from "../components/WeeklyMilestoneRevealWidget";
import { MatchIcebreakersWidget } from "../components/MatchIcebreakersWidget";
import { SituationalIcebreakerWidget } from "../components/SituationalIcebreakerWidget";
import { DateRatingChartWidget } from "../components/DateRatingChartWidget";
import { DateSuccessTrendWidget } from "../components/DateSuccessTrendWidget";
import { YearInReviewWidget } from "../components/YearInReviewWidget";
import { DatingSuccessScoreWidget } from "../components/DatingSuccessScoreWidget";
import { DatingHealthWidget } from "../components/DatingHealthWidget";
import { DatingRitualWidget } from "../components/DatingRitualWidget";
import { MatchCompassWidget } from "../components/MatchCompassWidget";
import { SmartDatePlannerWidget } from "../components/SmartDatePlannerWidget";
import { CityInsiderWidget } from "../components/CityInsiderWidget";
import { SmartDatingDiaryWidget } from "../components/SmartDatingDiaryWidget";
import { DateDiaryStatsWidget } from "../components/DateDiaryStatsWidget";
import { ClarityScoreWidget } from "../components/ClarityScoreWidget";
import { DatingTimelineWidget } from "../components/DatingTimelineWidget";
import { WeeklyConsistencyWidget } from "../components/WeeklyConsistencyWidget";
import { NextDateWidget } from "../components/NextDateWidget";
import { DailyGoalRingsWidget } from "../components/DailyGoalRingsWidget";
import { DateMoodStreakWidget } from "../components/DateMoodStreakWidget";
import { DatingReadinessWidget } from "../components/DatingReadinessWidget";
import { DailyCoachInsightWidget } from "../components/DailyCoachInsightWidget";
import { DateMoodChartWidget } from "../components/DateMoodChartWidget";
import { SmartVerbindungBadgeWidget } from "../components/SmartVerbindungBadgeWidget";
import { SmartDateReminderWidget } from "../components/SmartDateReminderWidget";
import { DataExportWidget } from "../components/DataExportWidget";
import { DatePreparationChecklistWidget } from "../components/DatePreparationChecklistWidget";
import { PreDateChecklistWidget } from "../components/PreDateChecklistWidget";
import { ReflectionLogWidget } from "../components/ReflectionLogWidget";
import { NextDateCountdownWidget } from "../components/NextDateCountdownWidget";
import { SafeDatePlannerWidget } from "../components/SafeDatePlannerWidget";
import { CompatibilityRadarWidget } from "../components/CompatibilityRadarWidget";
import { MoodMonitorWidget } from "../components/MoodMonitorWidget";
import { DailyMoodCheckInWidget } from "../components/DailyMoodCheckInWidget";
import {
  SmartMatchFilter,
  LIFE_GOALS,
  COMMUNICATION_STYLES,
} from "../components/SmartMatchFilter";
import { ValuesQuizWidget } from "../components/ValuesQuizWidget";
import { WeeklySuccessSummaryWidget } from "../components/WeeklySuccessSummaryWidget";
// ENTFERNT 14.08.2026: DatingWheelStatsWidget — geloeste Aufgaben und
// gesammelte Punkte kamen ueber 31 Tage aus `0`, samt der zwei
// grossen Summen darueber.
import { fetchProfileSummary, askAICoach } from "../lib/api";
import { VerbindungScoreBadge } from "../components/VerbindungScoreBadge";
import {
  isSmartMatchEnabled,
  checkNewProfilesForSmartMatches,
} from "../services/smartMatchService";
import { SmartVerbindungTutorialOverlay } from "../components/SmartVerbindungTutorialOverlay";
const SmartVerbindungCarousel = lazy(() => import("../components/SmartVerbindungCarousel").then(m => ({ default: m.SmartVerbindungCarousel })));
const KlarMatchWidget = lazy(() => import("../components/KlarMatchWidget").then(m => ({ default: m.KlarMatchWidget })));
import { DatingWheelWidget } from "../components/DatingWheelWidget";
import { WheelStatsWidget } from "../components/WheelStatsWidget";
import { SuccessSummaryWidget } from "../components/SuccessSummaryWidget";
import { DailyMoodWidget } from "../components/DailyMoodWidget";
import { TodayFeelingTrackerWidget } from "../components/TodayFeelingTrackerWidget";
import { MiniDiaryWidget } from "../components/MiniDiaryWidget";
import { Meilensteine } from "../components/Meilensteine";
import { DatingDuelWidget } from "../components/DatingDuelWidget";
import { RecentIntrosWidget } from "../components/RecentIntrosWidget";
import { MoodDiaryWidget } from "../components/MoodDiaryWidget";
import { PopularDateIdeasWidget } from "../components/PopularDateIdeasWidget";
import { DailyIcebreakerWidget } from "../components/DailyIcebreakerWidget";
import { DailyCoachAffirmation } from "../components/DailyCoachAffirmation";

import { ActivityChartWidget } from "../components/ActivityChartWidget";
// ENTFERNT 14.08.2026: EmailSummaryWidget — es verschickte eine Mail mit
// zwei Zaehlern, die niemand schreibt, und war der einzige Grund fuer die
// Google-Berechtigung `gmail.send`. Siehe src/lib/AuthContext.tsx.
// ENTFERNT 14.08.2026: QualityConversationsChartWidget — die Kurve
// „Tiefgruendige Gespraeche (letzte 30 Tage)" kam aus `0`;
// der eine „echte" Wert fuer heute las einen Schluessel, den niemand
// schreibt, mit Vorgabe 2.
import { DatingJournalWidget } from "../components/DatingJournalWidget";
import { KlarCompassWidget } from "../components/KlarCompassWidget";
import { DateInspirationTab } from "../components/DateInspirationTab";
import { melde } from "../lib/fehler";
import { VerbindungInterestsTagCloudWidget } from "../components/VerbindungInterestsTagCloudWidget";
import { DailyUsageRitualWidget } from "../components/DailyUsageRitualWidget";
import { DailyTaskWidget } from "../components/DailyTaskWidget";
import { ActivitySummaryWidget } from "../components/ActivitySummaryWidget";
import { KlarInsightsWidget } from "../components/KlarInsightsWidget";

const DAILY_LIMIT = 8;

const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  Berlin: { lat: 52.52, lng: 13.405 },
  München: { lat: 48.1351, lng: 11.582 },
  Hamburg: { lat: 53.5511, lng: 9.9937 },
  Köln: { lat: 50.9375, lng: 6.9603 },
  Wien: { lat: 48.2082, lng: 16.3738 },
  Zürich: { lat: 47.3769, lng: 8.5417 },
};

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// ═══════════════════════════════════════════════════════════════════════════
// `// @ts-nocheck` ENTFERNT am 12.08.2026 — die letzte der acht Dateien.
// Was die Zeile verdeckt hat:
//
// ── 1. DIE NO-GOS WURDEN NIE GELESEN ──────────────────────────────────────
// `setUserNoGos` wurde nirgends aufgerufen. Die Liste blieb dauerhaft leer
// — und sie geht an DREI Stellen in `calculateDeepMatch(…, userNoGos,
// noGoStrictness)` ein. Was auf der Profilseite unter „Meine No-Gos"
// eingetragen wird, hatte auf das Deep-Kontakt also keinerlei Wirkung.
// Jetzt wird die Liste im Ladeeffekt geholt.
//
// ── 2. DIE GESPRÄCHSANFÄNGE DES TAGES HATTEN KEINEN BEZUG ─────────────────
// `<DailyIcebreakerWidget verbindungenInterests={…} />` — die Komponente
// kennt diese Eigenschaft nicht, sie heisst `matchesInterests`. Der Wert
// wurde verworfen, und das Widget schickte `matchesInterests: undefined`
// an `/api/daily-icebreaker`. Derselbe Fehler wie bei `ChatDatePlanner`
// heute Vormittag, an einer zweiten Stelle.
//
// ── 3. VIER SCHALTER, DIE ES NICHT GIBT ───────────────────────────────────
// `setIsFocusMode`, `setPrioritizeInterests`, `setIsFilterMenuOpen` und
// `setShowSmartKontaktTooltip` haben keinen Aufrufer. Der Fokus-Modus ist
// damit dauerhaft aus, der Filter „Interessen bevorzugen" ebenso. Das
// Verhalten bleibt, wie es ist — die Setzer sind weg, damit es nicht
// aussieht, als gäbe es die Schalter.
//
// ── 4. ZWEI TOTE FUNKTIONEN ───────────────────────────────────────────────
// `fetchWeeklyReview` (rief `/api/weekly-review`, kein Aufrufer, Ergebnis
// nirgends angezeigt) und `getBatteryIcon`. Dazu `toggleTheme`, das
// ausserdem nach `klarStorage['theme']` schrieb statt nach `klar_theme` —
// derselbe Fehler wie im am 11.08. entfernten `ThemeSettingsWidget`.
// FOLGE: `/api/weekly-review` hat keinen Aufrufer mehr in der App.
//
// ── 5. EIN `JSON.parse` OHNE `try` IM EFFEKT ──────────────────────────────
// `klar_search_history`. Steht dort etwas Unlesbares, wirft der Aufruf im
// Effekt, und React zeigt den Fehlerbildschirm statt des Dashboards.
//
// ── 6. `data.reduce((acc: unknown, item: unknown) => …)` ──────────────────────────
// Antwortet `/api/ai-passgenauigkeit` mit einem Objekt statt einer Liste —
// etwa `{ error: … }` —, gibt es kein `.reduce`, und der Klick endet in
// einem TypeError.
//
// ── 7. NEUN UNBENUTZTE IMPORTE ────────────────────────────────────────────
// Darunter vier ganze Widgets: AICoachMoodCheckWidget, SuccessRadarWidget,
// RelationshipJourneyWidget und Focus.
// ═══════════════════════════════════════════════════════════════════════════

const nurZeichenketten = (w: unknown): string[] =>
  Array.isArray(w) ? w.filter((x): x is string => typeof x === "string") : [];

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

import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/AuthContext";
import { fetchWithTimeout } from "../lib/api";
import { OktoberfestBanner } from "../components/OktoberfestBanner";

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, profileData } = useAuth();
  const { trackEvent } = useUsageAnalytics();
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);
  // BEFUND 10.08.2026: `showFilterSheet` wurde in Zeile 973 gelesen und in
  // 958/984 gesetzt, aber nirgends deklariert. ReferenceError beim ersten
  // Rendern — der weisse Bildschirm nach dem Onboarding. Dritter Fall
  // derselben Sorte an einem Tag; `@ts-nocheck` verdeckt alle drei.
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  /** Wortlaut des Servers, wenn ein Kontakt abgelehnt wurde. `null` heisst:
   *  keine Ablehnung — nicht „alles in Ordnung, aber unbekannt". */
  const [kontaktFehler, setKontaktFehler] = useState<string | null>(null);
  const [showMonetizationModal, setShowMonetizationModal] = useState(false);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"discover" | "inspiration">(
    "discover",
  );

  const [seenIds, setSeenIds] = useState<string[]>([]);

  const onRenderCallback = useCallback((
    id: string,
    phase: "mount" | "update" | "nested-update",
    actualDuration: number
  ) => {
    if (actualDuration > 16) {
      console.warn(`[Profiler] ${id} rendered in ${actualDuration.toFixed(2)}ms (${phase})`);
    }
  }, []);

  const [contactsLeft, setContactsLeft] = useState(DAILY_LIMIT);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [serverProfiles, setServerProfiles] = useState<Profile[]>([]);
  // BEFUND 12.08.2026: `setUserNoGos` wurde NIE aufgerufen. Die Liste blieb
  // dauerhaft leer — und sie geht in `calculateDeepMatch(…, userNoGos,
  // noGoStrictness)` an drei Stellen ein. Die No-Gos, die auf der
  // Profilseite eingetragen und unter `userNoGos` gespeichert werden,
  // wurden hier also nie gelesen: Das Deep-Kontakt hat sie schlicht
  // ignoriert. Jetzt werden sie im Ladeeffekt weiter unten geholt.
  const [userNoGos, setUserNoGos] = useState<string[]>([]);
  const [noGoStrictness] = useState<number>(() => {
    const saved = klarStorage.getItem("noGoStrictness");
    return saved ? parseInt(saved) : 100;
  });

  // ENTFERNT 12.08.2026: `weeklyReview` und `isFetchingReview` wurden
  // gesetzt und nie gelesen; ihr einziger Schreiber `fetchWeeklyReview`
  // hatte keinen Aufrufer. Der ganze Wochenrueckblick war tot — siehe die
  // Stelle, an der die Funktion stand.
  // BEFUND: `setIsFocusMode` wird nirgends aufgerufen — der Fokus-Modus
  // laesst sich nicht einschalten. `!isFocusMode` ist damit immer wahr, die
  // drei betroffenen Widgets sind immer sichtbar. Verhalten unveraendert;
  // der Setzer ist weg, damit es nicht so aussieht, als gaebe es den Schalter.
  const [isFocusMode] = useState(false);
  // ── 11.08.2026: toter Smart-Lock-Apparat entfernt ────────────────────────
  // Hier standen drei Dinge, die zusammen nichts taten:
  //
  //   const [isSmartLockEnabled, setIsSmartLockEnabled] = useState(false);
  //   const [isLocked, setIsLocked] = useState(false);
  //   useEffect(() => { if (isSmartLockEnabled) { /* simulated check */ } },
  //             [isSmartLockEnabled]);
  //
  // `setIsSmartLockEnabled` hatte im ganzen Projekt keinen Aufrufer, der
  // Effekt einen leeren Rumpf, und der Kommentar sagte „for demo we just
  // show the toggle" — einen Schalter gab es nicht. `isLocked` wurde nur
  // vom Sperrbildschirm gelesen, den niemand einschalten konnte.
  //
  // Der Sichtschutz liegt jetzt in `components/Sichtschutz.tsx` und ist in
  // `App.tsx` über allen Routen eingehängt.

  const [, setNewDeepKontaktAlert] = useState(false);
  const [deepKontaktCount, setDeepKontaktCount] = useState<number>(0);

  const [mustHaveInterests, setMustHaveInterests] = useState<string[]>([]);
  const [showHighVerbindungenOnly, setShowHighVerbindungenOnly] =
    useState(false);
  const [highCompatibilityFirst, setHighCompatibilityFirst] = useState(false);
  // BEFUND: `setPrioritizeInterests` wird nirgends aufgerufen — dieser
  // Filter laesst sich nicht einschalten und ist damit immer aus.
  const [prioritizeInterests] = useState(false);
  const [matchIntensity, setKontaktIntensity] = useState<number>(0);
  const [notifiedHighVerbindungen, setNotifiedHighVerbindungen] = useState<
    Set<string>
  >(new Set());
  const [notification, setNotification] = useState<{
    id: string;
    message: string;
    onUndo?: () => void;
  } | null>(null);

  const [profileSummary, setProfileSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const [filterLocation, setFilterLocation] = useState<string | null>(null);
  const [filterSharedHobbies, setFilterSharedHobbies] =
    useState<boolean>(false);
  const [filterSharedGoals, setFilterSharedGoals] = useState<boolean>(false);
  const [filterSharedCommunication, setFilterSharedCommunication] =
    useState<boolean>(false);
  // ENTFERNT: `isFilterMenuOpen` wurde weder gesetzt noch gelesen.
  const [filterMaxDistance, setFilterMaxDistance] = useState<number>(100);
  const [filterMinAge, setFilterMinAge] = useState<number>(18);
  const [filterMaxAge, setFilterMaxAge] = useState<number>(99);
  const [filterSpecificInterest, setFilterSpecificInterest] =
    useState<string>("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    // BEFUND 12.08.2026: Hier stand `JSON.parse(...)` ohne `try`. Steht
    // unter `klar_search_history` etwas Unlesbares, wirft der Aufruf im
    // Effekt — und React zeigt den Fehlerbildschirm statt des Dashboards.
    setSearchHistory(listeAusSpeicher("klar_search_history"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRecommendations = async () => {
      if (!user?.uid || user.isAnonymous || !profileData?.location) {
        if (!cancelled) setServerProfiles([]);
        return;
      }
      try {
        const params = new URLSearchParams({ city: String(profileData.location), minAge: String(filterMinAge), maxAge: String(filterMaxAge), limit: '30' });
        const response = await fetchWithTimeout(`/api/recommendations?${params.toString()}`, { timeout: 12000, retries: 0 });
        if (!response.ok) throw new Error('recommendations unavailable');
        const data = await response.json() as { recommendations?: Array<{ profile: Profile }> };
        if (!cancelled) setServerProfiles(Array.isArray(data.recommendations) ? data.recommendations.map(item => item.profile) : []);
      } catch {
        if (!cancelled) setServerProfiles([]);
      }
    };
    void loadRecommendations();
    return () => { cancelled = true; };
  }, [user?.uid, user?.isAnonymous, profileData?.location, filterMinAge, filterMaxAge]);

  const saveSearchHistory = (search: string) => {
    if (!search.trim()) return;
    const history = [
      search.trim(),
      ...searchHistory.filter((s) => s !== search.trim()),
    ].slice(0, 5);
    setSearchHistory(history);
    klarStorage.setItem("klar_search_history", JSON.stringify(history));
  };
  const [modalProfile, setModalProfile] = useState<Profile | null>(null);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [generatedIcebreaker, setGeneratedIcebreaker] = useState<string | null>(
    null,
  );

  const openProfile = useCallback((profile: Profile) => {
    setModalProfile(profile);
    void fetch('/api/activation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'first_profile_opened', metadata: { profileId: profile.id } }) }).catch(() => {});
  }, []);
  const [isGeneratingIcebreaker, setIsGeneratingIcebreaker] = useState(false);
  const [smartKontaktEnabledState, setSmartKontaktEnabledState] = useState(
    isSmartMatchEnabled(),
  );
  // `isDarkMode` wird nur noch geschrieben: Der einzige Leser war
  // `toggleTheme`, und der hatte keinen Aufrufer. Der Beobachter darunter
  // bleibt, damit ein spaeterer Leser den Wert vorfindet.
  const [, setIsDarkMode] = useState(
    document.documentElement.classList.contains("dark"),
  );
  // ENTFERNT: `showSmartKontaktTooltip` wurde weder gesetzt noch gelesen.
  const [smartKontaktDetailProfile, setSmartKontaktDetailProfile] =
    useState<Profile | null>(null);
  const [celebratedProfiles, setCelebratedProfiles] = useState<Set<string>>(
    new Set(),
  );
    const [roadmapMilestone, setRoadmapMilestone] = useState(0);

  const [aiFilterMode, setAiFilterMode] = useState<boolean>(false);
  const [aiKontaktScores, setAiKontaktScores] = useState<Record<
    string,
    { score: number; reason: string }
  > | null>(null);
  const [isCalculatingAiScores, setIsCalculatingAiScores] = useState(false);

  useEffect(() => {
    const updateMilestone = () => {
      const saved = klarStorage.getItem("klar_dating_roadmap");
      if (saved) {
        try {
          const roh: unknown = JSON.parse(saved);
          setRoadmapMilestone(Array.isArray(roh) ? roh.length : 0);
        } catch (e) {
          melde("Dashboard/roadmap", e);
        }
      }
    };

    updateMilestone();
    window.addEventListener("roadmapProgressChanged", updateMilestone);

    return () =>
      window.removeEventListener("roadmapProgressChanged", updateMilestone);
  }, []);

  const getBackgroundMilestoneClass = () => {
    if (roadmapMilestone >= 5) return "bg-emerald-50 dark:bg-emerald-950/20";
    if (roadmapMilestone >= 3) return "bg-indigo-50 dark:bg-indigo-950/20";
    if (roadmapMilestone >= 1) return "bg-amber-50 dark:bg-amber-950/20";
    return "bg-light-bg dark:bg-dark-bg";
  };

  useEffect(() => {
    const handleThemeChange = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    window.addEventListener("themechange", handleThemeChange);
    // Also listen to mutation observer for direct class changes just in case
    const observer = new MutationObserver(() => handleThemeChange());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      window.removeEventListener("themechange", handleThemeChange);
      observer.disconnect();
    };
  }, []);

  // ENTFERNT 12.08.2026: `toggleTheme` hatte keinen Aufrufer — und schrieb
  // ausserdem nach `klarStorage['theme']` statt nach `klar_theme`, dem
  // Schluessel, den `ThemeProvider` liest. Derselbe Fehler wie im am
  // 11.08. entfernten `ThemeSettingsWidget`: eine Umschaltung ohne Wirkung.

  useEffect(() => {
    const handleSettingsChange = () => {
      setSmartKontaktEnabledState(isSmartMatchEnabled());
    };
    window.addEventListener(
      "smartKontaktSettingsChanged",
      handleSettingsChange,
    );
    return () =>
      window.removeEventListener(
        "smartKontaktSettingsChanged",
        handleSettingsChange,
      );
  }, []);

  const uniqueLocations = useMemo(
    () => Array.from(new Set([profileData?.location, ...serverProfiles.map((p) => p.location)].filter(Boolean) as string[])),
    [profileData?.location, serverProfiles],
  );

  useEffect(() => {
    const seen = klarStorage.getItem("klar_walkthrough_seen");
    if (!seen) {
      setTimeout(() => setWalkthroughStep(1), 1000);
    }
    // Request notification permission for push notifications
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const nextWalkthroughStep = () => {
    if (walkthroughStep === 1) {
      setWalkthroughStep(2);
    } else if (walkthroughStep === 2) {
      setWalkthroughStep(0);
      klarStorage.setItem("klar_walkthrough_seen", "true");
    }
  };

  const skipWalkthrough = () => {
    setWalkthroughStep(0);
    klarStorage.setItem("klar_walkthrough_seen", "true");
  };

  useEffect(() => {
    // ── Kontingent vom Server, nicht aus dem Gerät ────────────────────────
    // Der Tageswechsel liegt bei 4 Uhr Berliner Zeit (`pure.ts:RESET_HOUR`),
    // nicht um Mitternacht. Die alte Fassung hier verglich
    // `new Date().toDateString()` — das setzte um Mitternacht zurück und
    // schenkte damit jede Nacht vier Stunden lang zusätzliche Kontakte.
    // Der Server rechnet richtig; der Browser braucht es nicht zu wissen.
    const weg = false;
    (async () => {
      try {
        const res = await fetch("/api/quota");
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        if (!weg && typeof d.uebrig === "number") setContactsLeft(d.uebrig);
      } catch {
        // Kein erfundener Wert: Bei einem Fehler bleibt der Anfangswert
        // stehen, und der erste Kontaktversuch bringt die Wahrheit vom
        // Server. Eine geratene Restanzeige wäre schlechter als eine, die
        // sich beim nächsten Versuch korrigiert.
      }
    })();

    // `seenIds` bleibt lokal: Es ist eine Anzeigehilfe („schon gesehen"),
    // kein Anspruch. Der Server verhindert Doppelkontakte über die
    // Dokument-ID, unabhängig davon, was das Gerät sich merkt.
    const savedSeenIds = klarStorage.getItem("klar_seen_ids");
    if (savedSeenIds) {
      try {
        setSeenIds(nurZeichenketten(JSON.parse(savedSeenIds) as unknown));
      } catch {
        /* unbrauchbarer Eintrag — dann eben ohne */
      }
    }
    try {
      const interests = getUserStorageItem('userInterests');
      if (interests) {
        setUserInterests(nurZeichenketten(JSON.parse(interests) as unknown));
      }

      const mustHaves = klarStorage.getItem("mustHaveInterests");
      if (mustHaves) {
        setMustHaveInterests(
          nurZeichenketten(JSON.parse(mustHaves) as unknown),
        );
      }

      // NEU 12.08.2026: Die No-Gos wurden hier nie geladen. Sie stehen seit
      // jeher unter "userNoGos" (geschrieben von der Profilseite) und gehen
      // an drei Stellen in `calculateDeepMatch` ein — mit einer leeren Liste
      // also wirkungslos.
      const noGos = klarStorage.getItem("userNoGos");
      if (noGos) {
        setUserNoGos(nurZeichenketten(JSON.parse(noGos) as unknown));
      }
    } catch (e) {
      melde("Dashboard", e);
    }
  }, []);

  useEffect(() => {
    let watchId: number;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          // Fallback to default coordinates without noisy warning if permission denied/policy restricted
          setUserCoords({ lat: 48.1351, lng: 11.5820 });
          if (error.code !== 1) {
            console.debug("Location fallback used:", error.message);
          }
        },
        { enableHighAccuracy: true },
      );
    }
    return () => {
      if (watchId !== undefined && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const availableProfiles = useMemo(() => {
    let profiles = serverProfiles.filter(
      (p) => p.isVerified === true && !seenIds.includes(p.id),
    );
    if (showHighVerbindungenOnly) {
      profiles = profiles.filter(
        (p) => calculateMatchScore(userInterests, p.interests) >= 80,
      );
    }

    if (filterLocation) {
      profiles = profiles.filter((p) => p.location === filterLocation);
    }

    // Distance filter
    if (userCoords && filterMaxDistance < 100) {
      profiles = profiles.filter((p) => {
        const cityCoord = cityCoordinates[p.location];
        if (!cityCoord) return true; // fallback
        const dist = calculateDistance(
          userCoords.lat,
          userCoords.lng,
          cityCoord.lat,
          cityCoord.lng,
        );
        return dist <= filterMaxDistance;
      });
    }

    // Age filter
    profiles = profiles.filter(
      (p) => p.age >= filterMinAge && p.age <= filterMaxAge,
    );

    // Specific interest filter
    if (filterSpecificInterest.trim()) {
      const search = filterSpecificInterest.toLowerCase().trim();
      profiles = profiles.filter(
        (p) =>
          p.interests.some((i) => i.toLowerCase().includes(search)) ||
          p.bio.toLowerCase().includes(search),
      );
    }

    if (filterSharedHobbies) {
      const userHobbies = userInterests.filter(
        (i) => !LIFE_GOALS.includes(i) && !COMMUNICATION_STYLES.includes(i),
      );
      profiles = profiles.filter((p) =>
        p.interests.some((i) => userHobbies.includes(i)),
      );
    }

    if (filterSharedGoals) {
      const userGoal = getUserStorageItem('userGoal') || "";
      const userGoalsList = userInterests.filter((i) => LIFE_GOALS.includes(i));
      profiles = profiles.filter(
        (p) =>
          p.interests.some((i) => userGoalsList.includes(i)) ||
          (userGoal && p.bio.toLowerCase().includes(userGoal.toLowerCase())) ||
          (userGoal &&
            p.interests.some((i) =>
              i.toLowerCase().includes(userGoal.toLowerCase()),
            )),
      );
    }

    if (filterSharedCommunication) {
      const userCommStyles = userInterests.filter((i) =>
        COMMUNICATION_STYLES.includes(i),
      );
      profiles = profiles.filter((p) =>
        p.interests.some((i) => userCommStyles.includes(i)),
      );
    }

    if (matchIntensity > 0 && userInterests.length > 0) {
      profiles = profiles.filter(
        (p) =>
          calculateMatchScore(userInterests, p.interests) >= matchIntensity,
      );
    }

    let sortedProfiles = sortProfilesByRecommendation(
      profiles,
      userInterests,
      mustHaveInterests,
    );

    if (highCompatibilityFirst) {
      sortedProfiles = sortedProfiles.sort((a, b) => {
        const aMustHaves = a.interests.filter((i) =>
          mustHaveInterests.includes(i),
        ).length;
        const bMustHaves = b.interests.filter((i) =>
          mustHaveInterests.includes(i),
        ).length;

        const weightA =
          aMustHaves * 100 + calculateMatchScore(userInterests, a.interests);
        const weightB =
          bMustHaves * 100 + calculateMatchScore(userInterests, b.interests);

        return weightB - weightA;
      });
    }

    if (prioritizeInterests && userInterests.length > 0) {
      sortedProfiles = sortedProfiles.sort((a, b) => {
        const sharedA = a.interests.filter((i) =>
          userInterests.includes(i),
        ).length;
        const sharedB = b.interests.filter((i) =>
          userInterests.includes(i),
        ).length;
        return sharedB - sharedA;
      });
    }

    if (aiFilterMode && aiKontaktScores) {
      sortedProfiles = sortedProfiles
        .filter((p) => aiKontaktScores && aiKontaktScores[p.id])
        .sort(
          (a, b) =>
            aiKontaktScores![b.id]!.score - aiKontaktScores![a.id]!.score,
        );
    }

    return sortedProfiles;
  }, [
    seenIds,
    serverProfiles,
    showHighVerbindungenOnly,
    highCompatibilityFirst,
    userInterests,
    mustHaveInterests,
    filterLocation,
    filterSharedHobbies,
    filterSharedGoals,
    filterSharedCommunication,
    filterMaxDistance,
    filterMinAge,
    filterMaxAge,
    filterSpecificInterest,
    userCoords,
    aiFilterMode,
    aiKontaktScores,
  ]);

  // Automated background check for Smart-Verbindunges and regular notifications
  useEffect(() => {
    if (smartKontaktEnabledState) {
      // Find all unnotified profiles with score >= 90
      const highVerbindungen = checkNewProfilesForSmartMatches(
        availableProfiles,
        userInterests,
        notifiedHighVerbindungen,
      );
      if (highVerbindungen.length > 0) {
        // Mark them as notified
        const newNotified = new Set(notifiedHighVerbindungen);
        highVerbindungen.forEach((p: unknown) => newNotified.add(p.id));
        setNotifiedHighVerbindungen(newNotified);

        // If we have more than one, consolidate notification
        if (highVerbindungen.length === 1) {
          const p = highVerbindungen[0];
          if (p) {
            const message = `✨ Smart-Verbindung Alert: ${p.name} passt zu über 90% zu dir!`;
            setNotification({ id: p.id, message });

            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              new Notification("Smart-Verbindung gefunden!", {
                body: message,
                icon: "/favicon.ico",
              });
            }
          }
        } else {
          const message = `✨ Smart-Verbindung Alert: ${highVerbindungen.length} neue Profile passen zu über 90% zu dir!`;
          setNotification({ id: "batch", message });

          if (
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("Neue Smart-Verbindunges!", {
              body: message,
              icon: "/favicon.ico",
            });
          }
        }

        const timer = setTimeout(() => {
          setNotification(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }

    if (availableProfiles[0]) {
      // Normal 80%+ check for the current profile
      const currentProfile = availableProfiles[0];
      const score = calculateMatchScore(
        userInterests,
        currentProfile.interests,
      );

      // If smartKontaktEnabledState is true, we already alerted for >= 90 above.
      // So here we only alert for 80-89 if smartKontaktEnabledState is true,
      // or for >= 80 if smartKontaktEnabledState is false.
      const shouldNotifyNormal = smartKontaktEnabledState
        ? score >= 80 && score < 90
        : score >= 80;

      if (
        shouldNotifyNormal &&
        !notifiedHighVerbindungen.has(currentProfile.id)
      ) {
        const message = `🔥 Top Verbindung in der Nähe: ${currentProfile.name} teilt viele deiner Interessen! (${score}%)`;
        setNotification({
          id: currentProfile.id,
          message,
        });
        setNotifiedHighVerbindungen((prev) =>
          new Set(prev).add(currentProfile.id),
        );

        // Trigger push notification if smartKontakt is false (since if it's true, we only push for >= 90)
        if (
          !smartKontaktEnabledState &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification("Neues Top Verbindung!", {
            body: message,
            icon: "/favicon.ico",
          });
        }

        const timer = setTimeout(() => {
          setNotification(null);
        }, 4000);
        return () => clearTimeout(timer);
      } else if (
        notification &&
        notification.id !== currentProfile.id &&
        notification.id !== "batch"
      ) {
        setNotification(null);
      }
    } else if (notification) {
      setNotification(null);
    }
  }, [
    availableProfiles,
    userInterests,
    notifiedHighVerbindungen,
    notification,
    smartKontaktEnabledState,
  ]);

  useEffect(() => {
    const fetchSummary = async () => {
      const currentProfile = availableProfiles[0];
      if (!currentProfile) return;

      setIsLoadingSummary(true);
      setProfileSummary(null);

      try {
        const summary = await fetchProfileSummary(
          userInterests,
          currentProfile.name,
          currentProfile.interests,
          currentProfile.bio,
        );
        setProfileSummary(summary);
      } catch (e) {
        melde("Dashboard.fetchSummary", e);
        setProfileSummary(
          (e instanceof Error ? e.message : String(e)) ||
            "Das KI-Limit wurde vorübergehend erreicht. Bitte warte kurz.",
        );
      } finally {
        setIsLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [availableProfiles[0]?.id, userInterests]);

  useEffect(() => {
    // Determine the currently viewed profile (either the one in the modal, or the top of the kontakt stack)
    const activeProfile = modalProfile || availableProfiles[0];

    if (
      activeProfile &&
      calculateMatchScore(userInterests, activeProfile.interests) >= 90
    ) {
      if (!celebratedProfiles.has(activeProfile.id)) {
        setCelebratedProfiles((prev) => new Set(prev).add(activeProfile.id));
         // Hide after 3 seconds
      }
    }
  }, [modalProfile, availableProfiles, userInterests, celebratedProfiles]);

  useEffect(() => {
    const checkDeepVerbindungen = () => {
      let count = 0;
      availableProfiles.forEach((m) => {
        if (
          calculateDeepMatch(
            userInterests,
            userInterests,
            m.values,
            m.personalityTraits,
            userNoGos,
            noGoStrictness,
          ).isDeepMatch
        ) {
          count++;
        }
      });
      if (count > deepKontaktCount && deepKontaktCount !== 0) {
        setNewDeepKontaktAlert(true);
        hapticFeedback([100, 50, 100, 50, 200]);
        setTimeout(() => setNewDeepKontaktAlert(false), 5000);

        // Push notification logic
        const isPowerSaving =
          klarStorage.getItem("klar_power_saving_until") &&
          parseInt(klarStorage.getItem("klar_power_saving_until") || "0") >
            Date.now();
        if (
          !isPowerSaving &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification("Neue Tiefe Verbindung!", {
            body: "Dein Profil-Update hat ein neues Deep-Verbindung generiert.",
            icon: "/icon.png",
          });
        }
        setDeepKontaktCount(count);
      }
    };
    if (availableProfiles.length > 0) checkDeepVerbindungen();
  }, [availableProfiles, userInterests, userNoGos, noGoStrictness]);

  // ── ENTFERNT 12.08.2026: `fetchWeeklyReview` ────────────────────────────
  // Die Funktion rief `/api/weekly-review` auf und schrieb das Ergebnis in
  // `weeklyReview`. Sie hatte keinen Aufrufer, und `weeklyReview` wurde
  // nirgends angezeigt. Der Wochenrueckblick war an beiden Enden tot.
  // FOLGE: `/api/weekly-review` hat damit keinen Aufrufer mehr in der App.
  // Ob der Rueckblick gebaut werden soll, ist eine Produktentscheidung.
  // ────────────────────────────────────────────────────────────────────────

  const handleContact = useCallback(async (
    profile: Profile,
    interaction: "nachricht" | "pass",
  ) => {
    trackEvent("profile_interaction", { profileId: profile.id, interaction });

    if (interaction === "nachricht") {
      if (contactsLeft <= 0) {
        setShowMonetizationModal(true);
        return;
      }

      // ── Der Server entscheidet, nicht der Browser ──────────────────────
      // Vorher wurde hier `klarStorage` heruntergezählt. Das war weder
      // fälschungssicher noch mit der Anzeige oben synchron — und der
      // Doppelkontakt an dieselbe Person war nicht verhindert.
      let uebrig: number | null;
      try {
        const ergebnis = await beginneKontakt(profile.id);
        uebrig = ergebnis.uebrig;
      } catch (e) {
        // Die Meldung kommt WÖRTLICH vom Server. Sie unterscheidet drei
        // Fälle — Kontingent erschöpft, nicht verifiziert, bereits
        // angeschrieben — und jeder braucht eine andere Reaktion. Eine
        // eigene Formulierung hier würde diesen Unterschied einebnen.
        const text =
          e instanceof Error
            ? e.message
            : "Der Kontakt konnte nicht angelegt werden.";
        setKontaktFehler(text);
        if (text.includes('vergeben') || text.includes('erschöpft')) {
          setShowMonetizationModal(true);
        }
        // Restanzeige nachziehen: Vielleicht ist das Kontingent gerade auf
        // einem anderen Gerät verbraucht worden.
        meldeKontaktVerbraucht();
        return;
      }

      setKontaktFehler(null);
      void fetch('/api/activation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'first_contact', metadata: { profileId: profile.id } }) }).catch(() => {});
      if (typeof uebrig === "number") setContactsLeft(uebrig);
      meldeKontaktVerbraucht();

      const newSeenIds = [...seenIds, profile.id];
      setSeenIds(newSeenIds);
      klarStorage.setItem("klar_seen_ids", JSON.stringify(newSeenIds));

      setNotification({
        id: "kontakt_" + profile.id,
        message: "Kontaktanfrage gesendet",
        onUndo: async () => {
          // Die Rücknahme geht ebenfalls an den Server — er setzt den
          // Zähler zurück und löscht den Kontakt. Eine Rücknahme, die nur
          // die Anzeige zurückdreht, ist keine.
          try {
            await nimmKontaktZurueck(profile.id);
            setContactsLeft(contactsLeft);
            meldeKontaktVerbraucht();
          } catch (e) {
            // Die Frist von 5 Sekunden prüft der Server. Ist sie abgelaufen,
            // bleibt der Kontakt bestehen — und das ist zu sagen.
            setKontaktFehler(
              e instanceof Error
                ? e.message
                : "Die Rücknahme war nicht mehr möglich.",
            );
          }

          setSeenIds(seenIds);
          klarStorage.setItem("klar_seen_ids", JSON.stringify(seenIds));

          setNotification(null);
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        },
      });

      // Process after 5 seconds
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setNotification(null);
        recordInteraction(profile, interaction);

        // Update stats
        const matchesCount = parseInt(
          klarStorage.getItem("stats_matches_collected") || "0",
          10,
        );
        klarStorage.setItem(
          "stats_matches_collected",
          (matchesCount + 1).toString(),
        );

        const today = new Date().toDateString();
        const savedDate = klarStorage.getItem("klar_goal_date");
        let currentInteractions = parseInt(
          klarStorage.getItem("klar_daily_interactions") || "0",
          10,
        );
        if (savedDate !== today) {
          currentInteractions = 0;
          klarStorage.setItem("klar_goal_date", today);
        }
        klarStorage.setItem(
          "klar_daily_interactions",
          (currentInteractions + 1).toString(),
        );
        window.dispatchEvent(new Event("klar_interaction_updated"));
      }, 5000);
    } else {
      // Pass doesn't cost a Kontakt
      const newSeenIds = [...seenIds, profile.id];
      setSeenIds(newSeenIds);
      klarStorage.setItem("klar_seen_ids", JSON.stringify(newSeenIds));
      recordInteraction(profile, interaction);
    }
  }, [contactsLeft, seenIds, highCompatibilityFirst]);

  const handleQuizComplete = useCallback((values: string[]) => {
    const newUserInterests = Array.from(new Set([...userInterests, ...values]));
    setUserInterests(newUserInterests);
    setUserStorageItem('userInterests', JSON.stringify(newUserInterests));

    setNotification({
      id: Date.now().toString(),
      message:
        "Werte erfolgreich hinzugefügt! Verbindungen werden aktualisiert.",
    });
    setTimeout(() => setNotification(null), 3000);
  }, [userInterests]);

  // Simulate an incoming message on Dashboard for haptic feedback demonstration
  useEffect(() => {
    const timer = setTimeout(() => {
            setNotification({
        id: "new_msg_" + Date.now(),
        message: "💬 Neue Nachricht von einem Verbindung!",
      });
      setTimeout(() => setNotification(null), 5000);
    }, 12000); // Trigger after 12 seconds
    return () => clearTimeout(timer);
  }, []);

  const handleGenerateIcebreaker = async (profile: Profile) => {
    setIsGeneratingIcebreaker(true);
    try {
      const prompt = `Erstelle einen kurzen, charmanten Icebreaker-Spruch (1-2 Sätze) für ${profile.name}.
Ihre Interessen: ${profile.interests.join(", ")}.
Meine Interessen: ${userInterests.join(", ")}.
Finde eine Gemeinsamkeit oder stelle eine interessante Frage, um das Gespräch zu beginnen. Sei kreativ, nicht zu kitschig.`;
      const response = await askAICoach(prompt);
      setGeneratedIcebreaker(response.replace(/^"|"$/g, "").trim());

      // Update stats
      const currentCount = parseInt(
        klarStorage.getItem("klar_icebreaker_count") || "0",
        10,
      );
      klarStorage.setItem(
        "klar_icebreaker_count",
        (currentCount + 1).toString(),
      );
      // Trigger storage event so dashboard updates
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      melde("Dashboard.generateIcebreaker", e);
      setGeneratedIcebreaker("");
    } finally {
      setIsGeneratingIcebreaker(false);
    }
  };

  if (contactsLeft <= 0) {
    return (
      <>
        <OktoberfestBanner />
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-light-bg dark:bg-dark-bg">
          <div className="w-16 h-16 bg-stone-200 dark:bg-stone-800 rounded-full flex items-center justify-center mb-4">
            <Info className="text-stone-500 dark:text-stone-400" size={32} />
          </div>
          <h2 className="text-2xl font-serif mb-2 text-stone-900 dark:text-stone-100">
            Für heute geschafft.
          </h2>
          <p className="text-stone-600 dark:text-stone-400 mb-6">
            Du hast dein Limit für heute erreicht. Nimm dir Zeit für echte
            Gespräche mit deinen bisherigen Verbindungen.
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-500">
            Neue Kontakte gibt es morgen um 4 Uhr.
          </p>
        </div>
      </>
    );
  }

  const profile = availableProfiles[0];

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-light-bg dark:bg-dark-bg">
        <div className="w-16 h-16 bg-stone-200 dark:bg-stone-800 rounded-full flex items-center justify-center mb-4">
          <Info className="text-stone-500 dark:text-stone-400" size={32} />
        </div>
        <h2 className="text-2xl font-serif mb-2 text-stone-900 dark:text-stone-100">
          Keine Profile mehr.
        </h2>
        <p className="text-stone-600 dark:text-stone-400 mb-6">
          Wir haben aktuell keine weiteren Profile für dich.
          {filterLocation ||
          filterSharedHobbies ||
          filterSharedGoals ||
          filterSharedCommunication ||
          showHighVerbindungenOnly ||
          highCompatibilityFirst ||
          prioritizeInterests ||
          matchIntensity > 0 ||
          filterMaxDistance < 100 ||
          filterMinAge > 18 ||
          filterMaxAge < 99 ||
          filterSpecificInterest !== ""
            ? " Versuche, deine Filter anzupassen."
            : ""}
        </p>
        <div className="flex flex-col gap-3">
          {(filterLocation ||
            filterSharedHobbies ||
            filterSharedGoals ||
            filterSharedCommunication ||
            showHighVerbindungenOnly ||
            highCompatibilityFirst ||
            prioritizeInterests ||
            matchIntensity > 0 ||
            filterMaxDistance < 100 ||
            filterMinAge > 18 ||
            filterMaxAge < 99 ||
            filterSpecificInterest !== "") && (
            <button
              onClick={() => {
                setShowHighVerbindungenOnly(false);
                setFilterLocation(null);
                setFilterSharedHobbies(false);
                setFilterSharedGoals(false);
                setFilterSharedCommunication(false);
                setHighCompatibilityFirst(false);
                setFilterMaxDistance(100);
                setFilterMinAge(18);
                setFilterMaxAge(99);
                setFilterSpecificInterest("");
              }}
              className="px-6 py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl font-medium"
            >
              Filter zurücksetzen
            </button>
          )}
          {/* Zweite „Reset für Demo"-Schaltfläche, entfernt am 11.08.2026 —
              siehe Begründung oben. Was hier bleibt, ist das Zurücksetzen
              der bereits gesehenen Profile: Das ist eine reine Anzeigehilfe
              und hebt kein Limit auf. */}
          <button
            onClick={() => {
              setSeenIds([]);
              klarStorage.setItem("klar_seen_ids", JSON.stringify([]));
            }}
            className="px-6 py-3 bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-xl font-medium shadow-md hover:opacity-90 transition-opacity"
          >
            Bereits gesehene erneut zeigen
          </button>
        </div>
      </div>
    );
  }

  // ── ENTFERNT 12.08.2026: `getBatteryIcon` ───────────────────────────────
  // Die Funktion hatte keinen Aufrufer. Sie stammt aus der Zeit vor der
  // gemeinsamen `KontingentAnzeige`, die den Fuellstand heute an einer
  // Stelle darstellt. Der Hinweis von damals — kein Rot, keine kuenstliche
  // Dringlichkeit (§ 12) — gilt weiter und steht dort im Code.
  // ────────────────────────────────────────────────────────────────────────

  const verbindungenInterests = availableProfiles.flatMap((p) => p.interests);
  const uniqueVerbindungenInterests = Array.from(
    new Set(verbindungenInterests),
  ).slice(0, 10);

  // ── FE-07 (Final Audit 08.08.2026) ──────────────────────────────────
  // Diese Rückgabe stand in Zeile 194 — vor 50 weiteren Hooks. Beim
  // Einschalten des Smart-Locks rief React in derselben Komponente 50
  // Hooks weniger auf: „Rendered fewer hooks than expected". Statt der
  // Sperre erschien der Fehlerbildschirm — die Privatsphäre-Funktion
  // hätte also genau dann versagt, wenn man sie braucht.
  // ── 11.08.2026: Sperrbildschirm hierher entfernt ────────────────────────
  // Hier stand ein vollständiger Sperrbildschirm („Smart-Lock Aktiv"), der
  // sich nicht einschalten liess: `setIsLocked(true)` kam im ganzen Projekt
  // nicht vor. Er deckte ausserdem nur das Dashboard ab, während die
  // schutzbedürftigen Inhalte in den Gesprächen stehen.
  //
  // Sein Text versprach „Bitte entsperren (PIN / FaceID)", der Knopf hiess
  // „Entsperren (Demo)" und entsperrte ohne Prüfung — dieselbe Klasse wie
  // „End-to-End gesichert" im Login (§ 5 UWG, entfernt am 09.08.2026).
  //
  // Der Sichtschutz liegt jetzt in `components/Sichtschutz.tsx` und ist in
  // `App.tsx` über allen Routen eingehängt. Er hat einen sichtbaren
  // Einstieg, verdeckt sich beim Wechsel in den Hintergrund selbst, und er
  // sagt auf dem Bildschirm, wovor er NICHT schützt.




const discoverProfileCard = useMemo(() => (
<>
        {/* Wischgesten-Ausschluss (AUD-04): Keine Gesten-Bewertung.
            Entscheidungen erfolgen bewusst über die dedizierten Aktionsschaltflächen unten. */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, x: 0 }}
          exit={{ scale: 0.95, opacity: 0, x: -100 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          key={profile.id}
          className={`flex-1 flex flex-col bg-white dark:bg-stone-800 rounded-2xl overflow-hidden border cursor-pointer transition-colors ${
            walkthroughStep === 2
              ? "relative z-50 scale-[1.02] shadow-md ring-4 ring-brand/50 border-stone-300 dark:border-stone-700"
              : (aiFilterMode && aiKontaktScores && aiKontaktScores[profile.id]
                    ? aiKontaktScores![profile.id]!.score
                    : calculateMatchScore(userInterests, profile.interests)) >=
                  90
                ? "border-yellow-400/50 dark:border-yellow-500/50 shadow-[0_0_25px_-5px_rgba(250,204,21,0.4)] dark:shadow-[0_0_25px_-5px_rgba(234,179,8,0.2)] "
                : "border-stone-300 dark:border-stone-700 "
          }`}
          onClick={() => {
            openProfile(profile);
            setGeneratedIcebreaker(null);
            if (walkthroughStep === 2) {
              nextWalkthroughStep();
            }
          }}
        >
          <div className="h-[45%] bg-stone-200 dark:bg-stone-800 relative animate-pulse">
            <img
              src={profile.photoUrl}
              alt={`Foto von ${profile.name}`}
              className="w-full h-full object-cover absolute inset-0"
              style={{ aspectRatio: "1/1" }}
              loading="lazy"
              width={400}
              height={400}
            />
            {(aiFilterMode && aiKontaktScores && aiKontaktScores[profile.id]
              ? aiKontaktScores![profile.id]!.score
              : calculateMatchScore(userInterests, profile.interests)) >=
              90 && (
              <button
                type="button"
                aria-label="Smart Kontakt Details"
                className="absolute top-4 left-4 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setSmartKontaktDetailProfile(profile);
                }}
              >
                <motion.div
                  initial={{
                    opacity: 0,
                    scale: 0.8,
                    filter: "brightness(0.5)",
                  }}
                  whileInView={{
                    opacity: 1,
                    scale: 1,
                    filter: "brightness(1)",
                    boxShadow: [
                      "0 0 0px rgba(250,204,21,0)",
                      "0 0 30px rgba(250,204,21,0.8)",
                      "0 0 15px rgba(250,204,21,0.4)",
                    ],
                  }}
                  viewport={{ once: true, margin: "-10px" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className=" from-yellow-50 to-amber-50 dark:from-stone-900 dark:to-stone-900/95  border border-yellow-300 dark:border-yellow-600/50 text-yellow-600 dark:text-yellow-500 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer  transition-transform"
                >
                  <Sparkles size={14} className="fill-current" />
                  Smart-Verbindung
                </motion.div>
              </button>
            )}
          </div>
          <div className="p-4 flex flex-col justify-between flex-1 relative overflow-y-auto hide-scrollbar">
            <div className="absolute -top-6 right-6 flex flex-col items-end gap-2">
              {calculateDeepMatch(
                userInterests,
                userInterests,
                profile.values,
                profile.personalityTraits,
                userNoGos,
                noGoStrictness,
              ).isDeepMatch && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full border border-purple-200 dark:border-purple-800/50 shadow-sm shadow-purple-500/10">
                  <Sparkles size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Tiefe Verbindung
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 bg-white dark:bg-stone-800 rounded-full border border-stone-200 dark:border-stone-700 shadow-md p-1.5 pr-3">
                <VerbindungScoreBadge
                  score={
                    aiFilterMode &&
                    aiKontaktScores &&
                    aiKontaktScores[profile.id]
                      ? aiKontaktScores![profile.id]!.score
                      : calculateMatchScore(userInterests, profile.interests)
                  }
                />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 leading-none">
                    KI-basiert
                  </span>
                  <span className="text-xs font-semibold text-brand dark:text-brand-light leading-none mt-0.5">
                    KI-Verbindung
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-serif font-medium text-stone-900 dark:text-stone-100">
                  {profile.name}, {profile.age}
                </h2>
                <ShieldCheck size={20} className="text-blue-500" />
              </div>
              {profile.location && (
                <div className="flex items-center gap-1 text-stone-500 dark:text-stone-400 text-sm mb-3">
                  <MapPin size={14} />
                  <span>
                    {profile.location}
                    {(() => {
                      const coords = cityCoordinates[profile.location];
                      if (userCoords && coords) {
                        return (
                          <span className="ml-2 px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded-md text-xs font-medium">
                            {calculateDistance(
                              userCoords.lat,
                              userCoords.lng,
                              coords.lat,
                              coords.lng,
                            )}{" "}
                            km entfernt
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </span>
                </div>
              )}
              <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-2 mb-3">
                {profile.bio}
              </p>

              {(profileSummary ||
                isLoadingSummary ||
                (aiFilterMode &&
                  aiKontaktScores &&
                  aiKontaktScores[profile.id])) && (
                <div className="mb-4 bg-brand/5 dark:bg-brand-light/5 border border-brand/20 dark:border-brand-light/20 rounded-xl p-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles
                      size={14}
                      className="text-brand dark:text-brand-light shrink-0"
                    />
                    <h4 className="font-semibold text-xs text-brand dark:text-brand-light uppercase tracking-wider">
                      Verbindungs-Tipp
                    </h4>
                  </div>
                  <div className="text-sm text-stone-700 dark:text-stone-300">
                    {isLoadingSummary ? (
                      <div className="space-y-2"><Skeleton className="h-4 w-full bg-brand/20 dark:bg-brand-light/20" /><Skeleton className="h-4 w-3/4 bg-brand/20 dark:bg-brand-light/20" /></div>
                    ) : aiFilterMode &&
                      aiKontaktScores &&
                      aiKontaktScores[profile.id] ? (
                      aiKontaktScores![profile.id]!.reason
                    ) : (
                      profileSummary
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(profile.interests || []).map((interest) => {
                const isMustHave = mustHaveInterests.includes(interest);
                const shared =
                  isMustHave || isInterestShared(interest, userInterests);
                return (
                  <span
                    key={interest}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      isMustHave
                        ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                        : shared
                          ? "bg-brand/10 dark:bg-brand-light/10 border-brand/30 dark:border-brand-light/30 text-brand dark:text-brand-light"
                          : "bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
                    }`}
                  >
                    {isMustHave && (
                      <Star
                        size={12}
                        className="inline mr-1 -mt-0.5 fill-current"
                      />
                    )}
                    {!isMustHave && shared && (
                      <Sparkles size={12} className="inline mr-1 -mt-0.5" />
                    )}
                    {interest}
                  </span>
                );
              })}
            </div>

            <MatchCompatibilityInsights
              userInterests={userInterests}
              profileInterests={profile.interests}
              profileName={profile.name}
            />
          </div>
        </motion.div>

        <div className="pt-6 pb-2 flex items-center justify-center gap-4">
          <button
            onClick={() => handleContact(profile, "pass")}
            className="flex-1 py-4 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <X size={20} />
            <span className="font-medium text-sm uppercase tracking-wider">
              {t("dashboard.actionNext")}
            </span>
          </button>
          <button
            onClick={() => handleContact(profile, "nachricht")}
            className="flex-1 py-4 bg-brand dark:bg-brand-light hover:opacity-90 text-white dark:text-stone-900 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Heart size={20} className="fill-current" />
            <span className="font-medium text-sm uppercase tracking-wider">
              {t("dashboard.actionIcebreaker")}
            </span>
          </button>
        </div>
</>
), [profile, walkthroughStep, aiFilterMode, aiKontaktScores, userInterests, mustHaveInterests, profileSummary, isLoadingSummary, userCoords, handleContact, t, filterSharedHobbies, filterSharedGoals, filterSharedCommunication]);

const inspirationWidgets = useMemo(() => (
<div className="flex flex-col gap-4">
          <BeiSicht>
            <SmartVorschlaegeWidget />
          </BeiSicht>
          <BeiSicht>
            <WeeklyMoodSummaryWidget />
          </BeiSicht>
          <BeiSicht>
            <SafeDatePlannerWidget />
          </BeiSicht>
          <BeiSicht>
            <NextDateCountdownWidget />
          </BeiSicht>
          <BeiSicht>
            <PreDateChecklistWidget />
          </BeiSicht>
          <BeiSicht>
            <ReflectionLogWidget />
          </BeiSicht>
          <KlarCompassWidget userInterests={userInterests} />
          {/* ENTFERNT: EmailSummaryWidget, siehe Kommentar am Import. */}
          <DatingJournalWidget userInterests={userInterests} />
          {/* ENTFERNT: QualityConversationsChartWidget, siehe Kommentar am Import. */}
          {/* BEFUND 12.08.2026: Hier stand `verbindungenInterests={…}`.
              `DailyIcebreakerWidget` kennt diese Eigenschaft nicht — sie
              heisst `matchesInterests`. Der Wert wurde also verworfen, und
              das Widget schickte `matchesInterests: undefined` an
              /api/daily-icebreaker. Die Gespraechsanfaenge des Tages waren
              damit ohne jeden Bezug zu den Interessen der Verbindungen. */}
          <DailyIcebreakerWidget
            userInterests={userInterests}
            matchesInterests={uniqueVerbindungenInterests}
          />
          <SmartDatePlannerWidget location={filterLocation} />
          <DatingJournalWidget userInterests={userInterests} />
          {/* ENTFERNT: QualityConversationsChartWidget, siehe Kommentar am Import. */}
          {/* BEFUND 12.08.2026: Hier stand `verbindungenInterests={…}`.
              `DailyIcebreakerWidget` kennt diese Eigenschaft nicht — sie
              heisst `matchesInterests`. Der Wert wurde also verworfen, und
              das Widget schickte `matchesInterests: undefined` an
              /api/daily-icebreaker. Die Gespraechsanfaenge des Tages waren
              damit ohne jeden Bezug zu den Interessen der Verbindungen. */}
          <DailyIcebreakerWidget
            userInterests={userInterests}
            matchesInterests={uniqueVerbindungenInterests}
          />
          <SmartDatePlannerWidget location={filterLocation} />
          <BeiSicht>
            <DateInspirationTab
              userInterests={userInterests}
              userCoords={userCoords}
            />
          </BeiSicht>
        </div>
), [userInterests, uniqueVerbindungenInterests, filterLocation, userCoords]);

  return (
    <Profiler id="Dashboard" onRender={onRenderCallback}>
    <div
      className={`h-full flex flex-col p-4 relative transition-colors duration-1000 ${getBackgroundMilestoneClass()}`}
    >
      <LocalLaunchWidget />
      <DailyCoachAffirmation />
      <DashboardDateBanner />
      <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl mb-4 shrink-0 relative z-10">
        <button
          onClick={() => setActiveTab("discover")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "discover" ? "bg-white dark:bg-stone-700 shadow-sm text-brand dark:text-brand-light" : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"}`}
        >
          {t("dashboard.tabDiscover")}
        </button>
        <button
          onClick={() => setActiveTab("inspiration")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "inspiration" ? "bg-white dark:bg-stone-700 shadow-sm text-brand dark:text-brand-light" : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"}`}
        >
          {t("dashboard.tabInspiration")}
        </button>
      </div>

      {/* ── Ablehnung des Servers, im Wortlaut ──────────────────────────────
          Drei Fälle mit drei verschiedenen Antworten: Kontingent erschöpft,
          nicht verifiziert, bereits angeschrieben. Die Verifizierung ist der
          einzige, aus dem heraus es weitergeht — deshalb steht dort ein Weg
          und keine Sackgasse. */}
      {kontaktFehler && (
        <div
          role="alert"
          className="mb-3 shrink-0 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4"
        >
          <p className="text-sm text-stone-700 dark:text-stone-300">
            {kontaktFehler}
          </p>
          {kontaktFehler.includes("Verifizierung") && (
            <a
              href="/verifizierung"
              className="mt-3 inline-block px-4 py-2 rounded-xl bg-brand dark:bg-brand-light text-white dark:text-stone-900 text-sm font-medium"
            >
              Jetzt verifizieren
            </a>
          )}
          <button
            onClick={() => setKontaktFehler(null)}
            className="mt-3 ml-3 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 underline"
          >
            Schliessen
          </button>
        </div>
      )}

      <div
        className={`flex-1 flex-col overflow-hidden relative ${activeTab === "discover" ? "flex" : "hidden"}`}
      >
        <AnimatePresence>
          {walkthroughStep > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 z-40 pointer-events-auto"
              onClick={nextWalkthroughStep}
            >
              {walkthroughStep === 1 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-stone-800 p-6 rounded-2xl max-w-sm w-11/12 text-center">
                  <Sparkles
                    size={32}
                    className="text-brand dark:text-brand-light mx-auto mb-4"
                  />
                  <h3 className="text-xl font-serif text-stone-900 dark:text-stone-100 mb-2">
                    Finde genau was du suchst
                  </h3>
                  <p className="text-stone-600 dark:text-stone-400 mb-6 text-sm">
                    Nutze die neuen Filter-Chips, um Profile nach deinen
                    aktuellen Interessen zu filtern. Klicke auf ein Interesse,
                    um nur dazu passende Verbindungen zu sehen.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={skipWalkthrough}
                      className="flex-1 py-3 text-stone-600 dark:text-stone-400 font-medium text-sm"
                    >
                      Überspringen
                    </button>
                    <button
                      onClick={nextWalkthroughStep}
                      className="flex-1 py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl font-medium text-sm shadow-sm hover:opacity-90"
                    >
                      {t("dashboard.actionNext")}
                    </button>
                  </div>
                </div>
              )}

              {walkthroughStep === 2 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-stone-800 p-6 rounded-2xl max-w-sm w-11/12 text-center">
                  <Info
                    size={32}
                    className="text-brand dark:text-brand-light mx-auto mb-4"
                  />
                  <h3 className="text-xl font-serif text-stone-900 dark:text-stone-100 mb-2">
                    Lerne deine Verbindung kennen
                  </h3>
                  <p className="text-stone-600 dark:text-stone-400 mb-6 text-sm">
                    Tippe einfach auf eine Profilkarte, um mehr über die
                    Interessen, Hobbys und eine ausführliche Bio der Person zu
                    erfahren.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={nextWalkthroughStep}
                      className="w-full py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl font-medium text-sm shadow-sm hover:opacity-90"
                    >
                      Verstanden
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ y: -50, opacity: 0, x: "-50%" }}
              animate={{ y: 0, opacity: 1, x: "-50%" }}
              exit={{ y: -50, opacity: 0, x: "-50%" }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="fixed top-28 left-1/2 z-[100] bg-brand dark:bg-brand-light text-white dark:text-stone-900 px-4 py-3 rounded-2xl shadow-md flex items-center justify-between gap-3 w-11/12 max-w-sm border border-white/20"
            >
              <span className="text-sm font-medium">
                {notification.message}
              </span>
              {notification.onUndo && (
                <button
                  onClick={notification.onUndo}
                  className="text-xs font-bold bg-white/20 px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors"
                >
                  Rückgängig
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === "discover" && (
          <div className="absolute top-0 right-0 p-4 z-50 pointer-events-none w-full">
            <div className="flex justify-end gap-2 pointer-events-auto">
              <button
                onClick={() => setShowFilterSheet(true)}
                className="p-2.5 bg-white dark:bg-stone-800 rounded-full shadow-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors border border-stone-100 dark:border-stone-700"
                aria-label="Filter"
              >
                <Filter size={20} />
              </button>
            </div>
          </div>
        )}

        {/* P0-1: Die oeffnende <AnimatePresence> fehlte. Das schliessende Tag
          in Zeile 1139 hatte keine Entsprechung — daher der Fehler
          "Expected corresponding JSX closing tag for div". Der Wrapper ist
          noetig, weil der Block eine exit-Animation benutzt. */}
        <AnimatePresence>
          {showFilterSheet && (
            <div className="fixed inset-0 bg-black/50 z-[200] flex justify-end">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-4/5 max-w-sm h-full bg-white dark:bg-stone-800 shadow-sm overflow-y-auto"
              >
                <div className="p-4 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-stone-800/80  z-10">
                  <h2 className="font-serif text-xl text-stone-900 dark:text-stone-100">
                    Filter
                  </h2>
                  <button
                    aria-label="Filter schließen"
                    onClick={() => setShowFilterSheet(false)}
                    className="p-2 text-stone-500 hover:text-stone-900 dark:hover:text-white rounded-full bg-stone-100 dark:bg-stone-800"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-4 space-y-6 pb-24">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        KI-Deep-Kontakt
                      </span>
                      <label aria-label="KI-Deep-Kontakt aktivieren" className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                        <input
                          id="filter-ki-deep-verbindung"
                          name="filter-ki-deep-verbindung"
                          type="checkbox"
                          checked={aiFilterMode}
                          onChange={async (e) => {
                            const checked = e.target.checked;
                            setAiFilterMode(checked);
                            if (checked && !aiKontaktScores) {
                              setIsCalculatingAiScores(true);
                              try {
                                // BEFUND 10.08.2026: Hier stand "/api/ai-match".
                                // Diese Route gibt es in server.ts nicht — der
                                // Endpunkt heisst /api/ai-passgenauigkeit und
                                // erwartet genau diese Nutzlast. Offenbar wurde
                                // er umbenannt und der Client nie nachgezogen.
                                // Der Schalter „KI-Deep-Kontakt" konnte damit nie
                                // funktionieren; der Fehler wurde abgefangen und
                                // der Schalter setzte sich still zurück.
                                //
                                // `name` fehlte ausserdem in der Nutzlast, obwohl
                                // der Prompt ihn benutzt — dort stand bisher
                                // „Name: undefined" für jedes Profil.
                                const res = await fetch(
                                  "/api/ai-passgenauigkeit",
                                  {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      userInterests,
                                      profiles: availableProfiles.map((p) => ({
                                        id: p.id,
                                        name: p.name,
                                        bio: p.bio,
                                        interests: p.interests,
                                      })),
                                    }),
                                  },
                                );
                                if (!res.ok)
                                  throw new Error("API request failed");
                                // BEFUND 12.08.2026: Hier stand `data.reduce(…)`
                                // mit `any`. Antwortet der Server mit einem
                                // Objekt statt einer Liste — etwa
                                // `{ error: … }` —, gibt es kein `.reduce`,
                                // und der Klick endet in einem TypeError.
                                const roh: unknown = JSON.parse(
                                  (await res.text()) || "[]",
                                );
                                const scoresMap: Record<
                                  string,
                                  { score: number; reason: string }
                                > = {};
                                if (Array.isArray(roh)) {
                                  for (const eintrag of roh) {
                                    if (
                                      eintrag === null ||
                                      typeof eintrag !== "object"
                                    )
                                      continue;
                                    const o = eintrag as Record<
                                      string,
                                      unknown
                                    >;
                                    if (typeof o["id"] !== "string") continue;
                                    scoresMap[o["id"]] = {
                                      score:
                                        typeof o["score"] === "number"
                                          ? o["score"]
                                          : 0,
                                      reason:
                                        typeof o["reason"] === "string"
                                          ? o["reason"]
                                          : "",
                                    };
                                  }
                                }
                                setAiKontaktScores(scoresMap);
                              } catch (err) {
                                melde("Dashboard.calculateAiScores", err);
                                setAiFilterMode(false);
                              } finally {
                                setIsCalculatingAiScores(false);
                              }
                            }
                          }}
                          className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-stone-200 dark:border-stone-700 checked:right-0 checked:border-brand dark:checked:border-brand-light transition-all"
                        />
                        <div className="toggle-label block overflow-hidden h-5 rounded-full bg-stone-200 dark:bg-stone-700"></div>
                      </label>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Sortiert Profile nach echter psychologischer
                      Passgenauigkeit (analysiert durch KI).
                    </p>
                    {isCalculatingAiScores && (
                      <div className="mt-2 text-xs text-brand font-medium  flex items-center gap-1">
                        <div className="w-3 h-3 bg-brand/50 rounded-full " />
                        Analysiere Profile tiefgründig...
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="filter-matching-intensitaet"
                      className="text-xs text-stone-500 dark:text-stone-400 mb-1.5 flex justify-between"
                    >
                      <span>Kontakting-Intensität</span>
                      <span className="font-medium text-brand dark:text-brand-light">
                        {matchIntensity === 0
                          ? "Offen für Neues"
                          : matchIntensity < 50
                            ? "Etwas selektiver"
                            : matchIntensity < 80
                              ? "Starke Verbindungen"
                              : "Präzise Verbindungen"}
                      </span>
                    </label>
                    <input
                      id="filter-matching-intensitaet"
                      name="filter-matching-intensitaet"
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={matchIntensity}
                      onChange={(e) =>
                        setKontaktIntensity(parseInt(e.target.value))
                      }
                      className="w-full accent-brand dark:accent-brand-light"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400 mt-1">
                      <span>Offen</span>
                      <span>Präzise</span>
                    </div>
                  </div>

                  {userCoords && (
                    <div>
                      <label
                        htmlFor="filter-max-distanz"
                        className="text-xs text-stone-500 dark:text-stone-400 mb-1.5 flex justify-between"
                      >
                        <span>Maximale Distanz</span>
                        <span className="font-medium text-brand dark:text-brand-light">
                          {filterMaxDistance < 100
                            ? `${filterMaxDistance} km`
                            : "Egal"}
                        </span>
                      </label>
                      <input
                        id="filter-max-distanz"
                        name="filter-max-distanz"
                        type="range"
                        min="5"
                        max="100"
                        step="5"
                        value={filterMaxDistance}
                        onChange={(e) =>
                          setFilterMaxDistance(parseInt(e.target.value))
                        }
                        className="w-full accent-brand dark:accent-brand-light"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-stone-500 dark:text-stone-400 mb-1.5 flex justify-between">
                      <span>Alter</span>
                      <span className="font-medium text-brand dark:text-brand-light">
                        {filterMinAge} -{" "}
                        {filterMaxAge === 99 ? "99+" : filterMaxAge} Jahre
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="filter-alter-min"
                        name="filter-alter-min"
                        type="number"
                        min="18"
                        max="99"
                        value={filterMinAge}
                        onChange={(e) =>
                          setFilterMinAge(
                            Math.min(
                              parseInt(e.target.value) || 18,
                              filterMaxAge,
                            ),
                          )
                        }
                        className="w-full bg-stone-100 dark:bg-stone-800 border border-transparent rounded-xl px-3 py-2 text-sm text-center text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand/50"
                      />
                      <span className="text-stone-400">-</span>
                      <input
                        id="filter-alter-max"
                        name="filter-alter-max"
                        type="number"
                        min="18"
                        max="99"
                        value={filterMaxAge}
                        onChange={(e) =>
                          setFilterMaxAge(
                            Math.max(
                              parseInt(e.target.value) || 99,
                              filterMinAge,
                            ),
                          )
                        }
                        className="w-full bg-stone-100 dark:bg-stone-800 border border-transparent rounded-xl px-3 py-2 text-sm text-center text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="filter-interesse"
                      className="text-xs text-stone-500 dark:text-stone-400 mb-1.5 block"
                    >
                      Interesse suchen
                    </label>
                    <input
                      id="filter-interesse"
                      name="filter-interesse"
                      type="text"
                      placeholder="z.B. Yoga, Klettern..."
                      value={filterSpecificInterest}
                      onChange={(e) =>
                        setFilterSpecificInterest(e.target.value)
                      }
                      onBlur={() => saveSearchHistory(filterSpecificInterest)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          saveSearchHistory(filterSpecificInterest);
                        }
                      }}
                      className="w-full bg-stone-100 dark:bg-stone-800 border border-transparent rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand/50"
                    />
                    {searchHistory.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(searchHistory || []).map((search, i) => (
                          <button
                            key={i}
                            onClick={() => setFilterSpecificInterest(search)}
                            className="px-2 py-1 bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-[10px] font-medium"
                          >
                            {search}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="filter-standort"
                      className="text-xs text-stone-500 dark:text-stone-400 mb-1.5 block"
                    >
                      Standort
                    </label>
                    <div className="relative">
                      <select
                        id="filter-standort"
                        name="filter-standort"
                        value={filterLocation || ""}
                        onChange={(e) =>
                          setFilterLocation(e.target.value || null)
                        }
                        className="w-full bg-stone-100 dark:bg-stone-800 border border-transparent rounded-xl px-4 py-2.5 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand/50 appearance-none"
                      >
                        <option value="">Alle Standorte</option>
                        {(uniqueLocations || []).map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div
          className={`mb-4 transition-all ${walkthroughStep === 1 ? "relative z-50 ring-4 ring-brand/50 bg-white dark:bg-stone-800 rounded-xl p-2 -mx-2" : ""}`}
        >
          <SmartMatchFilter
            filterSharedHobbies={filterSharedHobbies}
            onFilterSharedHobbiesChange={setFilterSharedHobbies}
            filterSharedGoals={filterSharedGoals}
            onFilterSharedGoalsChange={setFilterSharedGoals}
            filterSharedCommunication={filterSharedCommunication}
            onFilterSharedCommunicationChange={setFilterSharedCommunication}
          />
        </div>

        {discoverProfileCard}
        <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 mb-2 -mx-4 px-4 pb-6 pt-2 [&:not(:has(>div:not(:empty)))]:hidden">
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <WeeklyMilestoneRevealWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <WeeklySuccessSummaryWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden"></div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <ValuesQuizWidget onComplete={handleQuizComplete} />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <BeiSicht vorlauf="150px" platzhalterHoehe="12rem">
              <CompatibilityRadarWidget
                userInterests={userInterests}
                verbindungen={availableProfiles}
              />
            </BeiSicht>
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DailyMoodCheckInWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <BeiSicht vorlauf="150px" platzhalterHoehe="12rem">
              <MoodMonitorWidget />
            </BeiSicht>
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <ProfileCheckWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <QuickPreparationCountdownWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatePlannerWidget
              userInterests={userInterests}
              location={filterLocation}
              profiles={serverProfiles}
            />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <CityInsiderWidget location={filterLocation} />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <SmartDatingDiaryWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DateDiaryStatsWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <ClarityScoreWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DateSuccessRadarWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingTimelineWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <WeeklyConsistencyWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DailyGoalRingsWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DateMoodStreakWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingReadinessWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DailyCoachInsightWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DateMoodChartWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <NextDateWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <BeiSicht vorlauf="150px" platzhalterHoehe="12rem">
              <CityTrendRadarWidget location={filterLocation} />
            </BeiSicht>
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <BeiSicht vorlauf="150px" platzhalterHoehe="12rem">
              <DatePreparationChecklistWidget userInterests={userInterests} />
            </BeiSicht>
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DateReflectionJournalWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <PastDatesArchiveWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DateMemoriesWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingHappinessScoreWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <VerbindungContextAnalysisWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingFocusModeWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <BreathingExerciseWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <BeiSicht vorlauf="150px" platzhalterHoehe="12rem">
              <SituationalIcebreakerWidget userInterests={userInterests} profiles={serverProfiles} />
            </BeiSicht>
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <MatchIcebreakersWidget profiles={serverProfiles} />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <YearInReviewWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DateRatingChartWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DateSuccessTrendWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingHealthWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingRitualWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <MatchCompassWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <SmartVerbindungBadgeWidget />
          </div>
          {/* 14.08.2026 ENTFERNT: <DatingMilestonesWidget /> — die dritte
            Meilenstein-Anzeige. Sie zeigte sieben Eintraege, von denen
            fuenf fest auf `false` standen („P2: war fest verdrahtet") und
            damit dauerhaft grau blieben. Die zwei erreichbaren sind in
            `src/lib/meilensteine.ts` aufgegangen; die Anzeige dazu steht
            weiter unten als <Meilensteine />. */}
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <SmartDateReminderWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DataExportWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingSuccessScoreWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DailyAffirmationWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingGoalProgressWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <MonthlyMoodAreaWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DateTypePieChartWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            {!isFocusMode && <ReflectionInsightDashboard />}
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <MoodInsightWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <MiniCalendarWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingGoalRoadmapWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingSuccessArchiveWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            {/* ENTFERNT: DatingProgressChartWidget, siehe Kommentar am Import. */}
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DatingKarmaWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <MoodDiaryWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <PopularDateIdeasWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            {!isFocusMode && <WeeklyTimelineWidget />}
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <SuccessDashboardWidget />
          </div>
          {/* ENTFERNT: ConversationStatsWidget, siehe Kommentar am Import. */}
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <UpcomingDateWidget />
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            {!isFocusMode && <DailyPulseWidget />}
          </div>
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <DailyGoalTracker />
          </div>

          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <SocialEnergyWidget />
          </div>

          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <WeeklyConsistencyTracker />
          </div>
          {/* ENTFERNT: DatingWheelStatsWidget, siehe Kommentar am Import. */}
          <div className="min-w-[85%] max-w-md snap-center shrink-0 empty:hidden">
            <TrendingInterestsWidget location={filterLocation} />
            <BeiSicht>
              <VerbindungInterestsTagCloudWidget
                verbindungen={availableProfiles}
              />
            </BeiSicht>
            <BeiSicht>
              <DailyTaskWidget isCompleted={availableProfiles.length === 0} />
            </BeiSicht>
            <BeiSicht>
              <DailyUsageRitualWidget />
            </BeiSicht>
            <BeiSicht>
              <ActivitySummaryWidget />
            </BeiSicht>
            <BeiSicht vorlauf="150px" platzhalterHoehe="12rem">
              <KlarInsightsWidget />
            </BeiSicht>
          </div>
        </div>

        <SmartVerbindungCarousel
          profiles={availableProfiles}
          userInterests={userInterests}
          onProfileClick={(profile: Profile) => {
            openProfile(profile);
            setGeneratedIcebreaker(null);
          }}
        />

        <KlarMatchWidget
          onProfileClick={(profile: Profile) => {
            openProfile(profile);
            setGeneratedIcebreaker(null);
          }}
        />
        <BeiSicht>
          <TodayFeelingTrackerWidget />
        </BeiSicht>

        <BeiSicht>
          <ActivityChartWidget />
        </BeiSicht>
        <BeiSicht>
          <MiniDiaryWidget />
        </BeiSicht>
        <BeiSicht>
          <DatingWheelWidget />
        </BeiSicht>
        <BeiSicht>
          <SuccessSummaryWidget />
        </BeiSicht>
        <BeiSicht>
          <WheelStatsWidget />
        </BeiSicht>
        <BeiSicht>
          <DatingDuelWidget />
        </BeiSicht>
        <Meilensteine />
        <BeiSicht>
          <DailyMoodWidget />
        </BeiSicht>
        <BeiSicht>
          <RecentIntrosWidget />
        </BeiSicht>

        <AnimatePresence>
          {modalProfile && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 z-40"
                onClick={() => setModalProfile(null)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={`absolute inset-x-0 bottom-0 top-16 bg-white dark:bg-stone-800 z-50 rounded-t-3xl flex flex-col overflow-hidden shadow-md border-t-2 ${
                  (aiFilterMode &&
                  aiKontaktScores &&
                  aiKontaktScores[modalProfile.id]
                    ? aiKontaktScores![modalProfile.id]!.score
                    : calculateMatchScore(
                        userInterests,
                        modalProfile.interests,
                      )) >= 90
                    ? "border-yellow-400/50 dark:border-yellow-500/50 shadow-[0_-10px_40px_-10px_rgba(250,204,21,0.3)] dark:shadow-[0_-10px_40px_-10px_rgba(234,179,8,0.2)]"
                    : "border-transparent"
                }`}
              >
                <div className="relative h-2/5 shrink-0 bg-stone-200 dark:bg-stone-800">
                  <img
                    src={modalProfile.photoUrl}
                    alt={`Foto von ${modalProfile.name}`}
                    className="w-full h-full object-cover"
                    width={600}
                    height={400}
                  />
                  {(aiFilterMode &&
                  aiKontaktScores &&
                  aiKontaktScores[modalProfile.id]
                    ? aiKontaktScores![modalProfile.id]!.score
                    : calculateMatchScore(
                        userInterests,
                        modalProfile.interests,
                      )) >= 90 && (
                    <button
                      type="button"
                      aria-label="Smart Kontakt Details"
                      className="absolute top-4 left-4 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSmartKontaktDetailProfile(modalProfile);
                      }}
                    >
                      <motion.div
                        initial={{
                          opacity: 0,
                          scale: 0.8,
                          filter: "brightness(0.5)",
                        }}
                        whileInView={{
                          opacity: 1,
                          scale: 1,
                          filter: "brightness(1)",
                          boxShadow: [
                            "0 0 0px rgba(250,204,21,0)",
                            "0 0 30px rgba(250,204,21,0.8)",
                            "0 0 15px rgba(250,204,21,0.4)",
                          ],
                        }}
                        viewport={{ once: true, margin: "-10px" }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className=" from-yellow-50 to-amber-50 dark:from-stone-900 dark:to-stone-900/95  border border-yellow-300 dark:border-yellow-600/50 text-yellow-600 dark:text-yellow-500 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer  transition-transform"
                      >
                        <Sparkles size={14} className="fill-current" />
                        Smart-Verbindung
                      </motion.div>
                    </button>
                  )}
                  <button
                    aria-label="Profil schließen"
                    onClick={() => setModalProfile(null)}
                    className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/40  rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-3xl font-serif font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
                        {modalProfile.name}, {modalProfile.age}
                        <ShieldCheck size={24} className="text-blue-500" />
                      </h2>
                      {modalProfile.location && (
                        <div className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 mt-2">
                          <MapPin size={16} />
                          <span>
                            {modalProfile.location}
                            {(() => {
                              const coords =
                                cityCoordinates[modalProfile.location];
                              if (userCoords && coords) {
                                return (
                                  <span className="ml-2 px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded-md text-xs font-medium">
                                    {calculateDistance(
                                      userCoords.lat,
                                      userCoords.lng,
                                      coords.lat,
                                      coords.lng,
                                    )}{" "}
                                    km entfernt
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/50 rounded-full border border-stone-200 dark:border-stone-700 shadow-sm p-1.5 pr-3">
                      <VerbindungScoreBadge
                        score={
                          aiFilterMode &&
                          aiKontaktScores &&
                          aiKontaktScores[modalProfile.id]
                            ? aiKontaktScores![modalProfile.id]!.score
                            : calculateMatchScore(
                                userInterests,
                                modalProfile.interests,
                              )
                        }
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-500 leading-none">
                          KI-basiert
                        </span>
                        <span className="text-xs font-semibold text-brand dark:text-brand-light leading-none mt-0.5">
                          KI-Verbindung
                        </span>
                      </div>
                    </div>
                    {calculateDeepMatch(
                      userInterests,
                      userInterests,
                      modalProfile.values,
                      modalProfile.personalityTraits,
                      userNoGos,
                      noGoStrictness,
                    ).isDeepMatch && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full border border-purple-200 dark:border-purple-800/50">
                        <Sparkles size={14} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          Tiefe Verbindung
                        </span>
                      </div>
                    )}
                  </div>

                  {(profileSummary ||
                    isLoadingSummary ||
                    (aiFilterMode &&
                      aiKontaktScores &&
                      aiKontaktScores[modalProfile.id])) && (
                    <div className="bg-brand/5 dark:bg-brand-light/5 border border-brand/20 dark:border-brand-light/20 rounded-xl p-4 mb-8 flex gap-3 items-start">
                      <div className="bg-brand/10 dark:bg-brand-light/10 p-2 rounded-lg shrink-0">
                        <Sparkles
                          size={20}
                          className="text-brand dark:text-brand-light"
                        />
                      </div>
                      <div>
                        <h4 className="font-medium text-stone-900 dark:text-stone-100 text-sm mb-1">
                          Individueller Verbindungs-Tipp
                        </h4>
                        <div className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
                          {isLoadingSummary ? (
                            <div className="space-y-2 mt-1"><Skeleton className="h-4 w-full bg-brand/20 dark:bg-brand-light/20" /><Skeleton className="h-4 w-3/4 bg-brand/20 dark:bg-brand-light/20" /></div>
                          ) : aiFilterMode &&
                            aiKontaktScores &&
                            aiKontaktScores[modalProfile.id] ? (
                            aiKontaktScores![modalProfile.id]!.reason
                          ) : (
                            profileSummary
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-3 border-b border-stone-200 dark:border-stone-700 pb-2">
                      Über mich
                    </h3>
                    <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-lg">
                      {modalProfile.bio}
                    </p>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-3 border-b border-stone-200 dark:border-stone-700 pb-2">
                      Interessen
                    </h3>
                    <div className="flex flex-wrap gap-2.5">
                      {(modalProfile.interests || []).map((interest) => {
                        const isMustHave = mustHaveInterests.includes(interest);
                        const shared =
                          isMustHave ||
                          isInterestShared(interest, userInterests);
                        return (
                          <span
                            key={interest}
                            className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                              isMustHave
                                ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                                : shared
                                  ? "bg-brand/10 dark:bg-brand-light/10 border-brand/30 dark:border-brand-light/30 text-brand dark:text-brand-light"
                                  : "bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300"
                            }`}
                          >
                            {isMustHave && (
                              <Star
                                size={14}
                                className="inline mr-1.5 -mt-0.5 fill-current"
                              />
                            )}
                            {!isMustHave && shared && (
                              <Sparkles
                                size={14}
                                className="inline mr-1.5 -mt-0.5"
                              />
                            )}
                            {interest}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <MatchCompatibilityInsights
                    userInterests={userInterests}
                    profileInterests={modalProfile.interests}
                    profileName={modalProfile.name}
                  />

                  <VerbindungOptimizerWidget
                    userInterests={userInterests}
                    profile={modalProfile}
                  />

                  <div className="mt-8 mb-4">
                    <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-3 border-b border-stone-200 dark:border-stone-700 pb-2 flex items-center gap-2">
                      <Sparkles
                        size={18}
                        className="text-brand dark:text-brand-light"
                      />
                      KI-{t("dashboard.actionIcebreaker")}
                    </h3>
                    {generatedIcebreaker ? (
                      <div className="bg-brand/10 dark:bg-brand-light/10 border border-brand/20 dark:border-brand-light/20 rounded-xl p-4 relative">
                        <Sparkles
                          size={20}
                          className="text-brand dark:text-brand-light absolute top-4 right-4 opacity-50"
                        />
                        <p className="text-stone-800 dark:text-stone-200 font-medium italic pr-8 leading-relaxed">
                          "{generatedIcebreaker}"
                        </p>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              setModalProfile(null);
                              handleContact(modalProfile, "nachricht");
                            }}
                            className="flex-1 py-2.5 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                          >
                            <Heart size={16} className="fill-current" />
                            Senden
                          </button>
                          <button
                            onClick={() =>
                              handleGenerateIcebreaker(modalProfile)
                            }
                            className="px-4 py-2.5 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg text-sm font-medium hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors"
                          >
                            Neu generieren
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGenerateIcebreaker(modalProfile)}
                        disabled={isGeneratingIcebreaker}
                        className="w-full py-4 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 transition-opacity group hover:opacity-90 disabled:opacity-70 disabled:pointer-events-none"
                      >
                        {isGeneratingIcebreaker ? (
                          <Skeleton className="w-6 h-6 rounded-full bg-white/50 dark:bg-stone-800/50" />
                        ) : (
                          <Sparkles
                            size={24}
                            className="group- transition-transform"
                          />
                        )}
                        <span className="font-semibold text-sm">
                          {isGeneratingIcebreaker
                            ? "Analysiere eure Interessen..."
                            : "Personalisierten Icebreaker generieren"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-stone-800 border-t border-stone-200 dark:border-stone-700 flex gap-4">
                  <button
                    onClick={() => {
                      setModalProfile(null);
                      handleContact(modalProfile, "pass");
                    }}
                    className="flex-1 py-4 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <X size={20} />
                    <span className="font-medium text-sm uppercase tracking-wider">
                      {t("dashboard.actionNext")}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setModalProfile(null);
                      handleContact(modalProfile, "nachricht");
                    }}
                    className="flex-1 py-4 bg-brand dark:bg-brand-light hover:opacity-90 text-white dark:text-stone-900 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Heart size={20} className="fill-current" />
                    <span className="font-medium text-sm uppercase tracking-wider">
              {t("dashboard.actionIcebreaker")}
                    </span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {smartKontaktDetailProfile && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
                onClick={() => setSmartKontaktDetailProfile(null)}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed z-[70] bg-white dark:bg-stone-800 rounded-3xl overflow-hidden shadow-md max-w-sm w-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-stone-200 dark:border-stone-700"
              >
                <div className=" from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 p-5 relative overflow-hidden">
                  <button
                    aria-label="Details schließen"
                    onClick={() => setSmartKontaktDetailProfile(null)}
                    className="absolute top-4 right-4 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
                  >
                    <X size={20} />
                  </button>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white dark:bg-stone-800/80 p-2 rounded-full shadow-sm text-yellow-500">
                      <Sparkles size={20} className="fill-current" />
                    </div>
                    <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                      Smart-Verbindung!
                    </h3>
                  </div>
                  <p className="text-sm text-stone-700 dark:text-stone-300">
                    Warum passt{" "}
                    <span className="font-semibold">
                      {smartKontaktDetailProfile.name}
                    </span>{" "}
                    so gut zu dir?
                  </p>
                </div>

                <div className="p-5">
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Passgenauigkeit
                      </h4>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {calculateMatchScore(
                          userInterests,
                          smartKontaktDetailProfile.interests,
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-emerald-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${calculateMatchScore(userInterests, smartKontaktDetailProfile.interests)}%`,
                        }}
                        transition={{
                          duration: 1,
                          delay: 0.2,
                          ease: "easeOut",
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                      Gemeinsame Interessen
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(smartKontaktDetailProfile.interests || [])
                        .filter((i) => isInterestShared(i, userInterests))
                        .map((interest) => {
                          const isMustHave =
                            mustHaveInterests.includes(interest);
                              return (
                            <div
                              key={interest}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                                isMustHave
                                  ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/50 text-yellow-700 dark:text-yellow-400"
                                  : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {isMustHave ? (
                                <Star size={12} className="fill-current" />
                              ) : (
                                <Heart size={12} className="fill-current" />
                              )}
                              {interest}
                              {isMustHave && (
                                <span className="text-[10px] opacity-70 ml-1">
                                  (Must-have)
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={() => setSmartKontaktDetailProfile(null)}
                      className="w-full py-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-medium text-sm transition-colors"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

                <SmartVerbindungTutorialOverlay />

        {/* ENTFERNT 11.08.2026 — schwebender Herz-Knopf unten rechts.
          Hier stand ein runder Knopf (`fixed bottom-24 right-4 z-40`) mit
          einem gefuellten Herzen. Drei Befunde:

            1. Das Herz verspricht „gefaellt mir". Getan hat er etwas
               anderes: `setModalProfile(availableProfiles[0])` — er oeffnete
               die Profilkarte. Dasselbe leistet ein Tipp auf die Karte.
            2. Auf der Registerkarte „{t("dashboard.tabInspiration")}" war er wirkungslos. Der
               Rumpf des `onClick` steht vollstaendig in
               `if (activeTab === 'discover')`; auf der anderen Registerkarte
               wechselte nur das Symbol zu `Sparkles`, und ein Tipp bewirkte
               nichts.
            3. Er stand an derselben schwebenden Stelle, aus der am selben
               Tag der Sichtschutz und der Theme-Knopf in die Systemleiste
               verlegt wurden.

          Ersatzlos entfernt (Entscheidung des Auftraggebers, 11.08.2026).
          Es geht keine Funktion verloren: Die Profilkarte bleibt
          unveraendert antippbar. */}
      </div>

      {/* 11.08.2026: Hier stand <QuickThemeToggle />. Der Knopf war damit
          ausschliesslich im Dashboard vorhanden — auf Profil, Chats, Coach,
          Tipps und im Chat gab es ihn nicht. Er steht jetzt in der
          Systemleiste in App.tsx und ist auf jedem Bildschirm erreichbar. */}

      <div
        className={`flex-1 overflow-y-auto hide-scrollbar pb-24 ${activeTab === "inspiration" ? "block" : "hidden"}`}
      >
        {inspirationWidgets}
      </div>

      <MonetizationChoiceModal
        isOpen={showMonetizationModal}
        onClose={() => setShowMonetizationModal(false)}
        isLoadingAd={isLoadingAd}
        onWatchAd={() => {
          setIsLoadingAd(true);
          setTimeout(() => {
            setIsLoadingAd(false);
            setShowMonetizationModal(false);
            setNotification({
              id: "ad_reward_" + Date.now(),
              message: "Werbespot abgeschlossen. Kontingent wird synchronisiert...",
            });
            meldeKontaktVerbraucht();
          }, 600);
        }}
      />
    </div>
    </Profiler>
  );
}

