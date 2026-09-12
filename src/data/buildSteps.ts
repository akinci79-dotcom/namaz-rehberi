import type { PrayerDefinition, PrayerStep, RecitationMode } from '../types/prayer';
import {
  ALLAHU_AKBAR,
  DUAA_RABBENA,
  KAVME,
  RUKU_TASBIH,
  SALAM,
  SALAVAT,
  SECDE_TASBIH,
  SUBHANEKE,
  TAHIYYAT,
} from './phrases';

/**
 * Hanefi farz akışı — yaygın ilmihal öğretisi (erkeklere göre duruş notu; mümkün yerde nötr).
 *
 * Rekât içi: kıyam → rükû → kavme → 1. secde → celse → 2. secde
 *   → (son rekât değilse) ayağa kalk  veya  (2. rekât + 3/4 rekâtlı namaz) ilk oturuş → kalk
 *   → (son rekât) son oturuş (tahiyyat, salavat, dua) → selam
 *
 * Kıyam kıraati (farz, yaygın öğreti):
 *  - 1. rekât: Sübhaneke, Eûzü, Besmele, Fâtiha, zamm-ı sure
 *  - 2. rekât: Besmele, Fâtiha, zamm-ı sure
 *  - 3. ve 4. rekât (farz): Besmele, yalnızca Fâtiha — zamm-ı sure okunmaz
 *
 * Belirsizlik / tercih notları:
 *  - Eûzü yalnızca 1. rekâtta (yaygın Hanefi). Her rekâtta okuyan da vardır; bu sürümde 1. rekât.
 *  - Besmele her rekâtta Fâtiha'dan önce içinden.
 *  - İlk oturuşta yalnızca Ettehiyyâtü; salavat son oturuşa bırakılır.
 *    (İlk oturuşta salavat okuyan için bazı Hanefi kaynaklarda sehiv secdesi geçer; burada okunmaması öğretilir.)
 *  - Son dua metni değişebilir; Rabbenâ âtinâ yaygın bir örnektir, şart değildir.
 *  - Cehrî/sırrî imam için geçerlidir; tek başına kılan genelde içinden okur.
 */
