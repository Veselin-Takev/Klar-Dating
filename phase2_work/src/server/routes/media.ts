import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { getAppBucket } from '../storage';
import { profileMediaPath } from '../../lib/profileMedia';

const record = z.record(z.string(), z.unknown());
const MAX_BYTES = 8 * 1024 * 1024;
/** Per-instance memory admission complements shared quotas. Keep a slot until
 * the async backend operation finishes, even after a client disconnect. */
export function createMediaUploadAdmission(limit = 4) {
  let active = 0;
  const leases = new WeakMap<express.Response, {started: boolean; released: boolean}>();
  const release = (res: express.Response) => {
    const lease = leases.get(res);
    if (lease && !lease.released) { lease.released = true; active--; }
  };
  const admit: express.RequestHandler = (_req, res, next) => {
    if (active >= limit) { res.set({'Retry-After':'1','Connection':'close'}).status(503).json({code:'media_capacity_unavailable'}); return; }
    active++; leases.set(res,{started:false,released:false});
    res.once('close',()=>{if(!leases.get(res)?.started)release(res)});
    next();
  };
  const run = (handler: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler => async (req,res,next) => {
    const lease = leases.get(res);
    if (!lease || lease.released) { res.destroy(); return; }
    lease.started = true;
    try { await handler(req,res); } catch(error) { next(error); } finally { release(res); }
  };
  return {admit,run};
}
export function createMediaRouter(repo: () => TenantAwareFirestoreRepository, bucket = getAppBucket): express.Router {
  const router = express.Router();
  const uploads = createMediaUploadAdmission();
  async function allowed(requester: string, owner: string): Promise<boolean> {
    return repo().transaction(async tx => {
      const users = await Promise.all([requester, owner].map(async uid => {
        const [user, deletion, lock] = await Promise.all([tx.read(`users/${uid}`, record), tx.read(`account_deletions/${uid}`, record), tx.read(`account_locks/${uid}`, record)]);
        return user?.isAdult === true && user.active !== false && user.mediaAccessState === 'active' && !deletion && !lock;
      }));
      return users.every(Boolean);
    });
  }
  router.use('/media', (_req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin' }); next();
  });
  router.get('/media/profiles/:uid/:file', async (req, res) => {
    try {
      const uid = String(req.params.uid), file = String(req.params.file);
      profileMediaPath(uid, file);
      if (!req.user?.uid || req.user.firebase?.sign_in_provider === 'anonymous' || !await allowed(req.user.uid, uid)) return res.sendStatus(403);
      if (req.aborted || res.destroyed) return;
      const object = bucket().file(`profiles/${uid}/${file}`);
      const [metadata] = await object.getMetadata();
      if (!['image/jpeg','image/png','image/webp'].includes(metadata.contentType ?? '') || !(Number(metadata.size) > 0 && Number(metadata.size) <= MAX_BYTES)) return res.sendStatus(404);
      if (!metadata.generation || !await allowed(req.user.uid, uid)) return res.sendStatus(403);
      if (req.aborted || res.destroyed) return;
      // Bind the version inspected above, and use backpressure instead of
      // buffering up to 8 MB for every concurrent Cloud Run request.
      const stream = bucket().file(object.name,{generation:metadata.generation}).createReadStream({validation:'crc32c'});
      res.type(metadata.contentType!);
      stream.once('error',()=>{if(res.headersSent)res.destroy();else res.sendStatus(404)});
      res.once('close',()=>stream.destroy());
      stream.pipe(res);
    } catch { res.sendStatus(404); }
  });
  router.post('/media/profile', uploads.admit, express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: MAX_BYTES, inflate: false }), uploads.run(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid || !Buffer.isBuffer(req.body) || req.body.length < 3) return res.sendStatus(400);
    const mime = req.get('content-type')?.split(';')[0] ?? '';
    const bytes: Buffer = req.body;
    const valid = mime === 'image/jpeg' ? bytes.subarray(0,3).equals(Buffer.from([255,216,255]))
      : mime === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : mime === 'image/webp' && bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
    if (!valid) return res.sendStatus(400);
    const filename = randomUUID() + (mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg');
    const object = bucket().file(`profiles/${uid}/${filename}`);
    try {
      if (!await allowed(uid, uid)) return res.sendStatus(403);
      // Admin upload creates no Firebase download token. Direct client uploads
      // are denied by Rules; there is no client getDownloadURL step.
      await object.save(bytes, { resumable: false, metadata: { contentType: mime, cacheControl: 'private, no-store' } });
      const path = profileMediaPath(uid, filename);
      await repo().transaction(async tx => {
        const [user, deletion, lock] = await Promise.all([tx.read(`users/${uid}`, record), tx.read(`account_deletions/${uid}`, record), tx.read(`account_locks/${uid}`, record)]);
        if (!user || user.isAdult !== true || user.active === false || user.mediaAccessState !== 'active' || deletion || lock) throw new Error('account_unavailable');
        tx.write(`users/${uid}`, record, { photoURL: path, photoUrl: path }, { merge: true });
      });
      return res.json({ url: path });
    } catch {
      await object.delete().catch(() => undefined);
      return res.status(503).json({ code: 'media_upload_unavailable' });
    }
  }));
  return router;
}
