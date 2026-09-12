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
    vitir: 3,
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
    if (count(steps, 'selam') !== 1) {
      fail(`${prayer.id} tek selam olmalı`);
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
    if (prayer.rank === 'farz' && prayer.rakahCount >= 3) {
      if (lastKiyam && !lastKiyam.instruction.includes('yalnızca Fâtiha')) {
        fail(`${prayer.id} son rekât kıyamı Fâtiha-only olmalı`);
      }
    }

    const firstKiyam = steps.find((step) => step.kind === 'kiyam' && step.rakah === 1);
    if (firstKiyam && !firstKiyam.instruction.includes('Sübhaneke')) {
      fail(`${prayer.id} 1. rekât Sübhaneke içermeli`);
    }

    if (prayer.kunut === 'before-ruku') {
      const kunutSteps = steps.filter((step) => step.kind === 'kunut');
      if (kunutSteps.length !== 1 || kunutSteps[0]?.rakah !== prayer.rakahCount) {
        fail(`${prayer.id} son rekâtta tam bir kunut adımı olmalı`);
      }
      const lastKiyamIndex = steps.findIndex(
        (step) => step.kind === 'kiyam' && step.rakah === prayer.rakahCount,
      );
      const kunutIndex = steps.findIndex((step) => step.kind === 'kunut');
      const lastRukuIndex = steps.findIndex(
        (step) => step.kind === 'ruku' && step.rakah === prayer.rakahCount,
      );
      if (!(lastKiyamIndex < kunutIndex && kunutIndex < lastRukuIndex)) {
        fail(`${prayer.id} kunut, 3. rekât kıyamından sonra ve rükûdan önce olmalı`);
      }
      if (lastKiyam && !lastKiyam.instruction.includes('zamm-ı sure')) {
        fail(`${prayer.id} 3. rekât kıyamında zamm-ı sure olmalı`);
      }
    } else if (count(steps, 'kunut') !== 0) {
      fail(`${prayer.id} kunut içermemeli`);
    }
  }
}
