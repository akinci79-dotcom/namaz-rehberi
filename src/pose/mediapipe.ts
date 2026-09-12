import { isWebRuntime, publicAssetUrl } from './publicUrl';
import type { PoseLandmark } from './types';

interface DetectResult {
  landmarks?: PoseLandmark[][];
}

export interface PoseLandmarkerHandle {
  detectForVideo(video: HTMLVideoElement, timestamp: number): DetectResult;
  close(): void;
}

interface TasksVisionModule {
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<unknown>;
  };
  PoseLandmarker: {
    createFromOptions: (
      fileset: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate?: 'CPU' | 'GPU' };
        runningMode: 'VIDEO';
        numPoses: number;
        minPoseDetectionConfidence?: number;
        minPosePresenceConfidence?: number;
        minTrackingConfidence?: number;
      },
    ) => Promise<PoseLandmarkerHandle>;
  };
}

async function importVisionBundle(): Promise<TasksVisionModule> {
  const url = publicAssetUrl('mediapipe/vision_bundle.mjs');
  const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<TasksVisionModule>;
  return dynamicImport(url);
}

export async function createPoseLandmarker(): Promise<PoseLandmarkerHandle> {
  if (!isWebRuntime()) {
    throw new Error('Kamera yardımcısı yalnızca web / Safari’de çalışır.');
  }

  const vision = await importVisionBundle();
  const wasmPath = publicAssetUrl('mediapipe/wasm');
  const modelPath = publicAssetUrl('models/pose_landmarker_lite.task');
  const fileset = await vision.FilesetResolver.forVisionTasks(wasmPath);

  try {
    return await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
  } catch {
    return vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
  }
}
