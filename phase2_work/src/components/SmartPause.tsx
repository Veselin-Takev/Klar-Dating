import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// Smart-Pause — EINE Karte, EINE Wahrheit
//
// ── DER BEFUND VOM 14.08.2026 ─────────────────────────────────────────────
// Smart-Pause stand zweimal auf der Profilseite, und die beiden hielten
// VERSCHIEDENE Daten an VERSCHIEDENEN Orten:
//
//   SmartPauseWidget    klarStorage `klar_smart_pause_config`
//                       { days, startHour, endHour } — nur auf diesem Geraet
//   SmartPausePlanner   Firestore users/{uid}.userSettings.smartPauseSchedule
//                       boolean[7][24] — geraeteuebergreifend
//
// „Aktiv: 5 Tage, 18:00 – 22:00 Uhr" im Widget musste also nicht dem
// entsprechen, was der Planer zeigte. Beim Geraetewechsel war die eine
// Haelfte weg, die andere nicht.
//
// ── DIE ENTSCHEIDUNG ──────────────────────────────────────────────────────
// Firestore fuehrt. Geraeteuebergreifend, EINE Wahrheit, und
// `isValidUserUpdate` in `firestore.rules` erlaubt `userSettings`
// ausdruecklich.
//
// ── DIE UEBERNAHME, DIE NICHT VERGESSEN WERDEN DARF ───────────────────────
// Wer heute im Widget „Mo–Fr, 18–22 Uhr" gesetzt hat, hat das NUR lokal.
// Ohne Uebernahme waere der Stand nach der Umstellung weg — ohne Meldung,
// bis irgendwann die Pause ausbleibt. Deshalb: Findet sich in Firestore kein
// gueltiger Plan, aber lokal die alte Konfiguration, wird sie EINMALIG
// umgerechnet und gespeichert. Die Umrechnung samt Tageszaehlung steht in
// `src/lib/pausenplan.ts` und ist dort geprueft.
//
// ── WAS ENTFALLEN IST, UND WARUM ──────────────────────────────────────────
// Der eigene Schalter „Zeitplan Automatisierung" (`klar_smart_pause_schedule`)
// gibt es nicht mehr. Er war eine zweite Einstellung fuer dieselbe Sache: Ein
// Plan ohne eingetragene Stunde tut ohnehin nichts, ein Plan mit Stunden soll
// wirken. Der Plan IST die Einstellung.
//
// ── WAS BEWUSST LOKAL BLEIBT ──────────────────────────────────────────────
// „Jetzt pausieren" (`klar_smart_pause`). Das ist kein Plan, sondern ein
// Zustand des Augenblicks — er gehoert zu diesem Geraet, in dieser Sitzung.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import { Moon, WifiOff, Clock, Save, Info } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { melde } from '../lib/fehler';
import { useAuth } from '../lib/AuthContext';
import {
  type Pausenplan,
  leererPlan,
  istGueltigerPlan,
  istPauseLautPlan,
  planAusAlterKonfiguration,
  hatPause,
  pausierteStunden,
} from '../lib/pausenplan';

const TAGESNAMEN = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const SCHLUESSEL_JETZT = 'klar_smart_pause';
const SCHLUESSEL_ALT_KONFIG = 'klar_smart_pause_config';

