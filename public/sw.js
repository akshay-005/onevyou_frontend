// frontend/public/sw.js
// Service Worker for handling web push notifications

// --- NEW PUSH HANDLER (fetch full notification) ---
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error("Invalid push payload", e);
  }

  // If payload contains ONLY notificationId -> fetch full notification
  if (data.notificationId) {
    event.waitUntil(
      fetch(`/api/notifications/${data.notificationId}`)
        .then((res) => res.json())
        .then((note) => {
          return self.registration.showNotification(note.title || "ONEVYOU", {
            body: note.body || "",
            icon: note.icon || "/icon.png",
            data: { url: note.url || "/dashboard" }
          });
        })
        .catch((err) => {
          console.error("Failed to fetch full notification:", err);
          return self.registration.showNotification("ONEVYOU", {
            body: "You have a new notification"
          });
        })
    );
    return;
  }

  // Fallback (if push accidentally has full body)
  event.waitUntil(
    self.registration.showNotification(data.title || "ONEVYOU", {
      body: data.body || "",
      icon: data.icon || "/icon.png",
      data: data.data || {}
    })
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

// --- RUNTIME CACHING: images and API ---
// Add below your existing listeners in sw.js
const IMAGE_CACHE = "onevyou-images-v1";
const API_CACHE = "onevyou-api-v1";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Images: cache-first
  if (req.destination === "image" || url.pathname.match(/\.(png|jpg|jpeg|webp|avif)$/i)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          return cached || fetch(req);
        }
      })
    );
    return;
  }

  // 2) API GETs: stale-while-revalidate for same-origin /api/*
  if (req.method === "GET" && url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(
      caches.open(API_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(req);
        const networkPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) cache.put(req, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => null);

        // Return cached if present, else wait for network
        return cachedResponse || networkPromise;
      })
    );
    return;
  }

  // default: let the network handle it
});
