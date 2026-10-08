import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';
import { authFetch } from '../src/lib/authFetch';
import { requestNotificationPermissionAndGetToken } from '../src/lib/fcm';

vi.mock('firebase/app', () => ({ getApp: vi.fn(() => ({ name: 'test' })) }));
vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({ app: 'test' })),
  getToken: vi.fn(),
  onMessage: vi.fn(),
}));
vi.mock('../src/lib/authFetch', () => ({ authFetch: vi.fn() }));

describe('FCM token registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
  });

  it('registers through authenticated same-origin transport without a client-controlled user id', async () => {
    vi.mocked(getToken).mockResolvedValue('fcm-token-value-with-at-least-20-chars');
    vi.mocked(authFetch).mockResolvedValue({ ok: true } as Response);

    await expect(requestNotificationPermissionAndGetToken()).resolves.toBe('fcm-token-value-with-at-least-20-chars');
    expect(getApp).toHaveBeenCalled();
    expect(getMessaging).toHaveBeenCalled();
    expect(authFetch).toHaveBeenCalledWith('/api/device-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'fcm-token-value-with-at-least-20-chars' }),
    });
  });

  it('does not report registration success when the server rejects persistence', async () => {
    vi.mocked(getToken).mockResolvedValue('fcm-token-value-with-at-least-20-chars');
    vi.mocked(authFetch).mockResolvedValue({ ok: false, status: 401 } as Response);
    await expect(requestNotificationPermissionAndGetToken()).resolves.toBeNull();
  });

  it('does not call the API when notification permission is denied', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') });
    await expect(requestNotificationPermissionAndGetToken()).resolves.toBeNull();
    expect(authFetch).not.toHaveBeenCalled();
  });
});
