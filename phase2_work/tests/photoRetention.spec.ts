// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { deleteExpiredPhotoPage, PHOTO_RETENTION_MS } from '../functions/src/retention';

describe('P0 #202: legacy upload-age retention must fail closed', () => {
  it('never lists or deletes a still-pending photo older than 30 days', async () => {
    const list = vi.fn(async () => {
      throw new Error('Storage should not be read by disabled photo purge');
    });
    const bucket = { getFiles: list };
    await expect(deleteExpiredPhotoPage(
      bucket as any, new Date(Date.now() + PHOTO_RETENTION_MS + 1000),
    )).rejects.toThrow('legacy_age_only_photo_purge_disabled');
    expect(list).not.toHaveBeenCalled();
  });

  it('cannot purge an approved photo without the authoritative decision date', async () => {
    const removed = vi.fn();
    const list = vi.fn(async () => [[{
      getMetadata: async () => [{
        timeCreated: '2020-01-01T00:00:00Z',
        generation: '2',
      }],
      delete: removed,
    }], {}]);
    await expect(deleteExpiredPhotoPage({ getFiles: list } as any, new Date('2026-11-01')))
      .rejects.toThrow('legacy_age_only_photo_purge_disabled');
    expect(list).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
  });

  it('does not mutate Storage when an obsolete caller supplies a page token', async () => {
    const list = vi.fn(async () => [[], {}]);
    await expect(deleteExpiredPhotoPage({ getFiles: list } as any, new Date(), 'next-page'))
      .rejects.toThrow('legacy_age_only_photo_purge_disabled');
    expect(list).not.toHaveBeenCalled();
  });
});
