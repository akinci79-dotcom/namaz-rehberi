import { useEffect, useRef } from 'react';

import type { StepKind } from '../types/prayer';
import { speakCue } from '../voice/speech';
import { requireSeenPoseBeforeAdvance } from './stepPose';
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
 * Namaz sırasında telefona bakılamaz. Kameranın "Şimdi rükûya eğilin",
 * "Dizler görünmüyor, telefonu geriye çekin" gibi TÜM geri bildirimi eskiden
 * yalnızca ekranda metin olarak vardı (assist.cue / statusText) — hiç
 * söylenmiyordu. Kullanıcı bunu göremediği için kamera "sessizce" çalışmıyor
 * gibi görünüyordu; aslında çoğu zaman durumu biliyordu, sadece söylemiyordu.
 * Bu hook aynı ipuçlarını sesli de veriyor.
 */
export function usePoseVoiceCues(
  enabled: boolean,
  assist: PoseAssistState,
  currentStepKind: StepKind | undefined,
): void {
  const lastCue = useRef<string | null>(null);
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
      lastCue.current = null;
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
      // "kıyam" gibi çok adımlı/uzun duruşlarda cue, adımın en başından beri
      // ileriye bakıp "şimdi rükûya eğilin" diyebilir — bu adım henüz kıraat
      // aşamasındayken YANLIŞ ve KAFA KARIŞTIRICI olur. Sadece gerçekten anlık
      // bir geçiş beklenen adımlarda (rükû, secde1/2, celse) sesli okuyoruz.
      const immediate = currentStepKind ? requireSeenPoseBeforeAdvance(currentStepKind) : false;
      if (immediate && assist.cue && assist.cue !== lastCue.current) {
        lastCue.current = assist.cue;
        speakCue(assist.cue);
      } else if (!assist.cue || !immediate) {
        lastCue.current = null;
      }
      return;
    }

    // Çerçeveleme sorunu varken poz ipucu anlamsız (zaten yanlış kadraj) — bir
    // sonraki doğru çerçevelemede aynı pozu tekrar duyurabilmek için sıfırla.
    lastCue.current = null;

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
  }, [
    enabled,
    assist.status,
    assist.cue,
    assist.bodyMissing,
    assist.framingClose,
    assist.legsMissing,
    currentStepKind,
  ]);

  useEffect(() => {
    return () => clearTimeout(framingTimer.current);
  }, []);
}
