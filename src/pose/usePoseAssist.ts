import { useEffect, useMemo, useRef, useState } from 'react';

import type { PrayerStep } from '../types/prayer';
import { classifyPose } from './classifyPose';
import { createPoseLandmarker, type PoseLandmarkerHandle } from './mediapipe';
import { cameraSupported, isWebRuntime } from './publicUrl';
import { poseForStepKind, poseWaitFallbackMs, samePoseDwellMs } from './stepPose';
import type { BodyPose, Framing } from './types';
import { POSE_CUE_TR, POSE_LABEL_TR } from './types';

export type AssistStatus =
  | 'off'
  | 'loading'
  | 'running'
  | 'degraded'
  | 'denied'
  | 'unsupported'
  | 'error';

const HOLD_MS = 750;
const COOLDOWN_MS = 900;
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
  attachPreview: (host: HTMLElement | null) => void;
}

export function usePoseAssist({ enabled, steps, stepIndex, onAdvance }: Options): PoseAssistState {
  const [status, setStatus] = useState<AssistStatus>('off');
  const [detected, setDetected] = useState<BodyPose>('unknown');
  const [framing, setFraming] = useState<Framing>('none');
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

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

  const current = steps[stepIndex];
  const next = steps[stepIndex + 1];
  const currentPose = current ? poseForStepKind(current.kind) : null;
  const nextPose = next ? poseForStepKind(next.kind) : null;
  const waitingFor = currentPose && nextPose && currentPose !== nextPose ? nextPose : null;

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      setDetected('unknown');
      setFraming('none');
      setCountdownSec(null);
      setLoadMessage(null);
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
    let holdStarted = 0;
    let lastAdvance = 0;
    let timerAnchor = performance.now();
    let timerStep = -1;
    let prevPose: BodyPose | undefined;
    let stablePose: BodyPose = 'unknown';
    let publishedPose: BodyPose = 'unknown';
    let stableCount = 0;

    const mountVideo = (video: HTMLVideoElement) => {
      videoRef.current = video;
      const host = previewHostRef.current;
      if (host && video.parentElement !== host) {
        host.innerHTML = '';
        host.appendChild(video);
      }
    };

    const advance = (now: number) => {
      lastAdvance = now;
      holdStarted = 0;
      timerAnchor = now;
      timerStep = stepIndexRef.current + 1;
      onAdvanceRef.current();
    };

    const runTimers = (now: number, pose: BodyPose) => {
      const idx = stepIndexRef.current;
      const list = stepsRef.current;
      const here = list[idx];
      if (!here) {
        return;
      }
      if (timerStep !== idx) {
        timerStep = idx;
        timerAnchor = now;
        holdStarted = 0;
      }
      if (now - lastAdvance < COOLDOWN_MS) {
        return;
      }

      const nxt = list[idx + 1];
      const from = poseForStepKind(here.kind);
      const to = nxt ? poseForStepKind(nxt.kind) : null;
      const samePose = !to || from === to;

      if (samePose) {
        const dwell = samePoseDwellMs(here);
        const left = Math.max(0, dwell - (now - timerAnchor));
        setCountdownSec(Math.ceil(left / 1000));
        if (left <= 0) {
          setCountdownSec(null);
          advance(now);
        }
        return;
      }

      if (pose === to && pose !== 'unknown') {
        if (!holdStarted) {
          holdStarted = now;
        }
        const leftHold = Math.max(0, HOLD_MS - (now - holdStarted));
        setCountdownSec(leftHold > 0 ? 1 : null);
        if (now - holdStarted >= HOLD_MS) {
          setCountdownSec(null);
          advance(now);
        }
        return;
      }

      holdStarted = 0;
      const fallback = poseWaitFallbackMs(here);
      const left = Math.max(0, fallback - (now - timerAnchor));
      setCountdownSec(Math.ceil(left / 1000));
      if (left <= 0) {
        setCountdownSec(null);
        advance(now);
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
        video.style.transform = 'scaleX(-1)';
        video.style.borderRadius = '10px';
        await video.play();
        mountVideo(video);

        try {
          landmarker = await createPoseLandmarker();
        } catch {
          landmarker = null;
          if (!cancelled) {
            setStatus('degraded');
            setLoadMessage('Duruş modeli yüklenemedi. Adımlar zamanlayıcıyla ilerleyecek.');
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

        timerAnchor = performance.now();
        timerStep = stepIndexRef.current;

        const tick = () => {
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
                if (stableCount >= 2 || guess.pose === 'unknown') {
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

          if (statusAllowsTimers()) {
            runTimers(now, pose);
          }
          raf = requestAnimationFrame(tick);
        };

        const statusAllowsTimers = () => true;
        raf = requestAnimationFrame(tick);
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

  const statusText = useMemo(
    () =>
      buildStatusText({
        enabled,
        status,
        loadMessage,
        detected,
        framing,
        waitingFor,
        current,
        next,
        countdownSec,
      }),
    [enabled, status, loadMessage, detected, framing, waitingFor, current, next, countdownSec],
  );

  const cue =
    waitingFor &&
    waitingFor !== 'unknown' &&
    enabled &&
    (status === 'running' || status === 'degraded')
      ? POSE_CUE_TR[waitingFor]
      : null;

  return {
    status,
    detected,
    framing,
    waitingFor,
    cue,
    countdownSec,
    statusText,
    attachPreview,
  };
}

function buildStatusText(input: {
  enabled: boolean;
  status: AssistStatus;
  loadMessage: string | null;
  detected: BodyPose;
  framing: Framing;
  waitingFor: BodyPose | null;
  current: PrayerStep | undefined;
  next: PrayerStep | undefined;
  countdownSec: number | null;
}): string {
  const { enabled, status, loadMessage, detected, framing, waitingFor, current, next, countdownSec } =
    input;
  if (!enabled) {
    return 'Kapalı — duruşla otomatik ilerleme yok';
  }
  if (status === 'loading') {
    return loadMessage ?? 'Yükleniyor…';
  }
  if (status === 'denied' || status === 'unsupported' || status === 'error') {
    return loadMessage ?? 'Kamera kullanılamıyor.';
  }
  if (status === 'degraded' && loadMessage) {
    const extra =
      countdownSec != null && next
        ? ` ${countdownSec} sn sonra: ${next.title}.`
        : '';
    return loadMessage + extra;
  }

  if (framing === 'none' && detected === 'unknown') {
    const extra = countdownSec != null ? ` ${countdownSec} sn sonra otomatik ilerler.` : '';
    return `Vücut görünmüyor — telefonu uzaklaştırın, baş-omuz-bel kadraja girsin.${extra}`;
  }
  if (framing === 'close') {
    const extra = countdownSec != null ? ` ${countdownSec} sn sonra otomatik.` : '';
    return `Yüz çok yakın — telefonu biraz uzaklaştırın, tüm gövde kadraja girsin.${extra}`;
  }

  if (waitingFor && waitingFor !== 'unknown') {
    const cue = POSE_CUE_TR[waitingFor];
    if (detected === waitingFor) {
      return `${POSE_LABEL_TR[detected]} algılandı — geçiliyor`;
    }
    if (detected !== 'unknown' && current && detected === poseForStepKind(current.kind)) {
      return `${POSE_LABEL_TR[detected]} duruyor. ${cue}${
        countdownSec != null ? ` (yedek ${countdownSec} sn)` : ''
      }`;
    }
    return `${cue}${countdownSec != null ? ` · yedek ${countdownSec} sn` : ''}`;
  }

  if (next && countdownSec != null) {
    const seen =
      detected !== 'unknown' ? `${POSE_LABEL_TR[detected]} algılandı. ` : '';
    return `${seen}${countdownSec} sn sonra: ${next.title}`;
  }

  if (detected !== 'unknown') {
    return `${POSE_LABEL_TR[detected]} algılandı`;
  }
  return 'Hazır';
}
