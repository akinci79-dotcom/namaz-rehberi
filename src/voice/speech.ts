import { isWebRuntime } from '../pose/publicUrl';
import type { PrayerStep } from '../types/prayer';

const MUTE_KEY = 'namaz.voiceMuted.v1';

export function isVoiceMuted(): boolean {
  return isWebRuntime() && window.localStorage.getItem(MUTE_KEY) === '1';
}

export function setVoiceMuted(muted: boolean): void {
  if (!isWebRuntime()) {
    return;
  }
  window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
}

export function speechSupported(): boolean {
  return isWebRuntime() && 'speechSynthesis' in window;
}

function pickTurkishVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith('tr')) ??
    voices.find((voice) => voice.lang.toLowerCase().includes('tr')) ??
    null
  );
}

/** iOS Safari konuşmayı yalnızca kullanıcı jestinden sonra açar. */
export function unlockSpeech(): void {
  if (!speechSupported()) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0.01;
    warm.rate = 1;
    warm.lang = 'tr-TR';
    window.speechSynthesis.speak(warm);
    window.speechSynthesis.cancel();
  } catch {
    // sessiz
  }
}

export function speakCue(text: string): void {
  if (!speechSupported() || isVoiceMuted() || !text.trim()) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 0.88;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voice = pickTurkishVoice();
    if (voice) {
      utterance.voice = voice;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // konuşma yoksa namaz devam eder
  }
}

/** Adım ileri gidince: önceki adım 2. secdeyse biten rekâtın sayısı. */
export function cueAfterLeavingStep(left: PrayerStep | undefined, advanced: boolean): string | null {
  if (!advanced || left?.kind !== 'secde2') {
    return null;
  }
  return rakahNumberWord(left.rakah);
}

/** Tamamlanan rekât sayısı — yalnızca 2. secdeden çıkışta söylenir. */
export function rakahNumberWord(rakah: number): string | null {
  switch (rakah) {
    case 1:
      return 'bir';
    case 2:
      return 'iki';
    case 3:
      return 'üç';
    case 4:
      return 'dört';
    default:
      return null;
  }
}

/**
 * Varsayılan kapalı: rükû / kalk / secde geçiş sözleri.
 * Açılırsa adım girişinde söylenir; rekât sayısı ayrıdır.
 */
export const VERBOSE_TRANSITION_CUES = false;

export function transitionCueForStepKind(kind: string): string | null {
  if (!VERBOSE_TRANSITION_CUES) {
    return null;
  }
  switch (kind) {
    case 'ruku':
      return 'rükû';
    case 'kalkis':
      return 'kalk';
    case 'secde1':
    case 'secde2':
      return 'secde';
    default:
      return null;
  }
}
