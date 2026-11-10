// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { deleteExpiredPhotoPage, PHOTO_RETENTION_MS } from '../functions/src/retention';

describe('legacy verification photo-age purge is disabled for all callers', () => {
  const now = new Date('2026-10-31T00:00:00Z');
  it.each(['pending', 'approved', 'rejected', 'missing-decision'])(
    'does not scan or delete an old object regardless of %s decision state',
    async (_decisionState) => {
      const bucket = { getFiles: vi.fn(async () => {
        throw new Error('legacy worker must not list photos');
      }) };
      const expired = new Date(now.getTime() + PHOTO_RETENTION_MS + 1);
      await expect(deleteExpiredPhotoPage(bucket as any, expired)).rejects.toThrow('legacy_photo_age_retention_disabled');
      expect(bucket.getFiles).not.toHaveBeenCalled();
    },
  );

  it('never acknowledges a page as successful when disabled', async () => {
    const bucket = { getFiles: vi.fn() };
    await expect(deleteExpiredPhotoPage(bucket as any, now, 'cursor')).rejects.toThrow('legacy_photo_age_retention_disabled');
    expect(bucket.getFiles).not.toHaveBeenCalled();
  });
});
