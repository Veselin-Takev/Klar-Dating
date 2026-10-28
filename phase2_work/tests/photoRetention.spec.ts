// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { deleteAccountPhotos, deleteExpiredPhotoPage } from '../functions/src/retention';

describe('verification photo retention age-only sweep fail-closed boundary', () => {
  it('refuses all legacy age-based purges before any storage access', async () => {
    const getFiles = vi.fn(async () => [[], {}]);
    await expect(deleteExpiredPhotoPage({ getFiles } as any, new Date())).rejects.toThrow('AGE_ONLY_PHOTO_PURGE_DISABLED');
    expect(getFiles).not.toHaveBeenCalled();
  });
  it('preserves explicit account-erasure flow independent of scheduled retention', async () => {
    const getFiles = vi.fn(async () => [[], {}]);
    await expect(deleteAccountPhotos({ getFiles } as any, 'synthetic-user')).resolves.toBe(true);
    expect(getFiles).toHaveBeenCalledTimes(2);
  });
});
