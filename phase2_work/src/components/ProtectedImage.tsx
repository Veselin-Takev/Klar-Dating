import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { authFetch } from '../lib/authFetch';
import { protectedMediaSource } from '../lib/profileMedia';
import config from '../../firebase-applet-config.json';

/** Protected images use an Authorization header, never a token in the URL.
 * Blobs are released on sign-out, token change and unmount; no shared cache. */
export function ProtectedImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const source = typeof src === 'string' ? protectedMediaSource(src, config.storageBucket) : null;
  const protectedPath = source?.startsWith('/api/media/') ? source : null;
  const [image, setImage] = useState<{path: string; url: string} | null>(null);
  useEffect(() => {
    if (!protectedPath) return;
    let current: AbortController | null = null, blobUrl: string | null = null;
    const clear = (reset = true) => { current?.abort(); if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = null; if (reset) setImage(null); };
    const unsubscribe = onIdTokenChanged(auth, user => {
      clear();
      if (!user) return;
      const controller = new AbortController(); current = controller;
      void authFetch(protectedPath, { signal: controller.signal, cache: 'no-store' }).then(async response => {
        if (!response.ok) throw new Error('media_denied');
        const blob = await response.blob();
        if (controller.signal.aborted || auth.currentUser?.uid !== user.uid) return;
        blobUrl = URL.createObjectURL(blob); setImage({ path: protectedPath, url: blobUrl });
      }).catch(() => { if (!controller.signal.aborted) setImage(null); });
    });
    return () => { unsubscribe(); clear(false); };
  }, [protectedPath]);
  return <img {...props} src={protectedPath ? image?.path === protectedPath ? image.url : undefined : source || undefined} />;
}
