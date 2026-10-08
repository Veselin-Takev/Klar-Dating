export class PushNotificationService {
  /**
   * Registriert den Service Worker und fordert die Berechtigung für Web-Push-Notifications an.
   */
  public static async requestPermissionAndRegister(): Promise<string | null> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Push notifications are not supported in this environment.');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Push notification permission denied by user.');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      // FCM token acquisition belongs to the Firebase Messaging integration.
      // Never return a fabricated token: callers must treat registration as unavailable.
      console.warn('Service Worker ready, but Firebase Messaging is not configured for token acquisition.');
      void registration;
      return null;
    } catch (error) {
      console.error('Error during push notification registration:', error);
      return null;
    }
  }

  /**
   * Simuliert das Senden oder Anzeigen einer lokalen High-Priority Benachrichtigung
   */
  public static showLocalNotification(title: string, body: string, icon?: string) {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        tag: 'klar-app-notification'
      });
    }
  }
}
