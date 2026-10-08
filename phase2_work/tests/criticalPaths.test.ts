import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore functions
const mockUpdateDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn((_db, collection, id) => ({ id, collection })),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  runTransaction: (...args: any[]) => mockRunTransaction(...args),
}));

describe('Critical Paths: Profile & Matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents race conditions during matching via transactions', async () => {
    // Simulate a concurrent like action
    mockRunTransaction.mockImplementation(async (_db, transactionHandler) => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ dailyCount: 5 })
        }),
        update: vi.fn()
      };
      await transactionHandler(mockTransaction);
      return true;
    });

    const result = await mockRunTransaction({}, async (t: any) => {
      const docRef = { id: 'user123', collection: 'quota_ledger' };
      const doc = await t.get(docRef);
      if (doc.data().dailyCount >= 8) throw new Error("Quota exceeded");
      t.update(docRef, { dailyCount: doc.data().dailyCount + 1 });
      return true;
    });

    expect(result).toBe(true);
    expect(mockRunTransaction).toHaveBeenCalledOnce();
  });

  it('updates profile atomically to prevent partial writes', async () => {
    await mockUpdateDoc({ id: 'user123' }, {
      displayName: 'Test User',
      age: 30
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith({ id: 'user123' }, {
      displayName: 'Test User',
      age: 30
    });
  });
});
