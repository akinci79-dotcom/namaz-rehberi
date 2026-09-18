const CACHE = "namaz-offline-8ebe6fd354643ed1";
const ASSETS = [
  ".",
  "./index.html",
  "./404.html",
  "./offline.js?v=652b81c80497",
  "./_expo/static/js/web/index-9785a370bc0f3e0a8fc1f2668600103f.js",
  "./apple-touch-icon.png",
  "./favicon.ico",
  "./manifest.webmanifest",
  "./mediapipe/vision_bundle.mjs",
  "./mediapipe/wasm/vision_wasm_internal.js",
  "./mediapipe/wasm/vision_wasm_internal.wasm",
  "./mediapipe/wasm/vision_wasm_module_internal.js",
  "./mediapipe/wasm/vision_wasm_module_internal.wasm",
  "./mediapipe/wasm/vision_wasm_nosimd_internal.js",
  "./mediapipe/wasm/vision_wasm_nosimd_internal.wasm",
  "./metadata.json",
  "./models/pose_landmarker_lite.task",
  "./offline.js"
];
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
