import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { timestampMillis } from '../../functions/src/firestoreRepository/runtimeSchemas';

const MAX_RECEIPT_MAIL_ATTEMPTS = 5;
const RECEIPT_RETRYABLE_HTTP = new Set([408, 425, 429]);
const RECEIPT_RETRY_BASE_MS = 60_000;
const RECEIPT_RETRY_MAX_MS = 60 * 60_000;
import express from 'express';
import { getServiceRepository } from './firestoreRepository/nativeDatabase';
import { runAccountDeletion } from './accountDeletion';
import { retryAccountSecurityJobs } from './accountSecurity';
import { cleanupExpiredApiLimits } from './sharedRateLimit';
import { processContractCancellation, contractRecord, type ContractRepository } from './contracts';


export async function deliverContractReceipt(id: string, db: ContractRepository = getServiceRepository('payments'), fetcher: typeof fetch = fetch) {
  const apiKey = process.env.SENDGRID_API_KEY; const sender = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !sender) return;
  const ref = `contract_requests/${id}`; const now = Date.now(); const lease = randomUUID();
  const job = await db.transaction(async tx => {
    const data = (await tx.read(ref, contractRecord));
    if (!data?.receipt || !data.email || data.mailStatus === 'accepted' || data.mailStatus === 'error' || timestampMillis(data.mailLeaseUntil) > now) return null;
    const attempts = Number.isSafeInteger(data.mailAttempts) ? data.mailAttempts! : 0;
    if (attempts >= MAX_RECEIPT_MAIL_ATTEMPTS) {
      tx.write(ref, contractRecord, { mailStatus: 'error', mailError: 'mail_retry_exhausted', mailLeaseUntil: 0, mailNextAttemptAt: new Date('9999-01-01') }, { merge: true });
      return null;
    }
    tx.write(ref, contractRecord, { mailLease: lease, mailLeaseUntil: now + 60_000, mailStatus: 'processing' }, { merge: true }); return data;
  });
  if (!job) return;
  try {
    const response = await fetcher('https://api.sendgrid.com/v3/mail/send', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6000),
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({
        personalizations: [{ to: [{ email: job.email }], custom_args: { contract_request_id: id } }],
        from: { email: sender }, subject: `Klar · ${id}`, content: [{ type: 'text/plain', value: job.receipt!.text }],
      }) });
    if (response.status !== 202) {
      const error = new Error(`mail_provider_http_${response.status}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    await db.transaction(async tx => { const current = (await tx.read(ref, contractRecord)); if (current?.mailLease !== lease) return; tx.write(ref, contractRecord, { mailStatus: 'accepted', mailAcceptedAt: new Date(), mailLeaseUntil: 0, mailNextAttemptAt: new Date('9999-01-01') }, { merge: true }); });
  } catch (error: unknown) {
    const status = Number((error as { status?: number })?.status);
    const retryable = !Number.isFinite(status) || RECEIPT_RETRYABLE_HTTP.has(status) || status >= 500;
    await db.transaction(async tx => {
      const current = (await tx.read(ref, contractRecord));
      if (current?.mailLease !== lease) return;
      const attempts = (Number.isSafeInteger(current.mailAttempts) ? current.mailAttempts! : 0) + 1;
      const terminal = attempts >= MAX_RECEIPT_MAIL_ATTEMPTS || !retryable;
      const delay = Math.min(RECEIPT_RETRY_MAX_MS, RECEIPT_RETRY_BASE_MS * 2 ** Math.min(attempts - 1, 6));
      tx.write(ref, contractRecord, {
        mailStatus: terminal ? 'error' : 'pending',
        mailAttempts: attempts,
        mailError: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        mailLeaseUntil: 0,
        mailLease: null,
        mailNextAttemptAt: new Date(Date.now() + (terminal ? 365 * 86400_000 : delay)),
      }, { merge: true });
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
export function createComplianceJobsRouter(db: () => ContractRepository = () => getServiceRepository('payments')) {
  const router = express.Router();
  router.post('/drain', express.raw({ inflate: false, type: 'application/json', limit: '1kb' }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !validJobSignature(req.body, req.get('X-Klar-Job-Signature'), process.env.COMPLIANCE_JOB_SECRET ?? '')) return res.sendStatus(401);
    let firestore: ContractRepository;
    try {
      if (JSON.parse(req.body.toString('utf8')).tenantId !== 'default') return res.sendStatus(403);
      firestore = db();
    } catch { return res.status(503).json({ code: 'compliance_worker_unavailable' }); }
    const lock = 'system/compliance_worker'; const now = Date.now();
    try {
      const workerLease = randomUUID();
      const acquired = await firestore.transaction(async tx => {
        const state = (await tx.read(lock, contractRecord));
        if ((state?.leaseUntil ?? 0) > now) return false;
        tx.write(lock, contractRecord, { lease: workerLease, leaseUntil: now + 180_000 }); return true;
      });
      if (!acquired) return res.status(202).json({ busy: true });
      try {
        await retryAccountSecurityJobs(firestore);
        await cleanupExpiredApiLimits(firestore);
        const cancellations = await firestore.list('contract_requests', contractRecord, {where: ['processingNextAttemptAt', '<=', new Date(now)], limit: 2});
        for (const job of cancellations) {
          try { await processContractCancellation(job.id, firestore); }
          catch { const attempts = (job.data.attempts ?? 0) + 1;
            await firestore.transaction(async tx => {
              const current = await tx.read(`contract_requests/${job.id}`, contractRecord);
              if (!current || current.processingStatus !== 'pending' || timestampMillis(current.processingLeaseUntil) > Date.now()) return;
              tx.write(`contract_requests/${job.id}`, contractRecord, { lastError: 'provider_retry_required', attempts,
              processingNextAttemptAt: new Date(now + Math.min(3600_000, 60_000 * 2 ** Math.min(attempts, 6))) }, { merge: true }); }); }
        }
        const receipts = await firestore.list('contract_requests', contractRecord, {where: ['mailNextAttemptAt', '<=', new Date(now)], limit: 3});
        for (const job of receipts) await deliverContractReceipt(job.id, firestore);
        const deletions = await firestore.list('account_deletions', contractRecord, {where: ['nextAttemptAt', '<=', new Date(now)], limit: 1});
        // Both workers resolve the supported default namespace from trusted configuration.
        for (const job of deletions) await runAccountDeletion(job.id);
        await firestore.transaction(async tx => { const state = (await tx.read(lock, contractRecord)); if (state?.lease !== workerLease) return; tx.write(lock, contractRecord, { leaseUntil: 0, lastSuccessAt: new Date() }, { merge: true }); });
        return res.json({ ok: true, deletionJobs: deletions.length });
      } finally { await firestore.transaction(async tx => { const state = (await tx.read(lock, contractRecord)); if (state?.lease !== workerLease) return; tx.write(lock, contractRecord, { leaseUntil: 0 }, { merge: true }); }); }
    } catch { return res.status(503).json({ code: 'compliance_worker_unavailable' }); }
  });
  return router;
}
