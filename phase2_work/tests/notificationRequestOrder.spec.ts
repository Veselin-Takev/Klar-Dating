import { describe, expect, it } from 'vitest';
import { isLatestNotificationRequest } from '../src/lib/notificationRequestOrder';

describe('legal notification poll response ordering', () => {
  it('only accepts the latest request in an active auth scope', () => {
    const oldRequest = 1;
    const newRequest = 2;
    expect(isLatestNotificationRequest(newRequest, newRequest, false)).toBe(true);
    expect(isLatestNotificationRequest(oldRequest, newRequest, false)).toBe(false);
  });

  it('rejects responses after unmount or session transition', () => {
    expect(isLatestNotificationRequest(2, 2, true)).toBe(false);
    expect(isLatestNotificationRequest(0, 0, false)).toBe(false);
    expect(isLatestNotificationRequest(Number.NaN, 1, false)).toBe(false);
  });
});
