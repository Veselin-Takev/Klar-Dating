import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const state = vi.hoisted(() => ({
  user: { uid: 'adult-viewer' } as { uid: string } | null,
  listener: null as ((user: { uid: string } | null) => void) | null,
  getBlob: vi.fn(),
  created: vi.fn(),
  revoked: vi.fn(),
}));
vi.mock('../src/lib/firebase', () => ({
  auth: { get currentUser() { return state.user; } },
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: { uid: string } | null) => void) => {
    state.listener = callback;
    callback(state.user);
    return () => { state.listener = null; };
  },
}));
vi.mock('firebase/storage', () => ({
  getStorage: () => ({ app: { options: { storageBucket: 'demo-klar.appspot.com' } } }),
  ref: (_storage: unknown, path: string) => ({ fullPath: path }),
  getBlob: (...args: unknown[]) => state.getBlob(...args),
}));
import { AuthorizedProfileImage } from '../src/components/AuthorizedProfileImage';

const NativeURL = URL;
beforeEach(() => {
  state.user = { uid: 'adult-viewer' };
  state.getBlob.mockReset();
  state.created.mockReset();
  state.revoked.mockReset();
  state.getBlob.mockResolvedValue(new Blob(['image'], { type: 'image/jpeg' }));
  vi.stubGlobal('URL', class extends NativeURL {
    static createObjectURL(blob: Blob) {
      state.created(blob);
      return 'blob:authorized-image';
    }
    static revokeObjectURL(url: string) { state.revoked(url); }
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('authorized profile image', () => {
  const path = 'profiles/owner-1/avatar_123.jpg';
  const legacy = 'https://firebasestorage.googleapis.com/v0/b/demo-klar.appspot.com/o/'
    + encodeURIComponent(path) + '?alt=media&token=SECRET-CANARY';
  it('loads legacy references through authenticated getBlob and revokes the object URL', async () => {
    const view = render(<AuthorizedProfileImage src={legacy} alt="Profile" />);
    await waitFor(() => expect(screen.getByAltText('Profile')).toHaveAttribute('src', 'blob:authorized-image'));
    expect(state.getBlob).toHaveBeenCalledWith({ fullPath: path }, 8 * 1024 * 1024);
    expect(screen.getByAltText('Profile').getAttribute('src')).not.toContain('SECRET-CANARY');
    view.unmount();
    expect(state.revoked).toHaveBeenCalledWith('blob:authorized-image');
  });
  it('fails closed if Storage Rules reject the current viewer', async () => {
    state.getBlob.mockRejectedValue(new Error('storage/unauthorized'));
    render(<AuthorizedProfileImage src={legacy} alt="Denied" />);
    await waitFor(() => expect(state.getBlob).toHaveBeenCalledOnce());
    expect(screen.getByAltText('Denied').getAttribute('src')).toBeNull();
    expect(state.created).not.toHaveBeenCalled();
  });
  it('does not retrieve a legacy object from a different bucket', async () => {
    const other = legacy.replace('demo-klar.appspot.com', 'foreign.appspot.com');
    render(<AuthorizedProfileImage src={other} alt="Foreign" />);
    await waitFor(() => expect(screen.getByAltText('Foreign')).toBeInTheDocument());
    expect(state.getBlob).not.toHaveBeenCalled();
    expect(screen.getByAltText('Foreign').getAttribute('src')).toBeNull();
  });
  it('hides a loaded object when the authenticated session ends', async () => {
    render(<AuthorizedProfileImage src={path} alt="Session" />);
    await waitFor(() => expect(screen.getByAltText('Session')).toHaveAttribute('src', 'blob:authorized-image'));
    state.user = null;
    const listener = state.listener;
    listener?.(null);
    await waitFor(() => expect(screen.getByAltText('Session').getAttribute('src')).toBeNull());
    expect(state.revoked).toHaveBeenCalledWith('blob:authorized-image');
  });
});
