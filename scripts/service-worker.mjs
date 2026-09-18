/** Üretilen çalışan, testlerde de doğrudan yürütülür. */
export function serviceWorkerSource(cacheName, assets) {
  return `const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(assets, null, 2)};
const PREFIX = 'namaz-offline-';

self.addEventListener('install', (event) => {
  // Tek dosya bile eksikse kurulumu reddet; çalışan eski sürümü koru.
  // skipWaiting yok: açık bir namazın ortasında sürüm değiştirilmez.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  // Diğer GitHub Pages uygulamalarının aynı origin'deki önbelleklerine dokunma.
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE)
      .map((key) => caches.delete(key)),
  )));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const shell = event.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') || url.pathname.endsWith('/404.html');
  const remember = (response) => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {}));
    }
    return response;
  };
  if (shell) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request);
        if (response.ok) return remember(response);
        return await cache.match(event.request) || await cache.match('./index.html') || response;
      } catch {
        return await cache.match(event.request) || await cache.match('./index.html') || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      return remember(await fetch(event.request));
    } catch {
      // JS/model/WASM isteğine HTML dönmek gerçek hatayı gizler ve modeli bozar.
      return Response.error();
    }
  })());
});
`;
}
