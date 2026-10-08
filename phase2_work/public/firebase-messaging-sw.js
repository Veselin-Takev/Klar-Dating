importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// This requires firebaseConfig to be loaded, but since it's built dynamically,
// usually you need to initialize it here. For the MVP, we just include the worker
// so the getToken() doesn't fail complaining about missing service worker.
self.addEventListener('push', function(event) {
  const payload = event.data ? event.data.json() : {};
  const title = payload.notification?.title || 'Neue Nachricht';
  const options = {
    body: payload.notification?.body || 'Du hast eine neue Benachrichtigung bei Klar.',
    icon: '/icon.png'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
