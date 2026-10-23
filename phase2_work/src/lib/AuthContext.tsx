import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signInAnonymously, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence  } from 'firebase/auth';
import type { User } from 'firebase/auth';
import type { DocumentSnapshot } from 'firebase/firestore';
import { clearQueueForUser, OFFLINE_REPLAY_CANCEL_EVENT } from './offlineQueue';
import { auth, db } from './firebase';
import { doc, getDocFromServer, onSnapshot, setDoc, updateDoc, waitForPendingWrites } from 'firebase/firestore';
import { meldeKontoErforderlich, sollGateZeigen } from './gastGrenze';
import { anmeldeschritt } from './anmeldefehler';
import { setDiagnosticsConsent } from './telemetryPrivacy';
import { authFetch } from './authFetch';
import { clearApiMemoryCache } from './api';
import { CostOptimizationService } from '../services/costOptimizationService';
import { zweckErlaubt } from '../server/pure';
import { omitUndefinedFields, profileContainsExpectedFields } from './profileWriteConfirmation';
import { isRecord, type JsonObject } from '../types/strict';
import { clearLegacyUserStorage, setUserStorageItem, klarStorage, clearUserStorageForUid, clearSessionStorageForApp } from './userScopedStorage';
import {
  type UserProfileData,
  type AuthSessionState,
  loadAuthSession,
  validateUserProfile,
} from './authSessionSchema';

export interface AuthContextType {
  user: User | null;
  profileData: UserProfileData | null;
  session: AuthSessionState;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  logOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfileData | JsonObject>;
  updateProfileData: (data: Partial<UserProfileData> | Record<string, unknown>) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTFERNT 14.08.2026: `cachedAccessToken` und `getAccessToken()`
//
// Sie hielten das Google-Zugriffstoken fuer den Bereich
// `https://www.googleapis.com/auth/gmail.send` — die Erlaubnis, E-Mails IM
// NAMEN der Person zu versenden. Angefordert wurde sie bei JEDER
// Google-Anmeldung, in `signInWithGoogle` weiter unten.
//
// Gebraucht hat sie genau ein Baustein: `EmailSummaryWidget`. Der schickte
// der Person eine Zusammenfassung mit zwei Zahlen —
// `stats_conversations_started` und `stats_profile_checks`. Beide Schluessel
// werden nirgends geschrieben (gemessen: 0 Schreibstellen, 3 Lesestellen);
// die Mail enthielt also zweimal „0".
//
// Bei Google ist `gmail.send` ein „restricted scope": Der Zustimmungsdialog
// sagt der Person woertlich, die App duerfe in ihrem Namen E-Mails senden,
// und fuer den Produktivbetrieb verlangt Google eine Sicherheitspruefung.
//
// Das ist der teuerste Vertrauensvorschuss, den diese App je verlangt hat —
// fuer eine Mail mit zwei Nullen.
//
// WENN die Zusammenfassung je kommen soll, gehoert sie auf den Server: Dort
// gibt es bereits `mail_queue`, und dann verschickt Klar sie unter EIGENEM
// Absender, statt das Postfach der Person zu benutzen.
// ═══════════════════════════════════════════════════════════════════════════

const defaultSession = loadAuthSession(null, null, undefined, true);

const AuthContext = createContext<AuthContextType>({
  user: null,
  profileData: null,
  session: defaultSession,
  loading: true,
  signInWithGoogle: async () => {},
  signInAsGuest: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logOut: async () => {},
  refreshProfile: async () => ({} as UserProfileData),
  updateProfileData: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequest = useRef(0);

  const session = useMemo(() => {
    return loadAuthSession(user, profileData, claims, loading);
  }, [user, profileData, claims, loading]);

  const claimReferral = async () => {
    try {
      const code = klarStorage.getItem('klar_referral_code');
      if (!code || !auth.currentUser || auth.currentUser.isAnonymous) return;
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/referral/claim', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ code }) });
      if (response.ok) klarStorage.removeItem('klar_referral_code');
    } catch { /* attribution can retry next session */ }
  };

  const publishPublicProfile = async (uid: string, profile: JsonObject) => {
    if (!auth.currentUser || auth.currentUser.isAnonymous || auth.currentUser.uid !== uid) return;
    if (!profile.name || !profile.location || !profile.age) return;
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch('/api/profile/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: uid }),
      });
    } catch {
      // Publishing is eventually consistent; profile editing must remain usable.
    }
  };

