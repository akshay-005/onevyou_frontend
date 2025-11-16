// frontend/public/sw.js
// Service Worker for handling web push notifications

self.addEventListener('push', function(event) {
  console.log('📬 Push notification received:', event);
  
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icon.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    data: data.data || {}, // Store custom data
    actions: data.data?.type === 'user-online' ? [
      { action: 'connect', title: 'Connect Now' },
      { action: 'dismiss', title: 'Later' }
    ] : []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'ONEVYOU', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('🖱️ Notification clicked:', event);
  
  event.notification.close();
  
  const data = event.notification.data;
  const urlToOpen = data.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // If app is already open, focus it
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});