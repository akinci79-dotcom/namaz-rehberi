import type { BodyPose } from './types';

export type TrackingPhase = 'waiting' | 'kiyam' | 'ruku' | 'kavme' | 'secde1' | 'celse' | 'secde2' | 'between' | 'complete';
export interface TrackingSnapshot {
  phase: TrackingPhase;
  rakah: number;
  completed: number;
  uncertain: boolean;
  reason: string | null;
  expected: BodyPose | null;
  completedEvent: number | null;
}
const EXPECTED: Record<TrackingPhase, BodyPose | null> = {
  waiting: null, kiyam: 'ruku', ruku: 'kiyam', kavme: 'secde',
  secde1: 'oturus', celse: 'secde', secde2: null, between: 'kiyam', complete: null,
};
const CURRENT: Partial<Record<TrackingPhase, BodyPose>> = {
  kiyam: 'kiyam', ruku: 'ruku', kavme: 'kiyam', secde1: 'secde', celse: 'oturus', secde2: 'secde',
};
const NEXT: Partial<Record<TrackingPhase, TrackingPhase>> = {
  kiyam: 'ruku', ruku: 'kavme', kavme: 'secde1', secde1: 'celse', celse: 'secde2', between: 'kiyam',
};

/** Observations are independent of teaching steps. Only a complete observed cycle emits a count. */
export function createPrayerTracker(totalRakah: number) {
  if (!Number.isInteger(totalRakah) || totalRakah < 1) throw new Error('Invalid rakah count');
  let phase: TrackingPhase = 'waiting';
  let completed = 0;
  let uncertain = false;
  let reason: string | null = null;
  let lastAt: number | null = null;
  let missingAt: number | null = null;
  let candidate: BodyPose = 'unknown';
  let held = 0;
  const snapshot = (event: number | null = null): TrackingSnapshot => ({
    phase, rakah: Math.min(completed + 1, totalRakah), completed, uncertain, reason,
    expected: EXPECTED[phase], completedEvent: event,
  });
  const suspend = (why: string) => {
    if (phase !== 'waiting' && phase !== 'complete') { uncertain = true; reason = why; }
    held = 0;
    return snapshot();
  };
  return {
    snapshot,
    start(now: number) {
      if (phase === 'waiting') { phase = 'kiyam'; lastAt = now; }
      return snapshot();
    },
    suspend,
    update(pose: BodyPose, now: number): TrackingSnapshot {
      if (phase === 'waiting' || phase === 'complete' || uncertain) return snapshot();
      if (!Number.isFinite(now)) return suspend('Geçersiz kamera zamanı');
      const gap = lastAt === null ? 0 : now - lastAt;
      if (gap < 0 || gap > 2500) return suspend('Kamera akışı kesildi; hareket sırası doğrulanamıyor');
      lastAt = now;
      if (pose === 'unknown') {
        missingAt ??= now;
        if (now - missingAt >= 2500) return suspend('Gövde uzun süre doğrulanamadı');
        if (gap > 500 || now - missingAt > 350) held = 0;
        return snapshot();
      }
      if (missingAt !== null && now - missingAt >= 2500) return suspend('Görüntü kaybında hareket kaçmış olabilir');
      const canAccumulate = missingAt === null && gap <= 500;
      missingAt = null;
      if (candidate !== pose || gap > 500) { candidate = pose; held = 0; }
      else if (canAccumulate) held += Math.min(gap, 250);
      if (held < 440) return snapshot();
      if (phase === 'secde2' && (pose === 'oturus' || pose === 'kiyam')) {
        completed += 1;
        phase = completed === totalRakah ? 'complete' : pose === 'kiyam' ? 'kiyam' : 'between';
        held = 0;
        return snapshot(completed);
      }
      if (pose === EXPECTED[phase]) {
        phase = NEXT[phase]!;
        held = 0;
      } else if (pose !== CURRENT[phase] && !(phase === 'between' && pose === 'oturus') && held >= 1100) {
        return suspend('Beklenen hareket sırası doğrulanamadı');
      }
      return snapshot();
    },
  };
}
