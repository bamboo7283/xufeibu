// Offline support.
//
// The app shell (HTML/CSS/JS) is network-first: a reload while online always
// runs the newest code. The old build did the opposite — it served the cached
// copy and only refreshed the cache in the background, so every reload showed
// the *previous* version and a fresh deploy appeared to change nothing.
// Everything else (icons) stays cache-first, since those rarely change.
const CACHE = 'xufeibu-v8';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
const CODE = /\/$|\.html$|\.css$|\.js$|\.webmanifest$/;

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never stores stale files.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isCode = req.mode === 'navigate' || CODE.test(new URL(req.url).pathname);

  e.respondWith(caches.open(CACHE).then(async (cache) => {
    if (isCode) {
      // Network first: show the newest code whenever the network answers.
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const cached = await cache.match(req, { ignoreSearch: true });
        return cached || Response.error();
      }
    }
    // Cache first for static assets, refreshed quietly in the background.
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
