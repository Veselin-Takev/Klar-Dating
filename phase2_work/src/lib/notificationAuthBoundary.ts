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
