import { logSafeFailure } from '../safeErrorLog';
import { Router, type Request } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '../db';
import { z } from 'zod';
import { normalizeLaunchCity } from '../platform/launchPlatform';

const vibeSchema = z.enum(['Casual', 'Romantic', 'Adventure']);
const isoDateTime = z.string().datetime({ offset: true });

const planInputSchema = z.object({
  connectionUid: z.string().min(1).max(128),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(1200),
  city: z.string().trim().min(1).max(80),
  region: z.string().trim().max(120).optional().default(''),
  vibe: vibeSchema,
  startsAt: isoDateTime,
  remindMe: z.boolean().default(false),
}).strict();

const availabilitySchema = z.object({
  startsAt: isoDateTime,
}).strict();

const curatedIdeas: Record<z.infer<typeof vibeSchema>, Array<{ title: string; description: string; locationType: string }>> = {
  Casual: [
    { title: 'Café und kurzer Spaziergang', description: 'Ein öffentlicher, entspannter Start mit einer einfachen Verlängerungsoption.', locationType: 'Café / Outdoor' },
    { title: 'Wochenmarkt mit Getränk', description: 'Nebeneinander unterwegs, mit vielen natürlichen Gesprächsanlässen.', locationType: 'Markt / Outdoor' },
    { title: 'Buchhandlung und Kaffee', description: 'Ein ruhiger Rahmen mit konkreten Themen, ohne festen Zeitdruck.', locationType: 'Kultur / Café' },
  ],
  Romantic: [
    { title: 'Abendspaziergang mit Aussicht', description: 'Ein öffentlicher Weg mit einem klaren Ziel und Raum für ruhige Gespräche.', locationType: 'Outdoor' },
    { title: 'Kleines Restaurant', description: 'Reservierbarer Rahmen mit ausreichend Ruhe und einer einfachen Anreise.', locationType: 'Restaurant' },
    { title: 'Kulturabend', description: 'Eine Ausstellung oder kleine Veranstaltung als gemeinsamer Gesprächsanlass.', locationType: 'Kultur' },
  ],
  Adventure: [
    { title: 'Stadt-Rallye zu Fuß', description: 'Eine kurze Route mit zwei bis drei öffentlichen Stationen und flexiblem Ende.', locationType: 'Outdoor' },
    { title: 'Kletter- oder Bewegungsangebot', description: 'Eine betreute Aktivität mit klaren Sicherheitsregeln und anschließender Pause.', locationType: 'Aktivität' },
    { title: 'Food-Markt mit kleiner Challenge', description: 'Gemeinsam auswählen, probieren und danach einen ruhigen Ort zum Reden wählen.', locationType: 'Markt' },
  ],
};

function uidFrom(req: Request, currentUserId: (req: Request) => string | null): string | null {
  return currentUserId(req);
}

async function verifyConnection(db: Firestore, uid: string, connectionUid: string): Promise<{ ok: true; profile: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  if (connectionUid === uid) return { ok: false, status: 400, error: 'Ungültige Verbindung.' };
  const profileSnap = await db.collection('public_profiles').doc(connectionUid).get();
  if (!profileSnap.exists) return { ok: false, status: 404, error: 'Verbindung nicht verfügbar.' };
  const profile = profileSnap.data() ?? {};
  if (profile.isVerified !== true || profile.active === false || profile.isExample === true) {
    return { ok: false, status: 403, error: 'Diese Verbindung ist derzeit nicht für einen Date-Plan verfügbar.' };
  }
  const [forward, reverse] = await Promise.all([
    db.collection('blocks').doc(`${uid}_${connectionUid}`).get(),
    db.collection('blocks').doc(`${connectionUid}_${uid}`).get(),
  ]);
  if (forward.exists || reverse.exists) return { ok: false, status: 403, error: 'Diese Verbindung ist derzeit nicht verfügbar.' };
  return { ok: true, profile };
}

