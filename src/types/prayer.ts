export type PrayerId = 'sabah' | 'ogle' | 'ikindi' | 'aksam' | 'yatsi';

/** İlk ka'de, iki secde arası (celse), son ka'de */
export type SittingKind = 'first' | 'middle' | 'last';

export type RecitationMode = 'cehri' | 'sirri';

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
  | 'tahiyyat'
  | 'selam';

export interface PrayerDefinition {
  id: PrayerId;
  name: string;
  rakahCount: number;
  /** İlk iki rekâtta imam için yaygın öğreti; tek başına kılan genelde içinden okur. */
  recitation: RecitationMode;
  summary: string;
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
