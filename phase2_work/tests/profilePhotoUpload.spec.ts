import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string; isAnonymous: boolean } },
  storage: {},
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  deleteObject: vi.fn(),
  getDownloadURL: vi.fn(),
  firestore: {},
  getFirestore: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDocFromServer: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({ auth: mocks.auth }));
vi.mock('firebase/storage', () => ({
  getStorage: mocks.getStorage,
  ref: mocks.ref,
  uploadBytes: mocks.uploadBytes,
  deleteObject: mocks.deleteObject,
  getDownloadURL: mocks.getDownloadURL,
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: mocks.getFirestore,
  doc: mocks.doc,
  setDoc: mocks.setDoc,
  getDocFromServer: mocks.getDocFromServer,
}));

import { ladeProfilfotoHoch } from '../src/lib/klar';
import { createCanonicalProfileMediaRef } from '../src/lib/profileMediaRef';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.currentUser = { uid: 'viewer', isAnonymous: false };
  mocks.getStorage.mockReturnValue(mocks.storage);
  mocks.ref.mockImplementation((_storage, path: string) => ({ fullPath: path }));
  mocks.uploadBytes.mockResolvedValue({ metadata: {} });
  mocks.deleteObject.mockResolvedValue(undefined);
  mocks.getFirestore.mockReturnValue(mocks.firestore);
  mocks.doc.mockImplementation((_db, collection: string, uid: string) => ({ collection, uid }));
  mocks.setDoc.mockResolvedValue(undefined);
  mocks.getDocFromServer.mockResolvedValue({ exists: () => false, data: () => undefined });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('profile photo upload writer', () => {
  it('persists an opaque owner-scoped media reference without calling getDownloadURL', async () => {
    const blob = new Blob(['image-data'], { type: 'image/jpeg' });

    const result = await ladeProfilfotoHoch(blob);
    const expectedPath = mocks.ref.mock.calls[0]?.[1] as string;
    const expectedRef = createCanonicalProfileMediaRef('viewer', expectedPath);

    expect(expectedPath).toMatch(/^profiles\/viewer\/avatar_[0-9a-f-]{36}\.jpg$/);
    expect(mocks.uploadBytes).toHaveBeenCalledWith(
      { fullPath: expectedPath },
      blob,
      { contentType: 'image/jpeg' },
    );
    expect(mocks.doc).toHaveBeenCalledWith(mocks.firestore, 'users', 'viewer');
    expect(mocks.setDoc).toHaveBeenCalledWith(
      { collection: 'users', uid: 'viewer' },
      { photoURL: expectedRef },
      { merge: true },
    );
    expect(result).toBe(expectedRef);
    expect(result).not.toContain('https://');
    expect(mocks.deleteObject).not.toHaveBeenCalled();
    expect(mocks.getDownloadURL).not.toHaveBeenCalled();
  });

  it('deletes a newly uploaded object only after a server read proves it is unreferenced', async () => {
    const writeError = new Error('profile write failed');
    mocks.setDoc.mockRejectedValueOnce(writeError);

    await expect(ladeProfilfotoHoch(new Blob(['image-data'], { type: 'image/jpeg' })))
      .rejects.toBe(writeError);

    const expectedPath = mocks.ref.mock.calls[0]?.[1] as string;
    expect(mocks.getDocFromServer).toHaveBeenCalledWith({
      collection: 'users',
      uid: 'viewer',
    });
    expect(mocks.deleteObject).toHaveBeenCalledWith({ fullPath: expectedPath });
  });

  it('retains the uploaded object when the server reference check is ambiguous', async () => {
    mocks.setDoc.mockRejectedValueOnce(new Error('profile write failed'));
    mocks.getDocFromServer.mockRejectedValueOnce(new Error('Firestore server read failed'));

    await expect(ladeProfilfotoHoch(new Blob(['image-data'], { type: 'image/jpeg' })))
      .rejects.toThrow('profile write failed');

    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it('does not compensate when the server profile already references the uploaded media', async () => {
    let attemptedMediaRef = '';
    mocks.setDoc.mockImplementationOnce(async (_document: unknown, data: { photoURL: string }) => {
      attemptedMediaRef = data.photoURL;
      throw new Error('write acknowledgement lost');
    });
    mocks.getDocFromServer.mockImplementationOnce(async () => ({
      exists: () => true,
      data: () => ({ photoURL: attemptedMediaRef }),
    }));

    await expect(ladeProfilfotoHoch(new Blob(['image-data'], { type: 'image/jpeg' })))
      .rejects.toThrow('write acknowledgement lost');

    expect(attemptedMediaRef).toMatch(/^klar-media:v1:/);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it('does not delete the object after the auth session changes during upload', async () => {
    mocks.uploadBytes.mockImplementationOnce(async () => {
      mocks.auth.currentUser = { uid: 'another-user', isAnonymous: false };
      return { metadata: {} };
    });

    await expect(ladeProfilfotoHoch(new Blob(['image-data'], { type: 'image/png' })))
      .rejects.toThrow('Die Sitzung hat sich während des Uploads geändert.');
    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.getDocFromServer).not.toHaveBeenCalled();
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it('uses distinct object paths for two rapid uploads', async () => {
    const first = await ladeProfilfotoHoch(new Blob(['first'], { type: 'image/jpeg' }));
    const second = await ladeProfilfotoHoch(new Blob(['second'], { type: 'image/jpeg' }));
    const paths = mocks.ref.mock.calls.map(call => call[1] as string);

    expect(paths).toHaveLength(2);
    expect(new Set(paths).size).toBe(2);
    expect(first).not.toBe(second);
  });

  it('rejects anonymous sessions and unsupported media before upload', async () => {
    mocks.auth.currentUser = { uid: 'guest', isAnonymous: true };
    await expect(ladeProfilfotoHoch(new Blob(['image'], { type: 'image/jpeg' }))).rejects.toThrow('Nicht angemeldet.');
    expect(mocks.uploadBytes).not.toHaveBeenCalled();

    mocks.auth.currentUser = { uid: 'viewer', isAnonymous: false };
    await expect(ladeProfilfotoHoch(new Blob(['not-image'], { type: 'text/plain' }))).rejects.toThrow('Ungültiges Profilbild.');
    expect(mocks.uploadBytes).not.toHaveBeenCalled();
  });
});
