import { useState } from "react";
import { ArrowLeft, Shield, AlertTriangle, ShieldCheck, FileWarning, EyeOff, Scale, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { motion } from "motion/react";

export default function SafetyCenter() {
  const [activeTab, setActiveTab] = useState<'guidelines' | 'reports'>('guidelines');

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-stone-950 overflow-y-auto">
      <div className="bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 p-4 sticky top-0 z-20 flex items-center gap-3">
        <Link to="/profile" className="p-2 -ml-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
          <ArrowLeft size={20} className="text-stone-700 dark:text-stone-300" />
        </Link>
        <div>
          <h1 className="font-serif text-xl text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Shield className="text-indigo-500" size={20} />
            Safety Center
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="bg-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-sm">
          <div className="relative z-10">
            <h2 className="text-xl font-bold mb-2">Deine Sicherheit steht an erster Stelle</h2>
            <p className="text-indigo-100 text-sm leading-relaxed mb-4">
              Wir tolerieren kein toxisches Verhalten. Erfahre mehr über unsere Richtlinien oder melde direkt Vorfälle, die gegen unsere Community-Standards verstoßen.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('guidelines')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'guidelines' ? 'bg-white text-indigo-700' : 'bg-indigo-700/50 hover:bg-indigo-700 text-white'}`}
              >
                Richtlinien
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-white text-indigo-700' : 'bg-indigo-700/50 hover:bg-indigo-700 text-white'}`}
              >
                Meine Meldungen
              </button>
            </div>
          </div>
          <Shield size={120} className="absolute -right-6 -bottom-6 text-indigo-500/30 rotate-12" />
        </div>

        {activeTab === 'guidelines' ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="font-semibold text-stone-900 dark:text-stone-100">Verbindlich & Respektvoll</h3>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
                Behandle andere so, wie du behandelt werden möchtest. Keine Beleidigungen, kein Bodyshaming und kein Hass.
              </p>
              <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3">
                <h4 className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1">Null-Toleranz bei:</h4>
                <ul className="text-xs text-stone-600 dark:text-stone-400 space-y-1 ml-4 list-disc">
                  <li>Hassrede & Rassismus</li>
                  <li>Belästigung & Stalking</li>
                  <li>Ungefragte sexuelle Inhalte</li>
                </ul>
              </div>
            </div>

            <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <EyeOff size={20} />
                </div>
                <h3 className="font-semibold text-stone-900 dark:text-stone-100">Datenschutz & Privatsphäre</h3>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
                Teile niemals sensible Informationen (z.B. genaue Adresse, Bankdaten) direkt im Chat. Nutze unsere In-App-Funktionen für Verabredungen.
              </p>
              {/* 14.08.2026: war ein `<button>` ohne `onClick` — derselbe
                  Befund wie DSG-02 („Schaltflaechen ohne onClick", klar/17).
                  Die Seite gibt es seit dem 09.08.2026 unter
                  /rechtstexte/:art; sie war von hier aus nur nicht
                  erreichbar. `ExternalLink` war zudem das falsche Symbol:
                  Der Weg fuehrt nicht nach draussen. */}
              <Link
                to="/rechtstexte/datenschutz"
                className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:underline min-h-[44px]"
              >
                Datenschutzrichtlinie lesen <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>

            <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Scale size={20} />
                </div>
                <h3 className="font-semibold text-stone-900 dark:text-stone-100">Consent (Zustimmung)</h3>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                Nur ein "Ja" ist ein "Ja". Wenn jemand das Gespräch beenden möchte oder kein Interesse an einem Date hat, respektiere das sofort. Wir werten persistentes Nachfragen nach einem "Nein" als Belästigung.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm text-center py-10">
              <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 text-stone-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileWarning size={24} />
              </div>
              <h3 className="font-medium text-stone-900 dark:text-stone-100 mb-1">Keine aktiven Meldungen</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 max-w-[250px] mx-auto">
                Wenn du ein Profil oder eine Nachricht meldest, kannst du den Status der Überprüfung hier einsehen.
              </p>
            </div>

            <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-5">
              <h4 className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-400 mb-2">
                <AlertTriangle size={16} /> Hilfe in Notfällen
              </h4>
              <p className="text-sm text-rose-600/80 dark:text-rose-400/80 mb-3">
                Wenn du dich in unmittelbarer Gefahr befindest, kontaktiere sofort die lokalen Behörden.
              </p>
              <a href="tel:112" className="block w-full text-center bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                Notruf 112 wählen
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