  const applyServerProfile = (data: JsonObject | null) => {
    const raw = data ? { ...data } : null;
    if (typeof raw?.photoURL === 'string' && raw.photoURL.includes('/_/upload/')) {
      delete raw.photoURL;
    }
    // A missing server field must never inherit a previous authorization or
    // consent decision. Revocations and incomplete snapshots fail closed.
    const profile = raw ? validateUserProfile(raw, auth.currentUser?.uid) : null;
    setProfileData(profile);
    setDiagnosticsConsent(zweckErlaubt(profile?.einwilligung, 'fehlerberichte'));
    // Display preferences only. Nothing is ever read back into authorization.
    if (profile) {
      try {
        setUserStorageItem('userInterests', JSON.stringify(profile.interests || []));
        setUserStorageItem('userGoal', profile.goal || 'undecided');
        setUserStorageItem('klar_user_bio', profile.bio || '');
        // Never migrate legacy global profile keys: doing so could transfer
        // another account's data after an in-browser account switch.
        clearLegacyUserStorage();
      } catch { /* Browser storage is optional. */ }
    }
  };

  const fetchProfile = async (currentUser: User, createIfMissing = false, expectedFields?: Record<string, unknown>) => {
    const request = ++profileRequest.current;
    const isCurrent = () => request === profileRequest.current && auth.currentUser?.uid === currentUser.uid;
    setDiagnosticsConsent(false);
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      let snapshot = await getDocFromServer(docRef);
      if (!isCurrent()) throw new Error('Die Sitzung hat sich geändert.');
      if (!snapshot.exists() && createIfMissing) {
        await setDoc(docRef, {
          uid: currentUser.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          name: currentUser.displayName?.trim() || '',
          bio: '', interests: [], goal: 'undecided', smartMatchAlerts: true,
        });
        snapshot = await getDocFromServer(docRef);
      }
      if (!isCurrent()) throw new Error('Die Sitzung hat sich geändert.');
      if (!snapshot.exists()) {
        throw new Error('Das gespeicherte Profil konnte nicht bestätigt werden.');
      }
      let data = snapshot.data();
      if (!(process.env.NODE_ENV === 'test' || process.env.VITEST) && typeof window !== 'undefined' && typeof fetch === 'function') {
        try {
          const token = await currentUser.getIdToken().catch(() => null);
          const statusRes = await fetch('/api/account/status', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json().catch(() => null);
            if (statusData?.ok && auth.currentUser?.uid === currentUser.uid) {
              data = {
                ...data,
                ...(statusData.isAdult === true ? { isAdult: true } : {}),
                ...(statusData.einwilligung ? { einwilligung: statusData.einwilligung } : {}),
              };
            }
          }
        } catch {
          // Status fallback
        }
      }
      if (expectedFields && !profileContainsExpectedFields(data, expectedFields)) {
        throw new Error('Die Profiländerung konnte nicht serverseitig bestätigt werden.');
      }
      // getDocFromServer() has reached the backend, but Firestore may still mark
      // the returned local view as pending when another write started after our
      // waitForPendingWrites() call. Never apply such a view as profile/consent
      // authority; the live listener will apply the next server-confirmed snapshot.
      if (snapshot.metadata.hasPendingWrites) {
        setDiagnosticsConsent(false);
        if (expectedFields) throw new Error('Die Profiländerung konnte nicht serverseitig bestätigt werden.');
        return data;
      }
      applyServerProfile(data);
      return data;
    } catch (error) {
      if (isCurrent()) applyServerProfile(null);
      throw error;
    }
  };

  const refreshProfile = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Bitte erneut anmelden.');
    return fetchProfile(currentUser);
  };

  const updateProfileData = async (data: Partial<UserProfileData> | Record<string, unknown>) => {
    if (!user || auth.currentUser?.uid !== user.uid) throw new Error('Bitte erneut anmelden.');
    {
      try {
        const docRef = doc(db, 'users', user.uid);
        const fieldsToPersist = omitUndefinedFields(data);
        const updatePayload = {
          ...fieldsToPersist,
          updatedAt: new Date().toISOString()
        };
        await updateDoc(docRef, updatePayload);
        // Firestore can acknowledge the write while the local view still
        // reports hasPendingWrites=true. Wait for all writes that were queued
        // before this call before using the server read as our authority check.
        // This avoids a false failure without weakening confirmation semantics.
        await waitForPendingWrites(db);
        // DAT-07/DAT-08: Der lokale Zustand wird erst NACH dem erfolgreichen
        // Schreibvorgang gesetzt. Vorher stand er davor bzw. wurde auch im
        // Fehlerfall gesetzt, und der Fehler ging in ein `console.warn`.
        // Folge: Jeder von den Firestore-Regeln abgelehnte Schreibvorgang
        // sah in der Oberflaeche wie ein Erfolg aus — bis zum Neuladen.
        // Genau so blieben `theme`, `moodHistory` und die vorgetaeuschte
        // Verifizierung monatelang unbemerkt.
        const persisted = await fetchProfile(user, false, fieldsToPersist);
        void publishPublicProfile(user.uid, persisted);
      } catch (error) {
        // ── GAST-02 (14.08.2026, im Browser beobachtet) ─────────────────
        // Als Gast lehnt `firestore.rules` das Update ab (`allow update`
        // verlangt `!istGast()`). Die Regel ist richtig — falsch war, dass
        // davon nur eine rote Zeile in der Konsole ankam. Der Mensch davor
        // aenderte etwas, es passierte nichts, und niemand sagte warum.
        //
        // Jetzt muendet die Regelablehnung in dasselbe Registrierungs-Gate
        // wie die API-Antwort 403. Ein zweiter Dialog waere eine zweite
        // Wahrheit; es gibt nur eine.
        if (sollGateZeigen(error, user)) {
          meldeKontoErforderlich({
            herkunft: 'firestore',
            vorgang: 'Profil speichern',
          });
        } else {
          console.error("Profil konnte nicht gespeichert werden", error);
        }
        throw error;   // die aufrufende Ansicht muss es erfahren
      }
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- Firebase auth is an external subscription; state updates mirror its authoritative lifecycle. */
  useEffect(() => {
    const handleRedirect = async () => {
      try {
        // Das Ergebnis wird nur noch abgeholt, damit Firebase den
        // Weiterleitungs-Zustand aufraeumt. Ein Zugriffstoken wird nicht
        // mehr entgegengenommen — siehe den Block am Anfang dieser Datei.
        await getRedirectResult(auth);
      } catch (error) {
        console.error("Redirect login error:", error);
      }
    };
    handleRedirect();

    let stopped = false;
    let authVersion = 0;
    let stopProfile: () => void = () => {};
    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
      const version = ++authVersion;
      ++profileRequest.current;
      stopProfile();
      setDiagnosticsConsent(false);
      setUser(currentUser);
      setProfileData(null);
      setLoading(!!currentUser);
      const isCurrent = () => !stopped && version === authVersion && auth.currentUser?.uid === currentUser?.uid;
      if (!currentUser) {
        setClaims(null);
        return;
      }
      try {
        if (!isCurrent()) return;
        try {
          if (typeof currentUser.getIdTokenResult === 'function') {
            const tokenResult = await currentUser.getIdTokenResult();
            if (tokenResult?.claims && isCurrent()) {
              setClaims(tokenResult.claims);
            }
          }
        } catch { /* claims are optional */ }
        const data = await fetchProfile(currentUser, true);
        if (!isCurrent()) return;
        void publishPublicProfile(currentUser.uid, data);
        void claimReferral();
        // Apply revocations and status downgrades while the account is open.
        // Cached or optimistic snapshots cannot authorize any new state.
        stopProfile = onSnapshot(doc(db, 'users', currentUser.uid), { includeMetadataChanges: true }, (snapshot: DocumentSnapshot) => {
          if (!isCurrent()) return;
          if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
            setDiagnosticsConsent(false);
            return;
          }
          applyServerProfile(snapshot.exists() ? snapshot.data() : null);
        }, () => {
          if (isCurrent()) applyServerProfile(null);
        });
      } catch {
        if (isCurrent()) applyServerProfile(null);
      } finally {
        if (isCurrent()) setLoading(false);
      }
    });

    return () => {
      stopped = true;
      ++profileRequest.current;
      setDiagnosticsConsent(false);
      stopProfile();
      unsubscribe();
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const withAuthRetry = async <T,>(fn: () => Promise<T>, retries = 1): Promise<T> => {
    try {
      return await fn();
    } catch (err: unknown) {
      const code = isRecord(err) && typeof err.code === 'string' ? err.code : undefined;
      const message = isRecord(err) && typeof err.message === 'string' ? err.message : undefined;
      if (retries > 0 && (code === 'auth/network-request-failed' || message?.includes('network-request-failed'))) {
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
        return withAuthRetry(fn, retries - 1);
      }
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    // KEIN `provider.addScope(...)`. Die Anmeldung fragt nur, was sie zum
    // Anmelden braucht. Siehe den Block am Anfang dieser Datei.
    const provider = new GoogleAuthProvider();
    try {
      await setPersistence(auth, browserLocalPersistence);
      await withAuthRetry(() => signInWithPopup(auth, provider));
      return;
    } catch (error: unknown) {
      const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
      switch (anmeldeschritt(code)) {
        case 'weiterleiten':
          await signInWithRedirect(auth, provider);
          return;
        case 'abbrechen':
          return;
        default:
          throw error;
      }
    }
  };

  const signInAsGuest = async () => {
    // Disabled anonymous sign-in must never create a permanent fallback account.
    await setPersistence(auth, browserSessionPersistence);
    await withAuthRetry(() => signInAnonymously(auth));
  };

  const signInWithEmail = async (email: string, pass: string) => {
    // A preceding anonymous session intentionally uses session persistence.
    // Set the permanent account policy before authentication, as for Google.
    await setPersistence(auth, browserLocalPersistence);
    await withAuthRetry(() => signInWithEmailAndPassword(auth, email, pass));
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    await setPersistence(auth, browserLocalPersistence);
    await withAuthRetry(() => createUserWithEmailAndPassword(auth, email, pass));
  };

  // ═════════════════════════════════════════════════════════════════════════
  // FE-03 / FE-04 (Final Audit 08.08.2026) — Abmelden räumt auf
  // ═════════════════════════════════════════════════════════════════════════
  const raeumeLokaleDaten = (uid: string) => {
    try {
      clearUserStorageForUid(uid);
      clearSessionStorageForApp();
    } catch { /* A blocked browser store must not prevent logout. */ }
  };

  const logOut = async () => {
    setDiagnosticsConsent(false);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    // Cancel in-flight offline replay before awaiting the revocation endpoint:
    // the Firebase auth-state event occurs only after server revocation.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(OFFLINE_REPLAY_CANCEL_EVENT));
    }

    // Revoke server-side first. A network/server failure must never strand the
    // user in the authenticated UI: local sign-out and cleanup still proceed.
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Fail-safe: local cleanup below remains mandatory even when offline.
    }

    await clearQueueForUser(uid).catch(() => {});
    clearApiMemoryCache();
    CostOptimizationService.clearCache();

    try {
      await signOut(auth);
    } finally {
      raeumeLokaleDaten(uid);
      if (typeof window !== 'undefined') window.location.replace('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, profileData, session, loading, signInWithGoogle, signInAsGuest, signInWithEmail, signUpWithEmail, logOut, refreshProfile, updateProfileData }}>
      {children}
    </AuthContext.Provider>
  );
};
