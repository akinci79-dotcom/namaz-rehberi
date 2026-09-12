import type { StepKind } from '../types/prayer';
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
