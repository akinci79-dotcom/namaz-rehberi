import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const indexPath = join(dist, 'index.html');

if (!existsSync(indexPath)) {
  throw new Error('dist/index.html yok. Önce: npx expo export -p web');
}

let html = readFileSync(indexPath, 'utf8');

const extras = [
  '<meta name="theme-color" content="#0C100E" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="apple-mobile-web-app-title" content="Namaz Rehberi" />',
  '<link rel="manifest" href="./manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="./apple-touch-icon.png" />',
];

if (!html.includes('apple-mobile-web-app-capable')) {
  html = html.replace('</head>', `    ${extras.join('\n    ')}\n  </head>`);
}

html = html.replace(
  /content="width=device-width, initial-scale=1, shrink-to-fit=no"/,
  'content="width=device-width, initial-scale=1, viewport-fit=cover"',
);

html = html.replaceAll('href="/favicon.ico"', 'href="./favicon.ico"');
html = html.replaceAll('src="/_expo/', 'src="./_expo/');

if (!html.includes('offline.js')) {
  html = html.replace('</body>', '  <script src="./offline.js" defer></script>\n</body>');
}

const iconSrc = join(process.cwd(), 'assets', 'icon.png');
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, join(dist, 'apple-touch-icon.png'));
}

const publicDir = join(process.cwd(), 'public');
for (const name of ['manifest.webmanifest', 'apple-touch-icon.png']) {
  const src = join(publicDir, name);
  if (existsSync(src)) {
    copyFileSync(src, join(dist, name));
  }
}

const modelsSrc = join(publicDir, 'models');
if (existsSync(modelsSrc)) {
  cpSync(modelsSrc, join(dist, 'models'), { recursive: true });
}

const bundleSrc = join(publicDir, 'mediapipe', 'vision_bundle.mjs');
mkdirSync(join(dist, 'mediapipe'), { recursive: true });
if (existsSync(bundleSrc)) {
  copyFileSync(bundleSrc, join(dist, 'mediapipe', 'vision_bundle.mjs'));
}

const wasmSrc = join(process.cwd(), 'node_modules/@mediapipe/tasks-vision/wasm');
if (existsSync(wasmSrc)) {
  cpSync(wasmSrc, join(dist, 'mediapipe', 'wasm'), { recursive: true });
}

const offlineSrc = join(publicDir, 'offline.js');
if (existsSync(offlineSrc)) {
  copyFileSync(offlineSrc, join(dist, 'offline.js'));
}

writeFileSync(indexPath, html);
writeFileSync(join(dist, '404.html'), html);
writeFileSync(join(dist, '.nojekyll'), '');
writeServiceWorker(dist);

console.log('Web dist iOS/Safari için hazırlandı.');

function writeServiceWorker(root) {
  const assets = ['.', './index.html', './404.html', ...listRelFiles(root)]
    .filter((path) => path !== './sw.js')
    .filter((path, index, all) => all.indexOf(path) === index);

  const body = `const CACHE = 'namaz-offline-v3';
const ASSETS = ${JSON.stringify(assets, null, 2)};

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
`;
  writeFileSync(join(root, 'sw.js'), body);
}

function listRelFiles(root, prefix = '.') {
  const names = readdirSync(root);
  const out = [];
  for (const name of names) {
    if (name === 'sw.js') {
      continue;
    }
    const full = join(root, name);
    const rel = `${prefix}/${name}`;
    if (statSync(full).isDirectory()) {
      out.push(...listRelFiles(full, rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}
