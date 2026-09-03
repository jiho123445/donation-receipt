/* PWA v4 service worker: no app-shell caching to avoid stale deployments. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
