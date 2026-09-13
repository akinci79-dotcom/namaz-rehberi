import { classifyPose } from '../src/pose/classifyPose';
import { samePoseDwellMs } from '../src/pose/stepPose';
import type { PoseLandmark } from '../src/pose/types';
import type { PrayerStep } from '../src/types/prayer';
import { cueForStepKind } from '../src/voice/speech';

function body(points: Record<number, [number, number]>): PoseLandmark[] {
  const out: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0,
  }));
  for (const [index, [x, y]] of Object.entries(points)) {
    out[Number(index)] = { x, y, visibility: 0.9 };
  }
  return out;
}

/** MediaPipe: 0 nose, 11/12 shoulder, 23/24 hip, 25/26 knee, 27/28 ankle */
function standing(): PoseLandmark[] {
  return body({
    0: [0.5, 0.12],
    11: [0.38, 0.22],
    12: [0.62, 0.22],
    23: [0.44, 0.48],
    24: [0.56, 0.48],
    25: [0.44, 0.7],
    26: [0.56, 0.7],
    27: [0.44, 0.92],
    28: [0.56, 0.92],
  });
}

function ruku(): PoseLandmark[] {
  return body({
    0: [0.5, 0.4],
    11: [0.38, 0.46],
    12: [0.62, 0.46],
    23: [0.44, 0.5],
    24: [0.56, 0.5],
    25: [0.44, 0.72],
    26: [0.56, 0.72],
    27: [0.44, 0.92],
    28: [0.56, 0.92],
  });
}

function sitting(): PoseLandmark[] {
  return body({
    0: [0.5, 0.28],
    11: [0.38, 0.38],
    12: [0.62, 0.38],
    23: [0.44, 0.64],
    24: [0.56, 0.64],
    25: [0.36, 0.74],
    26: [0.64, 0.74],
    27: [0.44, 0.82],
    28: [0.56, 0.82],
  });
}

function secde(): PoseLandmark[] {
  return body({
    0: [0.5, 0.66],
    11: [0.38, 0.7],
    12: [0.62, 0.7],
    23: [0.44, 0.76],
    24: [0.56, 0.76],
    25: [0.4, 0.82],
    26: [0.6, 0.82],
    27: [0.44, 0.88],
    28: [0.56, 0.88],
  });
}

function closeUp(): PoseLandmark[] {
  return body({
    0: [0.5, 0.28],
    11: [0.22, 0.48],
    12: [0.78, 0.48],
  });
}

const cases: Array<[string, PoseLandmark[], string]> = [
  ['standing', standing(), 'kiyam'],
  ['ruku', ruku(), 'ruku'],
  ['sitting', sitting(), 'oturus'],
  ['secde', secde(), 'secde'],
  ['closeUp', closeUp(), 'kiyam'],
];

let failed = 0;
for (const [name, landmarks, expected] of cases) {
  const guess = classifyPose(landmarks);
  const ok = guess.pose === expected;
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}: ${guess.pose} (${guess.confidence.toFixed(2)}) expected ${expected}`);
  if (!ok) {
    failed += 1;
  }
}

const niyet = { kind: 'niyet', sitting: undefined, rakah: 1 } as PrayerStep;
const lastSit = { kind: 'tahiyyat', sitting: 'last', rakah: 2 } as PrayerStep;
if (samePoseDwellMs(niyet) < 3000) {
  console.log('FAIL niyet dwell too short');
  failed += 1;
}
if (samePoseDwellMs(lastSit) < 10000) {
  console.log('FAIL last tahiyyat dwell too short');
  failed += 1;
}
if (cueForStepKind('secde1') !== 'bir' || cueForStepKind('secde2') !== 'iki') {
  console.log('FAIL secde voice cues');
  failed += 1;
}

if (failed) {
  process.exit(1);
}
console.log('Duruş sınıflandırıcı sentetik örnekleri geçti.');
