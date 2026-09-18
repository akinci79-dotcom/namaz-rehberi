import { useEffect, useMemo, useRef, useState } from 'react';

import type { PrayerStep } from '../types/prayer';
import {
  cameraDebugLine,
  cameraStatusText,
  type AdvanceHint,
  type CameraTickResult,
} from './cameraAdvance';
import { createPrayerTracker, type TrackingSnapshot } from './prayerTracker';
import { trackerStepIndex } from './trackerPresentation';
import { speakCue } from '../voice/speech';
import { acceptedCameraPose, createTakbirStart } from './takbirStart';
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
  onAdvance: (targetIndex: number) => void;
  onRakah: (rakah: number) => void;
}

export interface PoseAssistState {
  status: AssistStatus;
  completedRakahs: number;
  trackingUncertain: boolean;
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
  targetIndex: null,
  targetConfirmed: false,
  commitCurrent: false,
  hint: 'none',
  currentPose: 'unknown',
  expectedPose: null,
  waitingFor: null,
  secde2Ready: false,
  samePose: false,
};

export function usePoseAssist({ enabled, steps, stepIndex, onAdvance, onRakah }: Options): PoseAssistState {
  const [tracking, setTracking] = useState<TrackingSnapshot | null>(null);
  const onRakahRef = useRef(onRakah);
  onRakahRef.current = onRakah;
  const [status, setStatus] = useState<AssistStatus>('off');
  const [waitingTakbir, setWaitingTakbir] = useState(true);
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
    logSessionEvent('kamera başlatılıyor · sürüm: tracker-2');
    setWaitingTakbir(true);
    setTracking(null);
    setTick(IDLE_TICK);

    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarkerHandle | null = null;
    let raf = 0;
    let lastFrame = 0;
    let lastVideoTime = -1;
    const tracker = createPrayerTracker(stepsRef.current[0].totalRakah);
    let readySpoken = false;
    const takbir = createTakbirStart();
    let prayerStarted = false;
    let takbirPhase = 'waiting';
    let prevPose: BodyPose | undefined;
    let stablePose: BodyPose = 'unknown';
    let publishedPose: BodyPose = 'unknown';
    let stableCount = 0;
    let modelReady = false;
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
        setTracking(tracker.suspend('Ekran gizlendi; takip kesildi'));
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
      setTracking(tracker.suspend('Ekran gizlendi; takip kesildi'));
      takbir.resetPending();
      publishedPose = 'unknown';
      stablePose = 'unknown';
      stableCount = 0;
      prevPose = undefined;
      lastVideoTime = -1;
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
      if (!prayerStarted) return;
      const before = tracker.snapshot();
      const result = tracker.update(pose, now);
      setTracking(result);
      setTick({ ...IDLE_TICK, expectedPose: result.expected, waitingFor: result.expected,
        currentPose: pose, hint: result.uncertain ? 'manual' : 'camera' });
      if (before.phase !== result.phase || before.uncertain !== result.uncertain) {
        logSessionEvent(`takip: ${before.phase} → ${result.phase}; rekât=${result.rakah}; tamamlanan=${result.completed}; neden=${result.reason ?? 'yok'}`);
      }
      if (result.completedEvent !== null) onRakahRef.current(result.completedEvent);
      if (result.uncertain || before.phase === result.phase) return;
      const target = trackerStepIndex(stepsRef.current, result);
      if (target >= 0) {
        stepIndexRef.current = target;
        onAdvanceRef.current(target);
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

        let loggedFraming: Framing | null = null;
        let lastHeartbeatAt = performance.now();

        let lastMeasurementAt = 0;
        const loop = () => {
          if (cancelled) {
            return;
          }
          const now = performance.now();
          let pose: BodyPose = publishedPose;

          if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastFrame >= FRAME_MS) {
            lastVideoTime = video.currentTime;
            lastFrame = now;
            try {
              const result = landmarker.detectForVideo(video, now);
              const points = result.landmarks?.[0];
              if (!prayerStarted) {
                const startGuess = points ? classifyPose(points, undefined, { width: video.videoWidth, height: video.videoHeight }) : { pose: 'unknown' as const, confidence: 0, framing: 'none' as const };
                const phase = takbir.update(points, startGuess, now, { width: video.videoWidth, height: video.videoHeight });
                if (phase !== takbirPhase) {
                  logSessionEvent(`tekbir: ${takbirPhase} → ${phase}`);
                  takbirPhase = phase;
                }
                if (phase === 'ready' && !readySpoken) {
                  readySpoken = true;
                  speakCue('Kamera hazır. Tekbir bekleniyor.');
                }
                if (phase === 'started') {
                  const firstKiyam = stepsRef.current.findIndex(s => s.kind === 'kiyam');
                  if (firstKiyam >= 0) {
                    prayerStarted = true;
                    setWaitingTakbir(false);
                    setTracking(tracker.start(now));
                    stepIndexRef.current = firstKiyam;
                    onAdvanceRef.current(firstKiyam);
                    logSessionEvent(`TEKBİR ONAYLANDI → #${firstKiyam}; takip başladı`);
                  }
                }
              }
              if (!points) {
                prevPose = undefined;
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
                const rawGuess = classifyPose(points, prevPose, { width: video.videoWidth, height: video.videoHeight });
                const guess = { ...rawGuess, pose: acceptedCameraPose(rawGuess) };
                prevPose = guess.pose;
                if (now - lastMeasurementAt >= 1000) {
                  lastMeasurementAt = now;
                  // Compact geometry only; no image or video is stored.
                  const ids = [11,12,23,24,25,26,27,28];
                  logSessionEvent('ölçüm ' + JSON.stringify({
                    size: [video.videoWidth, video.videoHeight],
                    pose: guess.pose, score: +guess.confidence.toFixed(2),
                    joints: ids.map(i => [i, ...[points[i]?.x, points[i]?.y, points[i]?.z, points[i]?.visibility]
                      .map(v => v === undefined ? null : +v.toFixed(3))]),
                  }));
                }
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
                      `algı: ${publishedPose} → ${guess.pose} (adım #${stepIndexRef.current}, duruş puanı ${guess.confidence.toFixed(2)})${visInfo}`,
                    );
                  }
                  publishedPose = guess.pose;
                  setDetected(guess.pose);
                  pose = guess.pose;
                } else {
                  // Yeni aday henüz doğrulanmadıysa eski poza süre eklemeyiz.
                  pose = 'unknown';
                }
              }
            } catch {
              takbir.resetPending();
              prevPose = undefined;
              pose = 'unknown';
              publishedPose = 'unknown';
              stablePose = 'unknown';
              stableCount = 0;
              setDetected('unknown');
            }
            // Yalnızca yeni görüntü örneği süre biriktirir; son poz donmuşken sayılmaz.
            runGate(now, pose);
            mountVideo(video);
          }

          // A frozen video produces no observations; surface that loss without waiting for recovery.
          if (prayerStarted && now - lastFrame > 500) runGate(now, 'unknown');

          // Nabız: değişiklik olmasa bile döngünün canlı olduğunu ve o anki
          // durumu kanıtlamak için düzenli aralıklarla kaydet. Sekme donarsa
          // (rAF durursa) bu satırlar kesilir — teşhiste bunu görürüz.
          if (now - lastHeartbeatAt > 4000) {
            lastHeartbeatAt = now;
            logSessionEvent(
              `nabız: adım=#${stepIndexRef.current} algı=${pose} çerçeve=${loggedFraming ?? 'none'} model=${modelReady}`,
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
    if (tracking?.uncertain) return 'Sayım durdu: ' + tracking.reason + '. Yeniden başlamak için kamerayı kapatıp açın.';
    if (tracking?.phase === 'complete') return `${tracking.completed} rekâtın hareket dizisi izlendi. Selamdan sonra Bitir’e dokunun.`;
    if (waitingTakbir) return framing !== 'ok'
      ? 'Hazırlık: telefonu yerleştirin; ayakta ve secdede tüm gövdenize yer bırakın.'
      : 'Tekbir bekleniyor — ayakta ellerinizi kulak hizasına kaldırıp indirin.';
    return cameraStatusText({
      framingClose: framingCloseFlag,
      bodyMissing: bodyMissingFlag,
      legsMissing: legsMissingFlag,
      detected,
      tick,
      passedLabel,
    });
  }, [enabled, status, loadMessage, tracking, waitingTakbir, framingCloseFlag, bodyMissingFlag, legsMissingFlag, detected, tick, passedLabel]);

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
    !passedLabel &&
    !waitingTakbir && !tracking?.uncertain && tracking?.phase !== 'complete'
      ? POSE_CUE_TR[cuePose]
      : null;

  return {
    completedRakahs: tracking?.completed ?? 0,
    trackingUncertain: tracking?.uncertain ?? false,
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
