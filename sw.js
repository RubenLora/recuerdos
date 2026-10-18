// Offline support: network first (so new photos appear), cache as fallback.
// Every cache operation is optional: if storage fails, the game still loads from the network.
// Photos are stored encrypted, so the cache never holds a readable picture.
const CACHE = 'recuerdos-v11';
const CORE = ['./', './index.html', './game.js', './config.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .catch(() => {})
    .then(() => self.clients.claim()));
});

async function fromCache(req) {
  try { return await caches.match(req, { ignoreSearch: true }); } catch (e) { return undefined; }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    // 'no-cache' = always ask the server whether the file changed (cheap: "not modified"
    // answers are tiny), so an update shows up the next time the game opens online.
    const net = fetch(req, { cache: 'no-cache' });
    // Slow connection: after 4 s use the cached copy if there is one, otherwise keep waiting.
    const first = await Promise.race([net.catch(() => 'error'), new Promise(r => setTimeout(r, 4000, 'slow'))]);
    if (first instanceof Response) {
      if (first.ok) {
        const copy = first.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return first;
    }
    const hit = await fromCache(req);
    if (hit) return hit;
    return net;
  })());
});
