/**
 * Namaz sırasında telefona bakılamaz, dolayısıyla kamerada gerçekte ne
 * olduğunu ANLIK gözlemlemek imkansız. Bu modül, kamera açıkken olan biteni
 * (adım, algılanan poz, çerçeveleme, ilerleme) arka planda sessizce kaydeder;
 * namaz bitince kullanıcı bu kaydı ekranda görüp bize aktarabilir — hiçbir ek
 * eylem/gözlem gerektirmeden gerçek teşhis verisi.
 */

const KEY = 'namaz.sessionLog.v1';
const MAX_ENTRIES = 900;

let entries: string[] = [];
let startedAt = 0;

function persist(): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // localStorage dolu/erişilemez olabilir — kayıt yine de bellekte kalır.
  }
}

/** Kamera her açıldığında (yeni namaz denemesi) çağrılır — eski kayıt üzerine yazılır. */
export function resetSessionLog(): void {
  entries = [];
  startedAt = Date.now();
  persist();
}

export function logSessionEvent(ev: string): void {
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  entries.push(`${elapsedSec}s ${ev}`);
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }
  persist();
}

function load(): string[] {
  if (entries.length > 0) {
    return entries;
  }
  try {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasSessionLog(): boolean {
  return load().length > 0;
}

export function getSessionLogText(): string {
  const lines = load();
  if (lines.length === 0) {
    return 'Henüz kamera oturumu kaydı yok.';
  }
  return lines.join('\n');
}

export function clearSessionLog(): void {
  entries = [];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KEY);
    }
  } catch {
    // yoksay
  }
}
