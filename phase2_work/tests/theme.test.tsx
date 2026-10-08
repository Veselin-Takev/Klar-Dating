import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../src/components/ThemeProvider';

// BEFUND 10.08.2026 -- was hier vorher stand:
// Die ganze Datei bestand aus einem it(...) mit dem Koerper
// expect(true).toBe(true). Der Test hiess "applies and removes dark class
// based on localStorage and events" und konnte nicht fehlschlagen. Die
// Importe render, App und BrowserRouter lagen ungenutzt daneben.
//
// Ein Test, der nicht fehlschlagen kann, ist schlechter als kein Test: Er
// erhoeht die Zahl bestandener Tests und erzeugt Sicherheit, die es nicht
// gibt. Dieselbe Fehlerklasse wie die erfundenen KI-Antworten -- etwas
// sieht aus wie ein Ergebnis, ist aber keins.
//
// WARUM ThemeProvider UND NICHT App: Die alte Fassung importierte die ganze
// App. Die zieht Firebase, Routing und 178 Komponenten mit; ein Test
// darueber ist langsam und scheitert an Dingen, die mit dem Thema nichts zu
// tun haben.

vi.mock('../src/lib/firebase', () => ({ auth: {}, db: {} }));

vi.mock('firebase/auth', () => ({
  // Kein angemeldetes Konto: Der Provider faellt damit auf den lokalen
  // Speicher zurueck -- genau der Weg, den dieser Test prueft.
  onAuthStateChanged: (_auth: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  setDoc: vi.fn(async () => undefined),
}));

/** Kleiner Verbraucher, um setTheme von aussen ausloesen zu koennen. */
function Schalter() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="aktuell">{theme}</span>
      <button onClick={() => setTheme('light')}>hell</button>
      <button onClick={() => setTheme('dark')}>dunkel</button>
      <button onClick={() => setTheme('system')}>system</button>
    </div>
  );
}

/** Setzt matchMedia, das jsdom nicht mitbringt. */
function systemBevorzugt(dunkel: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dunkel,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe('Dunkelmodus', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    systemBevorzugt(false);
    vi.clearAllMocks();
  });

  it('uebernimmt die gespeicherte Einstellung beim Start', () => {
    localStorage.setItem('klar_theme', 'dark');
    render(<ThemeProvider><Schalter /></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByTestId('aktuell').textContent).toBe('dark');
  });

  it('wechselt die Klasse beim Umschalten und entfernt die alte', async () => {
    localStorage.setItem('klar_theme', 'dark');
    render(<ThemeProvider><Schalter /></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await act(async () => {
      screen.getByText('hell').click();
    });

    expect(document.documentElement.classList.contains('light')).toBe(true);
    // Die alte Klasse muss WEG sein. Bleiben beide stehen, entscheidet die
    // Reihenfolge im Stylesheet -- und das Ergebnis waere zufaellig.
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('merkt sich die Wahl im lokalen Speicher', async () => {
    render(<ThemeProvider><Schalter /></ThemeProvider>);
    await act(async () => {
      screen.getByText('dunkel').click();
    });
    expect(localStorage.getItem('klar_theme')).toBe('dark');
  });

  it('folgt bei system der Voreinstellung des Geraets', () => {
    systemBevorzugt(true);
    localStorage.setItem('klar_theme', 'system');
    render(<ThemeProvider><Schalter /></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setzt bei system auf hell, wenn das Geraet hell bevorzugt', () => {
    systemBevorzugt(false);
    localStorage.setItem('klar_theme', 'system');
    render(<ThemeProvider><Schalter /></ThemeProvider>);
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('kommt ohne gespeicherte Einstellung nicht ins Straucheln', () => {
    render(<ThemeProvider><Schalter /></ThemeProvider>);
    expect(screen.getByTestId('aktuell').textContent).toBe('system');
    // Genau EINE der beiden Klassen muss gesetzt sein.
    const hell = document.documentElement.classList.contains('light');
    const dunkel = document.documentElement.classList.contains('dark');
    expect(hell === dunkel).toBe(false);
  });
});
