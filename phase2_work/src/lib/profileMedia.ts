/** Media identifiers are object names, never arbitrary URLs or bearer tokens. */
export function profileMediaPath(uid: string, file: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[A-Za-z0-9_.-]{1,160}$/.test(file) || file === '.' || file === '..') throw new Error('invalid_media_path');
  return `/api/media/profiles/${uid}/${file}`;
}

export function protectedMediaSource(source: string, bucket: string): string | null {
  try {
    const url = new URL(source, 'https://media.invalid');
    if (url.pathname.startsWith('/api/media/')) {
      if (url.origin !== 'https://media.invalid' || url.search || url.hash) return null;
      const parts = url.pathname.split('/');
      return parts.length === 6 && parts[3] === 'profiles' ? profileMediaPath(parts[4]!, parts[5]!) : null;
    }
    if (url.hostname === 'firebasestorage.googleapis.com') {
      const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
      if (!match || decodeURIComponent(match[1]!) !== bucket) return null;
      const parts = decodeURIComponent(match[2]!).split('/');
      return parts.length === 3 && parts[0] === 'profiles' ? profileMediaPath(parts[1]!, parts[2]!) : null;
    }
    // Other sources are public UI assets; never forward a Firebase credential.
    if (/googleapis\.com$/.test(url.hostname) || url.searchParams.has('token')) return null;
    return source;
  } catch { return null; }
}
