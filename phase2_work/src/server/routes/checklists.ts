import { Router } from 'express';
import type { Firestore } from 'firebase-admin/firestore';

const DEFAULTS: Record<string, boolean> = {
  location:false,battery:false,trustedPerson:false,money:false,
  outfit_comfort:false,outfit_weather:false,outfit_ready:false,
  mindset:false,boundaries:false,authenticity:false,curiosity:false,openMind:false,
  topics_hobbies:false,topics_questions:false,topics_no_ex:false,
};

function sanitizeChecklist(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const result: Record<string, boolean> = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (key in input && typeof input[key] !== 'boolean') return null;
    if (key in input) result[key] = input[key] === true;
  }
  return result;
}

export function createChecklistRouter(deps: { currentUserId: (req: any) => string | null; getFirestore: () => Firestore }): Router {
  const router = Router();
  router.get('/checklists/date_prep', async (req, res) => {
    const uid = deps.currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const snap = await deps.getFirestore().doc(`users/${uid}/checklists/date_prep`).get();
      const checklist = snap.exists ? sanitizeChecklist(snap.data()?.checklist) : null;
      return res.json({ checklist: checklist ?? DEFAULTS });
    } catch { return res.status(503).json({ error: 'Checkliste derzeit nicht verfügbar.' }); }
  });
  router.put('/checklists/date_prep', async (req, res) => {
    const uid = deps.currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const checklist = sanitizeChecklist(req.body?.checklist);
    if (!checklist) return res.status(400).json({ error: 'Ungültige Checkliste.' });
    try {
      await deps.getFirestore().doc(`users/${uid}/checklists/date_prep`).set({ checklist, updatedAt: new Date() }, { merge: true });
      return res.json({ success: true, checklist });
    } catch { return res.status(503).json({ error: 'Checkliste konnte nicht synchronisiert werden.' }); }
  });
  return router;
}
