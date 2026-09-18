import {
  accumulateHold, expectedPoseForTransition, tickCameraAdvance,
  type CameraStepRef, type CameraTickResult,
} from './cameraAdvance';
import type { BodyPose } from './types';

/** Gerçek kamera ve zaman çizelgesi testleri aynı ilerleme durumunu kullanır. */
export function createCameraProgress(steps: readonly CameraStepRef[]) {
  let stepIndex = -1;
  let hold = 0;
  let confirmed = false;
  let lastAt: number | null = null;
  let unknownSince: number | null = null;

  return {
    reset() {
      stepIndex = -1;
      hold = 0;
      confirmed = false;
      lastAt = null;
      unknownSince = null;
    },
    update(index: number, detected: BodyPose, now: number, modelReady: boolean): CameraTickResult {
      if (index !== stepIndex) {
        stepIndex = index;
        hold = 0;
        confirmed = false;
        lastAt = null;
        unknownSince = null;
      }
      const gap = lastAt === null ? 0 : Math.max(0, now - lastAt);
      // Donmuş görüntü / model hatası sonrası eski süreyle ilerleme yapılmaz.
      if (gap > 500 || !modelReady) hold = 0;
      const dt = gap > 500 ? 0 : Math.min(gap, 250);
      lastAt = now;
      if (detected === 'unknown') {
        unknownSince ??= now;
        // Belirsiz/eksik kare, eski birikimle yeni hareketi onaylamasın.
        hold = 0;
      } else {
        unknownSince = null;
      }
      hold = accumulateHold(hold, dt, detected, expectedPoseForTransition(steps, index, confirmed));
      const result = tickCameraAdvance({ steps, index, detected, holdExpectedMs: hold,
        currentConfirmed: confirmed, modelReady });
      if (result.commitCurrent) {
        confirmed = true;
        hold = 0;
      }
      if (result.advance && result.targetIndex !== null) {
        stepIndex = result.targetIndex;
        confirmed = result.targetConfirmed;
        hold = 0;
      }
      return result;
    },
  };
}
