/** Ignore stale responses when a newer poll has been issued for the same view. */
export function isLatestNotificationRequest(
  requestId: number,
  latestRequestId: number,
  cancelled: boolean,
): boolean {
  return !cancelled && Number.isSafeInteger(requestId) && requestId > 0 &&
    requestId === latestRequestId;
}
