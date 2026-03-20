/// <reference lib="webworker" />

/**
 * Commune — Push Notification Service Worker
 *
 * This service worker handles incoming push events and notification clicks.
 * It is registered from the client via navigator.serviceWorker.register('/sw.js').
 */

// Default icon shown with every push notification
const DEFAULT_ICON = '/favicon.svg';

/**
 * Handle incoming push messages.
 * Expected push payload (JSON):
 *   { title: string, body: string, icon?: string, url?: string }
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    // If the payload is not JSON, use it as plain text body
    data = { title: 'Commune', body: event.data.text() };
  }

  const title = data.title || 'Commune';
  const options = {
    body: data.body || '',
    icon: data.icon || DEFAULT_ICON,
    badge: DEFAULT_ICON,
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Handle notification clicks — open or focus the relevant app URL.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If an existing window/tab is open, focus it and navigate
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise, open a new window
        return self.clients.openWindow(targetUrl);
      }),
  );
});
