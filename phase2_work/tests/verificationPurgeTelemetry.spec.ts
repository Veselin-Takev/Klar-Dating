// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  verificationPurgeIncompleteEvent,
  verificationPurgeP0BlockedEvent,
  verificationPurgeUnavailableEvent,
} from '../src/server/platform/verificationPurgeTelemetry';

describe('verification photo purge: aggregate-only operational events', () => {
  it('keeps only allowlisted summary counters, never event or Storage identifiers', () => {
    const input = {
      scanned: 5, failed: 1, pages: 2, hasMore: true,
      uid: 'sensitive-uid', path: 'verification/private-photo.jpg',
      secret: 'never-log-this', error: 'personally identifying exception',
    };
    expect(verificationPurgeIncompleteEvent(input, true)).toEqual({
      event: 'verification_photo_purge_incomplete', severity: 'ERROR',
      processed: 5, failedCount: 1, pages: 2, hasMore: true,
      unresolvedFailureBacklog: true,
    });
    const json = JSON.stringify(verificationPurgeIncompleteEvent(input, true));
    expect(json).not.toMatch(/sensitive-uid|private-photo|never-log-this|personally identifying/);
  });

  it('distinguishes a bounded backlog warning from an unresolved failed purge', () => {
    expect(verificationPurgeIncompleteEvent({
      scanned: 100, failed: 0, pages: 4, hasMore: true,
    }, false).severity).toBe('WARNING');
    expect(verificationPurgeIncompleteEvent({
      scanned: 25, failed: 0, pages: 1, hasMore: false,
    }, true).severity).toBe('ERROR');
  });

  it('generates constant, PII-free records for unavailable and P0-blocked paths', () => {
    expect(verificationPurgeUnavailableEvent()).toEqual({
      event: 'verification_photo_purge_unavailable', severity: 'ERROR',
    });
    expect(verificationPurgeP0BlockedEvent()).toEqual({
      event: 'verification_photo_purge_p0_live_blocked', severity: 'ERROR',
    });
  });
});
