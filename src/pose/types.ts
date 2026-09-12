export type BodyPose = 'kiyam' | 'ruku' | 'secde' | 'oturus' | 'unknown';

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseGuess {
  pose: BodyPose;
  confidence: number;
}

export const POSE_LABEL_TR: Record<BodyPose, string> = {
  kiyam: 'Kıyam',
  ruku: 'Rükû',
  secde: 'Secde',
  oturus: 'Oturuş',
  unknown: 'Algılanamadı',
};
