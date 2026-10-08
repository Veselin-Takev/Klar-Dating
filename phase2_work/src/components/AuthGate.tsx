import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { EINWILLIGUNG_VERSION } from '../server/pure';
import { LogoLoader } from './LogoLoader';
import { NotificationService } from '../services/notificationService';
import { AppSkeleton } from './SkeletonScreen';
import Login from '../screens/Login';
import { EinwilligungUndAlter } from './EinwilligungUndAlter';
import { getUserStorageItem, setUserStorageItem, klarStorage } from '../lib/userScopedStorage';

const Onboarding = lazy(() => import('../screens/Onboarding'));
const Rechtstexte = lazy(() => import('../screens/Rechtstexte'));

export interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * AuthGate: Isolierte Auth- und Compliance-Schranke.
 * Schärft die Trennung zwischen Authentifizierungs-/Einwilligungs-Logik und reinem UI-Rendering.
 *
 * Durchlaufene Gates:
 * 1. Loading-Status (Authentifizierung oder Profil wird geladen) -> LogoLoader
 * 2. Anmeldestatus (Kein Benutzer angemeldet) -> Login-Bildschirm
 * 3. DSG-02 Legal-Gate (Volljährigkeit + DSGVO Art. 9 Einwilligung) -> EinwilligungUndAlter
 * 4. Onboarding-Gate (Erstmalige Profil-Interessen für registrierte Nutzer) -> Onboarding
 * 5. Freigabe: Alle Schranken erfüllt -> Rendern der Anwendungs-Kindkomponenten (UI)
 */
export function AuthGate({ children }: AuthGateProps) {
  const { user, loading, profileData, updateProfileData } = useAuth();

  // Vermeidung redundanter Ladezustände durch synchrone Initialisierung aus klarStorage
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    return typeof window !== 'undefined' && getUserStorageItem('hasCompletedOnboarding') === 'true';
  });

  // Synchronisation des Onboarding-Zustands anhand von vorhandenen Profil-Interessen
  useEffect(() => {
    if (user && profileData) {
      if (profileData.interests && profileData.interests.length > 0 && !hasCompletedOnboarding) {
        setHasCompletedOnboarding(true);
        setUserStorageItem('hasCompletedOnboarding', 'true');
        if (profileData.bio) setUserStorageItem('klar_user_bio', profileData.bio);
        if (profileData.interests) setUserStorageItem('userInterests', JSON.stringify(profileData.interests));
        if (profileData.goal) setUserStorageItem('userGoal', profileData.goal);
      }
    }
  }, [user, profileData, hasCompletedOnboarding]);

  // Gate 1: Ladezustand
  if (loading) {
    return (
      <div className="h-[calc(100dvh-var(--contract-links-height,0px))] flex items-center justify-center bg-light-bg dark:bg-dark-bg">
        <LogoLoader sizeClass="w-24 h-24" />
      </div>
    );
  }

  // Gate 2: Nicht angemeldet
  if (!user) {
    return <Login />;
  }

  // Gate 3: DSG-02 Altersprüfung & Art.-9-Einwilligung
  const brauchtGate =
    !profileData
    || profileData.isAdult !== true
    || profileData.einwilligung?.version !== EINWILLIGUNG_VERSION;

  if (brauchtGate) {
    return (
      <Suspense fallback={<AppSkeleton />}>
        <Routes>
          <Route path="/rechtstexte/:art" element={<Rechtstexte />} />
          <Route path="/rechtstexte" element={<Rechtstexte />} />
          <Route
            path="*"
            element={<EinwilligungUndAlter alterBereitsGeprueft={profileData?.isAdult === true} />}
          />
        </Routes>
      </Suspense>
    );
  }

  // Gate 4: Onboarding für reguläre (nicht-anonyme) Nutzer
  if (!hasCompletedOnboarding && !user.isAnonymous) {
    return (
      <Suspense fallback={<AppSkeleton />}>
        <Onboarding
          onComplete={async (data) => {
            if (!updateProfileData) throw new Error('Profile persistence is unavailable');

            const profileUpdate: { interests: string[]; musicPreferences?: unknown } = {
              interests: data.interests,
            };
            if (data.musicPreferences) {
              profileUpdate.musicPreferences = data.musicPreferences;
            }
            await updateProfileData(profileUpdate);

            setUserStorageItem('userInterests', JSON.stringify(data.interests));
            setHasCompletedOnboarding(true);
            setUserStorageItem('hasCompletedOnboarding', 'true');
            klarStorage.setItem('klar_last_milestone_engagement', Date.now().toString());
            void NotificationService.requestPermission();
          }}
        />
      </Suspense>
    );
  }

  // Gate 5: Alle Kriterien erfüllt -> Kinder-UI rendern
  return <>{children}</>;
}
