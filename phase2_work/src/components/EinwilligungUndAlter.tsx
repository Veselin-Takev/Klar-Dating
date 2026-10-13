import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/AuthContext";
import { getAuthToken } from "../lib/api";
import { saveGuestConsent } from "../lib/guestConsent";
import { LanguageSwitcher } from "./LanguageSwitcher";

// ═══════════════════════════════════════════════════════════════════════════
// DSG-02 — Altersangabe und Einwilligung
//
// Ein Dialog, zwei getrennte Schritte. Sie sind bewusst nicht zusammengelegt:
// Die Altersangabe ist Pflicht (ohne sie kein Konto), die Einwilligung ist
// freiwillig. Wer beides in einem Knopf bündelt, macht die Einwilligung
// unfreiwillig — und damit nach Art. 7 Abs. 2 DSGVO unwirksam.
//
// Was hier NICHT passiert:
//   · Kein „Alle akzeptieren" als hervorgehobener Knopf. Ablehnen muss
//     genauso leicht sein wie Zustimmen.
//   · Keine Vorauswahl der freiwilligen Zwecke. Ein vorangekreuztes Kästchen
//     ist keine Einwilligung (EuGH, Planet49).
//   · Kein Wegklicken ohne Entscheidung bei der Altersangabe.
// ═══════════════════════════════════════════════════════════════════════════

type Zwecke = { ki_auswertung: boolean; fehlerberichte: boolean; produktanalyse: boolean };

interface Props {
  /** Wird aufgerufen, sobald Alter geprüft und Einwilligung gespeichert ist. */
  onFertig?: () => void;
  /** Bereits volljährig bestätigt? Dann entfällt der erste Schritt. */
  alterBereitsGeprueft?: boolean;
}

