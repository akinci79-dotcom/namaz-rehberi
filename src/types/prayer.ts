export type PrayerId = 'sabah' | 'ogle' | 'ikindi' | 'aksam' | 'yatsi' | 'vitir';

/** İlk ka'de, iki secde arası (celse), son ka'de */
export type SittingKind = 'first' | 'middle' | 'last';

export type RecitationMode = 'cehri' | 'sirri';

/** Farz vakit namazı veya Hanefi'de vacip olan vitir */
export type PrayerRank = 'farz' | 'vacip';

export type StepKind =
  | 'niyet'
  | 'iftitah'
  | 'kiyam'
  | 'ruku'
  | 'kavme'
  | 'secde1'
  | 'celse'
  | 'secde2'
  | 'kalkis'
  | 'kunut'
  | 'tahiyyat'
  | 'selam';

export interface PrayerDefinition {
  id: PrayerId;
  name: string;
  rakahCount: number;
  rank: PrayerRank;
  /** İlk iki rekâtta imam için yaygın öğreti; tek başına kılan genelde içinden okur. */
  recitation: RecitationMode;
  summary: string;
  /** Hanefi vitir: 3. rekâtta rükûdan önce kunut */
  kunut?: 'before-ruku';
}

export interface PrayerStep {
  id: string;
  prayerId: PrayerId;
  rakah: number;
  totalRakah: number;
  kind: StepKind;
  title: string;
  instruction: string;
  arabic?: string;
  sitting?: SittingKind;
}

export type AppRoute =
  | { name: 'home' }
  | { name: 'prayer'; prayerId: PrayerId }
  | { name: 'done'; prayerId: PrayerId };
