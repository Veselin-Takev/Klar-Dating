import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string; isAnonymous: boolean } },
  storage: {},
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  firestore: {},
  getFirestore: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({ auth: mocks.auth }));
vi.mock('firebase/storage', () => ({
  getStorage: mocks.getStorage,
  ref: mocks.ref,
  uploadBytes: mocks.uploadBytes,
  getDownloadURL: mocks.getDownloadURL,
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: mocks.getFirestore,
  doc: mocks.doc,
  setDoc: mocks.setDoc,
}));

import { ladeProfilfotoHoch } from '../src/lib/klar';
import { createCanonicalProfileMediaRef } from '../src/lib/profileMediaRef';

beforeEach(() => {
  mocks.auth.currentUser = { uid: 'viewer', isAnonymous: false };
  mocks.getStorage.mockReturnValue(mocks.storage);
  mocks.ref.mockImplementation((_storage, path: string) => ({ fullPath: path }));
  mocks.uploadBytes.mockResolvedValue({ metadata: {} });
  mocks.getFirestore.mockReturnValue(mocks.firestore);
  mocks.doc.mockImplementation((_db, collection: string, uid: string) => ({ collection, uid }));
  mocks.setDoc.mockResolvedValue(undefined);
  mocks.getDownloadURL.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('profile photo upload writer', () => {
  it('persists an opaque owner-scoped media reference without calling getDownloadURL', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const blob = new Blob(['image-data'], { type: 'image/jpeg' });
    const expectedPath = 'profiles/viewer/avatar_1700000000000.jpg';
    const expectedRef = createCanonicalProfileMediaRef('viewer', expectedPath);

    const result = await ladeProfilfotoHoch(blob);

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
    expect(mocks.getDownloadURL).not.toHaveBeenCalled();
  });

  it('does not persist the media reference when the auth session changes during upload', async () => {
    mocks.uploadBytes.mockImplementationOnce(async () => {
      mocks.auth.currentUser = { uid: 'another-user', isAnonymous: false };
      return { metadata: {} };
    });

    await expect(ladeProfilfotoHoch(new Blob(['image-data'], { type: 'image/png' })))
      .rejects.toThrow('Die Sitzung hat sich während des Uploads geändert.');
    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.getDownloadURL).not.toHaveBeenCalled();
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
