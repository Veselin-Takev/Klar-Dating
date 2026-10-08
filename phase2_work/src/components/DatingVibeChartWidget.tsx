import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// Stimmungsverlauf — mit Zeitraumwahl, ohne erfundene Tage
//
// ── ZWEI FEHLER, DIE HIER STANDEN (14.08.2026) ────────────────────────────
//
// 1. ERFUNDENE TAGE. Nach dem Aufbau der Reihe lief:
//
//        // Fill nulls with previous values or 3 (neutral) if no previous
//        let lastVal = 3;
//        for (…) { … else chartData[i].value = lastVal; }
//
//    Wer nie etwas eingetragen hatte, sah eine durchgehende Linie auf
//    „Neutral" über 14 Tage — als hätte er jeden Tag etwas gesagt.
//
// 2. EINE WIRKUNGSLOSE LEER-PRÜFUNG. Darunter stand
//
//        if (data.length === 0) return null;
//
//    mit dem Kommentar „LEER HEISST UNSICHTBAR". Die Reihe hatte aber
//    IMMER 14 Einträge, gefüllt oder nicht — die Bedingung konnte nie
//    zutreffen. Sie sah aus wie eine Absicherung und war keine.
//
//    Dieselbe Stelle ist in `MoodCalendarGridWidget` schon einmal
//    aufgefallen und dort richtig gelöst worden: mit einer eigenen Angabe
//    aus der QUELLE statt aus dem Ergebnis. Hier steht sie jetzt genauso.
//
// ── WAS NEU IST ───────────────────────────────────────────────────────────
// · Zeitraumwahl 7 · 14 · 28 · 60 Tage (klar/27, Abschnitt 7, Punkt 2).
//   Die Wahl bleibt in `klar_stimmung_zeitraum` erhalten.
// · Ein Tag ohne Eintrag bleibt eine Lücke (`connectNulls={false}`).
// · Die Kopfzeile nennt, auf wie vielen Tagen die Aussage beruht. Ein
//   Mittelwert aus zwei Einträgen über 60 Tage ist etwas anderes als einer
//   aus 55 — und der Unterschied gehört dorthin, wo die Zahl steht.
//
// Die Rechnung liegt in `src/lib/stimmung.ts` und wird dort geprüft
// (tests/stimmung.spec.ts). Diese Datei zeichnet nur.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Activity, MessageCircle } from 'lucide-react';
import {
  STUFEN_NAMEN,
  ZEITRAEUME,
  VORGABE_ZEITRAUM,
  belegteTage,
  eintraegeAusText,
  reihe,
  zeitraumAus,
  zusammenfassung,
  type Punkt,
  type Zeitraum,
} from '../lib/stimmung';

const SCHLUESSEL_STIMMUNGEN = 'klar_dating_moods';
const SCHLUESSEL_TAGEBUCH = 'klar_journal_entries';
const SCHLUESSEL_ZEITRAUM = 'klar_stimmung_zeitraum';

/** Ein Punkt mit dem Tagebuchtext, falls es an dem Tag einen gibt. */
interface PunktMitText extends Punkt {
  tagebuch: string | null;
}

