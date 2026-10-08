import type { UserMusicPreferences } from '../../types/user';
import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { explainCompatibility, type CompatibilityProfile } from './compatibility';

export const LAUNCH_CITIES = ['München', 'Berlin', 'Hamburg', 'Köln', 'Frankfurt am Main'] as const;
export const FOUNDING_500_LIMIT = 500;
export const ACTIVATION_TARGET = 70;
const REFERRAL_SECRET_MIN_LENGTH = 32;
export type LaunchCity = typeof LAUNCH_CITIES[number];

const CITY_ALIASES: Record<string, LaunchCity> = {
  munich: 'München', münchen: 'München', muenchen: 'München',
  berlin: 'Berlin', hamburg: 'Hamburg', cologne: 'Köln', köln: 'Köln', koeln: 'Köln',
  frankfurt: 'Frankfurt am Main', 'frankfurt am main': 'Frankfurt am Main',
};

export function normalizeLaunchCity(value: unknown): LaunchCity | null {
  if (typeof value !== 'string') return null;
  return CITY_ALIASES[value.trim().toLowerCase()] ?? null;
}

export type PublicProfile = {
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  photoUrl: string;
  interests: string[];
  musicPreferences?: UserMusicPreferences;
  values?: string[];
  personalityTraits?: string[];
  relationshipGoals?: string[];
  communication?: string[];
  availability?: string[];
  isVerified?: boolean;
  isExample?: boolean;
  active?: boolean;
  lastActiveAt?: unknown;
};

function cleanStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string').slice(0, 30) : [];
}

export function cleanMusicPreferences(value: unknown): UserMusicPreferences | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const music = value as Record<string, unknown>;
  if (!Array.isArray(music.genres) || typeof music.concertGoer !== 'boolean' || typeof music.playingInstrument !== 'boolean') return undefined;
  return { genres: cleanStringList(music.genres).map(genre => genre.slice(0, 80)), concertGoer: music.concertGoer, playingInstrument: music.playingInstrument };
}

export function toPublicProfile(uid: string, data: Record<string, unknown>): PublicProfile | null {
  const city = normalizeLaunchCity(data.location);
  const name = typeof data.name === 'string' ? data.name.trim().slice(0, 80) : '';
  const age = typeof data.age === 'number' ? Math.floor(data.age) : 0;
  if (!city || !name || age < 18 || age > 100) return null;
  return {
    id: uid,
    name,
    age,
    location: city,
    bio: typeof data.bio === 'string' ? data.bio.trim().slice(0, 800) : '',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
    interests: cleanStringList(data.interests),
    ...(cleanMusicPreferences(data.musicPreferences) ? { musicPreferences: cleanMusicPreferences(data.musicPreferences) } : {}),
    values: cleanStringList(data.values),
    personalityTraits: cleanStringList(data.personalityTraits),
    relationshipGoals: cleanStringList(data.relationshipGoals),
    communication: cleanStringList(data.communication),
    availability: cleanStringList(data.availability),
    isVerified: data.isVerified === true,
    isExample: data.isExample === true,
    active: true,
    lastActiveAt: FieldValue.serverTimestamp(),
  };
}

function daysSince(value: unknown): number {
  if (!value) return 999;
  const date = value instanceof Date ? value : typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function'
    ? (value as { toDate: () => Date }).toDate()
    : typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 999;
  return Math.max(0, (Date.now() - date.getTime()) / 86_400_000);
}

export function densityBand(activeUsers: number): 'building' | 'emerging' | 'active' | 'strong' {
  if (activeUsers >= 50) return 'strong';
  if (activeUsers >= 20) return 'active';
  if (activeUsers >= 5) return 'emerging';
  return 'building';
}

export type LaunchReadiness = {
  city: LaunchCity;
  activeUsers: number;
  verifiedUsers: number;
  band: 'building' | 'emerging' | 'active' | 'strong';
  readyForMatching: boolean;
  minThreshold: number;
  recommendation: 'invite_more' | 'boost_verification' | 'ready';
};

