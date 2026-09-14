const CACHE = 'namaz-offline-v6';
const ASSETS = [
  ".",
  "./index.html",
  "./404.html",
  "./.nojekyll",
  "./_expo/static/js/web/index-92d6e6a6bb3cfa871efc6bc66df45b23.js",
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
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
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
