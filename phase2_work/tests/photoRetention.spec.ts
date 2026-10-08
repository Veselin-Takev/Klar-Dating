// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { deleteExpiredPhotoPage, PHOTO_RETENTION_MS } from '../functions/src/retention';

describe('photo retention boundary and concurrent replacement', () => {
  it('deletes only expired generations and honors holds', async () => {
    const now = new Date('2026-09-27T12:00:00Z');
    const metadata = [
      { timeCreated: new Date(+now - PHOTO_RETENTION_MS).toISOString(), generation: '1' },
      { timeCreated: new Date(+now - PHOTO_RETENTION_MS + 1).toISOString(), generation: '2' },
      { timeCreated: '2020-01-01T00:00:00Z', generation: '3', temporaryHold: true },
    ];
    const files = metadata.map(value => ({ getMetadata: async () => [value], delete: vi.fn().mockResolvedValue(undefined) }));
    const bucket = { getFiles: async () => [files, { pageToken: 'cursor' }] };
    expect(await deleteExpiredPhotoPage(bucket as any, now)).toEqual({ deleted: 1, scanned: 3, nextPageToken: 'cursor' });
    expect(files[0]!.delete).toHaveBeenCalledWith({ ifGenerationMatch: '1' });
    expect(files[1]!.delete).not.toHaveBeenCalled(); expect(files[2]!.delete).not.toHaveBeenCalled();
  });
  it.each([404, 412])('safely handles a deleted or replaced generation (%s)', async code => {
    const file = { getMetadata: async () => [{ timeCreated: '2020-01-01', generation: '4' }], delete: vi.fn().mockRejectedValue({ code }) };
    expect((await deleteExpiredPhotoPage({ getFiles: async () => [[file], {}] } as any, new Date())).deleted).toBe(0);
  });
  it('propagates storage failure so the scheduler retries without advancing its cursor', async () => {
    await expect(deleteExpiredPhotoPage({ getFiles: async () => { throw new Error('unavailable'); } } as any, new Date())).rejects.toThrow('unavailable');
  });
});
