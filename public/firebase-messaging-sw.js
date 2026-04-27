importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyADG4gONMt7vfgLllYPBe3LKD9S0xwQzEA",
  authDomain: "date-3963e.firebaseapp.com",
  projectId: "date-3963e",
  storageBucket: "date-3963e.appspot.com",
  messagingSenderId: "172915248443",
  appId: "1:172915248443:web:aa0bf66ed5e9c8379ffb1e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message on BiChat',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data,
    tag: payload.data?.conversationId || 'general',
    renotify: true,
    vibrate: [200, 100, 200], // Custom vibration pattern
    requireInteraction: false, // Don't stick forever unless it's critical
    dir: 'ltr',
    timestamp: Date.now()
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification.data);
  event.notification.close();
  
  const conversationId = event.notification.data?.conversationId;
  const urlToOpen = conversationId ? `/messagesv2?uid=${event.notification.data.senderId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
