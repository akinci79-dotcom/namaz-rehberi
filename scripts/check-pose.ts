import { classifyPose } from '../src/pose/classifyPose';
import { samePoseDwellMs } from '../src/pose/stepPose';
import type { PoseLandmark } from '../src/pose/types';
import type { PrayerStep } from '../src/types/prayer';
import { getPrayerSteps, PRAYERS } from '../src/data';
import {
  cameraIdleWouldAdvance,
  cameraStatusText,
  CAMERA_HOLD_MS,
  expectedPoseForTransition,
  tickCameraAdvance,
} from '../src/pose/cameraAdvance';
import { requireSeenPoseBeforeAdvance } from '../src/pose/stepPose';
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

/** "Baş·omuz·bel" kadrajı: diz/ayak bileği YOK. Oturuş bu kadrajla kıyamdan ayrılamaz. */
function upperBodyOnlySitting(): PoseLandmark[] {
  return body({
    0: [0.5, 0.28],
    11: [0.38, 0.38],
    12: [0.62, 0.38],
    23: [0.44, 0.64],
    24: [0.56, 0.64],
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

const IDLE_CAMERA_TICK = {
  advance: false,
  commitCurrent: false,
  hint: 'none' as const,
  currentPose: 'unknown' as const,
  expectedPose: null,
  waitingFor: null,
  secde2Ready: false,
  samePose: false,
};

// Bilinen sınırlama: diz/ayak bileği kadrajda yoksa oturuş kıyamdan ayrılamaz.
// Bu durumda kullanıcı sessizce yanlış algı yerine "telefonu geriye çekin" uyarısı
// görmeli (cameraStatusText → legsMissing). Regresyon olursa burada patlamalı.
const partialGuess = classifyPose(upperBodyOnlySitting());
if (partialGuess.framing !== 'partial') {
  console.log(`FAIL upperBodyOnlySitting framing should be partial, got ${partialGuess.framing}`);
  failed += 1;
}
const legsMissingText = cameraStatusText({
  framingClose: false,
  bodyMissing: false,
  legsMissing: true,
  detected: 'unknown',
  tick: IDLE_CAMERA_TICK,
  passedLabel: null,
});
if (!legsMissingText.includes('Dizler görünmüyor')) {
  console.log(`FAIL legsMissing status text should warn about knees, got "${legsMissingText}"`);
  failed += 1;
}
const legsOkText = cameraStatusText({
  framingClose: false,
  bodyMissing: false,
  legsMissing: false,
  detected: 'secde',
  tick: IDLE_CAMERA_TICK,
  passedLabel: null,
});
if (legsOkText.includes('Dizler görünmüyor')) {
  console.log('FAIL legsMissing=false must not show knee warning');
  failed += 1;
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

if (!requireSeenPoseBeforeAdvance('secde2') || requireSeenPoseBeforeAdvance('kavme')) {
  console.log('FAIL seen-pose requirement');
  failed += 1;
}

const sabah = getPrayerSteps('sabah');
const sabahNiyet = sabah.findIndex((step) => step.kind === 'niyet');
const sabahKiyam = sabah.findIndex((step) => step.kind === 'kiyam');
const sabahSecde1 = sabah.findIndex((step) => step.kind === 'secde1');
const sabahSecde2 = sabah.findIndex((step) => step.kind === 'secde2');
const sabahLastSecde2 = sabah.map((step, index) => ({ step, index })).filter((row) => row.step.kind === 'secde2').pop();

if (expectedPoseForTransition(sabah, sabahNiyet, false) !== 'ruku') {
  console.log('FAIL niyet should wait for ruku (look-ahead)');
  failed += 1;
}
if (expectedPoseForTransition(sabah, sabahSecde1, false) !== 'secde') {
  console.log('FAIL secde1 expected pose must be secde (not sit)');
  failed += 1;
}
if (expectedPoseForTransition(sabah, sabahSecde2, false) !== 'secde') {
  console.log('FAIL secde2 expected pose must be secde');
  failed += 1;
}

function tickSabah(
  index: number,
  detected: 'kiyam' | 'ruku' | 'secde' | 'oturus' | 'unknown',
  hold: number,
  confirmed = false,
  model = true,
) {
  return tickCameraAdvance({
    steps: sabah,
    index,
    detected,
    holdExpectedMs: hold,
    currentConfirmed: confirmed,
    modelReady: model,
  });
}

if (!tickSabah(sabahKiyam, 'ruku', CAMERA_HOLD_MS).advance) {
  console.log('FAIL kıyam + held rükû must call advance');
  failed += 1;
}
if (!tickSabah(sabahNiyet, 'ruku', CAMERA_HOLD_MS).advance) {
  console.log('FAIL niyet + held rükû must advance toward rükû');
  failed += 1;
}
if (!tickSabah(sabahSecde1, 'secde', CAMERA_HOLD_MS).advance) {
  console.log('FAIL secde1 + held secde must advance (Algı: secde → stepIndex++)');
  failed += 1;
}
if (!tickSabah(sabahSecde2, 'secde', CAMERA_HOLD_MS).advance) {
  console.log('FAIL secde2 + held secde must advance to kalkış/tahiyyat');
  failed += 1;
}

if (sabahLastSecde2) {
  const left = sabah[sabahLastSecde2.index];
  const entered = sabah[sabahLastSecde2.index + 1];
  const cameraWouldAdvance = tickSabah(sabahLastSecde2.index, 'secde', CAMERA_HOLD_MS).advance;
  const voice = completedRakahAnnouncements(sabah, sabahLastSecde2.index, sabahLastSecde2.index + 1, new Set());
  if (!cameraWouldAdvance || left.kind !== 'secde2' || entered?.kind !== 'tahiyyat' || voice[0]?.word !== 'iki') {
    console.log('FAIL last sabah secde2 camera advance must unlock voice iki');
    failed += 1;
  }
}

const rukuIdx = sabah.findIndex((step) => step.kind === 'ruku');
const rukuHold = tickSabah(rukuIdx, 'ruku', CAMERA_HOLD_MS, false);
if (rukuHold.advance || !rukuHold.commitCurrent) {
  console.log('FAIL rükû first phase confirms rükû, does not leave yet');
  failed += 1;
}
if (!tickSabah(rukuIdx, 'kiyam', CAMERA_HOLD_MS, true).advance) {
  console.log('FAIL rükû after confirm + kıyam hold must go to kavme');
  failed += 1;
}

const idle30 = { duration: 30_000 as const };
if (
  cameraIdleWouldAdvance(
    { steps: sabah, index: sabahKiyam, detected: 'kiyam', modelReady: true },
    idle30.duration,
  )
) {
  console.log('FAIL camera advanced after 30s standing on kıyam (timer leak)');
  failed += 1;
}
if (
  cameraIdleWouldAdvance(
    { steps: sabah, index: sabahNiyet, detected: 'kiyam', modelReady: true },
    idle30.duration,
  )
) {
  console.log('FAIL camera advanced same-pose niyet on timer');
  failed += 1;
}
if (
  cameraIdleWouldAdvance(
    { steps: sabah, index: sabahSecde2, detected: 'oturus', modelReady: true },
    idle30.duration,
  )
) {
  console.log('FAIL camera left secde2 on sit without secde hold');
  failed += 1;
}

if (tickSabah(sabahKiyam, 'ruku', CAMERA_HOLD_MS, false, false).advance) {
  console.log('FAIL without model camera must not auto-advance');
  failed += 1;
}

if (failed) {
  process.exit(1);
}
console.log('Duruş sınıflandırıcı sentetik örnekleri geçti.');
