import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Inventory contract: every legacy endpoint is explicitly represented in a
 * test surface. This does not claim behavioral coverage; routen-inventar.mjs
 * intentionally measures only path acknowledgement.
 */
const legacyEndpointPaths = [
  '/api/auth/send-verification',
  '/api/legal-updates',
  '/api/legal-updates/:updateId/acknowledge',
  '/api/ai-list',
  '/api/analyze-reflection',
  '/api/compatibility-radar',
  '/api/conversation-dynamics',
  '/api/deep-verbindung-info',
  '/api/nogo-suggestions',
  '/api/weekly-review',
  '/api/extract-success-factors',
  '/api/reply-suggestions',
  '/api/icebreakers',
  '/api/optimize-bio-values',
  '/api/journal-audio-dump',
  '/api/smart-audit',
  '/api/dating-readiness',
  '/api/verify-photo',
  '/api/ads/callback',
] as const;

describe('route inventory acknowledgement', () => {
  it('keeps every known legacy endpoint represented in the source contract', () => {
    const server = readFileSync('server.ts', 'utf8');
    for (const path of legacyEndpointPaths) expect(server).toContain(path);
  });
});