export function evaluateCityLaunchReadiness(activeUsers: number, verifiedUsers: number, city: LaunchCity): LaunchReadiness {
  const band = densityBand(activeUsers);
  const readyForMatching = activeUsers >= 5;
  const verifiedRatio = activeUsers > 0 ? verifiedUsers / activeUsers : 0;

  let recommendation: 'invite_more' | 'boost_verification' | 'ready' = 'ready';
  if (activeUsers < 20) {
    recommendation = 'invite_more';
  } else if (verifiedRatio < 0.4) {
    recommendation = 'boost_verification';
  }

  return {
    city,
    activeUsers,
    verifiedUsers,
    band,
    readyForMatching,
    minThreshold: 20,
    recommendation,
  };
}

export async function getLocalDensity(db: Firestore, city: LaunchCity) {
  const snap = await db.collection('public_profiles').where('location', '==', city).limit(500).get();
  const active = snap.docs.filter(doc => doc.data().active !== false && daysSince(doc.data().lastActiveAt) <= 7).length;
  const verified = snap.docs.filter(doc => doc.data().active !== false && doc.data().isVerified === true && daysSince(doc.data().lastActiveAt) <= 7).length;
  return { city, activeUsers: active, verifiedUsers: verified, band: densityBand(active), threshold: active < 5 ? 5 : active < 20 ? 20 : active < 50 ? 50 : 100 };
}

export type RecommendationReason = {
  dimension: 'values' | 'relationshipGoals' | 'lifestyle' | 'communication' | 'interests' | 'boundaries' | 'availability';
  overlap: number;
  label: string;
};

function dimensionOverlap(a: string[] = [], b: string[] = []): number {
  const A = new Set(a.map(x => x.trim().toLowerCase()).filter(Boolean));
  const B = new Set(b.map(x => x.trim().toLowerCase()).filter(Boolean));
  if (!A.size || !B.size) return 0;
  let same = 0;
  for (const x of A) if (B.has(x)) same++;
  return same / Math.max(A.size, B.size);
}

const REASON_LABELS: Record<RecommendationReason['dimension'], string> = {
  values: 'Gemeinsame Werte',
  relationshipGoals: 'Ähnliche Beziehungsziele',
  lifestyle: 'Ähnlicher Lebensstil',
  communication: 'Passender Kommunikationsstil',
  interests: 'Gemeinsame Interessen',
  boundaries: 'Ähnliche Grenzen und Bedürfnisse',
  availability: 'Ähnliche Verfügbarkeit',
};

function reasonsFor(a: CompatibilityProfile, b: CompatibilityProfile): RecommendationReason[] {
  const dimensions: RecommendationReason['dimension'][] = ['values', 'relationshipGoals', 'lifestyle', 'communication', 'interests', 'boundaries', 'availability'];
  return dimensions
    .map(dimension => ({ dimension, overlap: dimensionOverlap(a[dimension], b[dimension]), label: REASON_LABELS[dimension] }))
    .filter(item => item.overlap >= 0.34)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map(item => ({ ...item, overlap: Math.round(item.overlap * 100) }));
}