export const SmartPause: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const [plan, setPlan] = useState<Pausenplan>(leererPlan);
  const [geladen, setGeladen] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState('');
  const [uebernommen, setUebernommen] = useState(false);
  const [jetztPausiert, setJetztPausiert] = useState(false);

  // ── Laden, mit einmaliger Uebernahme ────────────────────────────────────
  useEffect(() => {
    let abgemeldet = false;
    const laden = async () => {
      if (typeof window !== 'undefined') {
        setJetztPausiert(klarStorage.getItem(SCHLUESSEL_JETZT) === 'true');
      }
      if (!userId) {
        if (!abgemeldet) setGeladen(true);
        return;
      }
      try {
        const ref = doc(db, 'users', userId);
        const gespeichert = (await getDoc(ref)).data()?.userSettings?.smartPauseSchedule;

        if (istGueltigerPlan(gespeichert)) {
          if (!abgemeldet) setPlan(gespeichert);
        } else {
          // Nichts in Firestore: Gibt es lokal noch die alte Form?
          let alt: unknown = null;
          try {
            const roh = klarStorage.getItem(SCHLUESSEL_ALT_KONFIG);
            alt = roh ? JSON.parse(roh) : null;
          } catch {
            alt = null;
          }
          const uebernahme = planAusAlterKonfiguration(alt);
          if (hatPause(uebernahme)) {
            if (!abgemeldet) {
              setPlan(uebernahme);
              setUebernommen(true);
            }
          }
        }
      } catch (e) {
        melde('SmartPause/laden', e);
        if (!abgemeldet) setFehler('Zeitplan konnte nicht geladen werden.');
      } finally {
        if (!abgemeldet) setGeladen(true);
      }
    };
    laden();
    return () => {
      abgemeldet = true;
    };
  }, [userId]);

  // ── Automatik: jede Minute nachsehen, ob der Plan gerade greift ─────────
  useEffect(() => {
    if (!geladen || !hatPause(plan)) return;
    const pruefen = () => {
      const jetzt = new Date();
      const soll = istPauseLautPlan(plan, jetzt.getDay(), jetzt.getHours());
      setJetztPausiert((vorher) => {
        if (vorher === soll) return vorher;
        try {
          klarStorage.setItem(SCHLUESSEL_JETZT, String(soll));
        } catch {
          // Nicht speichern zu koennen ist kein Grund, die Pause zu verweigern.
        }
        return soll;
      });
    };
    pruefen();
    const uhr = setInterval(pruefen, 60000);
    return () => clearInterval(uhr);
  }, [geladen, plan]);

  const umschaltenJetzt = () => {
    setJetztPausiert((vorher) => {
      const neu = !vorher;
      try {
        klarStorage.setItem(SCHLUESSEL_JETZT, String(neu));
      } catch { /* siehe oben */ }
      return neu;
    });
  };

  const umschaltenStunde = (tag: number, stunde: number) => {
    setPlan((vorher) => {
      const neu = vorher.map((zeile) => [...zeile]);
      const zeile = neu[tag];
      if (zeile) zeile[stunde] = !zeile[stunde];
      return neu;
    });
  };

  const speichern = useCallback(async () => {
    if (!userId) {
      setFehler('Nicht angemeldet.');
      return;
    }
    setSpeichert(true);
    setFehler('');
    try {
      const ref = doc(db, 'users', userId);
      // Bestehende Einstellungen mitnehmen: `setDoc` mit `merge` ersetzt ein
      // verschachteltes Objekt vollstaendig, andere Eintraege unter
      // `userSettings` gingen sonst verloren.
      const vorhanden = (await getDoc(ref)).data()?.userSettings ?? {};
      await setDoc(
        ref,
        {
          userSettings: { ...vorhanden, smartPauseSchedule: plan },
          // `isValidUserUpdate` in firestore.rules erlaubt genau diese
          // beiden Felder zusammen.
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      // Erst NACH dem erfolgreichen Schreiben die alte lokale Form entfernen.
      // Andersherum waere sie bei einem Fehler weg und der Stand verloren.
      try {
        klarStorage.removeItem(SCHLUESSEL_ALT_KONFIG);
        klarStorage.removeItem('klar_smart_pause_schedule');
      } catch { /* siehe oben */ }
      setUebernommen(false);
    } catch (e) {
      melde('SmartPause/speichern', e);
      setFehler('Speichern fehlgeschlagen.');
    } finally {
      setSpeichert(false);
    }
  }, [userId, plan]);

  if (!geladen) {
    return (
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="bg-stone-200 rounded-md rounded-card h-24" aria-hidden="true" />
      </div>
    );
  }

  const stunden = pausierteStunden(plan);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Moon className={jetztPausiert ? 'text-indigo-500' : 'text-stone-400'} size={20} aria-hidden="true" />
          <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Smart-Pause</h3>
        </div>
        <button
          role="switch"
          aria-checked={jetztPausiert}
          aria-label="Jetzt pausieren"
          title="Jetzt pausieren"
          onClick={umschaltenJetzt}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            jetztPausiert ? 'bg-indigo-500' : 'bg-stone-300 dark:bg-stone-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              jetztPausiert ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
        Erscheine für deine Verbindungen als „Bin gerade offline". Du kannst die App
        weiterhin nutzen, ohne antworten zu müssen.
      </p>

      {jetztPausiert && (
        <div className="flex items-center gap-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-lg mb-4">
          <WifiOff size={14} aria-hidden="true" />
          Dein Profil wird gerade als „offline" angezeigt.
        </div>
      )}

      {uebernommen && (
        <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl mb-4 border border-amber-200 dark:border-amber-800">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Dein bisheriger Zeitplan lag nur auf diesem Gerät. Er ist hier übernommen —
            <strong> speichere ihn einmal</strong>, damit er auf allen Geräten gilt.
          </p>
        </div>
      )}

      <div className="border-t border-stone-100 dark:border-stone-700 pt-4 mt-2">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <Clock size={16} className="text-stone-400" aria-hidden="true" />
            Zeitplan
            <span className="text-xs font-normal text-stone-400">
              {stunden === 0 ? '· keine Stunde gewählt' : `· ${stunden} Std./Woche`}
            </span>
          </span>
          <button
            onClick={speichern}
            disabled={speichert}
            className="text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            {speichert ? <span>Speichere...</span> : <Save size={14} aria-hidden="true" />}
            Speichern
          </button>
        </div>

        <div className="flex items-start gap-2 text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl mb-4 border border-stone-100 dark:border-stone-700">
          <Info size={16} className="text-indigo-500 mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Wähle die Stunden, in denen du als „offline" erscheinen möchtest. Der Plan
            gilt auf allen deinen Geräten.
          </p>
        </div>

        {fehler && <p className="text-xs text-red-500 mb-4">{fehler}</p>}

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[500px]">
            <div className="flex mb-1">
              <div className="w-8 shrink-0"></div>
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="flex-1 text-[10px] text-center text-stone-400">
                  {i % 4 === 0 ? `${i}` : ''}
                </div>
              ))}
            </div>

            <div className="space-y-1">
              {TAGESNAMEN.map((tag, tIdx) => (
                <div key={tag} className="flex items-center h-6">
                  <div className="w-8 shrink-0 text-[10px] font-medium text-stone-500">{tag}</div>
                  {Array.from({ length: 24 }).map((_, hIdx) => {
                    const aktiv = plan[tIdx]?.[hIdx] === true;
                    return (
                      <div key={hIdx} className="flex-1 px-[1px] h-full">
                        <button
                          onClick={() => umschaltenStunde(tIdx, hIdx)}
                          aria-pressed={aktiv}
                          aria-label={`${tag}, ${hIdx}:00 bis ${hIdx + 1}:00`}
                          title={`${tag}, ${hIdx}:00 – ${hIdx + 1}:00`}
                          className={`w-full h-full rounded-[2px] transition-colors ${
                            aktiv
                              ? 'bg-indigo-400 dark:bg-indigo-500 hover:bg-indigo-500'
                              : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartPause;
