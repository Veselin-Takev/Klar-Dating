/**
 * A transport-level 2xx is not evidence of a persisted message.
 * Only the explicit success receipt from the Klar API confirms the write.
 * This pure check is shared by IndexedDB and legacy memory-queue replays.
 */
export function isAcknowledgedOfflineWrite(body: unknown): boolean {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    && (body as { success?: unknown }).success === true;
}
