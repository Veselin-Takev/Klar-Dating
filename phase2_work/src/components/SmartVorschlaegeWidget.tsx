import { fetchDatePlans } from '../lib/datePlans';
// ═══════════════════════════════════════════════════════════════════════════
// Smart-Tipp — ein Hinweis zum nächsten geplanten Date
//
// ── WAS HIER AM 14.08.2026 BEHOBEN WURDE ──────────────────────────────────
// Das Widget behauptete etwas über das Wetter:
//
//     setWeather(false ? 'sun' : 'rain');
//     …
//     'Es soll regnen, pack einen Schirm ein!'
//     'Die Sonne scheint, perfektes Wetter!'
//
// Ein Münzwurf, formuliert als Aufforderung. Anders als eine erfundene Zahl
// in einem Diagramm ist das sofort überprüfbar falsch — es genügt, aus dem
// Fenster zu sehen. Und es ist ein Rat, dem jemand folgen könnte.
//
// Entscheidung vom 14.08.2026: gestrichen, nicht durch eine echte Quelle
// ersetzt. Eine Wetter-Anbindung wäre ein eigenes Vorhaben (eigener
// Endpunkt, damit die Koordinaten nicht vom Gerät aus rausgehen;
// Zwischenspeicher; Fehlerfall; DSGVO-Betrachtung). Bis dahin gilt: lieber
// kein Wetter als ein erfundenes.
//
// ── WAS BLEIBT, WEIL ES ECHT IST ──────────────────────────────────────────
// Die Tageszeit. Sie kommt aus dem Termin, den die Person selbst geplant
// hat — Vormittag, Nachmittag, Abend. Name und Ort ebenso.
//
// ── NEBENBEI: DAS LESEN WAR UNGEPRUEFT ────────────────────────────────────
// `JSON.parse(saved)` mit `catch (e) { console.warn(e); ; }` — was unter dem Schlüssel stand,
// wurde ungeprüft übernommen und der leere `catch` verschluckte jeden
// Fehler. Jetzt wird gelesen, geprüft und Unpassendes verworfen.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { Lightbulb, Utensils, CalendarClock } from 'lucide-react';

/** Ein geplantes Date, wie es der Date-Planer ablegt. */
interface GeplantesDate {
  date: string;
  matchName: string;
  idea: string;
}

/** Der nächste Termin in der Zukunft, oder `null`. */
function naechsterTermin(dates: readonly GeplantesDate[], jetzt: Date): GeplantesDate | null {
  const kommend = dates
    .filter((d) => new Date(d.date).getTime() > jetzt.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return kommend[0] ?? null;
}

export function SmartVorschlaegeWidget() {

  const [naechstes, setNaechstes] = useState<GeplantesDate | null>(null);

  useEffect(() => {
    void fetchDatePlans().then(plans => setNaechstes(naechsterTermin(plans, new Date()))).catch(() => {
      // Unlesbarer Speicherinhalt heisst „kein Termin" — nicht „irgendein
      // Termin". Ohne Meldung, weil das kein Fehler der App ist.
      setNaechstes(null);
    });
  }, []);

  let text: string;
  let symbol = <Lightbulb size={20} className="text-amber-500" />;

  if (naechstes) {
    const stunde = new Date(naechstes.date).getHours();
    const ort = naechstes.idea ? ` Ort: ${naechstes.idea}.` : '';
    if (stunde < 12) {
      text = `Dein Vormittags-Date mit ${naechstes.matchName} steht an.${ort}`;
      symbol = <CalendarClock size={20} className="text-amber-500" />;
    } else if (stunde < 18) {
      text = `Nachmittags-Date mit ${naechstes.matchName}.${ort}`;
      symbol = <CalendarClock size={20} className="text-amber-500" />;
    } else {
      text = `Dein Abend-Date mit ${naechstes.matchName}.${ort}`;
      symbol = <Utensils size={20} className="text-indigo-400" />;
    }
  } else {
    text = 'Kein anstehendes Date gefunden. Zeit, den Date-Planer zu füllen!';
  }

  return (
    <div className="bg-stone-50 border border-stone-200 dark:from-stone-800 dark:to-stone-900 border border-amber-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full">


      <div className="flex items-center gap-3 mb-3">
        {symbol}
        <h3 className="font-semibold text-stone-800 dark:text-stone-200">Smart-Tipp</h3>
      </div>
      <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{text}</p>
    </div>
  );
}
