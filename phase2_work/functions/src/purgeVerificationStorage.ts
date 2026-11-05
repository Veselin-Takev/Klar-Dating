import { createHmac, randomUUID } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  readBoundedVerificationPurgeReceipt, verificationPurgeSchedulerFailureEvent,
} from './verificationPurgeJobReceipt';

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
  let response: Response;
  try {
    response = await fetch(`${origin}/api/admin/purge-verification-storage`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(150_000),
      headers: { 'content-type': 'application/json', 'X-Klar-Compliance-Timestamp': timestamp, 'X-Klar-Compliance-Nonce': nonce, 'X-Klar-Compliance-Signature': signature },
      body,
    });
  } catch {
    console.error(JSON.stringify(verificationPurgeSchedulerFailureEvent('transport')));
    // Avoid emitting URLs, headers or raw upstream errors in serverless logs.
    throw new Error('verification_photo_purge_transport_unavailable');
  }
  // A successful HTTP transport result is NOT a successful retention pass.
  // Reject legacy/partial responses and unresolved errors even if a proxy or
  // future route regression returns status 200.
  if (!response.ok) {
    console.error(JSON.stringify(verificationPurgeSchedulerFailureEvent('http', response.status)));
    // Status is numeric-only, not a response body or user-controlled URL.
    throw new Error(`verification_photo_purge_http_${response.status}`);
  }
  // Read at most 2 KiB of wire bytes; never buffer an unbounded response.
  let receipt;
  try {
    receipt = await readBoundedVerificationPurgeReceipt(response);
  } catch {
    console.error(JSON.stringify(verificationPurgeSchedulerFailureEvent('receipt')));
    throw new Error('verification_photo_purge_invalid_receipt');
  }
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
