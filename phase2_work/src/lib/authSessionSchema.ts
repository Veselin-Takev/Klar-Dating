import { z } from 'zod';
import { einwilligungGueltig, EINWILLIGUNG_VERSION } from '../server/pure';

/**
 * Striktes Schema für die Zustimmungs-Zwecke (Art. 7 DSGVO)
 */
export const ConsentPurposesSchema = z.object({
  notwendig: z.boolean().default(true),
  ki_auswertung: z.boolean().default(false),
  fehlerberichte: z.boolean().default(false),
  produktanalyse: z.boolean().default(false),
}).catchall(z.boolean());

/**
 * Striktes Schema für die informierte Einwilligung
 */
export const ConsentSchema = z.object({
  version: z.number().int().min(1),
  erteiltAm: z.string().optional().default(() => new Date().toISOString()),
  zwecke: ConsentPurposesSchema,
  widerrufenAm: z.string().nullable().optional(),
});

export type Consent = z.infer<typeof ConsentSchema>;

/**
 * Striktes Schema für Auth-Claims und Decoded Token
 */
export const AuthClaimsSchema = z.object({
  uid: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().max(100).optional(),
  picture: z.string().url().nullable().optional(),
  admin: z.boolean().optional(),
  moderator: z.boolean().optional(),
  role: z.string().max(50).optional(),
  roles: z.array(z.string().max(50)).optional(),
  isAnonymous: z.boolean().optional(),
  auth_time: z.number().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
  sub: z.string().optional(),
  user_id: z.string().optional(),
}).passthrough();

export type AuthClaims = z.infer<typeof AuthClaimsSchema>;

/**
 * Striktes Schema für das Benutzerprofil (Firestore: users/{uid})
 */
export const UserProfileDataSchema = z.object({
  uid: z.string().min(1),
  name: z.string().max(100).default('Neu'),
  isAdult: z.boolean().default(false),
  einwilligung: ConsentSchema.nullable().optional(),
  bio: z.string().max(2000).default(''),
  interests: z.array(z.string().max(50)).default([]),
  goal: z.string().max(100).default('undecided'),
  location: z.string().max(100).optional(),
  age: z.number().int().min(18).max(120).optional(),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.string().max(50).optional(),
  photoURL: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  photos: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  verificationStatus: z.enum(['none', 'pending', 'verified', 'rejected']).optional(),
  plan: z.enum(['frei', 'plus']).default('frei'),
  language: z.string().max(10).optional(),
  preferredLanguage: z.string().max(10).optional(),
  smartMatchAlerts: z.boolean().default(true),
  visibilitySettings: z.record(z.string(), z.boolean()).optional(),
  launchPromoClaimed: z.boolean().optional(),
  launchPromoMissed: z.boolean().optional(),
  musicPreferences: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

export type UserProfileData = z.infer<typeof UserProfileDataSchema>;

/**
 * Striktes Schema für den Authentifizierungsbenutzer (Firebase User Subset)
 */
export const AuthSessionUserSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email().nullable().optional(),
  displayName: z.string().nullable().optional(),
  photoURL: z.string().nullable().optional(),
  isAnonymous: z.boolean().default(false),
});

export type AuthSessionUser = z.infer<typeof AuthSessionUserSchema>;

/**
 * Striktes Schema für den konsistenten Auth-Session-Status
 * zwischen Server und Client
 */
export const AuthSessionStateSchema = z.object({
  user: AuthSessionUserSchema.nullable(),
  profile: UserProfileDataSchema.nullable(),
  claims: AuthClaimsSchema.optional(),
  isAuthenticated: z.boolean(),
  isAdult: z.boolean(),
  hasValidConsent: z.boolean(),
  isVerified: z.boolean(),
  isModerator: z.boolean(),
  isAdmin: z.boolean(),
  role: z.string(),
  roles: z.array(z.string()),
  status: z.enum(['authenticated', 'unauthenticated', 'gate_required', 'loading']),
  loadedAt: z.string(),
});

export type AuthSessionState = z.infer<typeof AuthSessionStateSchema>;

/**
 * Validiert Profildaten strikt anhand des UserProfileDataSchema
 */
export function validateUserProfile(rawData: unknown, fallbackUid?: string): UserProfileData | null {
  if (!rawData || typeof rawData !== 'object') return null;
  const clone = { ...(rawData as Record<string, unknown>) };
  if (!clone.uid && fallbackUid) {
    clone.uid = fallbackUid;
  }
  const result = UserProfileDataSchema.safeParse(clone);
  if (!result.success) {
    // Legacy documents are normalized without writing noisy production-console warnings.
    // Invalid privileged/session fields are never trusted from this fallback.
    if (typeof clone.uid === 'string' && clone.uid) {
      return {
        uid: clone.uid,
        name: typeof clone.name === 'string' ? clone.name : 'Neu',
        isAdult: clone.isAdult === true,
        einwilligung: ConsentSchema.safeParse(clone.einwilligung).success
          ? (clone.einwilligung as Consent)
          : null,
        bio: typeof clone.bio === 'string' ? clone.bio : '',
        interests: Array.isArray(clone.interests)
          ? clone.interests.filter((i): i is string => typeof i === 'string')
          : [],
        goal: typeof clone.goal === 'string' ? clone.goal : 'undecided',
        plan: clone.plan === 'plus' ? 'plus' : 'frei',
        smartMatchAlerts: clone.smartMatchAlerts !== false,
        ...clone,
      } as UserProfileData;
    }
    return null;
  }
  return result.data;
}

