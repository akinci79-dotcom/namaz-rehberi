import type { PrayerDefinition, PrayerId, PrayerRank } from '../types/prayer';

export const MADHAB_LABEL = 'Hanefi';

export const RANK_LABEL: Record<PrayerRank, string> = {
  farz: 'Farz',
  vacip: 'Vacip',
};

export const DISCLAIMER =
  'Bu uygulama, yaygın olarak öğretilen Hanefi uygulamaya dayanan kişisel bir yardımcıdır. Güvenilir bir âlime danışarak teyit ediniz. Fetva değildir.';

/**
 * Farz vakit namazları + Hanefi vitir (vacip).
 * Sünnet ve nafile bu sürümde yok.
 *
 * Belirsiz / sürüme alınmayan noktalar (buildSteps.ts ile birlikte):
 * - Dil ile niyet Hanefi'de şart değildir; kalp niyeti yeter. Öğrenen için örnek cümle verildi.
 * - Kadınlara özgü duruş farkları (el kaldırma, bağlama yeri, rükû/secde) ayrıntılı çizilmedi.
 * - Secde-i sehiv, imam-cemaat farkları ve kaza namazı yok.
 * - Vitir kunut lafzı kitaba göre değişir; yaygın “Allahümme innâ nestaînüke” örneği verildi.
 */
export const PRAYERS: readonly PrayerDefinition[] = [
  {
    id: 'sabah',
    name: 'Sabah',
    rakahCount: 2,
    rank: 'farz',
    recitation: 'cehri',
    summary: '2 rekât farz. İmam ilk iki rekâtta (yani her iki rekâtta) kıraati açıktan okur.',
  },
  {
    id: 'ogle',
    name: 'Öğle',
    rakahCount: 4,
    rank: 'farz',
    recitation: 'sirri',
    summary: '4 rekât farz. Kıraat gizlidir. 2. rekâttan sonra ilk oturuş vardır.',
  },
  {
    id: 'ikindi',
    name: 'İkindi',
    rakahCount: 4,
    rank: 'farz',
    recitation: 'sirri',
    summary: '4 rekât farz. Kıraat gizlidir. 2. rekâttan sonra ilk oturuş vardır.',
  },
  {
    id: 'aksam',
    name: 'Akşam',
    rakahCount: 3,
    rank: 'farz',
    recitation: 'cehri',
    summary: '3 rekât farz. İmam ilk iki rekâtta kıraati açıktan okur; 3. rekât gizlidir.',
  },
  {
    id: 'yatsi',
    name: 'Yatsı',
    rakahCount: 4,
    rank: 'farz',
    recitation: 'cehri',
    summary: '4 rekât farz. İmam ilk iki rekâtta açıktan okur; 3–4. rekât gizlidir.',
  },
  {
    id: 'vitir',
    name: 'Vitir',
    rakahCount: 3,
    rank: 'vacip',
    recitation: 'sirri',
    kunut: 'before-ruku',
    summary:
      '3 rekât vacip, tek selam. 2. rekâttan sonra ilk oturuş; 3. rekâtta rükûdan önce kunut.',
  },
] as const;

export function getPrayer(id: PrayerId): PrayerDefinition {
  const found = PRAYERS.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Bilinmeyen namaz: ${id}`);
  }
  return found;
}

export function rankLabel(prayer: PrayerDefinition): string {
  return RANK_LABEL[prayer.rank];
}
