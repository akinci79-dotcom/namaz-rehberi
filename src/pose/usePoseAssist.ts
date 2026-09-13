import { useEffect, useMemo, useRef, useState } from 'react';

import type { PrayerStep } from '../types/prayer';
import {
  cameraDebugLine,
  cameraStatusText,
  tickCameraAdvance,
  type AdvanceHint,
  type CameraTickResult,
} from './cameraAdvance';
import { classifyPose } from './classifyPose';
import { createPoseLandmarker, type PoseLandmarkerHandle } from './mediapipe';
import { cameraSupported, isWebRuntime } from './publicUrl';
import { poseForStepKind } from './stepPose';
import type { BodyPose, Framing } from './types';
import { POSE_CUE_TR } from './types';

export type AssistStatus =
  | 'off'
  | 'loading'
  | 'running'
  | 'degraded'
  | 'denied'
  | 'unsupported'
  | 'error';

const COOLDOWN_MS = 500;
const FRAME_MS = 140;

interface Options {
  enabled: boolean;
  steps: readonly PrayerStep[];
  stepIndex: number;
  onAdvance: () => void;
}

export interface PoseAssistState {
  status: AssistStatus;
  detected: BodyPose;
  framing: Framing;
  waitingFor: BodyPose | null;
  cue: string | null;
  countdownSec: number | null;
  statusText: string;
  debugLine: string;
  advanceHint: AdvanceHint;
  expectedPose: BodyPose | null;
  attachPreview: (host: HTMLElement | null) => void;
}

const IDLE_TICK: CameraTickResult = {
  advance: false,
  hint: 'none',
  seenCurrent: false,
  currentPose: 'unknown',
  expectedPose: null,
  waitingFor: null,
  secde2Confirmed: false,
  samePose: false,
};

