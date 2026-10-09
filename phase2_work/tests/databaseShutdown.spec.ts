// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { createDurableDbProxy } from '../src/server/durableStore';

describe('database shutdown boundary', () => {
  it('closes the underlying SDK once across concurrent termination requests', async () => {
    const terminate = vi.fn(async () => {});
    const db = createDurableDbProxy({ terminate } as unknown as Firestore);
    await Promise.all([db.terminate(), db.terminate()]);
    expect(terminate).toHaveBeenCalledTimes(1);
  });
  it('propagates SDK termination failure instead of claiming success', async () => {
    const terminate = vi.fn(async () => { throw new Error('termination_failed'); });
    const db = createDurableDbProxy({ terminate } as unknown as Firestore);
    await expect(db.terminate()).rejects.toThrow('termination_failed');
    await expect(db.terminate()).rejects.toThrow('termination_failed');
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
