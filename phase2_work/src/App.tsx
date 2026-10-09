import { useNavigate, useLocation } from "react-router";
import { getUserStorageItem, setUserStorageItem, klarStorage } from './lib/userScopedStorage';
import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { Sichtschutz } from "./components/Sichtschutz";
import { RegistrierungsGate } from "./components/RegistrierungsGate";
import { ContractLinks } from './components/ContractLinks';
import { MagicLinkGate } from './components/MagicLinkGate';
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n/config";
import { LanguagePreferenceProvider } from './i18n/LanguagePreference';
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotificationService } from "./services/notificationService";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { AppSkeleton } from "./components/SkeletonScreen";
import { hapticFeedback } from "./lib/haptics";
import { useOnline } from "./lib/useOnline";
import { Layout } from "./components/Layout";
import { SyncBanner } from "./components/SyncBanner";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { doc, onSnapshot } from "firebase/firestore";
import type { DocumentSnapshot, FirestoreError } from "firebase/firestore";
import { db } from "./lib/firebase";

export { Layout } from "./components/Layout";

const AuthGate = lazy(() => import("./components/AuthGate").then(m => ({ default: m.AuthGate })));
const SUSFeedbackModal = lazy(() => import("./components/SUSFeedbackModal").then(m => ({ default: m.SUSFeedbackModal })));
const DashboardOnboarding = lazy(() => import("./components/DashboardOnboarding").then(m => ({ default: m.DashboardOnboarding })));
const MaintenanceOverlay = lazy(() => import("./components/MaintenanceOverlay").then(m => ({ default: m.MaintenanceOverlay })));

// BILDSCHIRME WERDEN ERST GELADEN, WENN JEMAND SIE SIEHT
const Dashboard = lazy(() => import("./screens/Dashboard"));
const Chats = lazy(() => import("./screens/Chats"));
const ChatView = lazy(() => import("./screens/ChatView"));
const Profile = lazy(() => import("./screens/Profile"));
const KlarPlus = lazy(() => import("./screens/KlarPlus"));
const MeilensteineAlle = lazy(() => import("./screens/MeilensteineAlle"));
const DatingRituals = lazy(() => import("./screens/DatingRituals").then(m => ({ default: m.DatingRituals })));
const SafetyCenter = lazy(() => import("./screens/SafetyCenter"));
const AICoach = lazy(() => import("./screens/AICoach"));
const Tips = lazy(() => import("./screens/Tips"));
const Rechtstexte = lazy(() => import("./screens/Rechtstexte"));
const AdminDashboard = lazy(() => import("./screens/AdminDashboard"));
const Verifizierung = lazy(() => import("./screens/Verifizierung"));

/** Derselbe Ladezustand, den `App` beim Anmelden zeigt — damit ein Wechsel
 *  nicht anders aussieht als ein Start. Sanfte Fade-In- und Fade-Out-Animation mit AnimatePresence minimiert Layout-Sprünge beim Laden.
 *  Berücksichtigt die WCAG 2.3.3 Anforderungen via useReducedMotion für barrierefreie Animationen. */
export function Ladepunkt() {
  const shouldReduceMotion = Boolean(useReducedMotion());

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="app-skeleton-wrapper"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={shouldReduceMotion ? undefined : { opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" }}
        style={{ willChange: shouldReduceMotion ? "auto" : "opacity, transform" }}
        className="klar-page w-full h-full min-h-[100dvh] flex flex-col justify-start items-stretch overflow-hidden [will-change:opacity,transform]"
        role="status"
        aria-live="polite"
        aria-label="Wird geladen"
        data-reduced-motion={shouldReduceMotion ? "true" : "false"}
      >
        <AppSkeleton key="app-skeleton" />
      </motion.div>
    </AnimatePresence>
  );
}

function NotFoundHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);
  return null;
}

