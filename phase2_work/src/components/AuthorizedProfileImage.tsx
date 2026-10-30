import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { classifyProfileMediaSource } from '../lib/profileMediaSource';

// The Firebase SDK checks Storage Rules using the current auth session.
// Browser CORS on the bucket is required; no bearer download URL is rendered.
export function AuthorizedProfileImage({ src, alt = '', ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const [sessionUid, setSessionUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [loaded, setLoaded] = useState<{ source: string; uid: string; url: string } | null>(null);
  useEffect(() => onAuthStateChanged(auth, user => setSessionUid(user?.uid ?? null)), []);
  const source = typeof src === 'string' ? src : '';
  const reference = classifyProfileMediaSource(source);
  const storagePath = reference.kind === 'storage' ? reference.path : '';
  const sourceBucket = reference.kind === 'storage' ? reference.bucket : undefined;

  useEffect(() => {
    if (!storagePath || !sessionUid) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const { getStorage, ref, getBlob } = await import('firebase/storage');
        if (cancelled || auth.currentUser?.uid !== sessionUid) return;
        const storage = getStorage();
        // Never remap a legacy URL from a foreign bucket to this app.
        if (sourceBucket && sourceBucket !== storage.app.options.storageBucket) return;
        const blob = await getBlob(ref(storage, storagePath), 8 * 1024 * 1024);
        if (cancelled || auth.currentUser?.uid !== sessionUid) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) return;
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setLoaded({ source, uid: sessionUid, url: objectUrl });
      } catch {
        // Never fall back to a legacy bearer URL when access is denied.
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, sessionUid, storagePath, sourceBucket]);

  const safeSrc = reference.kind === 'public' ? reference.url
    : reference.kind === 'storage' && loaded?.source === source && loaded.uid === sessionUid
      ? loaded.url : undefined;
  return <img {...rest} src={safeSrc} alt={alt} referrerPolicy="no-referrer" />;
}
