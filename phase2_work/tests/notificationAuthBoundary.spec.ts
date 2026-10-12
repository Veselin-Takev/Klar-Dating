import { describe, expect, it } from 'vitest';
import { belongsToCurrentSession, belongsToCurrentAuthEpoch } from '../src/lib/notificationAuthBoundary';

describe('notification auth transition boundary', () => {
  it('accepts only the original authenticated session identity', () => {
    expect(belongsToCurrentSession('user-a', 'user-a')).toBe(true);
  });

  it('rejects logout, account switching and unsettled authentication', () => {
    expect(belongsToCurrentSession('user-a', null)).toBe(false);
    expect(belongsToCurrentSession('user-a', 'user-b')).toBe(false);
    expect(belongsToCurrentSession(null, 'user-b')).toBe(false);
    expect(belongsToCurrentSession('', '')).toBe(false);
  });

  it('rejects a late response after switching back without matching the original request identity', () => {
    const requestUid = 'user-a';
    expect(belongsToCurrentSession(requestUid, 'user-b')).toBe(false);
    expect(belongsToCurrentSession(requestUid, null)).toBe(false);
  });
  it('rejects stale asynchronous replies after reauthentication to the same UID', () => {
    expect(belongsToCurrentAuthEpoch('user-a', 'user-a', 1, 2)).toBe(false);
    expect(belongsToCurrentAuthEpoch('user-a', 'user-a', 2, 2)).toBe(true);
    expect(belongsToCurrentAuthEpoch('user-a', 'user-b', 2, 2)).toBe(false);
    expect(belongsToCurrentAuthEpoch('user-a', null, 2, 3)).toBe(false);
  });
});
