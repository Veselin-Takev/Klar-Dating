// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string; isAnonymous: boolean } },
  authFetch: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({ auth: mocks.auth }));
vi.mock('../src/lib/authFetch', () => ({ authFetch: mocks.authFetch }));

import { profileMediaApiPath, useAuthenticatedProfileMedia } from '../src/lib/profileMediaClient';

let originalCreateObjectUrl: PropertyDescriptor | undefined;
let originalRevokeObjectUrl: PropertyDescriptor | undefined;
const createObjectUrl = vi.fn(() => 'blob:profile-media');
const revokeObjectUrl = vi.fn();

beforeEach(() => {
  mocks.auth.currentUser = { uid: 'viewer', isAnonymous: false };
  mocks.authFetch.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    blob: async () => new Blob(['image-bytes'], { type: 'image/jpeg' }),
  } as Response);
  createObjectUrl.mockReset().mockReturnValue('blob:profile-media');
  revokeObjectUrl.mockReset();
  originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
});

afterEach(() => {
  cleanup();
  if (originalCreateObjectUrl) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectUrl);
  else delete (URL as unknown as { createObjectURL?: typeof URL.createObjectURL }).createObjectURL;
  if (originalRevokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl);
  else delete (URL as unknown as { revokeObjectURL?: typeof URL.revokeObjectURL }).revokeObjectURL;
});

describe('authenticated profile media client', () => {
  it('builds first-party routes and rejects raw bearer URLs', () => {
    expect(profileMediaApiPath({ kind: 'self' })).toBe('/api/profile-media/self');
    expect(profileMediaApiPath({ kind: 'profile', uid: 'person-2', mediaRef: 'klar-media:v1:YWJj' }))
      .toBe('/api/profile-media/person-2/klar-media%3Av1%3AYWJj');
    expect(() => profileMediaApiPath({
      kind: 'profile',
      uid: 'person-2',
      mediaRef: 'https://firebasestorage.googleapis.com/bucket/photo.jpg?token=secret',
    })).toThrow('Invalid profile media reference.');
  });

  it('loads another profile with the authFetch bearer-token boundary and revokes its object URL', async () => {
    const { result, unmount } = renderHook(() => useAuthenticatedProfileMedia(
      { kind: 'profile', uid: 'person-2', mediaRef: 'klar-media:v1:YWJj' },
      'viewer',
    ));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.src).toBe('blob:profile-media');
    expect(mocks.authFetch).toHaveBeenCalledWith(
      '/api/profile-media/person-2/klar-media%3Av1%3AYWJj',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
    );
    unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:profile-media');
  });

  it('routes self-view through the UID-bound endpoint without accepting a client UID', async () => {
    const { result } = renderHook(() => useAuthenticatedProfileMedia({ kind: 'self' }, 'viewer', 'profile-revision-1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mocks.authFetch).toHaveBeenCalledWith(
      '/api/profile-media/self',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
    );
  });

  it('revokes the previous object URL when the target changes', async () => {
    mocks.authFetch
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob(['one'], { type: 'image/jpeg' }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => new Blob(['two'], { type: 'image/jpeg' }) } as Response);
    createObjectUrl.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    const { result, rerender, unmount } = renderHook(
      ({ uid }: { uid: string }) => useAuthenticatedProfileMedia(
        { kind: 'profile', uid, mediaRef: 'klar-media:v1:YWJj' },
        'viewer',
      ),
      { initialProps: { uid: 'person-1' } },
    );
    await waitFor(() => expect(result.current.src).toBe('blob:first'));
    rerender({ uid: 'person-2' });
    await waitFor(() => expect(result.current.src).toBe('blob:second'));
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:first');
    unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:second');
  });

  it('fails closed for anonymous sessions without making a media request', async () => {
    mocks.auth.currentUser = { uid: 'guest', isAnonymous: true };
    const { result } = renderHook(() => useAuthenticatedProfileMedia({ kind: 'self' }, 'guest'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(mocks.authFetch).not.toHaveBeenCalled();
    expect(result.current.src).toBeNull();
  });
});
