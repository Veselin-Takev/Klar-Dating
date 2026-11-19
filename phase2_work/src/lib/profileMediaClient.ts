import { useEffect, useState } from 'react';
import { auth } from './firebase';
import { authFetch } from './authFetch';

export type ProfileMediaTarget =
  | { kind: 'self' }
  | { kind: 'profile'; uid: string; mediaRef: string };

export type AuthenticatedProfileMediaState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  src: string | null;
  error: Error | null;
};

type ObjectUrlLease = {
  src: string;
  release: () => void;
};

const MEDIA_REF_PATTERN = /^klar-media:v1:[A-Za-z0-9_-]+$/;
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Builds only first-party API paths. Raw download-token URLs are not accepted. */
export function profileMediaApiPath(target: ProfileMediaTarget): string {
  if (target.kind === 'self') return '/api/profile-media/self';
  if (!UID_PATTERN.test(target.uid) || !MEDIA_REF_PATTERN.test(target.mediaRef)) {
    throw new Error('Invalid profile media reference.');
  }
  return `/api/profile-media/${encodeURIComponent(target.uid)}/${encodeURIComponent(target.mediaRef)}`;
}

async function acquireProfileMediaObjectUrl(
  target: ProfileMediaTarget,
  expectedViewerUid: string | null,
  signal: AbortSignal,
): Promise<ObjectUrlLease> {
  const viewer = auth.currentUser;
  if (!viewer || viewer.isAnonymous) {
    throw new Error('A permanent authenticated session is required to load profile media.');
  }
  if (expectedViewerUid !== viewer.uid) {
    throw new Error('The authentication session changed before profile media loading.');
  }

  const response = await authFetch(profileMediaApiPath(target), { method: 'GET', signal });
  if (!response.ok) throw new Error(`Profile media could not be loaded (HTTP ${response.status}).`);

  const blob = await response.blob();
  if (!ALLOWED_IMAGE_TYPES.has(blob.type)) {
    throw new Error('The profile media response has an unsupported image type.');
  }
  if (signal.aborted || auth.currentUser?.uid !== viewer.uid || auth.currentUser?.isAnonymous) {
    throw new Error('The authentication session changed while profile media was loading.');
  }

  const src = URL.createObjectURL(blob);
  let released = false;
  return {
    src,
    release: () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(src);
    },
  };
}

/**
 * Loads a profile image with the current Firebase ID token and exposes only a
 * temporary browser object URL. The URL is revoked on source/session changes
 * and on unmount; it must never be persisted or shared as a profile field.
 *
 * Pass viewerUid from the owning auth context so account switches invalidate
 * an in-flight request even when the profile target itself has not changed.
 */
export function useAuthenticatedProfileMedia(
  target: ProfileMediaTarget | null,
  viewerUid: string | null = auth.currentUser?.uid ?? null,
  revision: string | null = null,
): AuthenticatedProfileMediaState {
  const kind = target?.kind ?? null;
  const targetUid = target?.kind === 'profile' ? target.uid : null;
  const mediaRef = target?.kind === 'profile' ? target.mediaRef : null;
  const key = [kind ?? 'none', targetUid ?? '', mediaRef ?? '', viewerUid ?? 'signed-out', revision ?? ''].join('|');
  const [state, setState] = useState<AuthenticatedProfileMediaState & { key: string }>({
    key: '',
    status: 'idle',
    src: null,
    error: null,
  });

  useEffect(() => {
    if (!kind) return undefined;
    const source: ProfileMediaTarget = kind === 'self'
      ? { kind: 'self' }
      : { kind: 'profile', uid: targetUid ?? '', mediaRef: mediaRef ?? '' };
    const controller = new AbortController();
    let active = true;
    let release: (() => void) | null = null;

    void acquireProfileMediaObjectUrl(source, viewerUid, controller.signal)
      .then(asset => {
        release = asset.release;
        if (!active) {
          asset.release();
          return;
        }
        setState({ key, status: 'ready', src: asset.src, error: null });
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return;
        const error = cause instanceof Error ? cause : new Error('Profile media could not be loaded.');
        setState({ key, status: 'error', src: null, error });
      });

    return () => {
      active = false;
      controller.abort();
      release?.();
    };
  }, [kind, targetUid, mediaRef, viewerUid, revision, key]);

  if (!kind) return { status: 'idle', src: null, error: null };
  if (state.key !== key) return { status: 'loading', src: null, error: null };
  return { status: state.status, src: state.src, error: state.error };
}
