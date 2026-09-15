import { useEffect, useRef } from 'react';

import { speakCue } from '../voice/speech';
import type { PoseAssistState } from './usePoseAssist';

const FRAMING_REPEAT_MS = 15000;
/** Kare gürültüsü/anlık titreme için: çerçeveleme sorunu bu kadar sürerse konuş. */
const FRAMING_DEBOUNCE_MS = 2500;

type FramingKind = 'body' | 'close' | 'legs';

const FRAMING_MESSAGE: Record<FramingKind, string> = {
  body: 'Vücut görünmüyor. Telefonu uzaklaştırın.',
  close: 'Yüz çok yakın. Telefonu uzaklaştırın.',
  legs: 'Dizler görünmüyor. Telefonu geriye çekin.',
};

/**
 * ÖNEMLİ TASARIM KURALI: namaz sırasında ses SADECE 2. secdeden sonra biten
 * rekâtın sayısını söylemeli (bkz. usePrayerVoice) — kullanıcının asıl isteği
 * budur, başka hiçbir sesli yönlendirme istenmemiştir. Bu hook bir ara
 * denemede "şimdi rükûya eğilin", "şimdi oturun" gibi her poz geçişini de
 * sesli okuyordu; gerçek namaz testinde bu YANLIŞ/GEREKSİZ ve RAHATSIZ EDİCİ
 * bulundu (adımlar hızlı aktığında art arda anlamsız komutlar okunuyordu).
 * O kısım tamamen kaldırıldı. Yalnızca gerçekten kritik, namazı imkansız
 * kılacak durumlar sesli kalıyor: kamera/model çalışmıyor ya da çerçeveleme
 * o kadar bozuk ki (vücut yok / çok yakın / dizler yok) algı hiç çalışamaz.
 */
export function usePoseVoiceCues(enabled: boolean, assist: PoseAssistState): void {
  const activeFramingKind = useRef<FramingKind | null>(null);
  const lastFramingWarnAt = useRef(0);
  const framingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const spokenBrokenStatus = useRef(false);

  // Model yüklenemedi / kamera reddedildi gibi durumlar da eskiden sadece
  // ekranda yazıyordu. Namaz sırasında bu, "kamera çalışıyor" sanıp aslında
  // en baştan hiç çalışmadığı anlamına gelebilirdi — bir kez sesli söylüyoruz.
  useEffect(() => {
    if (!enabled) {
      spokenBrokenStatus.current = false;
      return;
    }
    const broken =
      assist.status === 'degraded' ||
      assist.status === 'error' ||
      assist.status === 'denied' ||
      assist.status === 'unsupported';
    if (broken && !spokenBrokenStatus.current) {
      spokenBrokenStatus.current = true;
      speakCue(assist.statusText);
    }
    if (assist.status === 'running') {
      spokenBrokenStatus.current = false;
    }
  }, [enabled, assist.status, assist.statusText]);

  useEffect(() => {
    if (!enabled || assist.status !== 'running') {
      activeFramingKind.current = null;
      clearTimeout(framingTimer.current);
      return;
    }

    const framingKind: FramingKind | null = assist.bodyMissing
      ? 'body'
      : assist.framingClose
        ? 'close'
        : assist.legsMissing
          ? 'legs'
          : null;

    if (!framingKind) {
      activeFramingKind.current = null;
      clearTimeout(framingTimer.current);
      return;
    }

    if (framingKind !== activeFramingKind.current) {
      activeFramingKind.current = framingKind;
      clearTimeout(framingTimer.current);
      // Anlık kare titremesiyle yanlış alarm vermemek için biraz bekle.
      framingTimer.current = setTimeout(() => {
        lastFramingWarnAt.current = Date.now();
        speakCue(FRAMING_MESSAGE[framingKind]);
      }, FRAMING_DEBOUNCE_MS);
      return;
    }

    const now = Date.now();
    if (now - lastFramingWarnAt.current > FRAMING_REPEAT_MS) {
      lastFramingWarnAt.current = now;
      speakCue(FRAMING_MESSAGE[framingKind]);
    }
  }, [enabled, assist.status, assist.bodyMissing, assist.framingClose, assist.legsMissing]);

  useEffect(() => {
    return () => clearTimeout(framingTimer.current);
  }, []);
}
