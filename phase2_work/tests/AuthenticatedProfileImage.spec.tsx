// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  auth: {
    currentUser: null as null | { uid: string; isAnonymous: boolean },
    listener: null as null | ((user: null | { uid: string; isAnonymous: boolean }) => void),
  },
  authFetch: vi.fn(),
}));
vi.mock('../src/lib/firebase', () => ({ auth: mocks.auth }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, listener: (user: null | { uid: string; isAnonymous: boolean }) => void) => {
    mocks.auth.listener = listener;
    listener(mocks.auth.currentUser);
    return vi.fn();
  },
}));
vi.mock('../src/lib/authFetch', () => ({ authFetch: mocks.authFetch }));

import { AuthenticatedProfileImage } from '../src/components/AuthenticatedProfileImage';

const createObjectUrl = vi.fn(() => 'blob:protected-image');
const revokeObjectUrl = vi.fn();
let originalCreate: PropertyDescriptor | undefined;
let originalRevoke: PropertyDescriptor | undefined;

beforeEach(() => {
  mocks.auth.currentUser = { uid: 'viewer-1', isAnonymous: false };
  mocks.auth.listener = null;
  mocks.authFetch.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    blob: async () => new Blob(['image-bytes'], { type: 'image/jpeg' }),
  } as Response);
  createObjectUrl.mockReset().mockReturnValue('blob:protected-image');
  revokeObjectUrl.mockReset();
  originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
});

afterEach(() => {
  cleanup();
  if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
  else delete (URL as unknown as { createObjectURL?: typeof URL.createObjectURL }).createObjectURL;
  if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
  else delete (URL as unknown as { revokeObjectURL?: typeof URL.revokeObjectURL }).revokeObjectURL;
});

describe('AuthenticatedProfileImage', () => {
  it('loads protected media only through the authenticated proxy and revokes the blob URL on unmount', async () => {
    const view = render(
      <AuthenticatedProfileImage
        src="/api/profile-media/person-2/klar-media%3Av1%3AYWJj"
        alt="Geschütztes Profilbild"
        className="avatar"
      />,
    );
    await waitFor(() => expect(screen.getByRole('img', { name: 'Geschütztes Profilbild' })).toHaveAttribute('src', 'blob:protected-image'));
    expect(mocks.authFetch).toHaveBeenCalledWith(
      '/api/profile-media/person-2/klar-media%3Av1%3AYWJj',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
    );
    view.unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:protected-image');
  });

  it('never renders or fetches a legacy public Firebase download URL', () => {
    render(<AuthenticatedProfileImage src="https://firebasestorage.googleapis.com/v0/b/b/o/profiles%2Fuser%2Fphoto.jpg?alt=media&token=secret" alt="Profilbild" />);
    expect(screen.getByRole('img', { name: 'Profilbild' })).not.toHaveAttribute('src');
    expect(mocks.authFetch).not.toHaveBeenCalled();
  });

  it('routes the own image through the identity-bound self endpoint', async () => {
    render(<AuthenticatedProfileImage target={{ kind: 'self' }} viewerUid="viewer-1" alt="Eigenes Profilbild" />);
    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith(
      '/api/profile-media/self',
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
    ));
  });

  it('revokes the previous blob URL and reloads when the Firebase account changes', async () => {
    const view = render(<AuthenticatedProfileImage src="/api/profile-media/person-2/klar-media%3Av1%3AYWJj" alt="Profilbild" />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Profilbild' })).toHaveAttribute('src', 'blob:protected-image'));
    const initialCalls = mocks.authFetch.mock.calls.length;
    await act(async () => {
      mocks.auth.currentUser = { uid: 'viewer-2', isAnonymous: false };
      mocks.auth.listener?.(mocks.auth.currentUser);
    });
    await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledWith('blob:protected-image'));
    await waitFor(() => expect(mocks.authFetch.mock.calls.length).toBeGreaterThan(initialCalls));
    view.unmount();
  });
});
