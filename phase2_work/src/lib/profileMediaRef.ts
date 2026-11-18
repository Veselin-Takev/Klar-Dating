const PREFIX = 'klar-media:v1:';
const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const OBJECT_PATH_PATTERN = /^[A-Za-z0-9_./-]+$/;

/**
 * Builds the same opaque, owner-scoped media reference as the server.
 * Profile object paths intentionally use an ASCII-only alphabet so browser
 * btoa() and Node Buffer(...).toString('base64url') produce identical values.
 */
export function createCanonicalProfileMediaRef(uid: string, objectPath: string): string {
  if (!UID_PATTERN.test(uid)
    || !objectPath.startsWith('profiles/' + uid + '/')
    || !OBJECT_PATH_PATTERN.test(objectPath)
    || objectPath.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('Invalid profile media path.');
  }

  const encoded = btoa(objectPath)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return PREFIX + encoded;
}

/** Returns true only for a syntactically valid opaque reference. */
export function isCanonicalProfileMediaRef(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith(PREFIX)
    && /^[A-Za-z0-9_-]+$/.test(value.slice(PREFIX.length));
}
