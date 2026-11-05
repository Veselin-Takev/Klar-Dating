import { createHmac, randomUUID } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { readBoundedVerificationPurgeReceipt } from './verificationPurgeJobReceipt';

const secret = defineSecret('COMPLIANCE_JOB_SECRET');
const endpoint = defineString('COMPLIANCE_API_ORIGIN', { description: 'HTTPS origin of the Klar API; no path or credentials.' });

export const purgeVerificationStorageCron = onSchedule({
  region: 'europe-west3', schedule: '0 3 * * *', timeZone: 'UTC', memory: '256MiB', timeoutSeconds: 180,
  maxInstances: 1, retryCount: 3, secrets: [secret],
}, async () => {
  const origin = endpoint.value();
  const jobSecret = secret.value();
  if (!origin || jobSecret.length < 32) throw new Error('Invalid verification storage purge configuration');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('COMPLIANCE_API_ORIGIN must be an HTTPS origin without a path');
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const body = '{}';
  const signature = createHmac('sha256', jobSecret).update(`${timestamp}.${nonce}.${body}`).digest('hex');
  const response = await fetch(`${origin}/api/admin/purge-verification-storage`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(150_000),
    headers: { 'content-type': 'application/json', 'X-Klar-Compliance-Timestamp': timestamp, 'X-Klar-Compliance-Nonce': nonce, 'X-Klar-Compliance-Signature': signature },
    body,
  });
  // A successful HTTP transport result is NOT a successful retention pass.
  // Reject legacy/partial responses and unresolved errors even if a proxy or
  // future route regression returns status 200.
  if (!response.ok) throw new Error(`Verification storage purge failed: HTTP ${response.status}`);
  // Read at most 2 KiB of wire bytes; never use response.text() here,
  // which buffers unbounded input before a length check can run.
  const receipt = await readBoundedVerificationPurgeReceipt(response);
  // Aggregates only; do not log UIDs, verification paths, signed messages,
  // HMAC values, auth headers or untrusted server response text.
  console.info(JSON.stringify({
    event: 'verification_photo_purge_completed',
    processed: receipt.processed,
    purgedCount: receipt.purgedCount,
    skippedCount: receipt.skippedCount,
    pages: receipt.pages,
  }));
});
