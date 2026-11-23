/**
 * P0 #374 Package 3 — offline candidate Storage Rules contract.
 *
 * This is a deterministic description of the client boundary, not a Firebase
 * SDK adapter. The candidate Rules deny every direct client read/write.
 * Tenant, ownership, adult-verification, account-state and bilateral-block
 * checks remain server-side prerequisites in the Package 1 delivery contract.
 */
export type ProfileMediaStorageOperation = 'read' | 'write';

export interface ProfileMediaStorageAttempt {
  readonly operation: ProfileMediaStorageOperation;
  readonly objectPath: string;
}

export interface ProfileMediaStorageDecision {
  readonly allowed: false;
  readonly code: 'DIRECT_CLIENT_STORAGE_ACCESS_DENIED';
}

const OPAQUE_PROFILE_MEDIA_PATH = /^profile-media\/v1\/[A-Za-z0-9_-]{32,128}$/;

/** Canonical object identifiers only; never accepts URLs, query strings or UID paths. */
export function isCanonicalOpaqueProfileMediaPath(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 160
    && OPAQUE_PROFILE_MEDIA_PATH.test(value)
    && !value.includes('..')
    && !value.includes('%')
    && !value.includes('\\')
    && !value.includes('?')
    && !value.includes('#');
}

/**
 * Candidate Storage Rules intentionally deny every direct client operation.
 * This function cannot authorize an upload or read; signed delivery is a
 * separate server-only contract and must remain default-off until approved.
 */
export function evaluateProfileMediaStorageAccess(
  attempt: ProfileMediaStorageAttempt,
): ProfileMediaStorageDecision {
  // Read the operation/path so malformed attempts are still represented as
  // evaluated inputs; neither value can create a client-side allow path.
  void attempt.operation;
  void attempt.objectPath;
  return Object.freeze({
    allowed: false,
    code: 'DIRECT_CLIENT_STORAGE_ACCESS_DENIED',
  });
}
