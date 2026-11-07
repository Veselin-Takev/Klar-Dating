import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/AuthContext";
import { getAuthToken } from "../lib/api";
import { saveGuestConsent } from "../lib/guestConsent";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { birthdateFromParts, partsFromBirthdate } from "../lib/birthdateEntry";

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
  const { t, i18n } = useTranslation();
  const { refreshProfile, user } = useAuth();
  const [schritt, setSchritt] = useState<"alter" | "einwilligung">(
    alterBereitsGeprueft ? "einwilligung" : "alter",
  );
  // Direct numeric entry avoids decade-scrolling on mobile. The native calendar
  // remains available, and both modes produce the same canonical ISO date.
  const [modus, setModus] = useState<"direkt" | "kalender">("direkt");
  const [tag, setTag] = useState("");
  const [monat, setMonat] = useState("");
  const [jahr, setJahr] = useState("");
  const [kalenderDatum, setKalenderDatum] = useState("");
  const [fehlerAmDatum, setFehlerAmDatum] = useState(false);
  const geburtsdatum = modus === "kalender"
    ? (partsFromBirthdate(kalenderDatum) ? kalenderDatum : "")
    : (birthdateFromParts(tag, monat, jahr) ?? "");
  const monthFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "de", {
    month: "long", timeZone: "UTC",
  });
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
    setFehlerAmDatum(false);

    if (!geburtsdatum) {
      setFehler(t("ageGate.errorInvalid"));
      setFehlerAmDatum(true);
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
            setFehlerAmDatum(true);
            setFehler(t("ageGate.errorInvalid"));
            return;
          default:
            if (res.status === 429) {
              setFehler(t("ageGate.errorRateLimit"));
              return;
            }
            // A missing Vercel API route is a deployment/backend problem,
            // NOT an invalid birth date. Never fall back to browser authority.
            if ([404, 405, 502, 503, 504].includes(res.status)) {
              setFehler(t("ageGate.errorService"));
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
    <div className="min-h-[100dvh] bg-canvas flex items-start justify-center px-4 pt-6 pb-12 sm:items-center sm:px-6 sm:py-8">
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

            <fieldset
              aria-describedby={fehler ? "geb-hinweis geb-fehler" : "geb-hinweis"}
              className="mb-2"
            >
              <legend className="block text-ink font-medium mb-3">
                {t("ageGate.birthdateLabel")}
              </legend>

              {modus === "direkt" ? (
                <div id="geb-eingabe" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.2fr)] gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <label htmlFor="geb-tag" className="block mb-2 text-sm text-ink">
                      {t("ageGate.dayLabel")}
                    </label>
                    <input
                      id="geb-tag"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday-day"
                      pattern="[0-9]*"
                      maxLength={2}
                      placeholder={t("ageGate.dayPlaceholder")}
                      value={tag}
                      onChange={e => {
                        setTag(e.target.value.replace(/\D/g, "").slice(0, 2));
                        setFehler(null);
                        setFehlerAmDatum(false);
                      }}
                      aria-invalid={fehlerAmDatum}
                      className="w-full min-h-[52px] px-3 rounded-xl border border-line-ui bg-surface text-ink text-base text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="geb-monat" className="block mb-2 text-sm text-ink">
                      {t("ageGate.monthLabel")}
                    </label>
                    <select
                      id="geb-monat"
                      autoComplete="bday-month"
                      value={monat}
                      onChange={e => {
                        setMonat(e.target.value);
                        setFehler(null);
                        setFehlerAmDatum(false);
                      }}
                      aria-invalid={fehlerAmDatum}
                      className="w-full min-h-[52px] px-2 rounded-xl border border-line-ui bg-surface text-ink text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <option value="">{t("ageGate.monthPlaceholder")}</option>
                      {Array.from({ length: 12 }, (_, monthIndex) => {
                        const monthValue = String(monthIndex + 1).padStart(2, "0");
                        return (
                          <option key={monthValue} value={monthValue}>
                            {monthFormatter.format(new Date(Date.UTC(2020, monthIndex, 1)))}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="geb-jahr" className="block mb-2 text-sm text-ink">
                      {t("ageGate.yearLabel")}
                    </label>
                    <input
                      id="geb-jahr"
                      type="text"
                      inputMode="numeric"
                      autoComplete="bday-year"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder={t("ageGate.yearPlaceholder")}
                      value={jahr}
                      onChange={e => {
                        setJahr(e.target.value.replace(/\D/g, "").slice(0, 4));
                        setFehler(null);
                        setFehlerAmDatum(false);
                      }}
                      aria-invalid={fehlerAmDatum}
                      className="w-full min-h-[52px] px-2 rounded-xl border border-line-ui bg-surface text-ink text-base text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    />
                  </div>
                </div>
              ) : (
                <input
                  id="geb"
                  name="geburtsdatum"
                  type="date"
                  data-testid="geburtsdatum-input"
                  autoComplete="bday"
                  min="1900-01-01"
                  value={kalenderDatum}
                  onChange={e => {
                    setKalenderDatum(e.target.value);
                    setFehler(null);
                    setFehlerAmDatum(false);
                  }}
                  aria-label={t("ageGate.birthdateLabel")}
                  aria-invalid={fehlerAmDatum}
                  className="w-full min-h-[52px] p-3 rounded-xl border border-line-ui bg-surface text-ink text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
              )}
              <p id="geb-hinweis" className="text-sm text-muted mt-3">
                {t("ageGate.dateInputHint")}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (modus === "direkt") {
                    setKalenderDatum(geburtsdatum);
                    setModus("kalender");
                  } else {
                    const parts = partsFromBirthdate(kalenderDatum);
                    setTag(parts?.day ?? "");
                    setMonat(parts?.month ?? "");
                    setJahr(parts?.year ?? "");
                    setModus("direkt");
                  }
                  setFehler(null);
                  setFehlerAmDatum(false);
                }}
                className="inline-flex items-center min-h-11 mt-2 text-base underline underline-offset-4 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t(modus === "direkt" ? "ageGate.useCalendar" : "ageGate.useDirect")}
              </button>
            </fieldset>

            {fehler && (
              <p id="geb-fehler" role="alert" className="text-base mb-2 text-warn">
                {fehler}
              </p>
            )}

            <button
              type="submit"
              disabled={laeuft}
              className="w-full min-h-[52px] py-3 mt-4 rounded-2xl bg-accent text-on-accent font-medium text-base disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