const ProfileSkeleton = () => (
  <div className="p-4 space-y-6 h-full flex flex-col bg-stone-50 dark:bg-stone-900 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 bg-stone-200 dark:bg-stone-700 rounded-full" />
      <div className="space-y-2 flex-1">
        <div className="h-6 bg-stone-200 dark:bg-stone-700 rounded w-1/3" />
        <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded w-1/4" />
      </div>
    </div>
    <div className="space-y-4">
      <div className="h-10 bg-stone-200 dark:bg-stone-700 rounded w-full" />
      <div className="h-24 bg-stone-200 dark:bg-stone-700 rounded w-full" />
      <div className="h-10 bg-stone-200 dark:bg-stone-700 rounded w-full" />
    </div>
  </div>
);

const SafetySkeleton = () => (
  <div className="p-4 space-y-4 h-full flex flex-col bg-stone-50 dark:bg-stone-900 animate-pulse">
    <div className="h-8 bg-stone-200 dark:bg-stone-700 rounded w-1/2 mb-4" />
    <div className="h-24 bg-stone-200 dark:bg-stone-700 rounded-xl w-full" />
    <div className="h-24 bg-stone-200 dark:bg-stone-700 rounded-xl w-full" />
    <div className="h-24 bg-stone-200 dark:bg-stone-700 rounded-xl w-full" />
  </div>
);

export const LazyRoute = ({ component: Component, fallback }: { component: React.ComponentType, fallback?: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={fallback || <Ladepunkt />}>
      <PageWrapper>
        <Component />
      </PageWrapper>
    </Suspense>
  </ErrorBoundary>
);

export function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LazyRoute component={Dashboard} />} />
        <Route path="/chats" element={<LazyRoute component={Chats} />} />
        <Route path="/chat/:id" element={<LazyRoute component={ChatView} />} />
        <Route path="/ai-coach" element={<LazyRoute component={AICoach} />} />
        <Route path="/tips" element={<LazyRoute component={Tips} />} />
        <Route path="/profile" element={<LazyRoute component={Profile} fallback={<ProfileSkeleton />} />} />
        <Route path="/klar-plus" element={<LazyRoute component={KlarPlus} />} />
        <Route path="/meilensteine" element={<LazyRoute component={MeilensteineAlle} />} />
        <Route path="/rituals" element={<LazyRoute component={DatingRituals} />} />
        <Route path="/safety" element={<LazyRoute component={SafetyCenter} fallback={<SafetySkeleton />} />} />
        <Route path="/verifizierung" element={<LazyRoute component={Verifizierung} />} />
        <Route path="/admin" element={<LazyRoute component={AdminDashboard} />} />
        <Route path="/rechtstexte/:art" element={<LazyRoute component={Rechtstexte} />} />
        <Route path="*" element={<LazyRoute component={NotFoundHandler} />} />
      </Routes>
    </AnimatePresence>
  );
}

export const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
};

