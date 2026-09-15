import type { StepKind } from '../types/prayer';

import { poseForStepKind } from './stepPose';
import type { BodyPose } from './types';
import { POSE_WAIT_TR } from './types';

// ÖNEMLİ: kullanıcı gerçek namazda "kaplumbağa gibi çok yavaş hareket etmek
// gerekiyor, hızlı hareket edince algılamıyor" diye bildirdi. 850ms + 3 karelik
// yayın gecikmesi (~420ms) + gerçek harekette kaçınılmaz ufak titremeler
// toplamda namazın doğal temposundan belirgin şekilde daha yavaş bir duruş
// gerektiriyordu. Rükû/secde gibi rükünler zaten birkaç saniye (tesbih süresi)
// tutulduğu için süreyi kısaltmak yanlış pozitif riskini önemli ölçüde
// artırmaz, ama gerçek tempoda hareket edince de algılanmasını sağlar.
/** Algı = beklenen duruş bu kadar tutulunca Sonraki ile aynı ilerleme. Saat yok. */
export const CAMERA_HOLD_MS = 550;

export type AdvanceHint = 'camera' | 'manual' | 'none';

export interface CameraStepRef {
  kind: StepKind;
}

export interface CameraTickInput {
  steps: readonly CameraStepRef[];
  index: number;
  detected: BodyPose;
  holdExpectedMs: number;
  /** Rükû: önce rükû teyidi, sonra kıyam (kavme). */
  currentConfirmed: boolean;
  modelReady: boolean;
}

export interface CameraTickResult {
  advance: boolean;
  /** Rükû birinci faz: adım ilerlemez, rükû teyit edilir. */
  commitCurrent: boolean;
  hint: AdvanceHint;
  currentPose: BodyPose;
  expectedPose: BodyPose | null;
  waitingFor: BodyPose | null;
  secde2Ready: boolean;
  samePose: boolean;
}

/**
 * Bu adımı bırakmak için tutulması gereken duruş.
 * secde1/secde2: secde (sonraki oturuş/kıyam değil — eski kapı sesi hiç tetiklemiyordu).
 * celse: oturuş. rükû: önce rükû, teyitten sonra kıyam.
 * kıyam/niyet: ilerideki ilk farklı duruş (genelde rükû).
 */
export function expectedPoseForTransition(
  steps: readonly CameraStepRef[],
  index: number,
  currentConfirmed: boolean,
): BodyPose | null {
  const current = steps[index];
  if (!current) {
    return null;
  }

  switch (current.kind) {
    case 'secde1':
    case 'secde2':
      return 'secde';
    case 'celse':
      return 'oturus';
    case 'ruku':
      return currentConfirmed ? 'kiyam' : 'ruku';
    default:
      break;
  }

  const from = poseForStepKind(current.kind);
  for (let i = index + 1; i < steps.length; i += 1) {
    const pose = poseForStepKind(steps[i].kind);
    if (pose !== from) {
      return pose;
    }
  }
  return null;
}

/**
 * Beklenen duruşun tutulma süresini biriktirir. Tek bir gürültülü/yanlış kare
 * (MediaPipe karesel sıçraması, geçiş anındaki motion blur) tüm ilerlemeyi SIFIRLAMAZ
 * — yalnızca yumuşak biçimde azaltır. 'unknown' (kısa süreli oklüzyon, kare atlaması)
 * hiç ceza vermez: ilerleme de eklemez, azaltmaz da. Eskiden tek yanlış kare
 * holdExpectedMs'i 0'a çekiyordu; gerçek harekette (özellikle rükû/secdeye giriş
 * çıkışlarda) bu, 850ms'lik kesintisiz doğru algı şartını pratikte imkansız kılıyordu.
 */
export function accumulateHold(
  holdMs: number,
  dt: number,
  detected: BodyPose,
  expected: BodyPose | null,
): number {
  if (expected && detected === expected) {
    return holdMs + dt;
  }
  if (detected === 'unknown' || !expected) {
    return holdMs;
  }
  // Gerçek namaz kayıtlarında, doğru duruş sürdürülürken bile ara sıra yanlış/
  // gürültülü kareler görülüyordu (ör. rükûda anlık "secde" sıçraması). Eski
  // 2x ceza (dt*2) bu tür kısa gürültüyü net biriktirmeyi çok yavaşlatıyor,
  // kullanıcının "çok yavaş hareket etmesi gerekiyor" hissine katkıda
  // bulunuyordu. Cezayı 1.3x'e indirdik: hâlâ sürekli yanlış pozdan (gerçekten
  // farklı bir duruşa geçildiğinde) hızla çıkar, ama izole gürültüyü tolere
  // etmek daha kolay.
  return Math.max(0, holdMs - dt * 1.3);
}

