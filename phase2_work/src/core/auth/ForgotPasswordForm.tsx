import React, { useState, useEffect } from 'react';
import {
  requestPasswordReset,
  confirmNewPassword,
  calculatePasswordStrength,
  isValidEmailFormat,
} from './passwordResetService';
import { Check, AlertCircle, Eye, EyeOff, Mail, KeyRound, Sparkles, ArrowLeft, Clock } from 'lucide-react';

export interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
  initialToken?: string | null;
  initialMode?: 'request' | 'reset' | 'magic_confirm';
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onBackToLogin,
  initialToken = null,
  initialMode = 'request',
}) => {
  const [mode, setMode] = useState<'request' | 'sent' | 'reset' | 'magic_confirm' | 'success'>(
    initialToken ? 'reset' : initialMode
  );
  const [method, setMethod] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(initialToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation & Loading
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 60-Second Cooldown Timer for Resending
  const [cooldown, setCooldown] = useState(0);

  // 3-Second Countdown for Auto-Redirect upon Success
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // Check URL parameters on mount if token not provided via prop
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token') || params.get('oobCode');
      const isResetMode = params.get('mode') === 'resetPassword' || window.location.pathname.includes('/passwort-erneuern');
      if (urlToken || isResetMode) {
        if (urlToken) setToken(urlToken);
        setMode('reset');
      }
    }
  }, []);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Success auto-redirect effect
  useEffect(() => {
    if (mode !== 'success') return;
    if (redirectCountdown <= 0) {
      onBackToLogin();
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [mode, redirectCountdown, onBackToLogin]);

  // Live password strength calculation
  const strength = calculatePasswordStrength(newPassword);

  // Step 2 Submission: Request Link
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setServerError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Bitte gib deine E-Mail-Adresse ein.');
      return;
    }
    if (!isValidEmailFormat(trimmed)) {
      setEmailError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    setIsLoading(true);
    const result = await requestPasswordReset(trimmed, method);
    setIsLoading(false);

    if (result.success) {
      setMode('sent');
      setCooldown(60); // 60s cooldown
    } else {
      setServerError(result.error || 'Ein Fehler ist aufgetreten.');
    }
  };

  // Step 5 Submission: Confirm New Password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setServerError(null);

    if (!newPassword) {
      setPasswordError('Bitte gib ein neues Passwort ein.');
      return;
    }
    if (newPassword.length < 12) {
      setPasswordError('Das Passwort muss mindestens 12 Zeichen lang sein.');
      return;
    }
    if (!strength.criteria.hasUpper || !strength.criteria.hasLower || !strength.criteria.hasNumberOrSpecial) {
      setPasswordError('Das Passwort muss Groß- und Kleinbuchstaben sowie Zahlen oder Sonderzeichen enthalten.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    setIsLoading(true);
    const result = await confirmNewPassword(token, newPassword);
    setIsLoading(false);

    if (result.success) {
      setMode('success');
      setRedirectCountdown(3);
    } else {
      setServerError(result.error || 'Dieser Wiederherstellungslink ist abgelaufen oder wurde bereits verwendet.');
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center bg-light-bg px-6 py-10 shadow-md dark:bg-dark-bg text-ink">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Brand Icon Badge */}
        <div className="w-16 h-16 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light rounded-3xl flex items-center justify-center mb-6 shadow-sm rotate-2">
          {mode === 'reset' ? <KeyRound size={32} /> : mode === 'success' ? <Check size={32} /> : <Sparkles size={32} />}
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SCHRITT 2: Screen „Passwort zurücksetzen anfordern“
        ───────────────────────────────────────────────────────────── */}
        {mode === 'request' && (
          <div className="w-full">
            <h1 className="text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 text-center">
              Passwort zurücksetzen
            </h1>
            <p className="text-stone-600 dark:text-stone-400 text-center mb-6 text-sm">
              Gib deine registrierte E-Mail-Adresse ein. Wir senden dir einen sicheren Link, mit dem du ein neues Passwort vergeben kannst.
            </p>

            {/* Moderne Authentifizierung: Magic Link Tab Toggle */}
            <div className="flex rounded-2xl bg-stone-100 dark:bg-stone-800 p-1 mb-6 border border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setMethod('password')}
                className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${
                  method === 'password'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'
                }`}
              >
                Passwort-Link
              </button>
              <button
                type="button"
                onClick={() => setMethod('magic')}
                className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all ${
                  method === 'magic'
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'
                }`}
              >
                Direkt anmelden (Magic Link)
              </button>
            </div>

            {serverError && (
              <div role="alert" className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleRequestSubmit} noValidate className="space-y-4">
              <div className="flex flex-col space-y-1 text-left">
                <label htmlFor="reset-email" className="text-sm font-medium text-stone-700 dark:text-stone-300 ml-1">
                  E-Mail-Adresse
                </label>
                <div className="relative">
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@beispiel.de"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    className={`w-full p-4 rounded-2xl border ${
                      emailError
                        ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
                        : 'border-stone-200 dark:border-stone-700'
                    } bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand`}
                    disabled={isLoading}
                    required
                  />
                </div>
                {emailError && (
                  <p role="alert" className="text-xs text-red-600 dark:text-red-400 ml-1 mt-1">
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-brand text-white rounded-2xl font-medium text-base flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-50 min-h-12"
              >
                {isLoading ? (
                  <>
                    <Clock size={18} className="animate-spin" />
                    <span>Wird gesendet…</span>
                  </>
                ) : (
                  <span>Link anfordern</span>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 text-sm transition-colors min-h-11 px-2"
                >
                  <ArrowLeft size={16} />
                  <span>Zurück zum Login</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            SCHRITT 3: Feedback-Screen / Bestätigung (Schutz vor Account Enumeration)
        ───────────────────────────────────────────────────────────── */}
        {mode === 'sent' && (
          <div className="w-full text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
              <Mail size={24} />
            </div>

            <h1 className="text-3xl font-serif text-stone-900 dark:text-stone-100">
              E-Mail gesendet
            </h1>

            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-sm text-stone-700 dark:text-stone-300 leading-relaxed text-left space-y-3">
              <p className="font-medium text-stone-900 dark:text-stone-100">
                Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir soeben einen Link zum Zurücksetzen deines Passworts gesendet.
              </p>
              <ul className="text-xs text-stone-500 dark:text-stone-400 space-y-1.5 list-disc pl-4">
                <li>Prüfe auch deinen Spam- oder Junk-Ordner.</li>
                <li>Der Link ist aus Sicherheitsgründen für 15 Minuten gültig.</li>
              </ul>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={handleRequestSubmit}
                disabled={isLoading || cooldown > 0}
                className="w-full py-3.5 px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-medium text-sm hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50 min-h-11"
              >
                {cooldown > 0 ? `Erneut senden in ${cooldown}s` : 'Erneut senden'}
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 text-sm transition-colors min-h-11 px-2"
              >
                <ArrowLeft size={16} />
                <span>Zurück zur Anmeldung</span>
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            SCHRITT 5: Screen „Neues Passwort vergeben“
        ───────────────────────────────────────────────────────────── */}
        {mode === 'reset' && (
          <div className="w-full">
            <h1 className="text-3xl font-serif text-stone-900 dark:text-stone-100 mb-2 text-center">
              Neues Passwort wählen
            </h1>
            <p className="text-stone-600 dark:text-stone-400 text-center mb-6 text-sm">
              Bitte vergib ein neues, sicheres Passwort für deinen Account.
            </p>

            {serverError && (
              <div role="alert" className="p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-sm flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{serverError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('request');
                    setServerError(null);
                  }}
                  className="text-xs font-semibold text-brand underline self-start ml-6"
                >
                  Neuen Link anfordern
                </button>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              {/* Feld 1: Neues Passwort */}
              <div className="flex flex-col space-y-1 text-left">
                <label htmlFor="new-password" className="text-sm font-medium text-stone-700 dark:text-stone-300 ml-1">
                  Neues Passwort
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    aria-label="Neues Passwort"
                    placeholder="Mindestens 12 Zeichen"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-4 pr-12 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1"
                    aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <div className="space-y-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 text-xs">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-600 dark:text-stone-400">Passwortstärke:</span>
                    <span
                      className={`font-semibold ${
                        strength.tier === 'strong'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : strength.tier === 'medium'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-500'
                      }`}
                    >
                      {strength.label}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        strength.tier === 'strong'
                          ? 'bg-emerald-500 w-full'
                          : strength.tier === 'medium'
                          ? 'bg-amber-500 w-2/3'
                          : 'bg-red-500 w-1/3'
                      }`}
                    />
                  </div>
                  {/* Criteria Checklist */}
                  <div className="grid grid-cols-1 gap-1 pt-1 text-[11px] text-stone-600 dark:text-stone-400">
                    <div className="flex items-center gap-1.5">
                      <span className={strength.criteria.minLength ? 'text-emerald-600' : 'text-stone-400'}>
                        {strength.criteria.minLength ? '✓' : '○'}
                      </span>
                      <span>Mindestens 12 Zeichen</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={strength.criteria.hasUpper && strength.criteria.hasLower ? 'text-emerald-600' : 'text-stone-400'}>
                        {strength.criteria.hasUpper && strength.criteria.hasLower ? '✓' : '○'}
                      </span>
                      <span>Groß- und Kleinbuchstaben</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={strength.criteria.hasNumberOrSpecial ? 'text-emerald-600' : 'text-stone-400'}>
                        {strength.criteria.hasNumberOrSpecial ? '✓' : '○'}
                      </span>
                      <span>Zahlen oder Sonderzeichen</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Feld 2: Passwort wiederholen */}
              <div className="flex flex-col space-y-1 text-left">
                <label htmlFor="confirm-password" className="text-sm font-medium text-stone-700 dark:text-stone-300 ml-1">
                  Passwort wiederholen
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    aria-label="Passwort wiederholen"
                    placeholder="Passwort erneut eingeben"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-4 pr-12 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-brand"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1"
                    aria-label={showConfirmPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {passwordError && (
                  <p role="alert" className="text-xs text-red-600 dark:text-red-400 ml-1 mt-1">
                    {passwordError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-brand text-white rounded-2xl font-medium text-base flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-50 min-h-12"
              >
                {isLoading ? (
                  <>
                    <Clock size={18} className="animate-spin" />
                    <span>Wird gespeichert…</span>
                  </>
                ) : (
                  <span>Passwort speichern & anmelden</span>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 text-sm transition-colors min-h-11 px-2"
                >
                  <ArrowLeft size={16} />
                  <span>Zurück zum Login</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            SCHRITT 6: Erfolgsmeldung & Automatische Weiterleitung
        ───────────────────────────────────────────────────────────── */}
        {mode === 'success' && (
          <div className="w-full text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
              <Check size={28} />
            </div>

            <h1 className="text-3xl font-serif text-stone-900 dark:text-stone-100">
              Passwort erfolgreich geändert
            </h1>

            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              Dein neues Passwort ist nun aktiv. Alle bestehenden Sitzungen auf anderen Geräten wurden abgemeldet.
            </p>

            <div className="pt-4 space-y-3">
              <button
                type="button"
                onClick={onBackToLogin}
                className="w-full py-4 bg-brand text-white rounded-2xl font-medium text-base hover:bg-brand-dark transition-colors shadow-sm min-h-12"
              >
                Weiter zum Login ({redirectCountdown}s)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