function AppContent() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | undefined>();
  const [maintenanceEstimatedEndTime, setMaintenanceEstimatedEndTime] = useState<string | undefined>();

  useEffect(() => {
    const handleMaintenanceEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string; estimatedEndTime?: string }>).detail;
      setIsMaintenance(true);
      if (detail?.message) setMaintenanceMessage(detail.message);
      if (detail?.estimatedEndTime) setMaintenanceEstimatedEndTime(detail.estimatedEndTime);
    };
    window.addEventListener("klar-maintenance-mode", handleMaintenanceEvent);

    let unsub = () => {};
    try {
      unsub = onSnapshot(
        doc(db, "config", "maintenance"),
        (docSnap: DocumentSnapshot) => {
          if (docSnap.exists() && docSnap.data().active) {
            setIsMaintenance(true);
            setMaintenanceMessage(docSnap.data().message);
            setMaintenanceEstimatedEndTime(docSnap.data().estimatedEndTime);
          } else if (docSnap.exists() && !docSnap.data().active) {
            setIsMaintenance(false);
          }
        },
        () => {}
      );
    } catch {
      // Offline or mock environment fallback
    }

    return () => {
      window.removeEventListener("klar-maintenance-mode", handleMaintenanceEvent);
      unsub();
    };
  }, []);

  const { user } = useAuth();
  const online = useOnline();
  const isOffline = !online;

  useEffect(() => {
    // Initialize theme from klarStorage or system preference
    const applyTheme = () => {
      const savedTheme = klarStorage.getItem("klar_theme");
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (savedTheme === "dark" || (!savedTheme && systemDark)) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
    applyTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (!klarStorage.getItem("klar_theme")) {
        applyTheme();
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('button, a, input[type="submit"], [role="button"]');
      if (target) {
        hapticFeedback('light');
      }
    };
    document.addEventListener('click', handleGlobalClick, { capture: true });

    const completed = getUserStorageItem('hasCompletedOnboarding') === 'true';

    if (completed) {
      NotificationService.requestPermission();
    }

    const interval = setInterval(() => {
      NotificationService.checkRituals();
    }, 60000);

    return () => {
      document.removeEventListener('click', handleGlobalClick, { capture: true });
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const localBio = getUserStorageItem('klar_user_bio');

          let updated = false;

          if (data.bio && localBio && data.bio !== localBio) {
            setUserStorageItem('klar_user_bio', data.bio);
            updated = true;
          }

          if (data.interests) {
            const localInterests = getUserStorageItem('userInterests');
            if (localInterests && JSON.stringify(data.interests) !== localInterests) {
               setUserStorageItem('userInterests', JSON.stringify(data.interests));
               updated = true;
            }
          }

          if (updated) {
            const event = new CustomEvent('klar-in-app-notification', {
              detail: {
                title: "Daten synchronisiert",
                message: "Dein Profil wurde im Hintergrund aktualisiert.",
                type: "info"
              }
            });
            window.dispatchEvent(event);
          }
        }
      }, (err: FirestoreError) => console.warn("App.tsx onSnapshot error:", err));
      return () => unsubscribe();
    }
  }, [user]);

  if (isMaintenance) {
    return (
      <Suspense fallback={<Ladepunkt />}>
        <MaintenanceOverlay
          onRetry={() => window.location.reload()}
          message={maintenanceMessage}
          estimatedEndTime={maintenanceEstimatedEndTime}
        />
      </Suspense>
    );
  }

  if (isOffline) {
    return (
      <div className="h-[calc(100dvh-var(--contract-links-height,0px))] flex items-center justify-center bg-stone-50 text-stone-900 p-6 text-center">
        <div>
          <h2 className="text-xl font-bold mb-2">Keine Internetverbindung</h2>
          <p className="text-stone-600 mb-4">Bitte überprüfe deine Verbindung und versuche es erneut.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-stone-900 text-white rounded-full font-medium">Neu laden</button>
        </div>
      </div>
    );
  }

  // Gesetzliche Pflicht (DSGVO Art. 13/14, DSA Art. 11/12, § 5 DDG, § 312k BGB):
  // Rechtstexte (Datenschutz, AGB, Impressum) sind ohne Anmeldung öffentlich zugänglich
  // und müssen sofort ohne Abhängigkeit von Auth-Ladestatus gerendert werden.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/rechtstexte')) {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<Ladepunkt />}>
            <Routes>
              <Route path="/rechtstexte/:art" element={<Rechtstexte />} />
              <Route path="/rechtstexte" element={<Rechtstexte />} />
              <Route path="*" element={<Rechtstexte />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SyncBanner />
      <Suspense fallback={null}>
        <SUSFeedbackModal />
      </Suspense>
      <BrowserRouter>
        <Suspense fallback={<Ladepunkt />}>
          <AuthGate>
            <Layout>
              <Sichtschutz />
              <Suspense fallback={null}>
                <DashboardOnboarding />
              </Suspense>
              <RegistrierungsGate />
              <AnimatedRoutes />
            </Layout>
          </AuthGate>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default function App() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code && /^[A-Za-z0-9]{10}$/.test(code)) klarStorage.setItem('klar_referral_code', code.toUpperCase());
  }, []);

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <LanguagePreferenceProvider>
            <ContractLinks global />
            <MagicLinkGate>
              <AppContent />
            </MagicLinkGate>
          </LanguagePreferenceProvider>
        </AuthProvider>
      </I18nextProvider>
    </ErrorBoundary>
  );
}
