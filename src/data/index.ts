import type { PrayerId, PrayerStep } from '../types/prayer';
import { buildSteps } from './buildSteps';
import { getPrayer } from './prayers';

export { buildSteps, getNextTitle } from './buildSteps';
export { DISCLAIMER, getPrayer, MADHAB_LABEL, PRAYERS, RANK_LABEL, rankLabel } from './prayers';

const stepCache = new Map<PrayerId, PrayerStep[]>();

export function getPrayerSteps(id: PrayerId): PrayerStep[] {
  const cached = stepCache.get(id);
  if (cached) {
    return cached;
  }
  const steps = buildSteps(getPrayer(id));
  stepCache.set(id, steps);
  return steps;
}
