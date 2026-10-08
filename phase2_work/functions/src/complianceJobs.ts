import { createHmac } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const secret = defineSecret('COMPLIANCE_JOB_SECRET');
const endpoint = defineString('COMPLIANCE_API_ORIGIN', { default: '', description: 'HTTPS origin of the Klar API; no path or credentials.' });
export const retryComplianceJobsCron = onSchedule({ region: 'europe-west3', schedule: 'every 5 minutes', timeZone: 'UTC',
  memory: '256MiB', timeoutSeconds: 180, maxInstances: 1, retryCount: 3, secrets: [secret],
}, async () => {
  const value = endpoint.value();
  if (!value) return; // Deployment gate requires a real endpoint and a verified successful run.
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || secret.value().length < 32) throw new Error('Invalid compliance worker configuration');
  const body = JSON.stringify({ timestamp: Date.now() });
  const signature = createHmac('sha256', secret.value()).update(body).digest('hex');
  const response = await fetch(`${url.origin}/internal/compliance/drain`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(150_000),
    headers: { 'content-type': 'application/json', 'X-Klar-Job-Signature': signature }, body });
  if (!response.ok) throw new Error('Compliance worker unavailable');
});
