const CACHE = "namaz-offline-47f5d4e359";
const ASSETS = [
  ".",
  "./index.html",
  "./404.html",
  "./.nojekyll",
  "./_expo/static/js/web/index-47f5d4e359c2fc9222e1d4a141afcfcd.js",
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

function isShellRequest(request, url) {
  return request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/404.html');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isShellRequest(event.request, url)) {
    // ÖNEMLİ: index.html İÇİNDE hangi JS paketinin (içerik hash'i) yükleneceği
    // yazılı. Bunu cache-first sunmak, ağ erişilebilir olsa bile kullanıcıyı
    // yeni bir dağıtım gönderildikten SONRA da sonsuza dek eski kabukta (ve
    // dolayısıyla eski koddaki hatalarla) takılı bırakabilir — gerçek kullanıcı
    // testlerinde tam olarak bu şüphelenildi (art arda dağıtımlar hiçbir fark
    // yaratmadı). Bu yüzden kabuk için ÖNCE AĞ, yalnızca çevrimdışıyken önbellek.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('./index.html'))),
    );
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
