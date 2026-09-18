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
 *
 * Gemini bu fonksiyonu aralıktaki HER secde2'yi sayacak şekilde genişletti;
 * testler bunu açıkça yasaklıyor ("spoke when camera skipped ruku → kalkış").
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

  const left = steps[fromIndex];
  const next = steps[fromIndex + 1];
  if (!left || left.kind !== 'secde2' || !isPostRakahStep(next)) {
    return [];
  }
  if (already.has(left.rakah)) {
    return [];
  }

  const word = rakahNumberWord(left.rakah);
  if (!word) {
    return [];
  }
  return [{ rakah: left.rakah, word }];
}
