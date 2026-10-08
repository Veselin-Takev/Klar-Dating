import type { FunnelEventPayload, FunnelStep } from '../../types/analytics';
import { authFetch } from '../../src/lib/authFetch';

/** Explicit session consent is mandatory; server independently checks the persisted decision. */
export async function trackFunnelEvent(step: FunnelStep, metadata?: FunnelEventPayload['metadata'], consent = false) {
  if (!consent || typeof window === 'undefined') return;
  try {
    let sessionId = sessionStorage.getItem('klar_funnel_session');
    if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem('klar_funnel_session', sessionId); }
    await authFetch('/api/analytics/track', { method: 'POST', body: JSON.stringify({ step, metadata, sessionId }), keepalive: true });
  } catch { /* Optional analytics must never interrupt the user journey. */ }
}
