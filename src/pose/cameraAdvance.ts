import type { StepKind } from '../types/prayer';

import { poseForStepKind, requireSeenPoseBeforeAdvance } from './stepPose';
import type { BodyPose } from './types';
import { POSE_WAIT_TR } from './types';

/** Sonraki duruş bu kadar tutulunca kamera ilerletir. Saat ile adım atılmaz. */
export const CAMERA_HOLD_MS = 850;
export const CAMERA_SEEN_MS = 400;

export type AdvanceHint = 'camera' | 'manual' | 'none';

export interface CameraTickInput {
  currentKind: StepKind;
  nextKind: StepKind | undefined;
  detected: BodyPose;
  seenCurrentMs: number;
  matchingNextMs: number;
  modelReady: boolean;
}

export interface CameraTickResult {
  advance: boolean;
  hint: AdvanceHint;
  seenCurrent: boolean;
  currentPose: BodyPose;
  expectedPose: BodyPose | null;
  waitingFor: BodyPose | null;
  secde2Confirmed: boolean;
  samePose: boolean;
}

export function tickCameraAdvance(input: CameraTickInput): CameraTickResult {
  const currentPose = poseForStepKind(input.currentKind);
  const nextPose = input.nextKind ? poseForStepKind(input.nextKind) : null;
  const samePose = !nextPose || nextPose === currentPose;
  const seenCurrent = input.seenCurrentMs >= CAMERA_SEEN_MS;
  const waitingFor = !samePose && nextPose ? nextPose : null;
  const expectedPose = waitingFor ?? currentPose;
  const secde2Confirmed = input.currentKind === 'secde2' && seenCurrent;
  const mustSeeCurrent = requireSeenPoseBeforeAdvance(input.currentKind);

  if (!input.modelReady) {
    return {
      advance: false,
      hint: 'manual',
      seenCurrent,
      currentPose,
      expectedPose,
      waitingFor,
      secde2Confirmed,
      samePose,
    };
  }

  if (!input.nextKind || samePose) {
    return {
      advance: false,
      hint: 'manual',
      seenCurrent,
      currentPose,
      expectedPose,
      waitingFor: null,
      secde2Confirmed,
      samePose: true,
    };
  }

  if (mustSeeCurrent && !seenCurrent) {
    return {
      advance: false,
      hint: 'none',
      seenCurrent,
      currentPose,
      expectedPose,
      waitingFor,
      secde2Confirmed,
      samePose,
    };
  }

  if (input.detected === nextPose && input.matchingNextMs >= CAMERA_HOLD_MS) {
    return {
      advance: true,
      hint: 'camera',
      seenCurrent,
      currentPose,
      expectedPose,
      waitingFor,
      secde2Confirmed,
      samePose,
    };
  }

  if (input.detected === nextPose) {
    return {
      advance: false,
      hint: 'camera',
      seenCurrent,
      currentPose,
      expectedPose,
      waitingFor,
      secde2Confirmed,
      samePose,
    };
  }

  return {
    advance: false,
    hint: 'none',
    seenCurrent,
    currentPose,
    expectedPose,
    waitingFor,
    secde2Confirmed,
    samePose,
  };
}

export function cameraStatusText(input: {
  framingClose: boolean;
  bodyMissing: boolean;
  detected: BodyPose;
  tick: CameraTickResult;
}): string {
  if (input.bodyMissing) {
    return `Vücut görünmüyor — telefonu uzaklaştırın. Algı: ${POSE_WAIT_TR[input.detected]}`;
  }
  if (input.framingClose) {
    return `Yüz çok yakın — gövde kadraja girsin. Algı: ${POSE_WAIT_TR[input.detected]}`;
  }

  if (input.tick.secde2Confirmed) {
    return '2. secde görüldü — rekat sayılacak';
  }

  const parts: string[] = [];
  if (input.tick.waitingFor) {
    parts.push(`Bekleniyor: ${POSE_WAIT_TR[input.tick.waitingFor]}`);
  } else if (input.tick.samePose) {
    parts.push('Aynı duruş — Sonraki ile geçin');
  }
  parts.push(`Algı: ${POSE_WAIT_TR[input.detected]}`);
  return parts.join(' · ');
}

export function cameraDebugLine(detected: BodyPose, tick: CameraTickResult): string {
  const expected = tick.expectedPose ?? 'none';
  return `${detected} → ${expected} · advance: ${tick.hint}`;
}

/** Kamera açıkken duruş değişmezse adım artmamalı (süre yok). */
export function cameraIdleWouldAdvance(
  input: Omit<CameraTickInput, 'seenCurrentMs' | 'matchingNextMs'>,
  durationMs: number,
  stepMs = 50,
): boolean {
  let seen = 0;
  let match = 0;
  const from = poseForStepKind(input.currentKind);
  const to = input.nextKind ? poseForStepKind(input.nextKind) : null;
  for (let t = 0; t <= durationMs; t += stepMs) {
    if (input.detected === from) {
      seen += stepMs;
    }
    if (to && input.detected === to) {
      match += stepMs;
    } else {
      match = 0;
    }
    const tick = tickCameraAdvance({
      ...input,
      seenCurrentMs: seen,
      matchingNextMs: match,
    });
    if (tick.advance) {
      return true;
    }
  }
  return false;
}
