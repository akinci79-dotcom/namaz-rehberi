/** GitHub Pages alt yolunda (`/namaz-rehberi/`) göreli public dosya adresi. */
export function publicAssetUrl(relativePath: string): string {
  if (typeof window === 'undefined') {
    return relativePath;
  }
  const path = window.location.pathname;
  const dir = path.endsWith('/') ? path : path.replace(/\/[^/]*$/, '/');
  const clean = relativePath.replace(/^\//, '');
  return `${window.location.origin}${dir}${clean}`;
}

export function isWebRuntime(): boolean {
  return typeof document !== 'undefined' && typeof navigator !== 'undefined';
}

export function cameraSupported(): boolean {
  return isWebRuntime() && !!navigator.mediaDevices?.getUserMedia;
}
