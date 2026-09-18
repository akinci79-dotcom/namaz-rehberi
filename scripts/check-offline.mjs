import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { serviceWorkerSource } from './service-worker.mjs';

const source = serviceWorkerSource('namaz-offline-new', ['./index.html']);
function setup({ failInstall = false, failFetch = false, httpStatus = 200 } = {}) {
  const handlers = {}, deleted = [], saved = [];
  let skipWaiting = 0;
  const cache = {
    addAll: async () => { if (failInstall) throw Error('offline'); },
    match: async request => {
      const url = typeof request === 'string' ? request : request.url;
      return url === './index.html' ? new Response('<html>offline shell</html>') : undefined;
    },
    put: async (request) => { saved.push(request.url); },
  };
  vm.runInNewContext(source, {
    self: { registration: { scope: 'https://example.com/namaz-rehberi/' },
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: () => { skipWaiting++; },
    },
    caches: { open: async () => cache,
      keys: async () => ['namaz-offline-old', 'namaz-offline-new', 'another-app'],
      delete: async key => { deleted.push(key); return true; },
    },
    URL, Response,
    fetch: async () => { if (failFetch) throw Error('offline'); return new Response('network', { status: httpStatus }); },
  });
  return { handlers, deleted, saved, get skipWaiting() { return skipWaiting; } };
}
async function dispatchWait(handler) {
  let result;
  handler({ waitUntil: promise => { result = promise; } });
  return result;
}
async function request(worker, path, mode = 'cors') {
  let result;
  const waits = [];
  worker.handlers.fetch({ request: { method: 'GET', url: `https://example.com${path}`, mode },
    respondWith: promise => { result = promise; }, waitUntil: promise => waits.push(promise) });
  const response = await result;
  await Promise.all(waits);
  return response;
}
const failed = setup({ failInstall: true });
await assert.rejects(dispatchWait(failed.handlers.install), /offline/);
assert.deepEqual(failed.deleted, []);
assert.equal(failed.skipWaiting, 0);
const healthy = setup();
await dispatchWait(healthy.handlers.install);
await dispatchWait(healthy.handlers.activate);
assert.deepEqual(healthy.deleted, ['namaz-offline-old']);
assert.equal(healthy.skipWaiting, 0);
const offline = setup({ failFetch: true });
assert.match(await (await request(offline, '/namaz-rehberi/', 'navigate')).text(), /offline shell/);
assert.equal((await request(offline, '/namaz-rehberi/models/missing.task')).type, 'error');
assert.equal((await request(offline, '/namaz-rehberi/missing.js')).type, 'error');
assert.equal(await request(offline, '/other-site/model.task'), undefined);
const serverError = setup({ httpStatus: 503 });
assert.match(await (await request(serverError, '/namaz-rehberi/', 'navigate')).text(), /offline shell/);
await request(healthy, '/namaz-rehberi/test.js');
assert.deepEqual(healthy.saved, ['https://example.com/namaz-rehberi/test.js']);

// İlk kurulum ve güncelleme olayları açık namazı yenilememeli.
const listeners = {}, documentListeners = {};
let reloads = 0, registrations = 0, updates = 0;
vm.runInNewContext(readFileSync(new URL('../public/offline.js', import.meta.url), 'utf8'), {
  navigator: { serviceWorker: {
    register: async () => { registrations++; return { update: async () => { updates++; } }; },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  } },
  window: { addEventListener: (type, fn) => { listeners[type] = fn; }, location: { reload: () => { reloads++; } } },
  document: { visibilityState: 'visible', addEventListener: (type, fn) => { documentListeners[type] = fn; } },
});
listeners.load();
await new Promise(resolve => setImmediate(resolve));
listeners.controllerchange?.();
documentListeners.visibilitychange();
await new Promise(resolve => setImmediate(resolve));
assert.equal(registrations, 1);
assert.equal(updates, 2);
assert.equal(reloads, 0);
console.log('OK kurulum hatası, kapsamlı önbellek temizliği, çevrimdışı kabuk/model, HTTP 503, oturumda yenilememe');
