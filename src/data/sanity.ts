import { PRAYERS } from './prayers';
import { buildSteps } from './buildSteps';
import type { PrayerId, PrayerStep } from '../types/prayer';

function fail(message: string): never {
  throw new Error(`Namaz veri kontrolü: ${message}`);
}

function count(steps: PrayerStep[], kind: PrayerStep['kind']): number {
  return steps.filter((step) => step.kind === kind).length;
}

/**
 * Rekât sayıları ve oturuş noktalarını uygulama açılışında doğrular.
 * Yanlış bir adım dizisi sessizce yayınlanmasın diye.
 */
export function assertPrayerIntegrity(): void {
  const expectedRakah: Record<PrayerId, number> = {
    sabah: 2,
    ogle: 4,
    ikindi: 4,
    aksam: 3,
    yatsi: 4,
  };

  for (const prayer of PRAYERS) {
    if (prayer.rakahCount !== expectedRakah[prayer.id]) {
      fail(`${prayer.id} rekât sayısı ${prayer.rakahCount}, beklenen ${expectedRakah[prayer.id]}`);
    }

    const steps = buildSteps(prayer);
    if (steps.length === 0) {
      fail(`${prayer.id} adım üretmedi`);
    }
    if (steps[0]?.kind !== 'niyet' || steps[1]?.kind !== 'iftitah') {
      fail(`${prayer.id} niyet / iftitah ile başlamıyor`);
    }
    if (steps[steps.length - 1]?.kind !== 'selam') {
      fail(`${prayer.id} selam ile bitmiyor`);
    }

    if (count(steps, 'kiyam') !== prayer.rakahCount) {
      fail(`${prayer.id} kıyam sayısı rekât ile uyuşmuyor`);
    }
    if (count(steps, 'ruku') !== prayer.rakahCount) {
      fail(`${prayer.id} rükû sayısı rekât ile uyuşmuyor`);
    }
    if (count(steps, 'secde1') !== prayer.rakahCount || count(steps, 'secde2') !== prayer.rakahCount) {
      fail(`${prayer.id} secde sayısı rekât ile uyuşmuyor`);
    }
    if (count(steps, 'celse') !== prayer.rakahCount) {
      fail(`${prayer.id} celse sayısı rekât ile uyuşmuyor`);
    }

    const firstSittings = steps.filter((step) => step.sitting === 'first');
    const lastTahiyyat = steps.filter((step) => step.kind === 'tahiyyat' && step.sitting === 'last');

    if (prayer.rakahCount === 2) {
      if (firstSittings.length !== 0) {
        fail('Sabah namazında ilk oturuş olmamalı');
      }
    } else if (firstSittings.length !== 1 || firstSittings[0]?.rakah !== 2) {
      fail(`${prayer.id} ilk oturuşu 2. rekâtın sonunda olmalı`);
    }

    if (lastTahiyyat.length !== 1 || lastTahiyyat[0]?.rakah !== prayer.rakahCount) {
      fail(`${prayer.id} son oturuş son rekâtta olmalı`);
    }

    const lastKiyam = steps.find((step) => step.kind === 'kiyam' && step.rakah === prayer.rakahCount);
    if (prayer.rakahCount >= 3 && lastKiyam && !lastKiyam.instruction.includes('yalnızca Fâtiha')) {
      fail(`${prayer.id} son rekât kıyamı Fâtiha-only olmalı`);
    }

    const firstKiyam = steps.find((step) => step.kind === 'kiyam' && step.rakah === 1);
    if (firstKiyam && !firstKiyam.instruction.includes('Sübhaneke')) {
      fail(`${prayer.id} 1. rekât Sübhaneke içermeli`);
    }
  }
}
