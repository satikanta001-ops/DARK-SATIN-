/* DARK-SATIN service worker: lets the app open instantly and offline.
   Your data itself is synced by Firebase, not by this file. */
const VERSION = 'ds-v3';
const SHELL = ['./', './index.html', './manifest.json', './logo.svg', './logo-192.png', './logo-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); no(e); }); });

// Page: try the network first (so updates arrive), fall back to the saved copy.
async function page(req){
  const cache = await caches.open(VERSION);
  try {
    const res = await withTimeout(fetch(req), 4000);
    if (res.ok) cache.put('./index.html', res.clone());
    return res;
  } catch (_) {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}
// Everything else we handle: use the saved copy right away, refresh it in the background.
async function fresh(req, ev){
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; });
  if (hit) { ev.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (req.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')) e.respondWith(page(req));
    else if (!u.pathname.endsWith('sw.js')) e.respondWith(fresh(req, e));
    return;
  }
  // Firebase SDK code and Google Fonts. Firestore and login traffic is never touched.
  if ((u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(fresh(req, e));
  }
});
