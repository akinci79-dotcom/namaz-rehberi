import { useEffect, useMemo, useRef, useState } from 'react';

import type { PrayerStep } from '../types/prayer';
import {
  cameraDebugLine,
  cameraStatusText,
  expectedPoseForTransition,
  tickCameraAdvance,
  type AdvanceHint,
  type CameraTickResult,
} from './cameraAdvance';
import { classifyPose } from './classifyPose';
import { createPoseLandmarker, type PoseLandmarkerHandle } from './mediapipe';
import { cameraSupported, isWebRuntime } from './publicUrl';
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

const COOLDOWN_MS = 400;
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
  passedFlash: boolean;
  attachPreview: (host: HTMLElement | null) => void;
}

const IDLE_TICK: CameraTickResult = {
  advance: false,
  commitCurrent: false,
  hint: 'none',
  currentPose: 'unknown',
  expectedPose: null,
  waitingFor: null,
  secde2Ready: false,
  samePose: false,
};

export function usePoseAssist({ enabled, steps, stepIndex, onAdvance }: Options): PoseAssistState {
  const [status, setStatus] = useState<AssistStatus>('off');
  const [detected, setDetected] = useState<BodyPose>('unknown');
  const [framing, setFraming] = useState<Framing>('none');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [tick, setTick] = useState<CameraTickResult>(IDLE_TICK);
  const [passedLabel, setPassedLabel] = useState<string | null>(null);
  // Teşhis amaçlı: gerçek kamera akışının çözünürlüğü (yatay mı dikey mi geldiği
  // önizleme kırpma hatalarını ayırt etmek için debug satırında gösterilir).
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);

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
      setPassedLabel(null);
      setVideoSize(null);
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
    let lastTickAt = performance.now();
    let lastAdvance = 0;
    let gateStep = -1;
    let holdExpectedMs = 0;
    let currentConfirmed = false;
    let prevPose: BodyPose | undefined;
    let stablePose: BodyPose = 'unknown';
    let publishedPose: BodyPose = 'unknown';
    let stableCount = 0;
    let modelReady = false;
    let passedTimer: ReturnType<typeof setTimeout> | undefined;

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
        holdExpectedMs = 0;
        currentConfirmed = false;
      }
      if (now - lastAdvance < COOLDOWN_MS) {
        return;
      }

      const dt = Math.min(Math.max(0, now - lastTickAt), 250);
      lastTickAt = now;

      const expected = expectedPoseForTransition(list, idx, currentConfirmed);
      if (expected && pose === expected) {
        holdExpectedMs += dt;
      } else if (pose !== 'unknown' && pose !== expected) {
        holdExpectedMs = 0;
      }

      const result = tickCameraAdvance({
        steps: list,
        index: idx,
        detected: pose,
        holdExpectedMs,
        currentConfirmed,
        modelReady,
      });
      setTick(result);

      if (result.commitCurrent) {
        currentConfirmed = true;
        holdExpectedMs = 0;
        return;
      }

      // Algı beklenen duruşu HOLD süresince tuttuysa Sonraki ile aynı ilerleme.
      if (result.advance) {
        lastAdvance = now;
        holdExpectedMs = 0;
        const nxt = list[idx + 1];
        const label = nxt ? `Geçildi: ${nxt.title}` : 'Geçildi';
        setPassedLabel(label);
        clearTimeout(passedTimer);
        passedTimer = setTimeout(() => {
          if (!cancelled) {
            setPassedLabel(null);
          }
        }, 1400);
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
        // 'cover' + 'center top' varsayımı: kaynak video YATAY (1280x720) olur.
        // iOS Safari, telefon dikeyken ön kamerayı çoğu zaman DİKEY bir akış
        // (ör. 720x1280) olarak döndürür. O durumda 'cover' videoyu container'a
        // sığdırmak için YÜKSEKLİĞE göre ölçekler, video container'dan çok daha
        // uzun kalır ve 'top' çapası ALT kısmı (genelde gövdenin olduğu yer)
        // kırpıp yalnızca ÜST kısmı (başın üstü — tavan) gösterir. 'contain' ile
        // hiçbir kırpma olmaz; kullanıcı kameranın GERÇEKTEN ne gördüğünü görür.
        video.style.objectFit = 'contain';
        video.style.objectPosition = 'center';
        video.style.transform = 'scaleX(-1)';
        video.style.borderRadius = '0';
        video.style.background = '#0C100E';
        await video.play();
        mountVideo(video);
        setVideoSize({ width: video.videoWidth, height: video.videoHeight });

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
      clearTimeout(passedTimer);
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
      // Diz/ayak bileği görünmezse secde ile oturuş, kıyamdan güvenle ayırt edilemez
      // (bkz. classifyPose.ts). Kullanıcıyı susarak yanlış algılatmak yerine uyarıyoruz.
      legsMissing: framing === 'partial' && (tick.waitingFor === 'secde' || tick.waitingFor === 'oturus'),
      detected,
      tick,
      passedLabel,
    });
  }, [enabled, status, loadMessage, framing, detected, tick, passedLabel]);

  const debugLine = useMemo(() => {
    const base = cameraDebugLine(detected, tick);
    return videoSize ? `${base} · cam: ${videoSize.width}x${videoSize.height}` : base;
  }, [detected, tick, videoSize]);

  const cuePose = tick.waitingFor;
  const cue =
    cuePose &&
    cuePose !== 'unknown' &&
    enabled &&
    status === 'running' &&
    !passedLabel
      ? POSE_CUE_TR[cuePose]
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
    passedFlash: Boolean(passedLabel),
    attachPreview,
  };
}
