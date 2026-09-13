import type { BodyPose, Framing, PoseGuess, PoseLandmark } from './types';

const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;
const NOSE = 0;

const MIN_VIS = 0.22;
const HYSTERESIS = 0.07;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function visible(point: PoseLandmark | undefined, min = MIN_VIS): point is PoseLandmark {
  return !!point && (point.visibility ?? 1) >= min;
}

function mid(a: PoseLandmark, b: PoseLandmark): PoseLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

/** 0 = dik, 90 = yatay. y aşağı. */
export function torsoAngleDeg(hip: PoseLandmark, shoulder: PoseLandmark): number {
  const vx = shoulder.x - hip.x;
  const vy = shoulder.y - hip.y;
  const mag = Math.hypot(vx, vy) || 1e-6;
  const cos = clamp(-vy / mag, -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

function empty(framing: Framing): PoseGuess {
  return { pose: 'unknown', confidence: 0, framing };
}

/**
 * Ön kamera: omuz genişliği ölçek.
 * iPhone selfie sıkça yalnızca yüz/omuz gösterir — kalça yoksa dik gövde kıyam sayılır.
 */
export function classifyPose(landmarks: readonly PoseLandmark[], previous?: BodyPose): PoseGuess {
  const nose = landmarks[NOSE];
  const shoulderL = landmarks[L_SHOULDER];
  const shoulderR = landmarks[R_SHOULDER];
  const hipL = landmarks[L_HIP];
  const hipR = landmarks[R_HIP];

  if (!visible(nose, 0.18)) {
    return empty('none');
  }

  const hasShoulders = visible(shoulderL, 0.18) && visible(shoulderR, 0.18);
  if (!hasShoulders) {
    return empty(nose.y < 0.55 ? 'close' : 'none');
  }

  const shoulder = mid(shoulderL, shoulderR);
  const shoulderWidth = Math.abs(shoulderR.x - shoulderL.x);
  const tooClose = shoulderWidth > 0.48 || (shoulder.y < 0.42 && !visible(hipL, 0.18));

  const hasHips = visible(hipL, 0.16) && visible(hipR, 0.16);
  if (!hasHips) {
    const uprightFace = nose.y < shoulder.y;
    if (tooClose) {
      return {
        pose: uprightFace ? 'kiyam' : 'unknown',
        confidence: uprightFace ? 0.4 : 0,
        framing: 'close',
      };
    }
    return {
      pose: uprightFace ? 'kiyam' : 'unknown',
      confidence: uprightFace ? 0.45 : 0,
      framing: 'partial',
    };
  }

  const hip = mid(hipL, hipR);
  const kneeL = landmarks[L_KNEE];
  const kneeR = landmarks[R_KNEE];
  const ankleL = landmarks[L_ANKLE];
  const ankleR = landmarks[R_ANKLE];
  const knee =
    visible(kneeL, 0.14) && visible(kneeR, 0.14) ? mid(kneeL, kneeR) : undefined;
  const ankle =
    visible(ankleL, 0.12) && visible(ankleR, 0.12) ? mid(ankleL, ankleR) : undefined;

  const scale = Math.max(shoulderWidth, 0.1);
  const torsoNorm = (hip.y - shoulder.y) / scale;
  const angle = torsoAngleDeg(hip, shoulder);
  const bentByAngle = clamp((angle - 32) / 45, 0, 1);
  const framing: Framing = tooClose ? 'close' : ankle || knee ? 'ok' : 'partial';

  const lowerRef = ankle ?? knee;
  if (!lowerRef) {
    const highTorso = clamp((torsoNorm - 0.35) / 0.55, 0, 1);
    const lowTorso = clamp((0.5 - torsoNorm) / 0.4, 0, 1);
    return pick(
      {
        kiyam: highTorso * (1 - bentByAngle),
        ruku: Math.max(lowTorso, bentByAngle),
        secde: 0,
        oturus: 0,
      },
      previous,
      0.38,
      framing,
    );
  }

  const legNorm = (lowerRef.y - hip.y) / scale;
  const spanNorm = (lowerRef.y - nose.y) / scale;
  const highTorso = clamp((torsoNorm - 0.38) / 0.5, 0, 1);
  const lowTorso = clamp((0.52 - torsoNorm) / 0.4, 0, 1);
  const highLeg = clamp((legNorm - 0.95) / 0.55, 0, 1);
  const lowLeg = clamp((1.05 - legNorm) / 0.55, 0, 1);
  const compact = clamp((1.45 - spanNorm) / 0.7, 0, 1);

  return pick(
    {
      kiyam: highTorso * highLeg,
      ruku: Math.max(lowTorso, bentByAngle) * highLeg,
      oturus: highTorso * lowLeg,
      secde: Math.max(lowTorso * lowLeg, compact * Math.max(lowTorso, 0.35)),
    },
    previous,
    0.3,
    framing,
  );
}

function pick(
  scores: Record<Exclude<BodyPose, 'unknown'>, number>,
  previous: BodyPose | undefined,
  min: number,
  framing: Framing,
): PoseGuess {
  const entries = Object.entries(scores) as Array<[Exclude<BodyPose, 'unknown'>, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const [bestPose, bestScore] = entries[0];
  const second = entries[1]?.[1] ?? 0;

  if (previous && previous !== 'unknown' && previous !== bestPose) {
    const prevScore = scores[previous];
    if (prevScore + HYSTERESIS >= bestScore) {
      return { pose: previous, confidence: prevScore, framing };
    }
  }

  if (bestScore < min || bestScore - second < 0.03) {
    return {
      pose: previous && previous !== 'unknown' && bestScore > min * 0.65 ? previous : 'unknown',
      confidence: bestScore,
      framing,
    };
  }

  return { pose: bestPose, confidence: bestScore, framing };
}
