import type { ImgHTMLAttributes } from 'react';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuthenticatedProfileMedia, type ProfileMediaTarget } from '../lib/profileMediaClient';

type AuthenticatedProfileImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** First-party protected proxy URL returned by the server. External URLs are rejected. */
  src?: string | null;
  /** Explicit self/profile target for callers that already hold a typed reference. */
  target?: ProfileMediaTarget | null;
  viewerUid?: string | null;
  revision?: string | null;
};

function targetFromProxyPath(src?: string | null): ProfileMediaTarget | null {
  if (!src || src.includes('?') || src.includes('#')) return null;
  if (src === '/api/profile-media/self') return { kind: 'self' };
  const match = /^\/api\/profile-media\/([^/]+)\/([^/]+)$/.exec(src);
  if (!match) return null;
  try {
    const uid = decodeURIComponent(match[1]!);
    const mediaRef = decodeURIComponent(match[2]!);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^klar-media:v1:[A-Za-z0-9_-]+$/.test(mediaRef)) return null;
    return { kind: 'profile', uid, mediaRef };
  } catch {
    return null;
  }
}

/**
 * Renders profile media only after an authenticated backend request has
 * returned image bytes. It never renders legacy/public/download-token URLs.
 */
export function AuthenticatedProfileImage({
  src,
  target,
  viewerUid,
  revision,
  alt = '',
  className,
  ...imageProps
}: AuthenticatedProfileImageProps) {
  const [observedViewerUid, setObservedViewerUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  useEffect(() => onAuthStateChanged(auth, user => setObservedViewerUid(user?.uid ?? null)), []);
  const effectiveViewerUid = viewerUid === undefined ? observedViewerUid : viewerUid;
  const mediaTarget = target ?? targetFromProxyPath(src);
  const media = useAuthenticatedProfileMedia(mediaTarget, effectiveViewerUid, revision);

  if (media.status !== 'ready' || !media.src) {
    return (
      <span
        className={className}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        data-profile-media-status={media.status}
      />
    );
  }

  return (
    <img
      {...imageProps}
      src={media.src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}
