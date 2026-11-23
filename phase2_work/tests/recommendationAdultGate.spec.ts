import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { CompatibilityProfile } from '../src/server/platform/compatibility';
import { getRecommendations } from '../src/server/platform/launchPlatform';

type CandidateRecord = {
  id: string;
  data: () => Record<string, unknown>;
};

type QueryFilter = {
  field: string;
  value: unknown;
};

type QueryOptions = {
  filters: QueryFilter[];
  orderByDocumentId: boolean;
  cursorId?: string;
  pageSize?: number;
};

function candidate(id: string, patch: Record<string, unknown> = {}): CandidateRecord {
  return {
    id,
    data: () => ({
      name: id, age: 30, location: 'München', bio: '', interests: ['Wandern'],
      isAdult: true, active: true, isSuspended: false, isBlocked: false, isVerified: true, lastActiveAt: new Date(),
      ...patch,
    }),
  };
}

function fakeDb(records: CandidateRecord[], deleted: string[] = []): Firestore {
  const ownerState = new Map(records.map(record => [record.id, record.data()]));

  function createQuery(source: CandidateRecord[], options: QueryOptions = {
    filters: [],
    orderByDocumentId: false,
  }) {
    const withOptions = (next: Partial<QueryOptions>) => createQuery(source, { ...options, ...next });

    return {
      where(field: string, _operator: string, value: unknown) {
        return withOptions({ filters: [...options.filters, { field, value }] });
      },
      orderBy(_fieldPath: unknown) {
        return withOptions({ orderByDocumentId: true });
      },
      startAfter(cursor: { id: string }) {
        return withOptions({ cursorId: cursor.id });
      },
      limit(pageSize: number) {
        return withOptions({ pageSize });
      },
      async get() {
        let docs = source.filter(record =>
          options.filters.every(filter => record.data()[filter.field] === filter.value),
        );

        if (options.orderByDocumentId) {
          docs = docs.sort((left, right) =>
            left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
          );
        }
        if (options.cursorId !== undefined) {
          docs = docs.filter(record => record.id > options.cursorId!);
        }
        if (options.pageSize !== undefined) {
          docs = docs.slice(0, options.pageSize);
        }

        return {
          docs,
          size: docs.length,
          forEach(callback: (document: CandidateRecord) => void) {
            docs.forEach(callback);
          },
        };
      },
    };
  }

  const db = {
    collection(name: string) {
      if (name === 'public_profiles') return createQuery(records);
      if (name === 'blocks') return createQuery([]);
      if (name === 'users') {
        return {
          doc(id: string) {
            return {
              async get() {
                const data = ownerState.get(id);
                return { exists: data !== undefined, data: () => data };
              },
            };
          },
        };
      }
      if (name === 'account_deletions') {
        return {
          doc(id: string) {
            return {
              async get() {
                return { exists: deleted.includes(id) };
              },
            };
          },
        };
      }
      return createQuery([]);
    },
  };

  return db as unknown as Firestore;
}

describe('recommendation candidate adult and lifecycle gate', () => {
  it('serializes only adult, active, non-suspended and non-deletion-pending candidates', async () => {
    const fixtures = [
      candidate('adult'),
      candidate('minor', { isAdult: false }),
      candidate('suspended', { isSuspended: true }),
      candidate('blocked', { isBlocked: true }),
      candidate('inactive', { active: false }),
      candidate('deleting'),
      candidate('deletion-flag-pending', { deletionPending: true }),
      candidate('deletion-flag-corrupt', { deletionPending: null }),
    ];
    const db = fakeDb(fixtures, ['deleting']);
    const profile: CompatibilityProfile & { location: string; limit: number } = {
      location: 'München',
      interests: ['Wandern'],
      limit: 12,
    };

    const result = await getRecommendations(db, 'viewer', profile);
    expect(result.map(item => item.id)).toEqual(['adult']);
  });
});
