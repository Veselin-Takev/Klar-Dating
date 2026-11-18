import { createHmac } from 'node:crypto';
import { defineSecret, defineString } from 'firebase-functions/params';
import { warn } from 'firebase-functions/logger';
import { onObjectFinalized } from 'firebase-functions/v2/storage';

const complianceSecret = defineSecret('COMPLIANCE_JOB_SECRET');
const complianceApiOrigin = defineString('COMPLIANCE_API_ORIGIN', {
  description: 'HTTPS origin of the Klar API; no path or credentials.',
});

/**
 * Forwards the immutable Cloud Storage finalize event to the API's HMAC-gated
 * registration boundary. Invalid object metadata is permanently rejected;
 * transient API/Firestore failures are retried by the event trigger.
 */
export const registerVerificationDeletionFenceOnObjectFinalized = onObjectFinalized({
  region: 'europe-west3',
  retry: true,
  secrets: [complianceSecret],
}, async event => {
  const origin = complianceApiOrigin.value();
  const secret = complianceSecret.value();
  if (!origin || secret.length < 32) throw new Error('Invalid verification registration configuration');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) {
    throw new Error('COMPLIANCE_API_ORIGIN must be an HTTPS origin without a path');
  }

  const timestamp = String(Date.now());
  const body = JSON.stringify(event.data);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const response = await fetch(`${origin}/internal/verification/object-finalized`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'content-type': 'application/json',
      'X-Klar-Compliance-Timestamp': timestamp,
      'X-Klar-Compliance-Signature': signature,
    },
    body,
  });

  if (response.status === 409 || response.status === 422) {
    warn('verification_object_registration_rejected', { status: response.status });
    return;
  }
  if (!response.ok) throw new Error('Verification object registration API unavailable');
});
