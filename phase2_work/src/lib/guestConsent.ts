export type GuestConsentPurposes = {
  ki_auswertung: boolean;
  fehlerberichte: boolean;
  produktanalyse: boolean;
};

const PURPOSE_KEYS = ['ki_auswertung', 'fehlerberichte', 'produktanalyse'] as const;
const KEY_PREFIX = 'klar:guest:consent:';
const VERSION = 1;

/**
 * Anonymous Firebase identities have no authoritative account consent ledger.
 * Store a session-scoped, UID-bound preference, never a server evidenceId.
 */
export function saveGuestConsent(uid: string, purposes: GuestConsentPurposes, storage: Storage): void {
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('Invalid guest identity');
  if (PURPOSE_KEYS.some(key => typeof purposes[key] !== 'boolean')) throw new Error('Invalid consent purposes');
  const entry = { version: VERSION, ownerUid: uid, savedAt: new Date().toISOString(),
    zwecke: Object.fromEntries(PURPOSE_KEYS.map(key => [key, purposes[key]])) };
  const key = KEY_PREFIX + uid;
  storage.setItem(key, JSON.stringify(entry));
  const confirmed = storage.getItem(key);
  if (!confirmed || confirmed !== JSON.stringify(entry)) throw new Error('Guest consent storage was not confirmed');
}

export function readGuestConsent(uid: string, storage: Storage): GuestConsentPurposes | null {
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
  const raw = storage.getItem(KEY_PREFIX + uid);
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    if (record.ownerUid !== uid || record.version !== VERSION || !record.zwecke ||
        typeof record.zwecke !== 'object' || Array.isArray(record.zwecke)) return null;
    const purposes = record.zwecke as Record<string, unknown>;
    if (PURPOSE_KEYS.some(key => typeof purposes[key] !== 'boolean')) return null;
    return {
      ki_auswertung: purposes.ki_auswertung as boolean,
      fehlerberichte: purposes.fehlerberichte as boolean,
      produktanalyse: purposes.produktanalyse as boolean,
    };
  } catch { return null; }
}
