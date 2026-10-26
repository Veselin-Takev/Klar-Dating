import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const MAX_RECEIPT_MAIL_ATTEMPTS = 5;
const RECEIPT_RETRYABLE_HTTP = new Set([408, 425, 429]);
const RECEIPT_RETRY_BASE_MS = 60_000;
const RECEIPT_RETRY_MAX_MS = 60 * 60_000;
import express from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { getDb, runObservedTransaction } from './db';
import { processContractCancellation } from './contracts';
import { runAccountDeletion } from './accountDeletion';

export async function deliverContractReceipt(id: string, db: Firestore = getDb(), fetcher: typeof fetch = fetch) {
  const apiKey = process.env.SENDGRID_API_KEY; const sender = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !sender) return;
  const ref = db.doc(`contract_requests/${id}`); const now = Date.now(); const lease = randomUUID();
  const job = await runObservedTransaction(db, 'complianceJobs.acquireReceiptLease', async tx => {
    const data = (await tx.get(ref)).data();
    if (!data || data.mailStatus === 'accepted' || data.mailStatus === 'error' || ((typeof data.mailLeaseUntil?.toMillis === 'function' && data.mailLeaseUntil.toMillis() > now) || (typeof data.mailLeaseUntil === 'number' && data.mailLeaseUntil > now))) return null;
    const attempts = Number.isSafeInteger(data.mailAttempts) ? data.mailAttempts : 0;
    if (attempts >= MAX_RECEIPT_MAIL_ATTEMPTS) {
      tx.update(ref, { mailStatus: 'error', mailError: 'mail_retry_exhausted', mailLeaseUntil: 0, mailNextAttemptAt: new Date('9999-01-01') });
      return null;
    }
    tx.update(ref, { mailLease: lease, mailLeaseUntil: now + 60_000, mailStatus: 'processing' }); return data;
  });
  if (!job) return;
  try {
    const response = await fetcher('https://api.sendgrid.com/v3/mail/send', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6000),
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({
        personalizations: [{ to: [{ email: job.email }], custom_args: { contract_request_id: id } }],
        from: { email: sender }, subject: `Klar · ${id}`, content: [{ type: 'text/plain', value: job.receipt.text }],
      }) });
    if (response.status !== 202) {
      const error = new Error(`mail_provider_http_${response.status}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    await runObservedTransaction(db, 'complianceJobs.markReceiptAccepted', async tx => { const current = (await tx.get(ref)).data(); if (current?.mailLease !== lease) return; tx.update(ref, { mailStatus: 'accepted', mailAcceptedAt: new Date(), mailLeaseUntil: 0, mailNextAttemptAt: new Date('9999-01-01') }); });
  } catch (error: unknown) {
    const status = Number((error as { status?: number })?.status);
    const retryable = !Number.isFinite(status) || RECEIPT_RETRYABLE_HTTP.has(status) || status >= 500;
    await runObservedTransaction(db, 'complianceJobs.updateReceiptRetry', async tx => {
      const current = (await tx.get(ref)).data();
      if (current?.mailLease !== lease) return;
      const attempts = (Number.isSafeInteger(current.mailAttempts) ? current.mailAttempts : 0) + 1;
      const terminal = attempts >= MAX_RECEIPT_MAIL_ATTEMPTS || !retryable;
      const delay = Math.min(RECEIPT_RETRY_MAX_MS, RECEIPT_RETRY_BASE_MS * 2 ** Math.min(attempts - 1, 6));
      tx.update(ref, {
        mailStatus: terminal ? 'error' : 'pending',
        mailAttempts: attempts,
        mailError: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        mailLeaseUntil: 0,
        mailLease: null,
        mailNextAttemptAt: new Date(Date.now() + (terminal ? 365 * 86400_000 : delay)),
      });
    });
  }
}

export function validJobSignature(body: Buffer, signature: string | undefined, secret: string, now = Date.now()) {
  if (secret.length < 32 || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  let message: { timestamp?: unknown };
  try { message = JSON.parse(body.toString('utf8')); } catch { return false; }
  if (typeof message.timestamp !== 'number' || !Number.isSafeInteger(message.timestamp) || Math.abs(now - message.timestamp) > 300_000) return false;
  return timingSafeEqual(createHmac('sha256', secret).update(body).digest(), Buffer.from(signature, 'hex'));
}
/** Invoke from the Frankfurt scheduler. No polling timers or background CPU assumption in Cloud Run. */
export function createComplianceJobsRouter(db: () => Firestore = getDb) {
  const router = express.Router();
  router.post('/drain', express.raw({ inflate: false, type: 'application/json', limit: '1kb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !validJobSignature(req.body, req.get('X-Klar-Job-Signature'), process.env.COMPLIANCE_JOB_SECRET ?? '')) return res.sendStatus(401);
    const firestore = db(); const lock = firestore.doc('system/compliance_worker'); const now = Date.now();
    try {
      const workerLease = randomUUID();
      const acquired = await runObservedTransaction(firestore, 'complianceJobs.acquireWorkerLease', async tx => {
        const state = (await tx.get(lock)).data();
        if (state?.leaseUntil > now) return false;
        tx.set(lock, { lease: workerLease, leaseUntil: now + 180_000 }); return true;
      });
      if (!acquired) return res.status(202).json({ busy: true });
      try {
        const cancellations = await firestore.collection('contract_requests').where('processingNextAttemptAt', '<=', new Date(now)).limit(2).get();
        for (const job of cancellations.docs) {
          try { await processContractCancellation(job.id, firestore); }
          catch { const attempts = (job.data().attempts ?? 0) + 1;
            await job.ref.update({ lastError: 'provider_retry_required', attempts,
              processingNextAttemptAt: new Date(now + Math.min(3600_000, 60_000 * 2 ** Math.min(attempts, 6))) }); }
        }
        const receipts = await firestore.collection('contract_requests').where('mailNextAttemptAt', '<=', new Date(now)).limit(3).get();
        for (const job of receipts.docs) await deliverContractReceipt(job.id, firestore);
        const deletions = await firestore.collection('account_deletions').where('nextAttemptAt', '<=', new Date(now)).limit(1).get();
        for (const job of deletions.docs) await runAccountDeletion(job.id);
        await runObservedTransaction(firestore, 'complianceJobs.markWorkerSuccess', async tx => { const state = (await tx.get(lock)).data(); if (state?.lease !== workerLease) return; tx.set(lock, { leaseUntil: 0, lastSuccessAt: new Date() }, { merge: true }); });
        return res.json({ ok: true, deletionJobs: deletions.size });
      } finally { await runObservedTransaction(firestore, 'complianceJobs.releaseWorkerLease', async tx => { const state = (await tx.get(lock)).data(); if (state?.lease !== workerLease) return; tx.set(lock, { leaseUntil: 0 }, { merge: true }); }); }
    } catch { return res.status(503).json({ code: 'compliance_worker_unavailable' }); }
  });
  return router;
}
