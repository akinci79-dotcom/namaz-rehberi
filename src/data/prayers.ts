import type { PrayerDefinition, PrayerId } from '../types/prayer';

export const MADHAB_LABEL = 'Hanefi';

export const DISCLAIMER =
  'Bu uygulama, yaygın olarak öğretilen Hanefi uygulamaya dayanan kişisel bir yardımcıdır. Güvenilir bir âlime danışarak teyit ediniz. Fetva değildir.';

/**
 * Yalnız farz namazlar. Sünnet, vitir ve nafile bu sürümde yok.
 *
 * Belirsiz / sürüme alınmayan noktalar (buildSteps.ts ile birlikte):
 * - Dil ile niyet Hanefi'de şart değildir; kalp niyeti yeter. Öğrenen için örnek cümle verildi.
 * - Kadınlara özgü duruş farkları (el kaldırma, bağlama yeri, rükû/secde) ayrıntılı çizilmedi.
 * - Secde-i sehiv, imam-cemaat farkları ve kaza namazı yok.
 */
export const PRAYERS: readonly PrayerDefinition[] = [
  {
    id: 'sabah',
    name: 'Sabah',
    rakahCount: 2,
    recitation: 'cehri',
    summary: '2 rekât farz. İmam ilk iki rekâtta (yani her iki rekâtta) kıraati açıktan okur.',
  },
  {
    id: 'ogle',
    name: 'Öğle',
    rakahCount: 4,
    recitation: 'sirri',
    summary: '4 rekât farz. Kıraat gizlidir. 2. rekâttan sonra ilk oturuş vardır.',
  },
  {
    id: 'ikindi',
    name: 'İkindi',
    rakahCount: 4,
    recitation: 'sirri',
    summary: '4 rekât farz. Kıraat gizlidir. 2. rekâttan sonra ilk oturuş vardır.',
  },
  {
    id: 'aksam',
    name: 'Akşam',
    rakahCount: 3,
    recitation: 'cehri',
    summary: '3 rekât farz. İmam ilk iki rekâtta kıraati açıktan okur; 3. rekât gizlidir.',
  },
  {
    id: 'yatsi',
    name: 'Yatsı',
    rakahCount: 4,
    recitation: 'cehri',
    summary: '4 rekât farz. İmam ilk iki rekâtta açıktan okur; 3–4. rekât gizlidir.',
  },
] as const;

export function getPrayer(id: PrayerId): PrayerDefinition {
  const found = PRAYERS.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Bilinmeyen namaz: ${id}`);
  }
  return found;
}
