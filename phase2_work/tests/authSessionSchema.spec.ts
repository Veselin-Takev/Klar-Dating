import { describe, it, expect } from 'vitest';
import {
  UserProfileDataSchema,
  AuthSessionStateSchema,
  validateUserProfile,
  validateAuthClaims,
  loadAuthSession,
  validateServerAuthSession,
} from '../src/lib/authSessionSchema';
import { EINWILLIGUNG_VERSION } from '../src/server/pure';

describe('authSessionSchema - Strict Type Validation', () => {
  const validConsent = {
    version: EINWILLIGUNG_VERSION,
    erteiltAm: new Date().toISOString(),
    zwecke: {
      notwendig: true,
      ki_auswertung: true,
      fehlerberichte: false,
      produktanalyse: false,
    },
    widerrufenAm: null,
  };

  it('validates a complete user profile strictly with UserProfileDataSchema', () => {
    const raw = {
      uid: 'user-123',
      name: 'Max Mustermann',
      isAdult: true,
      einwilligung: validConsent,
      bio: 'Hallo, ich bin Max.',
      interests: ['Sport', 'Reisen'],
      goal: 'relationship',
      location: 'Berlin',
      plan: 'plus',
      verified: true,
    };

    const parsed = UserProfileDataSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Max Mustermann');
      expect(parsed.data.isAdult).toBe(true);
      expect(parsed.data.plan).toBe('plus');
    }
  });

  it('validateUserProfile applies strict defaults and sanitization', () => {
    const rawMinimal = {
      uid: 'user-456',
    };

    const validated = validateUserProfile(rawMinimal);
    expect(validated).not.toBeNull();
    expect(validated?.name).toBe('Neu');
    expect(validated?.bio).toBe('');
    expect(validated?.interests).toEqual([]);
    expect(validated?.plan).toBe('frei');
    expect(validated?.isAdult).toBe(false);
  });

  it('validateAuthClaims validates token claims correctly', () => {
    const claims = {
      uid: 'admin-1',
      admin: true,
      moderator: true,
      role: 'moderator',
      roles: ['moderator', 'admin'],
      email: 'admin@klar.app',
    };

    const validated = validateAuthClaims(claims);
    expect(validated).not.toBeNull();
    expect(validated?.admin).toBe(true);
    expect(validated?.moderator).toBe(true);
    expect(validated?.roles).toContain('admin');
  });

  it('validateAuthClaims maps user_id or sub to uid seamlessly', () => {
    const rawFirebaseClaims = {
      user_id: 'firebase-user-999',
      sub: 'firebase-user-999',
      auth_time: 1700000000,
      firebase: { sign_in_provider: 'google.com' },
    };

    const validated = validateAuthClaims(rawFirebaseClaims);
    expect(validated).not.toBeNull();
    expect(validated?.uid).toBe('firebase-user-999');
    expect(validated?.user_id).toBe('firebase-user-999');
  });

  it('normalizes malformed optional claims without production-console warnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const validated = validateAuthClaims({
      sub: 'firebase-user-123',
      email: 'not-an-email',
      admin: 'true',
      roles: ['admin', 42, { role: 'admin' }],
      firebase: { sign_in_provider: 'google.com' },
    });
    expect(validated?.uid).toBe('firebase-user-123');
    expect(validated?.admin).toBeUndefined();
    expect(validated?.roles).toEqual(['admin']);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('loadAuthSession returns unauthenticated state when user is null', () => {
    const session = loadAuthSession(null, null);
    expect(session.isAuthenticated).toBe(false);
    expect(session.status).toBe('unauthenticated');
    expect(session.user).toBeNull();
    expect(session.profile).toBeNull();
  });

  it('loadAuthSession returns loading state when loading flag is active', () => {
    const session = loadAuthSession({ uid: 'user-123' }, null, undefined, true);
    expect(session.status).toBe('loading');
    expect(session.isAuthenticated).toBe(true);
    expect(session.isAdult).toBe(false);
  });

  it('loadAuthSession enforces gate_required when age or consent is missing', () => {
    const user = { uid: 'user-underage', email: 'test@klar.app' };
    const rawProfile = {
      uid: 'user-underage',
      isAdult: false, // underage or not yet verified
      einwilligung: null,
    };

    const session = loadAuthSession(user, rawProfile);
    expect(session.isAuthenticated).toBe(true);
    expect(session.isAdult).toBe(false);
    expect(session.hasValidConsent).toBe(false);
    expect(session.status).toBe('gate_required');
  });

  it('loadAuthSession validates full authenticated session when age and consent pass', () => {
    const user = { uid: 'user-adult', email: 'adult@klar.app' };
    const rawProfile = {
      uid: 'user-adult',
      name: 'Lisa',
      isAdult: true,
      einwilligung: validConsent,
      isVerified: true,
    };
    const claims = {
      uid: 'user-adult',
      moderator: true,
    };

    const session = loadAuthSession(user, rawProfile, claims);
    expect(session.isAuthenticated).toBe(true);
    expect(session.isAdult).toBe(true);
    expect(session.hasValidConsent).toBe(true);
    expect(session.isVerified).toBe(true);
    expect(session.isModerator).toBe(true);
    expect(session.status).toBe('authenticated');

    // Strict schema check on the output
    const stateParse = AuthSessionStateSchema.safeParse(session);
    expect(stateParse.success).toBe(true);
  });

  it('validateServerAuthSession produces identical session state for server requests', () => {
    const decodedToken = {
      uid: 'server-user',
      email: 'server@klar.app',
      name: 'Server User',
      admin: false,
      moderator: true,
    };
    const serverProfileDoc = {
      uid: 'server-user',
      name: 'Server User',
      isAdult: true,
      einwilligung: validConsent,
    };

    const serverSession = validateServerAuthSession(decodedToken, serverProfileDoc);
    expect(serverSession.isAuthenticated).toBe(true);
    expect(serverSession.user?.uid).toBe('server-user');
    expect(serverSession.isAdult).toBe(true);
    expect(serverSession.isModerator).toBe(true);
    expect(serverSession.status).toBe('authenticated');
  });
});
