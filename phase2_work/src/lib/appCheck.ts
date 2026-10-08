import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from './firebase';

export function initAppCheck(): boolean {
  if (typeof window === 'undefined') return false;
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (typeof siteKey !== 'string' || siteKey.trim().length === 0) {
    console.error('Firebase App Check is not configured: VITE_RECAPTCHA_SITE_KEY is required.');
    return false;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true
    });
    return true;
  } catch (e) {
    console.error('Firebase App Check initialization failed:', e);
    return false;
  }
}
