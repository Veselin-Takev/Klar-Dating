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

  it('fails closed when Cloud Run and Firebase Admin project IDs disagree', () => {
    for (const env of [
      { GCLOUD_PROJECT: 'klar-admin', GOOGLE_CLOUD_PROJECT: 'other-project' },
      { GOOGLE_CLOUD_PROJECT: 'klar-admin', FIREBASE_PROJECT_ID: 'other-project' },
      { GCLOUD_PROJECT: 'klar-admin', FIREBASE_PROJECT_ID: 'other-project' },
      { GCLOUD_PROJECT: 'demo-klar', FIREBASE_PROJECT_ID: 'production-project',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    ]) {
      expect(() => resolveFirebaseRuntime(production, env)).toThrow('Firebase runtime project IDs disagree');
    }
  });

  it('accepts consistent explicit project identity across all three variables', () => {
    expect(resolveFirebaseRuntime(production, {
      GCLOUD_PROJECT: 'klar-admin', GOOGLE_CLOUD_PROJECT: 'klar-admin',
      FIREBASE_PROJECT_ID: 'klar-admin', FIRESTORE_DATABASE_ID: '(default)',
    })).toEqual({ projectId: 'klar-admin', databaseId: '(default)' });
    expect(resolveFirebaseRuntime(production, {
      FIREBASE_PROJECT_ID: 'klar-admin',
    })).toEqual({ projectId: 'klar-admin', databaseId: undefined });
  });

  it('does not import a named database from an unrelated checked-in Firebase project', () => {
    expect(resolveFirebaseRuntime(production, {
      GOOGLE_CLOUD_PROJECT: 'klar-admin',
    })).toEqual({ projectId: 'klar-admin', databaseId: undefined });
    expect(resolveFirebaseRuntime(production, {
      GCLOUD_PROJECT: 'klar-admin', FIRESTORE_DATABASE_ID: '(default)',
    })).toEqual({ projectId: 'klar-admin', databaseId: '(default)' });
    expect(resolveFirebaseRuntime(production, {
      GCLOUD_PROJECT: 'production-project',
    })).toEqual({ projectId: 'production-project', databaseId: 'production-db' });
  });
});
