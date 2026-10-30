/**
 * Profile media is an authorization reference, never a persistent download
 * capability. Legacy Firebase URLs are parsed without using their token.
 */
export type ProfileMediaSource =
  | { kind: 'storage'; path: string; bucket?: string }
  | { kind: 'public'; url: string }
  | { kind: 'blocked' };

const PROFILE_PATH = /^profiles\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9_.-]{1,180}$/;
const PUBLIC_IMAGE_HOSTS = new Set(['images.unsplash.com', 'lh3.googleusercontent.com']);

function permittedPath(path: string): boolean {
  return PROFILE_PATH.test(path) && !path.includes('..');
}

export function classifyProfileMediaSource(value: unknown): ProfileMediaSource {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
    return { kind: 'blocked' };
  }
  if (permittedPath(value)) return { kind: 'storage', path: value };
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) {
      return { kind: 'blocked' };
    }
    if (url.hostname === 'firebasestorage.googleapis.com') {
      const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
      if (!match) return { kind: 'blocked' };
      const bucket = decodeURIComponent(match[1]!);
      const path = decodeURIComponent(match[2]!);
      if (!/^[A-Za-z0-9_.-]{3,200}$/.test(bucket) || !permittedPath(path)) {
        return { kind: 'blocked' };
      }
      // The old alt=media and token= parameters are never used.
      return { kind: 'storage', path, bucket };
    }
    if (url.searchParams.has('token') || url.searchParams.has('X-Goog-Signature')
      || url.searchParams.has('GoogleAccessId') || url.searchParams.has('Signature')) {
      return { kind: 'blocked' };
    }
    const trusted = PUBLIC_IMAGE_HOSTS.has(url.hostname)
      || url.hostname.endsWith('.googleusercontent.com');
    return trusted ? { kind: 'public', url: url.toString() } : { kind: 'blocked' };
  } catch {
    return { kind: 'blocked' };
  }
}

export function canonicalProfileMediaReference(value: unknown): string {
  const parsed = classifyProfileMediaSource(value);
  return parsed.kind === 'storage' ? parsed.path
    : parsed.kind === 'public' ? parsed.url : '';
}