/**
 * INVARIANT: model hazır, sonraki adım var, detected === expectedPose,
 * holdExpectedMs >= CAMERA_HOLD_MS → advance true (rükû 1. faz hariç: commitCurrent).
 * Çağıran, advance true ise Sonraki ile aynı onAdvance'i çağırmak ZORUNDADIR.
 */
export function tickCameraAdvance(input: CameraTickInput): CameraTickResult {
  const current = input.steps[input.index];
  const currentPose = current ? poseForStepKind(current.kind) : 'unknown';
  const expectedPose = current
    ? expectedPoseForTransition(input.steps, input.index, input.currentConfirmed)
    : null;
  const next = input.steps[input.index + 1];
  const samePose = !expectedPose;
  const waitingFor = expectedPose;
  const secde2Ready = current?.kind === 'secde2' && input.detected === 'secde';

  const base = {
    commitCurrent: false,
    currentPose,
    expectedPose,
    waitingFor,
    secde2Ready,
    samePose,
  };

  if (!input.modelReady) {
    return { ...base, advance: false, hint: 'manual' };
  }
  if (!current || !next || !expectedPose) {
    return { ...base, advance: false, hint: 'manual', samePose: true };
  }

  const holding = input.detected === expectedPose;
  const heldLongEnough = holding && input.holdExpectedMs >= CAMERA_HOLD_MS;

  if (current.kind === 'ruku' && !input.currentConfirmed) {
    if (heldLongEnough) {
      return { ...base, advance: false, commitCurrent: true, hint: 'camera' };
    }
    return { ...base, advance: false, hint: holding ? 'camera' : 'none' };
  }

  if (heldLongEnough) {
    return { ...base, advance: true, hint: 'camera' };
  }
  if (holding) {
    return { ...base, advance: false, hint: 'camera' };
  }
  return { ...base, advance: false, hint: 'none' };
}

export function cameraStatusText(input: {
  framingClose: boolean;
  bodyMissing: boolean;
  /** Secde/oturuş bekleniyor ama diz/ayak bileği görünmüyor — bu duruşlar bacaksız ayırt edilemez. */
  legsMissing: boolean;
  detected: BodyPose;
  tick: CameraTickResult;
  passedLabel: string | null;
}): string {
  if (input.passedLabel) {
    return input.passedLabel;
  }
  if (input.bodyMissing) {
    return `Vücut görünmüyor — telefonu uzaklaştırın. Algı: ${POSE_WAIT_TR[input.detected]}`;
  }
  if (input.framingClose) {
    return `Yüz çok yakın — gövde kadraja girsin. Algı: ${POSE_WAIT_TR[input.detected]}`;
  }
  if (input.legsMissing) {
    return `Dizler görünmüyor — telefonu geriye çekin, tüm gövde girsin. Algı: ${POSE_WAIT_TR[input.detected]}`;
  }

  if (input.tick.secde2Ready) {
    return `2. secde görüldü — rekat sayılacak · Algı: ${POSE_WAIT_TR[input.detected]}`;
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

/** Sabit duruşta süreyle adım artmamalı. */
export function cameraIdleWouldAdvance(
  input: Omit<CameraTickInput, 'holdExpectedMs' | 'currentConfirmed'>,
  durationMs: number,
  stepMs = 50,
): boolean {
  let hold = 0;
  let confirmed = false;
  for (let t = 0; t <= durationMs; t += stepMs) {
    const expected = expectedPoseForTransition(input.steps, input.index, confirmed);
    if (expected && input.detected === expected) {
      hold += stepMs;
    } else if (input.detected !== 'unknown') {
      hold = 0;
    }
    const tick = tickCameraAdvance({
      ...input,
      holdExpectedMs: hold,
      currentConfirmed: confirmed,
    });
    if (tick.commitCurrent) {
      confirmed = true;
      hold = 0;
    }
    if (tick.advance) {
      return true;
    }
  }
  return false;
}
