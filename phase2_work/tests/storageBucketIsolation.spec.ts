import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({
  projectId: 'klar-admin',
  config: { projectId: 'legacy-project', storageBucket: 'legacy-project.firebasestorage.app' },
  bucket: vi.fn((name: string) => ({ name })),
}));

vi.mock('../src/server/db', () => ({
  getServerFirebaseApp: () => ({ options: { projectId: doubles.projectId } }),
}));
vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({ bucket: doubles.bucket }),
}));
vi.mock('node:fs', () => ({
  readFileSync: () => JSON.stringify(doubles.config),
}));

import { getAppBucket } from '../src/server/storage';

const oldBucket = process.env.FIREBASE_STORAGE_BUCKET;
const oldEmulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST;

describe('Firebase Storage project isolation', () => {
  beforeEach(() => {
    doubles.projectId = 'klar-admin';
    doubles.config = {
      projectId: 'legacy-project',
      storageBucket: 'legacy-project.firebasestorage.app',
    };
    doubles.bucket.mockClear();
    delete process.env.FIREBASE_STORAGE_BUCKET;
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  });

  afterEach(() => {
    if (oldBucket === undefined) delete process.env.FIREBASE_STORAGE_BUCKET;
    else process.env.FIREBASE_STORAGE_BUCKET = oldBucket;
    if (oldEmulator === undefined) delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    else process.env.FIREBASE_STORAGE_EMULATOR_HOST = oldEmulator;
  });

  it('fails closed rather than using a bucket from a different checked-in project', () => {
    expect(() => getAppBucket()).toThrow(/explicitly set for the selected Firebase project/);
    expect(doubles.bucket).not.toHaveBeenCalled();
  });

  it('uses an explicit reviewed bucket for a different staging project', () => {
    process.env.FIREBASE_STORAGE_BUCKET = 'klar-admin.firebasestorage.app';
    expect(getAppBucket()).toEqual({ name: 'klar-admin.firebasestorage.app' });
    expect(doubles.bucket).toHaveBeenCalledExactlyOnceWith('klar-admin.firebasestorage.app');
  });

  it('permits the checked-in bucket when the Admin project matches the config project', () => {
    doubles.projectId = 'legacy-project';
    expect(getAppBucket()).toEqual({ name: 'legacy-project.firebasestorage.app' });
    expect(doubles.bucket).toHaveBeenCalledExactlyOnceWith('legacy-project.firebasestorage.app');
  });

  it('does not treat a blank bucket override as explicit authorization', () => {
    process.env.FIREBASE_STORAGE_BUCKET = '  ';
    expect(() => getAppBucket()).toThrow(/explicitly set/);
    expect(doubles.bucket).not.toHaveBeenCalled();
  });

  it('rejects a gs:// prefixed explicit bucket identifier', () => {
    process.env.FIREBASE_STORAGE_BUCKET = 'gs://klar-admin.firebasestorage.app';
    expect(() => getAppBucket()).toThrow(/bucket name/);
    expect(doubles.bucket).not.toHaveBeenCalled();
  });

  it('preserves isolated demo-only Storage emulator behavior', () => {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
    doubles.projectId = 'demo-klar';
    expect(getAppBucket()).toEqual({ name: 'demo-klar.appspot.com' });
    doubles.projectId = 'klar-admin';
    expect(() => getAppBucket()).toThrow(/Storage emulator requires a demo project/);
  });
});
