import { useEffect, useMemo, useRef, useState } from 'react';

import type { PrayerStep } from '../types/prayer';
import {
  accumulateHold,
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
import { logSessionEvent, resetSessionLog } from './sessionLog';
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
// ÖNEMLİ: kullanıcı gerçek namazda "kaplumbağa gibi çok yavaş hareket etmek
// gerekiyor, hızlı hareket edince algılamıyor" diye bildirdi. Zincir şöyleydi:
// her 140ms'de bir kare işleniyor → 3 ardışık kare aynı pozu göstermeden algı
// bile yayınlanmıyordu (~420ms) → sonra CAMERA_HOLD_MS kadar KESİNTİSİZ aynı
// poz gerekiyordu. Gerçek harekette ufak titremeler bu süreyi daha da
// uzatıyordu. Kareyi daha sık işleyip (110ms) ve algı yayınlama eşiğini 2
// ardışık kareye indirerek toplam tepki süresini kısaltıyoruz.
const FRAME_MS = 110;

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
  /** Namaz sırasında ekrana bakılamadığı için sesli uyarı gerektiren çerçeveleme sorunları. */
  bodyMissing: boolean;
  framingClose: boolean;
  legsMissing: boolean;
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
  // Teşhis amaçlı: sekme/ekran namaz sırasında en az bir kez gizlenip tekrar
  // görünür oldu mu (ekran kilidi şüphesi — "hiç ilerlemedi" şikayetinin izini
  // sürmek için). Namaz bitince Bitir öncesi ekrana bakılırsa görülebilir.
  const [wokeFromHidden, setWokeFromHidden] = useState(false);

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
      setWokeFromHidden(false);
      return;
    }

    if (!isWebRuntime() || !cameraSupported()) {
      setStatus('unsupported');
      setLoadMessage('Bu tarayıcı kamerayı desteklemiyor. Sonraki / Önceki kullanın.');
      return;
    }

    // Namaz sırasında telefona bakılamadığı için, kamera açılınca gerçekte ne
    // olduğunu (adım/algı/çerçeve/ilerleme) sessizce kaydediyoruz. Namazdan
    // sonra bu kayıt ekranda gösterilebilir (bkz. DiagnosticsModal).
    resetSessionLog();
    logSessionEvent('kamera başlatılıyor');

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
    type WakeLockSentinelLike = {
      release?: () => Promise<void> | void;
      addEventListener?: (ev: string, cb: () => void) => void;
    };
    let wakeLock: WakeLockSentinelLike | null = null;

    // Namaz sırasında telefona dokunulmuyor; birkaç dakika süren bir namazda ekran
    // kilitlenirse (Wake Lock tarayıcı/iOS sürümü tarafından desteklenmiyorsa ya da
    // herhangi bir sebeple bırakılırsa) kamera akışı ve rAF döngüsü tamamen donar —
    // "hiç ilerlemedi" şikayetinin en olası sebebi budur. Sekme/ekran tekrar
    // görünür olduğunda kilidi yeniden almayı DENERİZ (expo-keep-awake bunu tek
    // seferlik istiyor, yeniden almıyor).
    const requestWakeLock = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
        };
        if (nav.wakeLock) {
          wakeLock = await nav.wakeLock.request('screen');
          logSessionEvent('wake lock alındı');
          wakeLock.addEventListener?.('release', () => {
            wakeLock = null;
            logSessionEvent('wake lock bırakıldı');
          });
        } else {
          logSessionEvent('wake lock desteklenmiyor');
        }
      } catch {
        logSessionEvent('wake lock isteği başarısız');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        logSessionEvent('sekme/ekran gizlendi');
        return;
      }
      if (!wakeLock) {
        void requestWakeLock();
      }
      // Sekme gizliyken/ekran kilitliyken geçen süre GÜVENİLMEZ: rAF durmuş
      // olabilir ama JS state'i (holdExpectedMs, currentConfirmed) donmuş halde
      // kalır. Uyanır uyanmaz eski birikmiş süreyle + telefonu tutarken oluşan
      // gürültülü ilk karelerle yanlışlıkla "ilerledi" tetiklenmesin diye
      // her şeyi sıfırlıyoruz.
      logSessionEvent('sekme/ekran tekrar görünür oldu (muhtemel uyku)');
      setWokeFromHidden(true);
      gateStep = -1;
      holdExpectedMs = 0;
      currentConfirmed = false;
      lastTickAt = performance.now();
      lastAdvance = performance.now();
      // iOS Safari, sekme/ekran gizliyken video akışını duraklatabilir; geri
      // dönünce elle play() çağırmak gerekebilir, yoksa kare akışı hiç gelmez.
      videoRef.current?.play().catch(() => undefined);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void requestWakeLock();

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
        logSessionEvent(`adım değişti → #${idx} (${here.kind})`);
      }
      if (now - lastAdvance < COOLDOWN_MS) {
        return;
      }

      const dt = Math.min(Math.max(0, now - lastTickAt), 250);
      lastTickAt = now;

      const expected = expectedPoseForTransition(list, idx, currentConfirmed);
      holdExpectedMs = accumulateHold(holdExpectedMs, dt, pose, expected);

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
        logSessionEvent(`rükû onaylandı (#${idx}), kıyam bekleniyor`);
        return;
      }

      // Algı beklenen duruşu HOLD süresince tuttuysa Sonraki ile aynı ilerleme.
      if (result.advance) {
        lastAdvance = now;
        holdExpectedMs = 0;
        const nxt = list[idx + 1];
        const label = nxt ? `Geçildi: ${nxt.title}` : 'Geçildi';
        logSessionEvent(`KAMERA İLERLETTİ #${idx} → #${idx + 1} (${nxt?.kind ?? '?'}), algı=${pose}`);
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
        logSessionEvent(`video akışı hazır: ${video.videoWidth}x${video.videoHeight}`);

        try {
          landmarker = await createPoseLandmarker();
          modelReady = true;
          logSessionEvent('duruş modeli yüklendi');
        } catch (modelError) {
          landmarker = null;
          modelReady = false;
          logSessionEvent(
            `duruş modeli YÜKLENEMEDİ: ${modelError instanceof Error ? modelError.message : String(modelError)}`,
          );
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
          logSessionEvent('durum: running');
        }

        lastTickAt = performance.now();
        gateStep = stepIndexRef.current;
        let loggedFraming: Framing | null = null;
        let lastHeartbeatAt = performance.now();

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
                if (publishedPose !== 'unknown') {
                  logSessionEvent(`gövde kayboldu (adım #${stepIndexRef.current})`);
                }
                setDetected('unknown');
                pose = 'unknown';
                stableCount = 0;
                stablePose = 'unknown';
                publishedPose = 'unknown';
              } else {
                const guess = classifyPose(points, prevPose);
                prevPose = guess.pose;
                setFraming(guess.framing);
                if (guess.framing !== loggedFraming) {
                  loggedFraming = guess.framing;
                  logSessionEvent(`çerçeve=${guess.framing} (adım #${stepIndexRef.current})`);
                }
                if (guess.pose === stablePose) {
                  stableCount += 1;
                } else {
                  stableCount = 1;
                  stablePose = guess.pose;
                }
                if (stableCount >= 2 || guess.pose === 'unknown') {
                  if (guess.pose !== publishedPose) {
                    // "yok" (unknown) durumuna düşünce HANGİ eklemin görünmediğini
                    // (omuz/kalça/diz/ayak bileği güven skoru) de kaydediyoruz —
                    // rükû gibi kameraya öne eğilen duruşlarda hangi görünürlük
                    // eşiğinin tetiklendiğini gerçek veriyle görebilmek için.
                    const visInfo =
                      guess.pose === 'unknown'
                        ? ` [omuz ${(points[11]?.visibility ?? 0).toFixed(2)}/${(points[12]?.visibility ?? 0).toFixed(2)} kalça ${(points[23]?.visibility ?? 0).toFixed(2)}/${(points[24]?.visibility ?? 0).toFixed(2)} diz ${(points[25]?.visibility ?? 0).toFixed(2)}/${(points[26]?.visibility ?? 0).toFixed(2)} ayak ${(points[27]?.visibility ?? 0).toFixed(2)}/${(points[28]?.visibility ?? 0).toFixed(2)}]`
                        : '';
                    logSessionEvent(
                      `algı: ${publishedPose} → ${guess.pose} (adım #${stepIndexRef.current}, güven ${guess.confidence.toFixed(2)})${visInfo}`,
                    );
                  }
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

          // Nabız: değişiklik olmasa bile döngünün canlı olduğunu ve o anki
          // durumu kanıtlamak için düzenli aralıklarla kaydet. Sekme donarsa
          // (rAF durursa) bu satırlar kesilir — teşhiste bunu görürüz.
          if (now - lastHeartbeatAt > 4000) {
            lastHeartbeatAt = now;
            logSessionEvent(
              `nabız: adım=#${stepIndexRef.current} algı=${pose} çerçeve=${loggedFraming ?? 'none'} hold=${Math.round(holdExpectedMs)}ms model=${modelReady}`,
            );
          }

          raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const name = error instanceof Error ? error.name : '';
        const text = error instanceof Error ? error.message : '';
        logSessionEvent(`HATA: ${name} ${text}`);
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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void wakeLock?.release?.();
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, [enabled]);

  const bodyMissingFlag = framing === 'none' && detected === 'unknown';
  const framingCloseFlag = framing === 'close';
  // Diz/ayak bileği görünmezse secde ile oturuş, kıyamdan güvenle ayırt edilemez
  // (bkz. classifyPose.ts). Kullanıcıyı susarak yanlış algılatmak yerine uyarıyoruz.
  const legsMissingFlag = framing === 'partial' && (tick.waitingFor === 'secde' || tick.waitingFor === 'oturus');

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
      framingClose: framingCloseFlag,
      bodyMissing: bodyMissingFlag,
      legsMissing: legsMissingFlag,
      detected,
      tick,
      passedLabel,
    });
  }, [enabled, status, loadMessage, framingCloseFlag, bodyMissingFlag, legsMissingFlag, detected, tick, passedLabel]);

  const debugLine = useMemo(() => {
    let line = cameraDebugLine(detected, tick);
    if (videoSize) {
      line += ` · cam: ${videoSize.width}x${videoSize.height}`;
    }
    if (wokeFromHidden) {
      // Ekran/sekme namaz sırasında en az bir kez gizlenip geri geldi — muhtemel
      // ekran kilidi. "Hiç ilerlemedi" şikayetini teşhis etmek için önemli.
      line += ' · ekran uyudu ⚠︎';
    }
    return line;
  }, [detected, tick, videoSize, wokeFromHidden]);

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
    bodyMissing: enabled && status === 'running' && bodyMissingFlag,
    framingClose: enabled && status === 'running' && framingCloseFlag,
    legsMissing: enabled && status === 'running' && legsMissingFlag,
    attachPreview,
  };
}
