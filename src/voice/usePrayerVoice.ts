import { useEffect, useRef } from 'react';

import type { PrayerStep } from '../types/prayer';
import { cueForStepKind, speakCue } from './speech';

/** Adıma ilk girildiğinde bir kez konuşur; duruş tutulurken tekrar etmez. */
export function usePrayerVoice(steps: readonly PrayerStep[], stepIndex: number, enabled: boolean): void {
  const lastSpokenId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const step = steps[stepIndex];
    if (!step || lastSpokenId.current === step.id) {
      return;
    }
    lastSpokenId.current = step.id;
    const cue = cueForStepKind(step.kind);
    if (cue) {
      speakCue(cue);
    }
  }, [enabled, stepIndex, steps]);

  useEffect(() => {
    lastSpokenId.current = null;
  }, [steps]);
}
