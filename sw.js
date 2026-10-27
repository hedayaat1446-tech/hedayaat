// Hedayat service worker: fast repeat visits and a friendly offline page.
// HTML: network first (always fresh), falling back to the cached copy, then to /offline.html.
// Static assets: stale-while-revalidate. API calls, admin and PDFs/videos are never cached here.
const VERSION = 'hedayat-v61';
const CORE = ['/offline.html', '/styles/site.css?v=61', '/vendor/bootstrap.min.css?v=536', '/vendor/bootstrap-icons.min.css?v=local',
  '/vendor/bootstrap.bundle.min.js?v=536', '/hedayat-logo-gold.png', '/icons/icon-192.png', '/fonts/TheYearofHandicrafts-Regular.woff2',
  '/fonts/TheYearofHandicrafts-Bold.woff2'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || /\.(pdf|mp4)$/i.test(url.pathname)) return;

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) { const c = await caches.open(VERSION); c.put(req, res.clone()); }
        return res;
      } catch {
        return (await caches.match(req)) || (await caches.match('/offline.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(async (res) => {
      if (res.ok && res.type === 'basic') { const c = await caches.open(VERSION); c.put(req, res.clone()); }
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});
