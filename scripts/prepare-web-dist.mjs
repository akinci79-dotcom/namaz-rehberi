import { createHash } from 'node:crypto';
import { serviceWorkerSource } from './service-worker.mjs';
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

const offlineVersion = createHash('sha256').update(readFileSync(join(process.cwd(), 'public/offline.js'))).digest('hex').slice(0, 12);
if (!html.includes('offline.js')) {
  html = html.replace('</body>', `  <script src="./offline.js?v=${offlineVersion}" defer></script>\n</body>`);
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
  const assets = ['.', './index.html', './404.html', `./offline.js?v=${offlineVersion}`, ...listRelFiles(root)]
    .filter((path) => path !== './sw.js' && path !== './.nojekyll')
    .filter((path, index, all) => all.indexOf(path) === index);

  // Model, kayıt betiği veya manifest değişince de yeni sürüm oluştur.
  const hash = createHash('sha256');
  hash.update(serviceWorkerSource('', []));
  hash.update(JSON.stringify(assets));
  for (const path of listRelFiles(root).sort()) {
    hash.update(path);
    hash.update(readFileSync(join(root, path)));
  }
  const cacheName = `namaz-offline-${hash.digest('hex').slice(0, 16)}`;
  const body = serviceWorkerSource(cacheName, assets);
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
