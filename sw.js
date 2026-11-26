const CACHE = 'oma-v9';
const FILES = ['./', 'index.html', 'manifest.json', 'icon.svg', 'style.css',
  'app.js', 'router.js', 'utils.js', 'database.js', 'orders.js', 'quick.js', 'tables.js', 'plan.js', 'table.js', 'shifts.js', 'shiftview.js', 'stats.js', 'backup.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => clients.claim())));
// Сначала сеть (всегда свежая версия), без сети — из кэша
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
