/**
 * Reject asynchronous UI acknowledgements that belong to a signed-out,
 * loading, or different identity. Server-side access control remains mandatory.
 */
export function belongsToCurrentSession(
  requestUid: string | null,
  currentUid: string | null,
): boolean {
  return typeof requestUid === 'string' && requestUid.length > 0 && requestUid === currentUid;
}

/** A new Firebase session can reuse the same UID; reject prior-session replies. */
export function belongsToCurrentAuthEpoch(
  requestUid: string | null,
  currentUid: string | null,
  requestEpoch: number,
  currentEpoch: number,
): boolean {
  return belongsToCurrentSession(requestUid, currentUid) &&
    Number.isSafeInteger(requestEpoch) &&
    requestEpoch === currentEpoch;
}