export function usePoseAssist({ enabled, steps, stepIndex, onAdvance }: Options): PoseAssistState {
  const [status, setStatus] = useState<AssistStatus>('off');
  const [detected, setDetected] = useState<BodyPose>('unknown');
  const [framing, setFraming] = useState<Framing>('none');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [tick, setTick] = useState<CameraTickResult>(IDLE_TICK);

  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;
  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const previewHostRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const attachPreview = (host: HTMLElement | null) => {
    previewHostRef.current = host;
    const video = videoRef.current;
    if (host && video && video.parentElement !== host) {
      host.innerHTML = '';
      host.appendChild(video);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      setDetected('unknown');
      setFraming('none');
      setLoadMessage(null);
      setTick(IDLE_TICK);
      return;
    }

    if (!isWebRuntime() || !cameraSupported()) {
      setStatus('unsupported');
      setLoadMessage('Bu tarayıcı kamerayı desteklemiyor. Sonraki / Önceki kullanın.');
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarkerHandle | null = null;
    let raf = 0;
    let lastFrame = 0;
    let lastTickAt = 0;
    let lastAdvance = 0;
    let gateStep = -1;
    let seenCurrentMs = 0;
    let matchingNextMs = 0;
    let currentCommitted = false;
    let prevPose: BodyPose | undefined;
    let stablePose: BodyPose = 'unknown';
    let publishedPose: BodyPose = 'unknown';
    let stableCount = 0;
    let modelReady = false;

    const mountVideo = (video: HTMLVideoElement) => {
      videoRef.current = video;
      const host = previewHostRef.current;
      if (host && video && video.parentElement !== host) {
        host.innerHTML = '';
        host.appendChild(video);
      }
    };

    const runGate = (now: number, pose: BodyPose) => {
      const idx = stepIndexRef.current;
      const list = stepsRef.current;
      const here = list[idx];
      if (!here) {
        return;
      }
      if (gateStep !== idx) {
        gateStep = idx;
        seenCurrentMs = 0;
        matchingNextMs = 0;
        currentCommitted = false;
      }
      if (now - lastAdvance < COOLDOWN_MS) {
        return;
      }

      const dt = lastTickAt ? Math.min(now - lastTickAt, 250) : 0;
      lastTickAt = now;
      const nxt = list[idx + 1];
      const from = poseForStepKind(here.kind);
      const to = nxt ? poseForStepKind(nxt.kind) : null;

      if (pose === from) {
        seenCurrentMs += dt;
        if (seenCurrentMs >= 400) {
          currentCommitted = true;
        }
      }
      if (to && pose === to) {
        matchingNextMs += dt;
      } else {
        matchingNextMs = 0;
      }

      const result = tickCameraAdvance({
        currentKind: here.kind,
        nextKind: nxt?.kind,
        detected: pose,
        seenCurrentMs: currentCommitted ? Math.max(seenCurrentMs, 400) : seenCurrentMs,
        matchingNextMs,
        modelReady,
      });
      setTick(result);
      if (result.advance) {
        lastAdvance = now;
        matchingNextMs = 0;
        onAdvanceRef.current();
      }
    };

    const run = async () => {
      setStatus('loading');
      setLoadMessage('Kamera ve model yükleniyor… Görüntü bu cihazdan çıkmaz.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        try {
          const track = stream.getVideoTracks()[0];
          const caps = track?.getCapabilities?.() as { zoom?: { min: number } } | undefined;
          if (track && caps?.zoom) {
            await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] as never });
          }
        } catch {
          // zoom yoksa devam
        }

        const video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.srcObject = stream;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.objectPosition = 'center top';
        video.style.transform = 'scaleX(-1)';
        video.style.borderRadius = '0';
        video.style.background = '#0C100E';
        await video.play();
        mountVideo(video);

        try {
          landmarker = await createPoseLandmarker();
          modelReady = true;
        } catch {
          landmarker = null;
          modelReady = false;
          if (!cancelled) {
            setStatus('degraded');
            setLoadMessage('Duruş modeli yüklenemedi. Yalnızca Sonraki / Önceki.');
          }
        }

        if (cancelled) {
          landmarker?.close();
          return;
        }

        if (landmarker) {
          setStatus('running');
          setLoadMessage(null);
        }

        lastTickAt = performance.now();
        gateStep = stepIndexRef.current;

        const loop = () => {
          if (cancelled) {
            return;
          }
          const now = performance.now();
          let pose: BodyPose = publishedPose;

          if (landmarker && video.readyState >= 2 && now - lastFrame >= FRAME_MS) {
            lastFrame = now;
            try {
              const result = landmarker.detectForVideo(video, now);
              const points = result.landmarks?.[0];
              if (!points) {
                setFraming((prev) => (prev === 'ok' ? 'partial' : 'none'));
                setDetected('unknown');
                pose = 'unknown';
                stableCount = 0;
                stablePose = 'unknown';
              } else {
                const guess = classifyPose(points, prevPose);
                prevPose = guess.pose;
                setFraming(guess.framing);
                if (guess.pose === stablePose) {
                  stableCount += 1;
                } else {
                  stableCount = 1;
                  stablePose = guess.pose;
                }
                if (stableCount >= 3 || guess.pose === 'unknown') {
                  publishedPose = guess.pose;
                  setDetected(guess.pose);
                  pose = guess.pose;
                } else {
                  pose = publishedPose;
                }
              }
            } catch {
              // tek kare
            }
            mountVideo(video);
          }

          runGate(now, pose);
          raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const name = error instanceof Error ? error.name : '';
        const text = error instanceof Error ? error.message : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setStatus('denied');
          setLoadMessage('Kamera izni verilmedi. Ayarlar → Safari → Kamera.');
        } else if (text.includes('model') || text.includes('wasm') || text.includes('Vision')) {
          setStatus('error');
          setLoadMessage('Duruş modeli yüklenemedi. Sonraki / Önceki kullanın.');
        } else {
          setStatus('error');
          setLoadMessage('Kamera açılamadı. Sonraki / Önceki ile devam edebilirsiniz.');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, [enabled]);

  const statusText = useMemo(() => {
    if (!enabled) {
      return 'Kapalı — duruşla ilerleme yok';
    }
    if (status === 'loading') {
      return loadMessage ?? 'Yükleniyor…';
    }
    if (status === 'denied' || status === 'unsupported' || status === 'error') {
      return loadMessage ?? 'Kamera kullanılamıyor.';
    }
    if (status === 'degraded' && loadMessage) {
      return loadMessage;
    }
    return cameraStatusText({
      framingClose: framing === 'close',
      bodyMissing: framing === 'none' && detected === 'unknown',
      detected,
      tick,
    });
  }, [enabled, status, loadMessage, framing, detected, tick]);

  const debugLine = useMemo(() => cameraDebugLine(detected, tick), [detected, tick]);

  const cue =
    tick.waitingFor &&
    tick.waitingFor !== 'unknown' &&
    enabled &&
    status === 'running'
      ? POSE_CUE_TR[tick.waitingFor]
      : null;

  return {
    status,
    detected,
    framing,
    waitingFor: tick.waitingFor,
    cue,
    countdownSec: null,
    statusText,
    debugLine,
    advanceHint: tick.hint,
    expectedPose: tick.expectedPose,
    attachPreview,
  };
}
