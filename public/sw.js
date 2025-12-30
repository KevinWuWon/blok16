// Service Worker for Blokus Duo - Push Notifications

// IndexedDB helper for storing player info
const DB_NAME = 'blokus-push';
const STORE_NAME = 'config';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getStoredValue(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch {
    return null;
  }
}

async function setStoredValue(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error('[SW] Failed to store value:', e);
  }
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Install event
self.addEventListener('install', () => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(clients.claim());
});

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'STORE_PLAYER_ID') {
    setStoredValue('playerId', event.data.playerId);
    setStoredValue('convexUrl', event.data.convexUrl);
  }
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'Blokus Duo',
    body: "It's your turn!",
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'blokus-turn',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'blokus-notification',
    requireInteraction: true,
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  const gameCode = event.notification.data?.gameCode;
  const urlToOpen = gameCode ? `/game/${gameCode}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const url = new URL(client.url);
        if (url.pathname.startsWith('/game/') || url.pathname === '/') {
          if (gameCode) {
            client.navigate(`/game/${gameCode}`);
          }
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// Push subscription change event - persist the new subscription
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed:', event);

  event.waitUntil(
    (async () => {
      try {
        // Re-subscribe with the same options
        const newSubscription = await self.registration.pushManager.subscribe(
          event.oldSubscription?.options || { userVisibleOnly: true }
        );

        console.log('[SW] Re-subscribed:', newSubscription);

        // Get stored player info
        const playerId = await getStoredValue('playerId');
        const convexUrl = await getStoredValue('convexUrl');

        if (!playerId || !convexUrl) {
          console.warn('[SW] No stored player ID or Convex URL, cannot refresh subscription');
          // Notify open clients to handle the refresh
          const allClients = await clients.matchAll({ type: 'window' });
          for (const client of allClients) {
            client.postMessage({
              type: 'PUSH_SUBSCRIPTION_CHANGED',
              subscription: {
                endpoint: newSubscription.endpoint,
                keys: {
                  p256dh: arrayBufferToBase64(newSubscription.getKey('p256dh')),
                  auth: arrayBufferToBase64(newSubscription.getKey('auth')),
                },
              },
            });
          }
          return;
        }

        // POST the new subscription to the server
        const response = await fetch(`${convexUrl}/push/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription?.endpoint,
            newEndpoint: newSubscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(newSubscription.getKey('p256dh')),
              auth: arrayBufferToBase64(newSubscription.getKey('auth')),
            },
            playerId,
          }),
        });

        if (!response.ok) {
          console.error('[SW] Failed to refresh subscription on server:', response.status);
        } else {
          console.log('[SW] Successfully refreshed subscription on server');
        }
      } catch (error) {
        console.error('[SW] Error handling subscription change:', error);
      }
    })()
  );
});
