import { auth } from './firebase';

/**
 * Browser persistence boundary.
 *
 * User-owned state is UID-scoped by default. Only explicitly reviewed
 * device/app preferences may remain global. This makes account switching
 * safe even when logout cleanup is skipped or interrupted.
 */
const GLOBAL_KEYS = new Set([
  'klar_theme',
  'klar_language',
  'klar_haptic_enabled',
  'klar_haptic_intensity',
  'klar_haptic_pattern',
  'klar_haptic_feedback',
  'klar_app_install_time',
  'klar_maintenance_mode',
  'klar_missing_i18n_keys',
  'klar_client_errors',
  'sichtschutz_paused_until',
]);

const SESSION_KEYS = new Set(['klar_magic_email', 'klar_deletion_receipt']);

export function userStorageKey(key: string, uid = auth.currentUser?.uid): string | null {
  if (!uid) return null;
  return `klar:user:${uid}:${key}`;
}

function isGlobalKey(key: string): boolean {
  return GLOBAL_KEYS.has(key);
}

function getStorage(key: string): Storage | null {
  if (typeof window === 'undefined') return null;
  if (SESSION_KEYS.has(key)) return window.sessionStorage;
  if (isGlobalKey(key)) return window.localStorage;
  return window.localStorage;
}

function scopedKey(key: string, uid?: string): string | null {
  if (SESSION_KEYS.has(key) || isGlobalKey(key)) return key;
  return userStorageKey(key, uid);
}

export function getUserStorageItem(key: string, uid?: string): string | null {
  try {
    const storage = getStorage(key);
    const scoped = scopedKey(key, uid);
    return storage && scoped ? storage.getItem(scoped) : null;
  } catch {
    return null;
  }
}

export function setUserStorageItem(key: string, value: string, uid?: string): void {
  try {
    const storage = getStorage(key);
    const scoped = scopedKey(key, uid);
    if (storage && scoped) storage.setItem(scoped, value);
  } catch {
    // Browser storage is optional.
  }
}

export function removeUserStorageItem(key: string, uid?: string): void {
  try {
    const storage = getStorage(key);
    const scoped = scopedKey(key, uid);
    if (storage && scoped) storage.removeItem(scoped);
  } catch {
    // Browser storage is optional.
  }
}

/** Remove only the current user's scoped state; never call localStorage.clear(). */
export function clearUserStorageForUid(uid: string): void {
  if (typeof window === 'undefined') return;
  const prefix = `klar:user:${uid}:`;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // Best-effort cleanup; the UID namespace still protects the next account.
  }
}

/** Remove legacy unscoped user-owned keys; never migrate them to another UID. */
export function clearLegacyUserStorage(): void {
  const legacyKeys = [
    'userInterests', 'userGoal', 'klar_user_bio', 'klar_profile',
    'profile_icebreakers', 'hasCompletedOnboarding',
  ];
  try {
    for (const key of legacyKeys) window.localStorage.removeItem(key);
  } catch {
    // Browser storage is optional.
  }
}

export function clearSessionStorageForApp(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of SESSION_KEYS) window.sessionStorage.removeItem(key);
  } catch {
    // Browser storage is optional.
  }
}

export const klarStorage = {
  getItem: getUserStorageItem,
  setItem: setUserStorageItem,
  removeItem: removeUserStorageItem,
} satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
