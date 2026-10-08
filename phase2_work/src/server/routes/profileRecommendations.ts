import { Router, type Request } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { CompatibilityProfile } from '../platform/compatibility';
import type { LaunchCity, PublicProfile } from '../platform/launchPlatform';

export type ProfileRecommendationsRouterDeps = {
  currentUserId: (req: Request) => string | null;
  getFirestore: () => Firestore;
  toPublicProfile: (uid: string, data: Record<string, unknown>) => PublicProfile | null;
  normalizeLaunchCity: (value: unknown) => LaunchCity | null;
  getRecommendations: (
    db: Firestore,
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

      const userSnap = await deps.getFirestore().collection('users').doc(uid).get();
      if (!userSnap.exists) return res.status(200).json({ ok: false, reason: 'Profil nicht gefunden' });

      const userData = userSnap.data() ?? {};
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

      await deps.getFirestore().collection('public_profiles').doc(uid).set(publicProfile);
      return res.json({ ok: true, city: publicProfile.location });
    } catch (error) {
      console.error('Public profile publish failed', error);
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

      const userSnap = await deps.getFirestore().collection('users').doc(uid).get();
      const data = userSnap.data() ?? {};
      const storedCity = typeof data.location === 'string' ? deps.normalizeLaunchCity(data.location) : null;
      if (city === undefined && data.location !== undefined && !storedCity) {
        return res.status(400).json({ error: 'Bitte aktualisiere deine Stadt auf einen unterstützten Standort.' });
      }
      const result = await deps.getRecommendations(deps.getFirestore(), uid, {
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
      console.error('Recommendations failed', error);
      return res.status(503).json({ error: 'Vorschläge derzeit nicht verfügbar.', recommendations: [] });
    }
  });

  return router;
}
