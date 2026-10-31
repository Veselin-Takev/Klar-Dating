import { createHmac } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { assertPurgeSchedulerResponse } from './purgeCompletion';

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
  const body = '{}';
  const signature = createHmac('sha256', jobSecret).update(`${timestamp}.${body}`).digest('hex');
  const response = await fetch(`${origin}/api/admin/purge-verification-storage`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(150_000),
    headers: { 'content-type': 'application/json', 'X-Klar-Compliance-Timestamp': timestamp, 'X-Klar-Compliance-Signature': signature },
    body,
  });
  // An HTTP 200 without a complete, bounded audit summary is NOT erasure proof.
  // Fail the scheduled invocation so its configured retry/error path remains active.
  await assertPurgeSchedulerResponse(response);
});
