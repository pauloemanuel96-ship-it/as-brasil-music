/* Service worker: deixa o site instalável e abre a casca do app mesmo com conexão ruim.
   Áudio, capas e API sempre vão direto para a rede. */
const VERSION = 'asbm-v1';
const SHELL = ['./', 'index.html', 'assets/style.css?v=1', 'assets/app.js?v=1', 'assets/icon.svg', 'assets/icon-192.png', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/\/(api|musicas|capas)\//.test(url.pathname) || e.request.headers.has('range')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
