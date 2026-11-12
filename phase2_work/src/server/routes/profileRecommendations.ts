import { logSafeFailure } from '../safeErrorLog';
import { Router, type Request } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { z } from 'zod';
const record = z.record(z.string(), z.unknown());
import type { CompatibilityProfile } from '../platform/compatibility';
import type { LaunchCity, PublicProfile } from '../platform/launchPlatform';

export type ProfileRecommendationsRouterDeps = {
  currentUserId: (req: Request) => string | null;
  repository: () => TenantAwareFirestoreRepository;
  toPublicProfile: (uid: string, data: Record<string, unknown>) => PublicProfile | null;
  normalizeLaunchCity: (value: unknown) => LaunchCity | null;
  getRecommendations: (
    db: Firestore | TenantAwareFirestoreRepository,
    uid: string,
    profile: CompatibilityProfile & { location?: string; minAge?: number; maxAge?: number; limit?: number },
  ) => Promise<unknown[]>;
};

function singleQuery(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parseIntegerQuery(value: unknown, fallback: number, min: number, max: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 30)
    : [];
}

export function createProfileRecommendationsRouter(deps: ProfileRecommendationsRouterDeps): Router {
  const router = Router();

  router.post('/profile/publish', async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const userSnap = await deps.repository().read(`users/${uid}`, record);
      if (!userSnap) return res.status(200).json({ ok: false, reason: 'Profil nicht gefunden' });

      const userData = userSnap ?? {};
      if (userData.isExample === true) {
        return res.status(200).json({ ok: false, reason: 'Beispielprofile dürfen nicht veröffentlicht werden.' });
      }
      if (userData.isAdult !== true) {
        return res.status(200).json({ ok: false, reason: 'Profil noch nicht für Vorschläge freigegeben.' });
      }

      const publicProfile = deps.toPublicProfile(uid, userData as Record<string, unknown>);
      if (!publicProfile) {
        return res.status(200).json({ ok: false, reason: 'Für die Veröffentlichung fehlen Profilangaben.' });
      }

      await deps.repository().transaction(async tx => {
        const [owner, deletion] = await Promise.all([tx.read(`users/${uid}`, record), tx.read(`account_deletions/${uid}`, record)]);
        if (!owner || deletion || owner.isAdult !== true) throw new Error('account_unavailable');
        const latestProfile = deps.toPublicProfile(uid, owner);
        if (!latestProfile) throw new Error('profile_incomplete');
        tx.write(`public_profiles/${uid}`, record, latestProfile);
      });
      return res.json({ ok: true, city: publicProfile.location });
    } catch (error) {
      logSafeFailure('unclassified_failure');
      return res.status(500).json({ error: 'Profil konnte nicht veröffentlicht werden.' });
    }
  });

  router.get('/recommendations', async (req, res) => {
    try {
      const uid = deps.currentUserId(req);
      if (!uid) return res.status(401).json({ error: 'Unauthorized' });

      const minAge = parseIntegerQuery(req.query.minAge, 18, 18, 100);
      const maxAge = parseIntegerQuery(req.query.maxAge, 80, 18, 100);
      const limit = parseIntegerQuery(req.query.limit, 12, 1, 30);
      const city = req.query.city === undefined ? undefined : singleQuery(req.query.city);

      if (minAge === null || maxAge === null || limit === null || (req.query.city !== undefined && city === undefined)) {
        return res.status(400).json({ error: 'Ungültige Empfehlungsparameter.' });
      }
      if (city !== undefined && !deps.normalizeLaunchCity(city)) {
        return res.status(400).json({ error: 'Bitte wähle eine unterstützte Stadt.' });
      }
      if (maxAge < minAge) {
        return res.status(400).json({ error: 'Das maximale Alter darf nicht unter dem Mindestalter liegen.' });
      }

      const userSnap = await deps.repository().read(`users/${uid}`, record);
      const data = userSnap ?? {};
      const storedCity = typeof data.location === 'string' ? deps.normalizeLaunchCity(data.location) : null;
      if (city === undefined && data.location !== undefined && !storedCity) {
        return res.status(400).json({ error: 'Bitte aktualisiere deine Stadt auf einen unterstützten Standort.' });
      }
      const result = await deps.getRecommendations(deps.repository(), uid, {
        location: city ?? storedCity ?? undefined,
        minAge,
        maxAge,
        limit,
        interests: stringList(data.interests),
        values: stringList(data.values),
        relationshipGoals: data.goal ? [String(data.goal).slice(0, 120)] : [],
        communication: stringList(data.communication),
        availability: stringList(data.availability),
      });

      return res.json({ recommendations: result });
    } catch (error) {
      logSafeFailure('unclassified_failure');
      return res.status(503).json({ error: 'Vorschläge derzeit nicht verfügbar.', recommendations: [] });
    }
  });

  return router;
}
