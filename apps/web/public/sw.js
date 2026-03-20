/// <reference lib="webworker" />

/**
 * Commune — Service Worker
 *
 * Handles push notifications and provides offline fallback caching.
 * Registered from the client via navigator.serviceWorker.register('/sw.js').
 */

// ── App Shell Cache ────────────────────────────────────────────────────────────

const CACHE_NAME = 'commune-v1';
const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
];

/**
 * Install event — cache the app shell.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)),
  );
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

/**
 * Activate event — clean up old caches.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

/**
 * Fetch event — serve navigation requests from cache when offline.
 * Non-navigation requests use network-first with no cache fallback
 * to avoid interfering with API calls and dynamic assets.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle navigation requests (HTML pages) with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/')),
    );
    return;
  }

  // For other GET requests, try network first, fall back to cache
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request)),
    );
  }
});

// ── Push Notifications ─────────────────────────────────────────────────────────

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