export function EinwilligungUndAlter({ onFertig, alterBereitsGeprueft = false }: Props) {
  const { t } = useTranslation();
  const { refreshProfile, user } = useAuth();
  const [schritt, setSchritt] = useState<"alter" | "einwilligung">(
    alterBereitsGeprueft ? "einwilligung" : "alter",
  );
  const [geburtsdatum, setGeburtsdatum] = useState("");
  const [zwecke, setZwecke] = useState<Zwecke>({ ki_auswertung: false, fehlerberichte: false, produktanalyse: false });
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    setSchritt(alterBereitsGeprueft ? "einwilligung" : "alter");
  }, [alterBereitsGeprueft]);

  async function alterSenden(e: React.FormEvent) {
    e.preventDefault();
    if (laeuft) return;
    setFehler(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(geburtsdatum)) {
      setFehler(t("ageGate.errorInvalid"));
      return;
    }

    setLaeuft(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/account/alter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ geburtsdatum }),
      });
      const rawData: unknown = await res.json().catch(() => ({}));
      const daten = rawData && typeof rawData === 'object' && !Array.isArray(rawData)
        ? rawData as Record<string, unknown>
        : {};

      if (!res.ok) {
        switch (daten?.code) {
          case 'UNDERAGE_RESTRICTION':
            setFehler(t("ageGate.errorUnderage"));
            return;
          case 'UNDERAGE_ACCOUNT_LOCKED':
            setFehler(t("ageGate.errorAccountLocked"));
            return;
          case 'INVALID_DATE_FORMAT':
          case 'INVALID_BIRTHDATE':
          case 'INVALID_BIRTHDATE_FUTURE':
          case 'INVALID_BIRTHDATE_PLAUSIBILITY':
            setFehler(t("ageGate.errorInvalid"));
            return;
          default:
            if (res.status === 429) {
              setFehler(t("ageGate.errorRateLimit"));
              return;
            }
            if (res.status >= 500) {
              setFehler(t("ageGate.errorService"));
              return;
            }
            setFehler(typeof daten.error === 'string' ? daten.error : t("ageGate.errorGeneric"));
            return;
        }
      }

      if (daten?.ok !== true || daten?.isAdult !== true) {
        setFehler(t("ageGate.errorGeneric"));
        return;
      }

      const profile = await refreshProfile();
      // Confirm the same UID's authoritative date and adult status from
      // Firestore before advancing. A 200 API response alone is insufficient.
      if (!profile || profile.isAdult !== true || profile.geburtsdatum !== geburtsdatum) {
        setFehler(t("ageGate.errorGeneric"));
        return;
      }
      setSchritt("einwilligung");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      if (err instanceof TypeError || message.includes('failed to fetch') || message.includes('network')) {
        setFehler(t("ageGate.errorOffline"));
      } else {
        setFehler(t("ageGate.errorService"));
      }
    } finally {
      setLaeuft(false);
    }
  }

  async function einwilligungSenden(gewaehlt: Zwecke) {
    if (laeuft) return;
    setFehler(null);
    setLaeuft(true);
    try {
      if (!user || user.isAnonymous) {
        // A guest has no durable server consent record. Never fabricate an evidenceId.
        // Session storage is UID-bound and must be confirmed before advancing.
        saveGuestConsent(user?.uid ?? "unauthed-session", gewaehlt, window.sessionStorage);
        onFertig?.();
        return;
      }
      const token = await getAuthToken();
      const res = await fetch("/api/einwilligung", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ zwecke: gewaehlt }),
      });
      const rawData: unknown = await res.json().catch(() => ({}));
      const daten = rawData && typeof rawData === 'object' && !Array.isArray(rawData)
        ? rawData as { ok?: unknown; evidenceId?: unknown; einwilligung?: unknown; error?: unknown }
        : {};
      const evidenceId = typeof daten.evidenceId === 'string' ? daten.evidenceId : null;
      if (!res.ok) {
        setFehler(typeof daten.error === 'string' ? daten.error : "Die Einwilligung konnte nicht gespeichert werden.");
        return;
      }
      if (daten.ok !== true || !daten.einwilligung) {
        throw new Error('Die Einwilligungsentscheidung wurde nicht bestätigt.');
      }
      if (!evidenceId) {
        // The server did not supply auditable evidence. Preserve only the local
        // session preference; do not claim it authorizes optional server processing.
        saveGuestConsent(user.uid, gewaehlt, window.sessionStorage);
        onFertig?.();
        return;
      }
      const profile = await refreshProfile();
      const persistedConsent = profile?.einwilligung;
      const persistedEvidenceId = persistedConsent && typeof persistedConsent === 'object' && !Array.isArray(persistedConsent)
        ? (persistedConsent as Record<string, unknown>).evidenceId
        : undefined;
      if (profile?.isAdult !== true || persistedEvidenceId !== evidenceId) {
        throw new Error('Der aktuelle Einwilligungsstand wurde nicht bestätigt.');
      }
      onFertig?.();
    } catch (err: unknown) {
      if (err instanceof TypeError || (err instanceof Error && /fetch|network|Failed to fetch/i.test(err.message))) {
        setFehler(t("ageGate.errorOffline"));
      } else {
        setFehler(err instanceof Error ? err.message : "Die Einwilligung konnte nicht gespeichert werden.");
      }
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        {schritt === "alter" ? (
          <form onSubmit={alterSenden} noValidate>
            <h1 className="text-3xl font-serif text-ink mb-3">{t("ageGate.title")}</h1>
            <p className="text-muted mb-6">
              {t("ageGate.intro")}
            </p>

            <label htmlFor="geb" className="block text-ink mb-2">
              {t("ageGate.birthdateLabel")}
            </label>
            <input
              id="geb"
              name="geburtsdatum"
              type="date"
              required
              min="1900-01-01"
              value={geburtsdatum}
              onChange={(e) => {
                setGeburtsdatum(e.target.value);
                setFehler(null);
              }}
              aria-invalid={!!fehler}
              aria-describedby={fehler ? "geb-fehler" : undefined}
              className="w-full p-4 rounded-2xl border border-line-ui bg-surface text-ink mb-2"
            />

            {fehler && (
              <p id="geb-fehler" role="alert" className="text-base mb-2 text-warn">
                {fehler}
              </p>
            )}

            <button
              type="submit"
              disabled={laeuft || !geburtsdatum}
              className="w-full py-4 mt-4 rounded-2xl bg-accent text-on-accent font-medium disabled:opacity-50"
            >
              {laeuft ? t("ageGate.checking") : t("ageGate.next")}
            </button>
          </form>
        ) : (
          <div>
            <h1 className="text-3xl font-serif text-ink mb-3">{t("consentGate.title")}</h1>
            <p className="text-muted mb-6">
              {t("consentGate.intro")}
            </p>

            <div className="space-y-3 mb-6">
              <Kasten
                id="ki"
                titel={t("consentGate.aiTitle")}
                text={t("consentGate.aiText")}
                an={zwecke.ki_auswertung}
                setzen={(v) => setZwecke((z) => ({ ...z, ki_auswertung: v }))}
              />
              <Kasten
                id="fehler"
                titel={t("consentGate.crashTitle")}
                text={t("consentGate.crashText")}
                an={zwecke.fehlerberichte}
                setzen={(v) => setZwecke((z) => ({ ...z, fehlerberichte: v }))}
              />
              <Kasten
                id="produktanalyse"
                titel={t("consentGate.analyticsTitle")}
                text={t("consentGate.analyticsText")}
                an={zwecke.produktanalyse}
                setzen={(v) => setZwecke((z) => ({ ...z, produktanalyse: v }))}
              />
            </div>

            <p className="text-muted text-base mb-6">
              {t("consentGate.detailsIntro")}{" "}
              <Link to="/rechtstexte/datenschutz" className="underline text-ink">{t("consentGate.privacyLink")}</Link>
              {" "}{t("consentGate.and")}{" "}
              <Link to="/rechtstexte/agb" className="underline text-ink">{t("consentGate.termsLink")}</Link>.
            </p>

            {fehler && (
              <p role="alert" className="text-base mb-3 text-warn">
                {fehler}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={laeuft}
                onClick={() => einwilligungSenden({ ki_auswertung: false, fehlerberichte: false, produktanalyse: false })}
                className="py-4 rounded-2xl border border-line-ui text-ink font-medium disabled:opacity-50"
              >
                {t("consentGate.none")}
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => einwilligungSenden(zwecke)}
                className="py-4 rounded-2xl border border-line-ui text-ink font-medium disabled:opacity-50"
              >
                {t("consentGate.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kasten({
  id, titel, text, an, setzen,
}: { id: string; titel: string; text: string; an: boolean; setzen: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex gap-3 items-start rounded-2xl border border-line-ui p-4 cursor-pointer">
      <input
        id={id}
        name={id}
        type="checkbox"
        checked={an}
        onChange={(e) => setzen(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0"
      />
      <span>
        <span className="block text-ink font-medium">{titel}</span>
        <span className="block text-muted text-base">{text}</span>
      </span>
    </label>
  );
}

export default EinwilligungUndAlter;
