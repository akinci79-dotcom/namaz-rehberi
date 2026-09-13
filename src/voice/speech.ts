import { isWebRuntime } from '../pose/publicUrl';

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

export function cueForStepKind(kind: string): string | null {
  switch (kind) {
    case 'secde1':
      return 'bir';
    case 'secde2':
      return 'iki';
    case 'ruku':
      return 'rükû';
    case 'kalkis':
      return 'kalk';
    default:
      return null;
  }
}
