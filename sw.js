const CACHE = "namaz-offline-f76bb9962a";
const ASSETS = [
  ".",
  "./index.html",
  "./404.html",
  "./.nojekyll",
  "./_expo/static/js/web/index-f76bb9962a4b7a4c5c7ed2e07849779c.js",
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

self.addEventListener('install', (event) => {
  // skipWaiting: yeni sürüm, açık sekmeler kapanmasını beklemeden hemen devreye
  // girsin. Aksi halde kullanıcı Safari'yi tamamen kapatmadan yeni dağıtımı
  // (ör. bu kamera düzeltmesini) hiç göremez — önceki dağıtımlarda yaşanan sorun.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
      // clients.claim: zaten açık olan sekmeleri de hemen bu sürüme bağla.
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
