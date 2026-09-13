export type BodyPose = 'kiyam' | 'ruku' | 'secde' | 'oturus' | 'unknown';

export type Framing = 'none' | 'close' | 'partial' | 'ok';

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseGuess {
  pose: BodyPose;
  confidence: number;
  framing: Framing;
}

export const POSE_LABEL_TR: Record<BodyPose, string> = {
  kiyam: 'Kıyam',
  ruku: 'Rükû',
  secde: 'Secde',
  oturus: 'Oturuş',
  unknown: 'Belirsiz',
};

export const POSE_CUE_TR: Record<Exclude<BodyPose, 'unknown'>, string> = {
  kiyam: 'Şimdi ayağa kalkın',
  ruku: 'Şimdi rükûya eğilin',
  secde: 'Şimdi secdeye gidin',
  oturus: 'Şimdi oturun',
};
