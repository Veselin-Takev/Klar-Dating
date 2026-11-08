import { Router, type Request } from 'express';
import { z } from 'zod';
import type { TenantAwareFirestoreRepository } from '../TenantAwareFirestoreRepository';
const stored = z.object({checklist: z.record(z.string(), z.boolean()), updatedAt: z.unknown().optional()});
const writeSchema = z.object({checklist:z.record(z.string(), z.boolean()), updatedAt:z.date()}).strict();

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

export function createChecklistRouter(deps: { currentUserId: (req: Request) => string | null; repositoryFor: (req: Request) => TenantAwareFirestoreRepository }): Router {
  const router = Router();
  router.use((_req, res, next) => process.env.KLAR_TENANT_CHECKLIST_MIGRATION_READY === 'true' ? next() : res.status(503).json({code:'tenant_checklist_migration_not_ready'}));
  router.get('/checklists/date_prep', async (req, res) => {
    const uid = deps.currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const document = await deps.repositoryFor(req).read(`users/${uid}/checklists/date_prep`, stored);
      const checklist = document ? sanitizeChecklist(document.checklist) : null;
      return res.json({ checklist: checklist ?? DEFAULTS });
    } catch { return res.status(503).json({ error: 'Checkliste derzeit nicht verfügbar.' }); }
  });
  router.put('/checklists/date_prep', async (req, res) => {
    const uid = deps.currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const checklist = sanitizeChecklist(req.body?.checklist);
    if (!checklist) return res.status(400).json({ error: 'Ungültige Checkliste.' });
    try {
      await deps.repositoryFor(req).write(`users/${uid}/checklists/date_prep`, writeSchema, {checklist, updatedAt: new Date()}, {merge:true});
      return res.json({ success: true, checklist });
    } catch { return res.status(503).json({ error: 'Checkliste konnte nicht synchronisiert werden.' }); }
  });
  return router;
}
