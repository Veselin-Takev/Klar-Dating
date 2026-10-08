import { getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { authFetch } from './authFetch';

export async function requestNotificationPermissionAndGetToken() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = getMessaging(getApp());
      const currentToken = await getToken(messaging, {});

      if (currentToken) {
        // Identity comes exclusively from the authenticated Firebase session on the server.
        const response = await authFetch('/api/device-token', {
          method: 'POST',
          body: JSON.stringify({ token: currentToken }),
        });
        if (!response.ok) return null;
        return currentToken;
      }
    }
    return null;
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
    return null;
  }
}

export function onForegroundMessage() {
  try {
    const messaging = getMessaging(getApp());
    return onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
    });
  } catch {
    console.warn('FCM not supported in this environment');
    return () => {};
  }
}