export function createDatePlansRouter(deps: { currentUserId: (req: Request) => string | null; getFirestore: () => Firestore }): Router {
  const router = Router();

  router.get('/date-planner/connections', async (req, res) => {
    const uid = uidFrom(req, deps.currentUserId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const user = await deps.getFirestore().collection('users').doc(uid).get();
      const city = normalizeLaunchCity(user.data()?.location);
      if (!city) return res.json({ connections: [] });
      const snap = await deps.getFirestore().collection('public_profiles').where('location', '==', city).limit(100).get();
      const blocked = new Set<string>();
      const [outgoing, incoming] = await Promise.all([
        deps.getFirestore().collection('blocks').where('blockerUid', '==', uid).limit(200).get(),
        deps.getFirestore().collection('blocks').where('blockedUid', '==', uid).limit(200).get(),
      ]);
      outgoing.forEach(doc => blocked.add(String(doc.data().blockedUid)));
      incoming.forEach(doc => blocked.add(String(doc.data().blockerUid)));
      const connections = snap.docs
        .filter(doc => doc.id !== uid && !blocked.has(doc.id) && doc.data().isVerified === true && doc.data().active !== false && doc.data().isExample !== true)
        .slice(0, 30)
        .map(doc => ({ id: doc.id, name: String(doc.data().name ?? '').slice(0, 80), age: Number(doc.data().age ?? 0), city }));
      return res.json({ connections });
    } catch {
      logSafeFailure('date_connections_failure');
      return res.status(503).json({ error: 'Verbindungen derzeit nicht verfügbar.', connections: [] });
    }
  });

  router.post('/date-planner/ideas', async (req, res) => {
    const uid = uidFrom(req, deps.currentUserId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = z.object({
      connectionUid: z.string().min(1).max(128),
      city: z.string().trim().min(1).max(80),
      region: z.string().trim().max(120).optional().default(''),
      vibe: vibeSchema,
    }).strict().safeParse(req.body);
    if (!parsed.success || !normalizeLaunchCity(parsed.success ? parsed.data.city : '')) {
      return res.status(400).json({ error: 'Bitte wähle eine unterstützte Stadt und einen gültigen Vibe.' });
    }
    try {
      const connection = await verifyConnection(deps.getFirestore(), uid, parsed.data.connectionUid);
      if (!connection.ok) return res.status(connection.status).json({ error: connection.error });
      const ideas = curatedIdeas[parsed.data.vibe].map((idea, index) => ({
        ...idea,
        id: `${parsed.data.vibe.toLowerCase()}-${index + 1}`,
        city: normalizeLaunchCity(parsed.data.city),
        region: parsed.data.region,
        connectionName: String(connection.profile.name ?? 'Verbindung').slice(0, 80),
      }));
      return res.json({ mode: 'kuratiert', ideas });
    } catch {
      logSafeFailure('date_ideas_failure');
      return res.status(503).json({ error: 'Date-Ideen derzeit nicht verfügbar.' });
    }
  });

  router.get('/date-plans', async (req, res) => {
    const uid = uidFrom(req, deps.currentUserId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const snap = await deps.getFirestore().collection('users').doc(uid).collection('datePlans').orderBy('startsAt', 'asc').limit(50).get();
      return res.json({ plans: snap.docs.map(doc => { const data = doc.data(); return { id: doc.id, ...data, date: data.startsAt, matchName: data.connectionName, idea: data.description }; }) });
    } catch {
      logSafeFailure('date_plans_read_failure');
      return res.status(503).json({ error: 'Date-Kalender derzeit nicht verfügbar.', plans: [] });
    }
  });

  router.post('/date-plans', async (req, res) => {
    const uid = uidFrom(req, deps.currentUserId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = planInputSchema.safeParse(req.body);
    if (!parsed.success || !normalizeLaunchCity(parsed.data.city)) return res.status(400).json({ error: 'Ungültiger Date-Plan.' });
    const startsAt = new Date(parsed.data.startsAt);
    if (startsAt.getTime() <= Date.now() - 60_000) return res.status(400).json({ error: 'Das Date muss in der Zukunft liegen.' });
    try {
      const connection = await verifyConnection(deps.getFirestore(), uid, parsed.data.connectionUid);
      if (!connection.ok) return res.status(connection.status).json({ error: connection.error });
      const ref = deps.getFirestore().collection('users').doc(uid).collection('datePlans').doc();
      const data = {
        connectionUid: parsed.data.connectionUid,
        connectionName: String(connection.profile.name ?? 'Verbindung').slice(0, 80),
        title: parsed.data.title,
        description: parsed.data.description,
        city: normalizeLaunchCity(parsed.data.city),
        region: parsed.data.region,
        vibe: parsed.data.vibe,
        startsAt: startsAt.toISOString(),
        remindMe: parsed.data.remindMe,
        reminderAt: parsed.data.remindMe ? new Date(startsAt.getTime() - 2 * 60 * 60 * 1000).toISOString() : null,
        reminderSentAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      await ref.create(data);
      return res.status(201).json({ plan: { id: ref.id, ...data } });
    } catch {
      logSafeFailure('date_plan_create_failure');
      return res.status(503).json({ error: 'Date konnte nicht gespeichert werden.' });
    }
  });

  router.delete('/date-plans/:planId', async (req, res) => {
    const uid = uidFrom(req, deps.currentUserId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(req.params.planId)) return res.status(400).json({ error: 'Ungültige Plan-ID.' });
    try {
      const ref = deps.getFirestore().collection('users').doc(uid).collection('datePlans').doc(req.params.planId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Date nicht gefunden.' });
      await ref.delete();
      return res.json({ ok: true });
    } catch {
      logSafeFailure('date_plan_delete_failure');
      return res.status(503).json({ error: 'Date konnte nicht gelöscht werden.' });
    }
  });

  router.get('/date-availability', async (req, res) => {
    const uid = uidFrom(req, deps.currentUserId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const snap = await deps.getFirestore().collection('users').doc(uid).collection('dateAvailability').orderBy('startsAt', 'asc').limit(50).get();
      return res.json({ availability: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
    } catch {
      logSafeFailure('date_availability_read_failure');
      return res.status(503).json({ error: 'Verfügbarkeit derzeit nicht verfügbar.', availability: [] });
    }
  });

  router.post('/date-availability', async (req, res) => {
    const uid = uidFrom(req, deps.currentUserId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = availabilitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ungültige Verfügbarkeit.' });
    const startsAt = new Date(parsed.data.startsAt);
    if (startsAt.getTime() <= Date.now()) return res.status(400).json({ error: 'Die Verfügbarkeit muss in der Zukunft liegen.' });
    try {
      const ref = deps.getFirestore().collection('users').doc(uid).collection('dateAvailability').doc();
      await ref.create({ startsAt: startsAt.toISOString(), createdAt: FieldValue.serverTimestamp() });
      return res.status(201).json({ availability: { id: ref.id, startsAt: startsAt.toISOString() } });
    } catch {
      logSafeFailure('date_availability_create_failure');
      return res.status(503).json({ error: 'Verfügbarkeit konnte nicht gespeichert werden.' });
    }
  });

  router.delete('/date-availability/:id', async (req, res) => {
    const uid = uidFrom(req, deps.currentUserId);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(req.params.id)) return res.status(400).json({ error: 'Ungültige ID.' });
    try {
      await deps.getFirestore().collection('users').doc(uid).collection('dateAvailability').doc(req.params.id).delete();
      return res.json({ ok: true });
    } catch {
      logSafeFailure('date_availability_delete_failure');
      return res.status(503).json({ error: 'Verfügbarkeit konnte nicht gelöscht werden.' });
    }
  });

  return router;
}
