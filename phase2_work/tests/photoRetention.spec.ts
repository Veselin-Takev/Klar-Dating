// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { deleteExpiredPhotoPage, PHOTO_RETENTION_MS } from '../functions/src/retention';

describe('VES-5 P0: legacy upload-age verification photo retention is retired', () => {
  it('retains the 30-day policy constant without interpreting creation age as authorization', () => {
    expect(PHOTO_RETENTION_MS).toBe(30 * 86_400_000);
  });

  it.each([
    { timeCreated: '2020-01-01', generation: '4' },
    { timeCreated: '2020-01-01', generation: '4', temporaryHold: true },
    { timeCreated: '2020-01-01', generation: '4', eventBasedHold: false },
  ])('refuses all legacy physical deletes, including aged objects: %j', async metadata => {
    const file = {
      getMetadata: vi.fn(async () => [metadata]),
      delete: vi.fn(),
    };
    const getFiles = vi.fn(async () => [[file], {}]);
    await expect(deleteExpiredPhotoPage({ getFiles } as any, new Date('2026-11-08'))).rejects.toThrow('verification_photo_p0_fencing_unverified');
    expect(getFiles).not.toHaveBeenCalled();
    expect(file.getMetadata).not.toHaveBeenCalled();
    expect(file.delete).not.toHaveBeenCalled();
  });

  it('fails closed before reading Storage even with a retry cursor', async () => {
    const getFiles = vi.fn();
    await expect(deleteExpiredPhotoPage({ getFiles } as any, new Date(), 'retry-cursor')).rejects.toThrow('verification_photo_p0_fencing_unverified');
    expect(getFiles).not.toHaveBeenCalled();
  });
});