export async function getRecommendations(
  db: Firestore,
  uid: string,
  profile: CompatibilityProfile & { location?: string; minAge?: number; maxAge?: number; limit?: number },
) {
  const city = normalizeLaunchCity(profile.location);
  if (!city) return [];
  const minAge = Math.max(18, Math.min(80, profile.minAge ?? 18));
  const maxAge = Math.max(minAge, Math.min(100, profile.maxAge ?? 80));
  const limit = Math.max(1, Math.min(30, profile.limit ?? 12));
  const snap = await db.collection('public_profiles').where('location', '==', city).limit(500).get();
  const blocked = new Set<string>();
  // Never truncate an exclusion list: an omitted block is a privacy failure.
  // Bound work and fail closed if an exceptional account exceeds the scan budget.
  for (const [ownField, otherField] of [['blockerUid', 'blockedUid'], ['blockedUid', 'blockerUid']] as const) {
    const query = db.collection('blocks').where(ownField, '==', uid).limit(200);
    let cursor: import('firebase-admin/firestore').QueryDocumentSnapshot | undefined;
    for (let page = 0; ; page++) {
      if (page >= 50) throw new Error('Block list scan budget exceeded');
      const result = await (cursor ? query.startAfter(cursor) : query).get();
      result.forEach(document => blocked.add(String(document.data()[otherField])));
      if (result.size < 200) break;
      cursor = result.docs[result.docs.length - 1];
    }
  }

  const candidates = snap.docs
    .map(d => ({ id: d.id, data: d.data() as Record<string, unknown> }))
    .filter(({ id, data }) => id !== uid && data.isExample !== true && !blocked.has(id) && data.active !== false && data.isVerified === true)
    .filter(({ data }) => typeof data.age === 'number' && data.age >= minAge && data.age <= maxAge)
    .filter(({ data }) => daysSince(data.lastActiveAt) <= 7)
    .map(({ id, data }) => {
      const candidate: CompatibilityProfile = {
        values: cleanStringList(data.values),
        relationshipGoals: cleanStringList(data.relationshipGoals),
        lifestyle: cleanStringList(data.lifestyle),
        communication: cleanStringList(data.communication),
        interests: cleanStringList(data.interests),
    ...(cleanMusicPreferences(data.musicPreferences) ? { musicPreferences: cleanMusicPreferences(data.musicPreferences) } : {}),
        boundaries: cleanStringList(data.boundaries),
        availability: cleanStringList(data.availability),
      };
      const explanation = explainCompatibility(profile, candidate);
      const score = explanation.score;
      const freshness = Math.max(0, 7 - daysSince(data.lastActiveAt)) / 7;
      const reasons = reasonsFor(profile, candidate);
      const verifiedBonus = data.isVerified === true ? 4 : 0;
      const meaningfulScore = Math.max(0, Math.min(100, Math.round(score * 0.82 + freshness * 8 + Math.min(6, reasons.length * 2) + verifiedBonus)));
      return {
        id,
        score: meaningfulScore,
        meaningfulConnectionScore: meaningfulScore,
        explanation,
        reasons,
        profile: toPublicProfile(id, data),
      };
    })
    .filter(item => item.profile !== null)
    .sort((a, b) => b.meaningfulConnectionScore - a.meaningfulConnectionScore || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, limit);
  return candidates;
}

export const ACTIVATION_EVENTS = new Set([
  'onboarding_started', 'onboarding_completed', 'profile_completed', 'first_recommendations',
  'first_profile_opened', 'first_contact', 'first_conversation', 'date_planned', 'date_reflected',
  'referral_shared', 'referral_qualified', 'launch_city_selected', 'founding_500_claimed',
]);

const ACTIVATION_WEIGHTS: Record<string, number> = {
  onboarding_started: 5,
  onboarding_completed: 10,
  profile_completed: 15,
  first_recommendations: 10,
  first_profile_opened: 5,
  first_contact: 10,
  first_conversation: 10,
  date_planned: 10,
  date_reflected: 15,
};

function safeActivationMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const allowedKeys = new Set(['city', 'profileId', 'source', 'variant', 'campaign', 'step']);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!allowedKeys.has(key)) continue;
    if (typeof value === 'string') result[key] = value.slice(0, 120);
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    else if (typeof value === 'boolean') result[key] = value;
  }
  return result;
}

export async function recordActivation(db: Firestore, uid: string, eventName: string, eventId?: string, metadata: Record<string, unknown> = {}) {
  if (!ACTIVATION_EVENTS.has(eventName)) throw new Error('Unsupported activation event');
  const safeId = typeof eventId === 'string' && /^[A-Za-z0-9_-]{8,120}$/.test(eventId)
    ? eventId
    : crypto.randomUUID();
  const ref = db.collection('activation_events').doc(safeId);
  await ref.create({ uid, eventName, metadata: safeActivationMetadata(metadata), createdAt: FieldValue.serverTimestamp() });
  return { eventId: safeId, weight: ACTIVATION_WEIGHTS[eventName] ?? 0 };
}

export function activationScore(events: string[]): { score: number; activated: boolean } {
  const unique = new Set(events);
  const score = Math.min(100, [...unique].reduce((sum, event) => sum + (ACTIVATION_WEIGHTS[event] ?? 0), 0));
  return { score, activated: score >= ACTIVATION_TARGET };
}

export function referralCodeFor(uid: string): string {
  const secret = process.env.REFERRAL_CODE_SECRET;
  if (!secret || secret.length < REFERRAL_SECRET_MIN_LENGTH) {
    throw new Error('REFERRAL_CODE_SECRET must be configured with at least 32 characters');
  }
  return crypto.createHmac('sha256', secret).update(uid).digest('base64url').slice(0, 10).toUpperCase();
}

