import { Router, type Request } from 'express';
import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import { FieldValue } from '../db';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS_URL = /^https:\/\/[^\s]+$/;

interface LegalUpdateRecord {
  id: string;
  version: string;
  publishedAt: string;
  titleKey: string;
  descriptionKey: string;
  sourceKey: string;
  sourceUrl: string;
  actionRequired: boolean;
  categoryKey: string;
}

function serializeUpdate(id: string, data: DocumentData): LegalUpdateRecord | null {
  const version = typeof data.version === 'string' ? data.version.trim() : '';
  const publishedAt = typeof data.publishedAt === 'string' ? data.publishedAt : '';
  const titleKey = typeof data.titleKey === 'string' ? data.titleKey : '';
  const descriptionKey = typeof data.descriptionKey === 'string' ? data.descriptionKey : '';
  const sourceKey = typeof data.sourceKey === 'string' ? data.sourceKey : '';
  const sourceUrl = typeof data.sourceUrl === 'string' ? data.sourceUrl : '';
  const categoryKey = typeof data.categoryKey === 'string' ? data.categoryKey : '';
  if (!ID.test(id) || !version || !ISO_DATE.test(publishedAt) || !titleKey || !descriptionKey || !sourceKey || !categoryKey || !HTTPS_URL.test(sourceUrl)) return null;
  return {
    id,
    version,
    publishedAt,
    titleKey,
    descriptionKey,
    sourceKey,
    sourceUrl,
    actionRequired: data.actionRequired === true,
    categoryKey,
  };
}

export function createLegalUpdatesRouter(deps: { currentUserId: (req: Request) => string | null; getFirestore: () => Firestore }): Router {
  const router = Router();

  router.get('/legal-updates', async (req, res) => {
    const uid = deps.currentUserId(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const db = deps.getFirestore();
      const [updatesSnap, acknowledgementsSnap] = await Promise.all([
        db.collection('legal_updates').orderBy('publishedAt', 'desc').limit(100).get(),
        db.collection('users').doc(uid).collection('legal_acknowledgements').limit(100).get(),
      ]);
      const updates = updatesSnap.docs.map(doc => serializeUpdate(doc.id, doc.data())).filter((value): value is LegalUpdateRecord => value !== null).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.version.localeCompare(a.version));
      const acknowledgedIds = acknowledgementsSnap.docs
        .map(doc => doc.id)
        .filter(id => ID.test(id));
      return res.json({ updates, acknowledgedIds });
    } catch (error) {
      console.error('Legal updates read failed', error);
      return res.status(503).json({ error: 'Rechtliche Updates derzeit nicht verfügbar.' });
    }
  });

  router.post('/legal-updates/:updateId/acknowledge', async (req, res) => {
    const uid = deps.currentUserId(req);
    const updateId = req.params.updateId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!ID.test(updateId)) return res.status(400).json({ error: 'Ungültige Update-ID.' });
    try {
      const db = deps.getFirestore();
      const updateRef = db.collection('legal_updates').doc(updateId);
      const ackRef = db.collection('users').doc(uid).collection('legal_acknowledgements').doc(updateId);
      await db.runTransaction(async tx => {
        const updateSnap = await tx.get(updateRef);
        if (!updateSnap.exists) throw new Error('LEGAL_UPDATE_NOT_FOUND');
        const update = serializeUpdate(updateId, updateSnap.data() ?? {});
        if (!update) throw new Error('LEGAL_UPDATE_INVALID');
        const ackSnap = await tx.get(ackRef);
        const acknowledgedAt = new Date().toISOString();
        if (!ackSnap.exists) {
          tx.create(ackRef, {
            updateId,
            version: update.version,
            publishedAt: update.publishedAt,
            status: 'acknowledged',
            acknowledgedAt,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          tx.set(ackRef, { version: update.version, publishedAt: update.publishedAt, status: 'acknowledged', acknowledgedAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
      });
      return res.json({ ok: true, updateId });
    } catch (error) {
      if (error instanceof Error && error.message === 'LEGAL_UPDATE_NOT_FOUND') return res.status(404).json({ error: 'Rechtliches Update nicht gefunden.' });
      if (error instanceof Error && error.message === 'LEGAL_UPDATE_INVALID') return res.status(409).json({ error: 'Rechtliches Update ist ungültig konfiguriert.' });
      console.error('Legal update acknowledgement failed', error);
      return res.status(503).json({ error: 'Rechtliches Update konnte nicht bestätigt werden.' });
    }
  });

  return router;
}
