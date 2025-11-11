//public
self.addEventListener('push', function(event) {
  const data = event.data.json();
  
  const options = {
    body: data.message,
    icon: '/icon.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});