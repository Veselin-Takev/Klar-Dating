import { klarStorage } from '../lib/userScopedStorage';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { istGastKonto } from '../lib/gastGrenze';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark' || value === 'system';

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const localTheme = klarStorage.getItem('klar_theme');
    if (isTheme(localTheme)) return localTheme;
  }
  return 'system';
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserId(user.uid);
          // Load user theme preference
          getDoc(doc(db, 'users', user.uid)).then((docSnap) => {
            if (docSnap.exists() && docSnap.data().theme) {
              const storedTheme = docSnap.data().theme;
              if (isTheme(storedTheme)) setThemeState(storedTheme);
            }
          }).catch(() => {
            // Silently fall back to local theme preference
          });
        } else {
          setUserId(null);
          // Load local theme preference
          const localTheme = klarStorage.getItem('klar_theme');
          if (isTheme(localTheme)) setThemeState(localTheme);
        }
      });
      return unsubscribe;
    } catch (e) {
      console.warn("Firebase not fully initialized yet", e);
      // Fallback for no firebase
      const localTheme = klarStorage.getItem('klar_theme');
      if (isTheme(localTheme)) setThemeState(localTheme);
    }
  }, []);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    klarStorage.setItem('klar_theme', newTheme);

    // ── GAST-02 (14.08.2026, im Browser beobachtet) ─────────────────────
    // Hier stand ein `setDoc(..., { merge: true })` ohne Ruecksicht darauf,
    // wer angemeldet ist. Als Gast lehnt `firestore.rules` das ab, und in
    // der Konsole stand zweimal:
    //
    //   Could not save theme to Firestore FirebaseError: PERMISSION_DENIED
    //
    // Die lokale Wahl (`klar_theme`, eine Zeile hoeher) greift trotzdem —
    // die Helligkeit stellt sich also um und bleibt es fuer diese Sitzung.
    // Nur geraeteuebergreifend gespeichert wird sie nicht, und DAS ist die
    // richtige Aussage: Ein Gast hat kein Konto, an dem etwas haengen
    // koennte.
    //
    // Deshalb gilt hier bewusst NICHT das Registrierungs-Gate: Die Helligkeit
    // ist keine Handlung, die an einem Konto haengen muss. Ein Dialog dafuer
    // waere eine Zumutung. Wir versuchen den Schreibvorgang schlicht nicht.
    if (userId && !istGastKonto(auth.currentUser)) {
      try {
        await setDoc(doc(db, 'users', userId), { theme: newTheme }, { merge: true });
      } catch (e) {
        console.warn("Could not save theme to Firestore", e);
      }
    }
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return { theme: 'system', setTheme: () => undefined }; // Fallback
  }
  return context;
};