export function buildSteps(prayer: PrayerDefinition): PrayerStep[] {
  const steps: PrayerStep[] = [];
  const total = prayer.rakahCount;
  let seq = 0;

  const push = (partial: Omit<PrayerStep, 'id' | 'prayerId' | 'totalRakah'>): void => {
    seq += 1;
    steps.push({
      ...partial,
      id: `${prayer.id}-${seq}-${partial.kind}`,
      prayerId: prayer.id,
      totalRakah: total,
    });
  };

  push({
    rakah: 1,
    kind: 'niyet',
    title: 'Niyet',
    instruction: `Kalbinden ${prayer.name} namazının ${total} rekât farzını Allah rızası için kılmaya niyet et. Dil ile söylemek Hanefi'de şart değildir; öğrenirken örnek: “Niyet ettim Allah rızası için bugünkü ${prayer.name.toLocaleLowerCase('tr-TR')} namazının farzını kılmaya.”`,
  });

  push({
    rakah: 1,
    kind: 'iftitah',
    title: 'İftitah tekbiri',
    instruction:
      'Ellerini kulak veya omuz hizasına kadar kaldırarak Allahü Ekber de. Ardından sağ elini sol elinin üzerine koyarak bağla. (Yaygın Hanefi öğreti: erkekler ellerini göbek altında, kadınlar göğüs üzerinde bağlar.)',
    arabic: ALLAHU_AKBAR,
  });

  for (let rakah = 1; rakah <= total; rakah += 1) {
    push(kiyamStep(rakah, total, prayer.recitation));

    push({
      rakah,
      kind: 'ruku',
      title: 'Rükû',
      instruction:
        'Allahü Ekber diyerek rükûya eğil. Sırtını mümkün olduğunca düz tut. En az üç defa Sübhane Rabbiyel Azîm de.',
      arabic: RUKU_TASBIH,
    });

    push({
      rakah,
      kind: 'kavme',
      title: 'Kavme',
      instruction:
        'Rükûdan doğrul. “Semiallahü limen hamideh” de, ardından “Rabbenâ lekel hamd.” Kısa bir an ayakta dur; hemen secdeye inme.',
      arabic: KAVME,
    });

    push({
      rakah,
      kind: 'secde1',
      title: '1. Secde',
      instruction:
        'Allahü Ekber diyerek secdeye git. Alın, burun, avuç içleri, dizler ve ayak parmakları yere değsin. En az üç defa Sübhane Rabbiyel A‘lâ de.',
      arabic: SECDE_TASBIH,
    });

    push({
      rakah,
      kind: 'celse',
      title: 'Celse',
      instruction:
        'Allahü Ekber diyerek iki secde arasında otur. Kısa bir dur. Dilersen “Allahümmeğfirlî” diyebilirsin.',
      sitting: 'middle',
    });

    push({
      rakah,
      kind: 'secde2',
      title: '2. Secde',
      instruction:
        'Allahü Ekber diyerek ikinci secdeye git. Yine en az üç defa Sübhane Rabbiyel A‘lâ de.',
      arabic: SECDE_TASBIH,
    });

    const isLast = rakah === total;
    const isFirstSitting = rakah === 2 && total >= 3;

    if (isLast) {
      push({
        rakah,
        kind: 'tahiyyat',
        title: 'Son oturuş',
        instruction:
          'Son rekâtın ikinci secdesinden sonra otur. Sırayla Ettehiyyâtü, salli-barik (salavat) ve bir dua oku. Dua şart olan belirli bir metin değildir; yaygın örnek Rabbenâ âtinâ’dır.',
        arabic: `${TAHIYYAT}\n\n${SALAVAT}\n\n${DUAA_RABBENA}`,
        sitting: 'last',
      });

      push({
        rakah,
        kind: 'selam',
        title: 'Selam',
        instruction:
          'Önce sağa, sonra sola dönerek “Es-selâmü aleyküm ve rahmetullah” de. Namaz tamamlanır.',
        arabic: SALAM,
        sitting: 'last',
      });
    } else if (isFirstSitting) {
      push({
        rakah,
        kind: 'tahiyyat',
        title: 'İlk oturuş',
        instruction:
          'İkinci rekâtın ikinci secdesinden sonra otur. Yalnızca Ettehiyyâtü’yü oku. Salavat bu oturuşta okunmaz. Bitince üçüncü rekâta kalkılacak.',
        arabic: TAHIYYAT,
        sitting: 'first',
      });

      push({
        rakah,
        kind: 'kalkis',
        title: 'Ayağa kalk',
        instruction: 'Allahü Ekber diyerek üçüncü rekâta kalk. Eller bu kalkışta kaldırılmaz (yaygın Hanefi öğreti).',
        arabic: ALLAHU_AKBAR,
      });
    } else {
      push({
        rakah,
        kind: 'kalkis',
        title: 'Ayağa kalk',
        instruction: `Allahü Ekber diyerek ${rakah + 1}. rekâta kalk.`,
        arabic: ALLAHU_AKBAR,
      });
    }
  }

  return steps;
}

function kiyamStep(
  rakah: number,
  total: number,
  recitation: RecitationMode,
): Omit<PrayerStep, 'id' | 'prayerId' | 'totalRakah'> {
  const voiceHint = recitationHint(rakah, recitation);
  const hasZammSure = rakah <= 2;

  if (rakah === 1) {
    return {
      rakah,
      kind: 'kiyam',
      title: 'Kıyam',
      instruction: `Ayakta dur. Sırayla Sübhaneke, Eûzü, Besmele, Fâtiha ve zamm-ı sure (kısa bir sure veya birkaç âyet; örn. İhlas, Kevser, Fil) oku. ${voiceHint}`,
      arabic: SUBHANEKE,
    };
  }

  if (hasZammSure) {
    return {
      rakah,
      kind: 'kiyam',
      title: 'Kıyam',
      instruction: `Ayakta: Besmele, Fâtiha ve zamm-ı sure oku. Sübhaneke ve Eûzü bu rekâtta tekrarlanmaz. ${voiceHint}`,
    };
  }

  return {
    rakah,
    kind: 'kiyam',
    title: 'Kıyam',
    instruction: `Ayakta: Besmele ve yalnızca Fâtiha oku. Farzın ${total === 3 ? 'üçüncü' : 'üçüncü ve dördüncü'} rekâtında zamm-ı sure okunmaz (yaygın Hanefi öğreti). ${voiceHint}`,
  };
}

function recitationHint(rakah: number, recitation: RecitationMode): string {
  if (recitation === 'sirri') {
    return 'Kıraat gizlidir (öğle / ikindi).';
  }
  if (rakah <= 2) {
    return 'İmam bu rekâtta Fâtiha ve zamm-ı sureyi açıktan okur; tek başına kılan genelde içinden okur.';
  }
  return 'Bu rekâtta kıraat gizlidir.';
}

export function getNextTitle(steps: readonly PrayerStep[], index: number): string | null {
  const next = steps[index + 1];
  return next ? next.title : null;
}
