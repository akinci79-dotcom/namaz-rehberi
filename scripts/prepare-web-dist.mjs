import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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

writeFileSync(indexPath, html);
writeFileSync(join(dist, '404.html'), html);
writeFileSync(join(dist, '.nojekyll'), '');

const iconSrc = join(process.cwd(), 'assets', 'icon.png');
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, join(dist, 'apple-touch-icon.png'));
}

console.log('Web dist iOS/Safari için hazırlandı.');
