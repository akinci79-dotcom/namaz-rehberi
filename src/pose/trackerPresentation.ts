import type { PrayerStep } from '../types/prayer';
import type { TrackingSnapshot } from './prayerTracker';

/** One-way projection. Display navigation never changes tracker state. */
export function trackerStepIndex(steps: readonly PrayerStep[], state: TrackingSnapshot): number {
  if (state.phase === 'waiting' || state.uncertain) return -1;
  if (state.phase === 'between' || state.phase === 'complete') {
    return steps.findIndex(s => s.rakah === state.completed && (s.kind === 'tahiyyat' || s.kind === 'kalkis'));
  }
  return steps.findIndex(s => s.rakah === state.rakah && s.kind === state.phase);
}
