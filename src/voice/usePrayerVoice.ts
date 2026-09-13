import { useEffect, useRef } from 'react';

import type { PrayerId, PrayerStep } from '../types/prayer';
import { completedRakahAnnouncements } from './rakahComplete';
import { speakCue } from './speech';

/**
 * Yalnızca 2. secde adımı bırakılınca (kalkış / ilk veya son oturuş) bir kez
 * rekât sayısı. Duruş algısı veya rükûdan doğrulma konuşturmaz.
 */
export function usePrayerVoice(
  prayerId: PrayerId,
  steps: readonly PrayerStep[],
  stepIndex: number,
  enabled: boolean,
): void {
  const prevIndex = useRef(stepIndex);
  const announced = useRef(new Set<number>());

  useEffect(() => {
    prevIndex.current = 0;
    announced.current = new Set();
  }, [prayerId]);

  useEffect(() => {
    const from = prevIndex.current;
    prevIndex.current = stepIndex;

    if (!enabled || stepIndex <= from) {
      return;
    }

    const cues = completedRakahAnnouncements(steps, from, stepIndex, announced.current);
    for (const cue of cues) {
      announced.current.add(cue.rakah);
      speakCue(cue.word);
    }
  }, [enabled, stepIndex, steps]);
}
