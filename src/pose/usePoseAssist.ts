import { useEffect, useRef, useState } from 'react';

import type { PrayerStep } from '../types/prayer';
import { classifyPose } from './classifyPose';
import { createPoseLandmarker, type PoseLandmarkerHandle } from './mediapipe';
import { cameraSupported, isWebRuntime } from './publicUrl';
import { poseForStepKind } from './stepPose';
import type { BodyPose } from './types';

export type AssistStatus = 'off' | 'loading' | 'running' | 'denied' | 'unsupported' | 'error';

const HOLD_MS = 700;
const COOLDOWN_MS = 850;
const FRAME_MS = 130;

interface Options {
  enabled: boolean;
  steps: readonly PrayerStep[];
  stepIndex: number;
  onAdvance: () => void;
}

export interface PoseAssistState {
  status: AssistStatus;
  detected: BodyPose;
  confidence: number;
  waitingFor: BodyPose | null;
  message: string | null;
  attachPreview: (host: HTMLElement | null) => void;
}

export function usePoseAssist({ enabled, steps, stepIndex, onAdvance }: Options): PoseAssistState {
  const [status, setStatus] = useState<AssistStatus>('off');
  const [detected, setDetected] = useState<BodyPose>('unknown');
  const [confidence, setConfidence] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;
  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const detectedRef = useRef<BodyPose>('unknown');
  const previewHostRef = useRef<HTMLElement | null>(null);

  const attachPreview = (host: HTMLElement | null) => {
    previewHostRef.current = host;
  };

  const current = steps[stepIndex];
  const next = steps[stepIndex + 1];
  const currentPose = current ? poseForStepKind(current.kind) : null;
  const nextPose = next ? poseForStepKind(next.kind) : null;
  const waitingFor = currentPose && nextPose && currentPose !== nextPose ? nextPose : null;

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      setDetected('unknown');
      setConfidence(0);
      setMessage(null);
      return;
    }

    if (!isWebRuntime() || !cameraSupported()) {
      setStatus('unsupported');
      setMessage('Bu tarayıcı kamerayı desteklemiyor. Sonraki / Önceki kullanın.');
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    let landmarker: PoseLandmarkerHandle | null = null;
    let raf = 0;
    let lastFrame = 0;
    let holdStarted = 0;
    let lastAdvance = 0;
    let prevPose: BodyPose | undefined;

    const cleanupVideo = () => {
      if (video) {
        video.srcObject = null;
        video.remove();
        video = null;
      }
    };

    const run = async () => {
      setStatus('loading');
      setMessage('Kamera ve model yükleniyor… Görüntü bu cihazdan çıkmaz.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 480 },
            height: { ideal: 360 },
            frameRate: { ideal: 18, max: 24 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.srcObject = stream;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.transform = 'scaleX(-1)';
        video.style.borderRadius = '10px';
        await video.play();

        const host = previewHostRef.current;
        if (host) {
          host.innerHTML = '';
          host.appendChild(video);
        }

        landmarker = await createPoseLandmarker();
        if (cancelled) {
          landmarker.close();
          return;
        }

        setStatus('running');
        setMessage(null);

        const tick = () => {
          if (cancelled || !video || !landmarker) {
            return;
          }
          const now = performance.now();
          if (now - lastFrame >= FRAME_MS && video.readyState >= 2) {
            lastFrame = now;
            try {
              const result = landmarker.detectForVideo(video, now);
              const points = result.landmarks?.[0];
              if (points) {
                const guess = classifyPose(points, prevPose);
                prevPose = guess.pose;
                detectedRef.current = guess.pose;
                setDetected(guess.pose);
                setConfidence(guess.confidence);

                const idx = stepIndexRef.current;
                const list = stepsRef.current;
                const here = list[idx];
                const nxt = list[idx + 1];
                if (here && nxt) {
                  const from = poseForStepKind(here.kind);
                  const to = poseForStepKind(nxt.kind);
                  const poseChanged = from !== to;
                  const matchesNext = guess.pose === to && guess.pose !== 'unknown';
                  if (poseChanged && matchesNext && now - lastAdvance > COOLDOWN_MS) {
                    if (!holdStarted) {
                      holdStarted = now;
                    } else if (now - holdStarted >= HOLD_MS) {
                      lastAdvance = now;
                      holdStarted = 0;
                      onAdvanceRef.current();
                    }
                  } else {
                    holdStarted = 0;
                  }
                }
              }
            } catch {
              // tek kare hatası döngüyü kesmesin
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const name = error instanceof Error ? error.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setStatus('denied');
          setMessage('Kamera izni verilmedi. Ayarlar → Safari → Kamera.');
        } else {
          setStatus('error');
          setMessage('Kamera açılamadı. Sonraki / Önceki ile devam edebilirsiniz.');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close();
      cleanupVideo();
    };
  }, [enabled]);

  return {
    status,
    detected,
    confidence,
    waitingFor,
    message,
    attachPreview,
  };
}
