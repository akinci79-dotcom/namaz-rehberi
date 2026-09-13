import { useEffect, useRef } from 'react';

import type { PrayerStep } from '../types/prayer';
import { poseForStepKind, poseWaitFallbackMs, samePoseDwellMs } from './stepPose';

export function practiceDelayMs(step: PrayerStep, next: PrayerStep | undefined): number {
  const from = poseForStepKind(step.kind);
  const to = next ? poseForStepKind(next.kind) : null;
  if (!to || from === to) {
    return samePoseDwellMs(step);
  }
  return poseWaitFallbackMs(step);
}

/** Yalnızca kamerasız prova: süreyle ilerler. Kamera açıkken çağrılmaz. */
export function usePracticeTimer(input: {
  enabled: boolean;
  steps: readonly PrayerStep[];
  stepIndex: number;
  onAdvance: () => void;
}): void {
  const onAdvanceRef = useRef(input.onAdvance);
  onAdvanceRef.current = input.onAdvance;

  useEffect(() => {
    if (!input.enabled) {
      return;
    }
    const step = input.steps[input.stepIndex];
    const next = input.steps[input.stepIndex + 1];
    if (!step) {
      return;
    }
    const delay = practiceDelayMs(step, next);
    const timer = setTimeout(() => {
      onAdvanceRef.current();
    }, delay);
    return () => clearTimeout(timer);
  }, [input.enabled, input.stepIndex, input.steps]);
}
