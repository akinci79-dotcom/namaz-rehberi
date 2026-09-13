import type { PrayerStep, StepKind } from '../types/prayer';
import type { BodyPose } from './types';

/** Adımın beklenen gövde duruşu. Aynı duruştaki adımlar kamerayla atlanmaz. */
export function poseForStepKind(kind: StepKind): BodyPose {
  switch (kind) {
    case 'niyet':
    case 'iftitah':
    case 'kiyam':
    case 'kunut':
    case 'kavme':
    case 'kalkis':
      return 'kiyam';
    case 'ruku':
      return 'ruku';
    case 'secde1':
    case 'secde2':
      return 'secde';
    case 'celse':
    case 'tahiyyat':
    case 'selam':
      return 'oturus';
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

/** Aynı duruştaki sonraki adıma geçmeden önce bekleme (niyet → tekbir → kıyam). */
export function samePoseDwellMs(step: PrayerStep): number {
  switch (step.kind) {
    case 'niyet':
    case 'iftitah':
      return 4000;
    case 'kalkis':
    case 'kavme':
      return 3500;
    case 'tahiyyat':
      return step.sitting === 'last' ? 12000 : 8000;
    case 'selam':
      return 4500;
    case 'kunut':
      return 12000;
    case 'kiyam':
      return step.rakah === 1 ? 8000 : 6000;
    default:
      return 4000;
  }
}

/**
 * Secde / celse: duruş görülmeden yedek süreyle atlama.
 * Aksi halde ayakta titreme 2. secdeyi “bitmiş” saydırır.
 */
export function requireSeenPoseBeforeAdvance(kind: StepKind): boolean {
  return kind === 'secde1' || kind === 'secde2' || kind === 'celse' || kind === 'ruku';
}

export function canAdvanceOnDetectedPose(input: {
  seenCurrentPose: boolean;
  detected: BodyPose;
  nextPose: BodyPose | null;
}): boolean {
  return (
    input.seenCurrentPose &&
    input.nextPose != null &&
    input.detected !== 'unknown' &&
    input.detected === input.nextPose
  );
}

/** Duruş değişimi gelmezse takılmamak için yedek süre (kıraat bitene kadar uzun). */
export function poseWaitFallbackMs(step: PrayerStep): number {
  switch (step.kind) {
    case 'kiyam':
      return step.rakah === 1 ? 28000 : 20000;
    case 'kunut':
      return 16000;
    case 'tahiyyat':
      return step.sitting === 'last' ? 14000 : 10000;
    case 'ruku':
      return 8000;
    case 'secde1':
    case 'secde2':
      return 7000;
    case 'celse':
    case 'kavme':
    case 'kalkis':
      return 8000;
    default:
      return 10000;
  }
}
