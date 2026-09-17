import type { PrayerStep } from '../types/prayer';

import { rakahNumberWord } from './speech';

/** 2. secdeden sonra rekâtı bitiren adım: sonraki rekâta kalkış veya ka'de. */
export function isPostRakahStep(step: PrayerStep | undefined): boolean {
  return step?.kind === 'kalkis' || step?.kind === 'tahiyyat';
}

/**
 * Ses yalnızca bu kenarda: bulunduğumuz adım `secde2` (rekât N) ve sıradaki
 * adım kalkış veya tahiyyat. Atlanan aralıktaki secde2 sayılmaz — kameranın
 * rükû/kavme titremesiyle atladığı rekât “bitmiş” sayılmaz.
 */
export function completedRakahAnnouncements(
  steps: readonly PrayerStep[],
  fromIndex: number,
  toIndex: number,
  already: ReadonlySet<number>,
): { rakah: number; word: string }[] {
  if (toIndex <= fromIndex || fromIndex < 0 || fromIndex >= steps.length) {
    return [];
  }

  const cues: { rakah: number; word: string }[] = [];

  for (let i = fromIndex; i < toIndex; i++) {
    const left = steps[i];
    const next = steps[i + 1];
    
    if (left && left.kind === 'secde2' && isPostRakahStep(next)) {
      if (!already.has(left.rakah)) {
        const word = rakahNumberWord(left.rakah);
        if (word) {
          cues.push({ rakah: left.rakah, word });
        }
      }
    }
  }

  return cues;
}
