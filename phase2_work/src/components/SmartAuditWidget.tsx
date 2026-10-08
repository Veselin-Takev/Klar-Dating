import { klarStorage } from '../lib/userScopedStorage';
import { useState } from 'react';
import { Sparkles, Activity, CheckCircle2, ChevronRight, Download, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
// 12.08.2026: `html2canvas` -> `html2canvas-pro`. Der urspruengliche
// Paketstand versteht die Farbfunktion `oklch()` nicht, die Tailwind v4
// durchgehend verwendet — jeder PDF-Export brach mit „Attempting to
// parse an unsupported color function oklch" ab. Der Fork kann sie.
import html2canvas from 'html2canvas-pro';
import { triggerHaptic } from '../lib/haptics';
import { fetchWithCache } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { melde } from '../lib/fehler';

// ═══════════════════════════════════════════════════════════════════════════
// `// @ts-nocheck` ENTFERNT am 12.08.2026. Der Hauptfund ist sichtbar
// kaputtes Verhalten, kein Schönheitsfehler:
//
// ── 1. EINE FEHLERANTWORT WURDE ALS ERGEBNIS ANGEZEIGT ────────────────────
// `server.ts:3117` antwortet bei einem Fehler mit
//     res.status(500).json({ error: "Audit failed" })
// Diese Komponente hat den Statuscode NIE angesehen. Sie las den Rumpf,
// parste ihn und setzte ihn als Ergebnis. Danach stand auf dem Bildschirm:
//
//     Profil-Score:  undefined / 10
//
// und `onAuditComplete(undefined)` reichte diesen Wert an `Profile.tsx`
// weiter. Mit `any` als Typ konnte der Compiler das nicht sehen.
//
// ── 2. DIE FEHLERANTWORT WURDE DAUERHAFT ZWISCHENGESPEICHERT ──────────────
// `klarStorage.setItem(cacheKey, …)` lief VOR jeder Prüfung. Der Schlüssel
// ist aus Bio, Werten und Bild gebildet — also stabil. Ein einziger
// missglückter Aufruf hat „undefined / 10" für genau diese Bio dauerhaft
// festgeschrieben. Nur eine Änderung am Profil hätte ihn wieder gelöst.
//
// ── 3. `useState<unknown>` ────────────────────────────────────────────────────
// Alle Zugriffe auf `auditResult` waren ungeprüft. Ersetzt durch einen
// benannten Typ und eine Prüffunktion, die aus `unknown` entweder ein
// gültiges Ergebnis macht oder `null`.
//
// ── WAS SICH SICHTBAR ÄNDERT ──────────────────────────────────────────────
// Schlägt das Audit fehl oder kommt etwas Unlesbares zurück, steht das
// jetzt da: „Die Auswertung ist nicht angekommen." Vorher stand dort eine
// Zahl, die keine war. Zwischengespeichert wird nur noch, was die Prüfung
// besteht.
//
// ── NACHTRAG 12.08.2026, abends ───────────────────────────────────────────
// Hier stand: „/api/smart-audit ist eine der 38 Aufrufstellen, die noch
// nicht über kiAufruf.ts laufen." Das ist erledigt — der Endpunkt war der
// letzte der 53 und hat jetzt Zeitgrenze, zweiten Versuch und JSON-Prüfung.
// Die Strategie bleibt `kein_ersatz`: Eine erfundene Profilbewertung wäre
// schlimmer als keine.
// ═══════════════════════════════════════════════════════════════════════════

interface SmartAuditWidgetProps {
  bio: string;
  values: { subject: string; A: number }[];
  profileImageUrl?: string;
  onAuditComplete?: (score: number) => void;
}

/** Das, was diese Komponente anzeigen kann — und sonst nichts. */
interface AuditErgebnis {
  overallScore: number;
  strengths: string[];
  suggestions: string[];
}

function nurZeichenketten(roh: unknown): string[] {
  return Array.isArray(roh) ? roh.filter((w): w is string => typeof w === 'string') : [];
}

/**
 * Aus einer unbekannten Antwort ein Ergebnis machen — oder `null`.
 *
 * Die Punktzahl ist die einzige Pflichtangabe: Ohne sie ist die Anzeige
 * „… / 10" sinnlos. Stärken und Vorschläge dürfen fehlen; dann werden die
 * Abschnitte einfach nicht gezeigt.
 */
function leseAudit(roh: unknown): AuditErgebnis | null {
  if (roh === null || typeof roh !== 'object') return null;
  const d = roh as Record<string, unknown>;
  const punkte = typeof d['overallScore'] === 'number' ? d['overallScore'] : Number.NaN;
  if (!Number.isFinite(punkte) || punkte < 1 || punkte > 10) return null;
  const strengths = nurZeichenketten(d['strengths']).filter((text) => text.trim().length > 0 && text.length <= 800).slice(0, 8);
  const suggestions = nurZeichenketten(d['suggestions']).filter((text) => text.trim().length > 0 && text.length <= 800).slice(0, 8);
  return {
    overallScore: Math.round(punkte * 10) / 10,
    strengths,
    suggestions,
  };
}

export function SmartAuditWidget({
  bio,
  values,
  profileImageUrl,
  onAuditComplete,
}: SmartAuditWidgetProps) {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditErgebnis | null>(null);
  const [fehlertext, setFehlertext] = useState<string | null>(null);

  const exportPDF = async () => {
    if (!auditResult) return;
    triggerHaptic('LIGHT_TAP');

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(245, 158, 11);
    doc.text('Smart-Audit Profilanalyse', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Generiert am: ' + new Date().toLocaleDateString('de-DE'), 14, 30);

    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text('Profil-Score: ' + auditResult.overallScore + ' / 10', 14, 45);

    let yPos = 60;

    const radarElement = document.getElementById('werte-radar-container');
    if (radarElement) {
      try {
        const canvas = await html2canvas(radarElement, { backgroundColor: null, scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 14, yPos, 80, 80);
        yPos += 90;
      } catch (e) {
        // Kein Abbruch: Das Diagramm ist Beiwerk, der Text ist der Bericht.
        melde('SmartAuditWidget/radar', e);
      }
    }

    if (auditResult.strengths.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(12);
      doc.setTextColor(16, 185, 129);
      doc.text('Deine Stärken:', 14, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      for (const str of auditResult.strengths) {
        const splitText = doc.splitTextToSize(String.fromCharCode(8226) + ' ' + str, 180);
        doc.text(splitText, 14, yPos);
        yPos += splitText.length * 5 + 2;
      }
      yPos += 5;
    }

    if (auditResult.suggestions.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(12);
      doc.setTextColor(245, 158, 11);
      doc.text('Optimierungspotenzial:', 14, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      for (const sug of auditResult.suggestions) {
        const splitText = doc.splitTextToSize(String.fromCharCode(8226) + ' ' + sug, 180);
        doc.text(splitText, 14, yPos);
        yPos += splitText.length * 5 + 2;
      }
    }

    doc.save('Klar-Smart-Audit-Report.pdf');
    triggerHaptic('SUCCESS');
  };

  const uebernehmen = (ergebnis: AuditErgebnis) => {
    setAuditResult(ergebnis);
    setFehlertext(null);
    onAuditComplete?.(ergebnis.overallScore);
    triggerHaptic('SUCCESS');
  };

  const handleAudit = async () => {
    setIsAuditing(true);
    setFehlertext(null);
    triggerHaptic('LIGHT_TAP');

    const cacheString = bio + JSON.stringify(values.map((v) => v.subject)) + (profileImageUrl ?? '');
    const cacheKey =
      'smartAuditCache_' + btoa(unescape(encodeURIComponent(cacheString))).substring(0, 50);

    const cachedData = klarStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const ergebnis = leseAudit(JSON.parse(cachedData) as unknown);
        if (ergebnis) {
          uebernehmen(ergebnis);
          setIsAuditing(false);
          return;
        }
        // Unbrauchbarer Eintrag: weg damit, statt ihn jedes Mal neu zu lesen.
        klarStorage.removeItem(cacheKey);
      } catch {
        klarStorage.removeItem(cacheKey);
      }
    }

    try {
      const res = await fetchWithCache('/api/smart-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, values: values.map((v) => v.subject), profileImageUrl }),
      });

      // NEU: Der Statuscode wird angesehen. Bei 400/500 steht im Rumpf
      // `{ error: … }` — das ist keine Auswertung.
      if (!res.ok) {
        const rumpf = await res.text();
        throw new Error(`HTTP ${res.status}: ${rumpf.slice(0, 200)}`);
      }

      const text = await res.text();
      const ergebnis = leseAudit(text ? (JSON.parse(text) as unknown) : null);
      if (!ergebnis) throw new Error('Antwort ohne lesbare Punktzahl');

      // Erst prüfen, dann speichern. Vorher andersherum — und damit wurde
      // eine Fehlermeldung dauerhaft festgeschrieben.
      klarStorage.setItem(cacheKey, JSON.stringify(ergebnis));
      uebernehmen(ergebnis);
    } catch (e) {
      melde('SmartAuditWidget', e);
      setFehlertext('Die Auswertung ist nicht angekommen. Bitte später noch einmal versuchen.');
      triggerHaptic('ERROR');
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm relative overflow-hidden mb-6">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full -z-10" />

      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
          <Activity size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">Smart-Audit Tool</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Analysiert deine Werte-Ausstrahlung
          </p>
        </div>
      </div>

      {!auditResult ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-stone-600 dark:text-stone-400">
            Lass den KI-Verbindungsberater prüfen, wie stark deine aktuellen Werte in deinem Profil und
            Bio-Text zur Geltung kommen, um die besten Deep-Verbindungen anzuziehen.
          </p>

          {fehlertext && (
            <p className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{fehlertext}</span>
            </p>
          )}

          <button
            onClick={handleAudit}
            disabled={isAuditing || !bio.trim()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
          >
            {isAuditing ? (
              <span className="flex items-center gap-2">
                <Sparkles size={16} className="" /> Analysiere Profil...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles size={16} /> Audit Starten
              </span>
            )}
          </button>
        </div>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700">
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                Profil-Score
              </span>
              <div className="flex items-center gap-1.5 font-mono text-lg font-bold text-amber-500">
                {auditResult.overallScore}{' '}
                <span className="text-xs text-stone-400 font-sans font-normal">/ 10</span>
              </div>
            </div>

            {auditResult.strengths.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-stone-800 dark:text-stone-200 mb-2">
                  Deine Stärken
                </h4>
                <ul className="flex flex-col gap-2">
                  {auditResult.strengths.map((str, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-stone-600 dark:text-stone-400"
                    >
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {auditResult.suggestions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-stone-800 dark:text-stone-200 mb-2">
                  Optimierungspotenzial
                </h4>
                <ul className="flex flex-col gap-2">
                  {auditResult.suggestions.map((sug, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-stone-600 dark:text-stone-400"
                    >
                      <ChevronRight size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <span>{sug}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={exportPDF}
                className="flex items-center justify-center gap-2 flex-1 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-medium text-xs transition-colors"
              >
                <Download size={14} /> Als PDF exportieren
              </button>
              <button
                onClick={() => setAuditResult(null)}
                className="flex items-center justify-center gap-2 flex-1 py-2 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 text-xs font-medium transition-colors"
              >
                Neues Audit starten
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
