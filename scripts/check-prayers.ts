import { assertPrayerIntegrity } from '../src/data/sanity';
import { getPrayerSteps } from '../src/data';
import { PRAYERS } from '../src/data/prayers';

assertPrayerIntegrity();

for (const prayer of PRAYERS) {
  const steps = getPrayerSteps(prayer.id);
  const first = steps.filter((s) => s.sitting === 'first').map((s) => `${s.rakah}:${s.title}`);
  const last = steps.filter((s) => s.sitting === 'last').map((s) => `${s.rakah}:${s.title}`);
  console.log(
    `${prayer.name} (${prayer.rakahCount} rekât): ${steps.length} adım | ilk oturuş=[${first.join(', ')}] | son=[${last.join(', ')}]`,
  );
}

console.log('Namaz veri kontrolü tamam.');
