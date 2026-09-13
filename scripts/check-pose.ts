import { classifyPose } from '../src/pose/classifyPose';
import { samePoseDwellMs } from '../src/pose/stepPose';
import type { PoseLandmark } from '../src/pose/types';
import type { PrayerStep } from '../src/types/prayer';
import { getPrayerSteps, PRAYERS } from '../src/data';
import { canAdvanceOnDetectedPose, requireSeenPoseBeforeAdvance } from '../src/pose/stepPose';
import { completedRakahAnnouncements } from '../src/voice/rakahComplete';
import { rakahNumberWord, transitionCueForStepKind } from '../src/voice/speech';

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
if (rakahNumberWord(1) !== 'bir' || rakahNumberWord(2) !== 'iki' || rakahNumberWord(3) !== 'üç' || rakahNumberWord(4) !== 'dört') {
  console.log('FAIL rakah number words');
  failed += 1;
}
if (transitionCueForStepKind('secde1') || transitionCueForStepKind('ruku') || transitionCueForStepKind('kalkis')) {
  console.log('FAIL transition cues must be off by default');
  failed += 1;
}

function spokenOnAdvance(
  steps: ReturnType<typeof getPrayerSteps>,
  from: number,
  to: number,
  already: ReadonlySet<number> = new Set(),
): string[] {
  return completedRakahAnnouncements(steps, from, to, already).map((item) => item.word);
}

for (const prayer of PRAYERS) {
  const steps = getPrayerSteps(prayer.id);
  const spoken: string[] = [];
  const already = new Set<number>();
  for (let i = 1; i < steps.length; i += 1) {
    const cues = completedRakahAnnouncements(steps, i - 1, i, already);
    for (const cue of cues) {
      already.add(cue.rakah);
      spoken.push(cue.word);
    }
    if (spokenOnAdvance(steps, i, i).length) {
      console.log(`FAIL ${prayer.id} spoke while holding pose`);
      failed += 1;
    }
  }
  const expected = Array.from({ length: prayer.rakahCount }, (_, n) => rakahNumberWord(n + 1));
  if (spoken.join(',') !== expected.join(',')) {
    console.log(`FAIL ${prayer.id} voice ${spoken.join(',')} !== ${expected.join(',')}`);
    failed += 1;
  }

  const ruku = steps.findIndex((step) => step.kind === 'ruku');
  const kavme = steps.findIndex((step) => step.kind === 'kavme');
  const secde1 = steps.findIndex((step) => step.kind === 'secde1');
  const celse = steps.findIndex((step) => step.kind === 'celse');
  if (spokenOnAdvance(steps, ruku, kavme).length) {
    console.log(`FAIL ${prayer.id} spoke ruku → kavme`);
    failed += 1;
  }
  if (spokenOnAdvance(steps, secde1, celse).length) {
    console.log(`FAIL ${prayer.id} spoke 1st sajdah → celse`);
    failed += 1;
  }
  if (spokenOnAdvance(steps, secde1, secde1 + 1).length) {
    console.log(`FAIL ${prayer.id} spoke entering/leaving 1st sajdah`);
    failed += 1;
  }

  const skipRukuToKalkis = steps.findIndex((step) => step.kind === 'kalkis');
  if (skipRukuToKalkis > ruku && spokenOnAdvance(steps, ruku, skipRukuToKalkis).length) {
    console.log(`FAIL ${prayer.id} spoke when camera skipped ruku → kalkış`);
    failed += 1;
  }

  const lastSecde2 = steps.map((step, index) => ({ step, index })).filter((row) => row.step.kind === 'secde2').pop();
  if (lastSecde2 && spokenOnAdvance(steps, lastSecde2.index - 1, lastSecde2.index + 1).length) {
    console.log(`FAIL ${prayer.id} spoke leaving 1st-sajdah-adjacent into 2nd without being on secde2`);
    failed += 1;
  }
}

const ogle = getPrayerSteps('ogle');
const ogleSecde2Last = ogle.map((step, index) => ({ step, index })).filter((row) => row.step.kind === 'secde2').pop();
if (!ogleSecde2Last || ogle[ogleSecde2Last.index + 1]?.kind !== 'tahiyyat') {
  console.log('FAIL öğle last secde2 must go to tahiyyat');
  failed += 1;
} else if (spokenOnAdvance(ogle, ogleSecde2Last.index, ogleSecde2Last.index + 1).join(',') !== 'dört') {
  console.log('FAIL öğle last rakah must say dört only from secde2 → son oturuş');
  failed += 1;
} else if (spokenOnAdvance(ogle, ogleSecde2Last.index, ogleSecde2Last.index + 1, new Set([4])).length) {
  console.log('FAIL öğle repeated dört');
  failed += 1;
}

if (
  canAdvanceOnDetectedPose({ seenCurrentPose: false, detected: 'kiyam', nextPose: 'kiyam' }) ||
  canAdvanceOnDetectedPose({ seenCurrentPose: true, detected: 'kiyam', nextPose: 'secde' })
) {
  console.log('FAIL pose advance gate');
  failed += 1;
}
if (!requireSeenPoseBeforeAdvance('secde2') || requireSeenPoseBeforeAdvance('kavme')) {
  console.log('FAIL seen-pose requirement');
  failed += 1;
}

if (failed) {
  process.exit(1);
}
console.log('Duruş sınıflandırıcı sentetik örnekleri geçti.');
