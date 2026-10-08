import { describe, expect, it } from 'vitest';
import { resolveFirebaseRuntime } from '../src/server/firebaseRuntime';
const production = { projectId: 'production-project', firestoreDatabaseId: 'production-db' };
describe('Firebase runtime isolation', () => {
  it('keeps emulator traffic on demo-klar and the default database', () => {
    expect(resolveFirebaseRuntime(production, {
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', GCLOUD_PROJECT: 'demo-klar',
    })).toEqual({ projectId: 'demo-klar' });
    expect(resolveFirebaseRuntime(production, {
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    })).toEqual({ projectId: 'demo-klar' });
  });
  it('rejects real project IDs when either emulator is enabled', () => {
    for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
      expect(() => resolveFirebaseRuntime(production, {
        [key]: '127.0.0.1:9099', GCLOUD_PROJECT: 'production-project',
      })).toThrow(/demo-/);
    }
  });
  it('honors explicit deployment configuration', () => {
    expect(resolveFirebaseRuntime(production, {
      GOOGLE_CLOUD_PROJECT: 'deployment-project', FIRESTORE_DATABASE_ID: 'deployment-db',
    })).toEqual({ projectId: 'deployment-project', databaseId: 'deployment-db' });
    expect(resolveFirebaseRuntime(production, {})).toEqual({
      projectId: 'production-project', databaseId: 'production-db',
    });
  });
});
