import type { BodyPose, PoseGuess, PoseLandmark } from './types';

/** Ekranda gösterilen tahmin tek başına sayım kanıtı değildir. */
export function acceptedCameraPose(guess: PoseGuess): BodyPose {
  return guess.framing === 'ok' && Number.isFinite(guess.confidence) && guess.confidence >= 0.3
    ? guess.pose : 'unknown';
}

export type TakbirPhase = 'waiting' | 'ready' | 'raised' | 'started';

/** İki el aşağı → kulak hizası → aşağı. Eksik/tek elden başlangıç uydurulmaz. */
export function createTakbirStart() {
  let phase: TakbirPhase = 'waiting';
  let lastAt: number | null = null;
  let candidate = '';
  let since = 0;
  let raisedAt = 0;
  const reset = () => { phase = 'waiting'; candidate = ''; lastAt = null; };
  return {
    resetPending() { if (phase !== 'started') reset(); },
    update(points: readonly PoseLandmark[] | undefined, guess: PoseGuess, now: number, size = { width: 1, height: 1 }): TakbirPhase {
      if (phase === 'started') return phase;
      if (lastAt !== null && (now - lastAt > 500 || now < lastAt)) reset();
      lastAt = now;
      const visible = (id: number) => {
        const p = points?.[id];
        return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
          (p.visibility ?? 0) >= 0.45 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
      };
      if (acceptedCameraPose(guess) !== 'kiyam' || ![11,12,15,16,23,24].every(visible)) {
        reset();
        return phase;
      }
      const p = points!.map(point => ({ ...point, y: point.y * size.height / size.width }));
      const shoulderY = (p[11].y + p[12].y) / 2;
      const torso = (p[23].y + p[24].y) / 2 - shoulderY;
      if (torso <= 0.05) { reset(); return phase; }
      const lowered = p[15].y > p[11].y + torso * 0.25 && p[16].y > p[12].y + torso * 0.25;
      const nearHead = (wrist: number, ear: number) => {
        const head = visible(ear) ? p[ear] : visible(0) ? p[0] : null;
        return !!head && Math.abs(p[wrist].y - head.y) <= torso * 0.55 &&
          Math.abs(p[wrist].x - head.x) <= Math.max(Math.abs(p[12].x - p[11].x), 0.08) &&
          p[wrist].y < p[wrist === 15 ? 11 : 12].y;
      };
      const raised = nearHead(15, 7) && nearHead(16, 8);
      if (phase === 'raised' && now - raisedAt > 5000) reset();
      const signal = lowered ? 'down' : raised ? 'up' : 'moving';
      if (signal !== candidate) { candidate = signal; since = now; }
      const held = now - since;
      if (phase === 'waiting' && lowered && held >= 330) phase = 'ready';
      else if (phase === 'ready' && raised && held >= 220) {
        phase = 'raised'; raisedAt = now;
      } else if (phase === 'raised' && lowered && held >= 220) phase = 'started';
      return phase;
    },
  };
}