/** Tagebucheinträge nach Tag. Unlesbares ergibt eine leere Zuordnung. */
function tagebuchNachTag(roh: string | null): Map<string, string> {
  const aus = new Map<string, string>();
  if (typeof roh !== 'string' || roh === '') return aus;
  let liste: unknown;
  try {
    liste = JSON.parse(roh);
  } catch {
    return aus;
  }
  if (!Array.isArray(liste)) return aus;
  for (const e of liste) {
    if (e === null || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    // `createdAt` fehlt bei älteren Einträgen. Vorher stand hier
    // `new Date(j.createdAt || Date.now())` — ein Eintrag ohne Zeitmarke
    // wurde damit auf HEUTE gelegt. Das ist eine erfundene Zuordnung;
    // solche Einträge bleiben jetzt unberücksichtigt.
    const wann = o['createdAt'];
    if (typeof wann !== 'string' && typeof wann !== 'number') continue;
    const d = new Date(wann);
    if (Number.isNaN(d.getTime())) continue;
    const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const text = typeof o['recap'] === 'string' ? o['recap'] : typeof o['content'] === 'string' ? o['content'] : '';
    if (text.trim() === '') continue;
    if (!aus.has(tag)) aus.set(tag, text.slice(0, 120));
  }
  return aus;
}

export function DatingVibeChartWidget() {
  const [zeitraum, setZeitraum] = useState<Zeitraum>(VORGABE_ZEITRAUM);
  const [punkte, setPunkte] = useState<PunktMitText[]>([]);
  // Aus der QUELLE, nicht aus dem Ergebnis — siehe Kopf dieser Datei.
  const [hatEintraege, setHatEintraege] = useState(false);

  const lesen = useCallback((fuer: Zeitraum) => {
    let rohStimmungen: string | null = null;
    let rohTagebuch: string | null = null;
    try {
      rohStimmungen = klarStorage.getItem(SCHLUESSEL_STIMMUNGEN);
      rohTagebuch = klarStorage.getItem(SCHLUESSEL_TAGEBUCH);
    } catch {
      // Gesperrter Speicher: dann eben nichts.
    }
    const eintraege = eintraegeAusText(rohStimmungen);
    setHatEintraege(eintraege.length > 0);

    const texte = tagebuchNachTag(rohTagebuch);
    setPunkte(reihe(eintraege, fuer, new Date()).map((p) => ({ ...p, tagebuch: texte.get(p.tag) ?? null })));
  }, []);

  useEffect(() => {
    let gespeichert: string | null = null;
    try {
      gespeichert = klarStorage.getItem(SCHLUESSEL_ZEITRAUM);
    } catch {
      // s. o.
    }
    const z = zeitraumAus(gespeichert);
    setZeitraum(z);
    lesen(z);
  }, [lesen]);

  const waehle = (z: Zeitraum) => {
    setZeitraum(z);
    try {
      klarStorage.setItem(SCHLUESSEL_ZEITRAUM, String(z));
    } catch {
      // Die Wahl gilt dann nur für diese Sitzung. Kein Grund abzubrechen.
    }
    lesen(z);
  };

  // LEER HEISST UNSICHTBAR — jetzt aus der Quelle beantwortet.
  // Reine Anzeige: Diese Karte bietet keine Eingabe, also käme man über sie
  // nie an die Stelle, an der man etwas einträgt (klar/27, Abschnitt 4).
  if (!hatEintraege) return null;

  const belegt = belegteTage(punkte);

  const Sprechblase = ({ active, payload }: { active?: boolean; payload?: { payload: PunktMitText }[] }) => {
    const p = payload?.[0]?.payload;
    if (!active || !p) return null;
    return (
      <div className="bg-white dark:bg-stone-800 p-3 rounded-xl shadow-lg border border-stone-100 dark:border-stone-700 max-w-[220px]">
        <p className="text-xs text-stone-500 mb-1">{p.tag}</p>
        <p className="text-sm font-bold text-stone-800 dark:text-stone-200">
          {p.wert === null ? 'Nichts eingetragen' : (STUFEN_NAMEN[p.wert] ?? '')}
        </p>
        {p.tagebuch && (
          <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-700">
            <div className="flex items-center gap-1.5 text-xs text-brand mb-1">
              <MessageCircle size={12} aria-hidden="true" />
              <span className="font-medium">Tagebuch</span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 italic line-clamp-3">{p.tagebuch}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand-light/10 flex items-center justify-center shrink-0">
          <Activity size={20} className="text-brand dark:text-brand-light" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-stone-900 dark:text-stone-100">Stimmungsverlauf</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">{zusammenfassung(punkte, zeitraum)}</p>
        </div>
      </div>

      <div
        role="group"
        aria-label="Zeitraum"
        className="flex gap-1 p-1 mb-4 bg-stone-100 dark:bg-stone-800 rounded-xl"
      >
        {ZEITRAEUME.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => waehle(z)}
            aria-pressed={z === zeitraum}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
              z === zeitraum
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            {z} Tage
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-[200px] w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={punkte} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="verlaufStimmung" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="beschriftung"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#888888' }}
              // Bei 60 Tagen stünden 60 Beschriftungen nebeneinander.
              interval="preserveStartEnd"
              minTickGap={24}
              dy={10}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(wert: number) => STUFEN_NAMEN[wert] ?? ''}
              tick={{ fontSize: 10, fill: '#888888' }}
            />
            <RechartsTooltip content={<Sprechblase />} />
            <Area
              type="monotone"
              dataKey="wert"
              // DER KERN: Tage ohne Eintrag werden NICHT überbrückt. Eine
              // Lücke ist die ehrliche Darstellung von „dazu liegt nichts
              // vor" — eine durchgezogene Linie wäre es nicht.
              connectNulls={false}
              stroke="#4F46E5"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#verlaufStimmung)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {belegt < zeitraum && (
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-3">
          Die Lücken sind Tage ohne Eintrag. Sie werden nicht überbrückt.
        </p>
      )}
    </div>
  );
}