/**
 * Validiert Decoded Token Claims strikt
 */
export function validateAuthClaims(rawClaims: unknown): AuthClaims | null {
  if (!rawClaims || typeof rawClaims !== 'object') return null;
  const raw = rawClaims as Record<string, unknown>;
  const clone: Record<string, unknown> = { ...raw };

  // Firebase reserves `firebase` for provider metadata. It is intentionally
  // preserved as an opaque passthrough field but never used for authorization.
  const uid = typeof raw.uid === 'string' && raw.uid.length > 0
    ? raw.uid
    : typeof raw.user_id === 'string' && raw.user_id.length > 0
      ? raw.user_id
      : typeof raw.sub === 'string' && raw.sub.length > 0
        ? raw.sub
        : null;
  if (uid) clone.uid = uid;

  // Normalize optional claims instead of logging validation failures. Firebase
  // and custom claims can legitimately evolve; malformed optional claims are
  // ignored, while privileged booleans are accepted only as actual booleans.
  for (const key of ['admin', 'moderator', 'isAnonymous'] as const) {
    if (typeof clone[key] !== 'boolean') delete clone[key];
  }
  for (const key of ['email_verified'] as const) {
    if (typeof clone[key] !== 'boolean') delete clone[key];
  }
  for (const key of ['auth_time', 'iat', 'exp'] as const) {
    if (typeof clone[key] !== 'number' || !Number.isFinite(clone[key])) delete clone[key];
  }
  for (const key of ['email'] as const) {
    if (typeof clone[key] !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clone[key])) delete clone[key];
  }
  for (const key of ['name', 'role', 'sub', 'user_id'] as const) {
    if (typeof clone[key] !== 'string' || clone[key].length === 0 || clone[key].length > 100) delete clone[key];
  }
  if (typeof clone.picture !== 'string' || !/^https?:\/\//.test(clone.picture)) delete clone.picture;
  if (!Array.isArray(clone.roles)) {
    delete clone.roles;
  } else {
    clone.roles = clone.roles.filter((role): role is string => typeof role === 'string' && role.length > 0 && role.length <= 50);
  }

  const result = AuthClaimsSchema.safeParse(clone);
  return result.success ? result.data : null;
}

/**
 * Haupt-Auth-Loader:
 * Erzeugt einen konsistent validierten Session-Status basierend auf User, Profildaten und Claims.
 */
export function loadAuthSession(
  user: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null; isAnonymous?: boolean } | null,
  rawProfile: unknown,
  rawClaims?: unknown,
  isLoading = false,
): AuthSessionState {
  const loadedAt = new Date().toISOString();

  if (isLoading) {
    return {
      user: user
        ? {
            uid: user.uid,
            email: user.email || null,
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
            isAnonymous: user.isAnonymous === true,
          }
        : null,
      profile: null,
      claims: undefined,
      isAuthenticated: !!user,
      isAdult: false,
      hasValidConsent: false,
      isVerified: false,
      isModerator: false,
      isAdmin: false,
      role: '',
      roles: [],
      status: 'loading',
      loadedAt,
    };
  }

  if (!user || !user.uid) {
    return {
      user: null,
      profile: null,
      claims: undefined,
      isAuthenticated: false,
      isAdult: false,
      hasValidConsent: false,
      isVerified: false,
      isModerator: false,
      isAdmin: false,
      role: '',
      roles: [],
      status: 'unauthenticated',
      loadedAt,
    };
  }

  const sessionUser: AuthSessionUser = {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    isAnonymous: user.isAnonymous === true,
  };

  const profile = validateUserProfile(rawProfile, user.uid);
  const claims = validateAuthClaims(rawClaims) || undefined;

  const isAdult = profile?.isAdult === true;
  const hasValidConsent = einwilligungGueltig(profile?.einwilligung, EINWILLIGUNG_VERSION);
  const isVerified = profile?.isVerified === true || profile?.verified === true;

  const role = typeof claims?.role === 'string' ? claims.role : '';
  const roles = Array.isArray(claims?.roles)
    ? claims.roles.filter((r): r is string => typeof r === 'string')
    : [];

  const isModerator =
    claims?.moderator === true ||
    role === 'moderator' ||
    roles.includes('moderator');

  const isAdmin =
    claims?.admin === true ||
    role === 'admin' ||
    roles.includes('admin');

  const needsGate = !isAdult || !hasValidConsent;
  const status = needsGate ? 'gate_required' : 'authenticated';

  return {
    user: sessionUser,
    profile,
    claims,
    isAuthenticated: true,
    isAdult,
    hasValidConsent,
    isVerified,
    isModerator,
    isAdmin,
    role,
    roles,
    status,
    loadedAt,
  };
}

/**
 * Server-seitiger Auth-Loader für Express Request / Middleware
 */
export function validateServerAuthSession(
  decodedToken: unknown,
  userDocument?: unknown,
): AuthSessionState {
  const claims = validateAuthClaims(decodedToken);
  if (!claims || !claims.uid) {
    return loadAuthSession(null, null);
  }

  const user: AuthSessionUser = {
    uid: claims.uid,
    email: claims.email || null,
    displayName: claims.name || null,
    photoURL: claims.picture || null,
    isAnonymous: claims.isAnonymous === true,
  };

  return loadAuthSession(user, userDocument, claims);
}
