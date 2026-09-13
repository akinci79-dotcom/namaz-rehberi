import { useEffect, useRef } from 'react';

import type { PrayerStep } from '../types/prayer';
import { cueAfterLeavingStep, speakCue, transitionCueForStepKind } from './speech';

/**
 * Rekât bitince (2. secdeden kalkış / son oturuşa geçiş) bir kez sayı söyler.
 * Secde girişinde veya duruş tutulurken konuşmaz. Geri gidince tekrar etmez.
 */
export function usePrayerVoice(steps: readonly PrayerStep[], stepIndex: number, enabled: boolean): void {
  const prevIndex = useRef(stepIndex);
  const lastAnnouncedRakah = useRef<number | null>(null);

  useEffect(() => {
    prevIndex.current = 0;
    lastAnnouncedRakah.current = null;
  }, [steps]);

  useEffect(() => {
    const previous = prevIndex.current;
    prevIndex.current = stepIndex;

    if (!enabled) {
      return;
    }
    if (stepIndex <= previous) {
      return;
    }

    const left = steps[previous];
    const word = cueAfterLeavingStep(left, true);
    if (word && left && lastAnnouncedRakah.current !== left.rakah) {
      lastAnnouncedRakah.current = left.rakah;
      speakCue(word);
      return;
    }

    const entered = steps[stepIndex];
    const extra = entered ? transitionCueForStepKind(entered.kind) : null;
    if (extra) {
      speakCue(extra);
    }
  }, [enabled, stepIndex, steps]);
}
