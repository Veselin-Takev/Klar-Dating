import { useEffect, useState } from 'react';

// P2 — Offline ist ein Zustand, kein Sonderfall.
// `navigator.onLine` allein lügt gern (WLAN verbunden, kein Internet), aber
// als erster Hinweis ist es besser als nichts — und es ist der Zustand, den
// die Design-Richtlinie §6 als eigenen Zustand fordert.
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    const an = () => setOnline(true);
    const aus = () => setOnline(false);
    window.addEventListener('online', an);
    window.addEventListener('offline', aus);
    return () => {
      window.removeEventListener('online', an);
      window.removeEventListener('offline', aus);
    };
  }, []);
  return online;
}
