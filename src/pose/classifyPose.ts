import type { BodyPose, Framing, PoseGuess, PoseLandmark } from './types';

const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_HIP = 23;
const R_HIP = 24;
const L_KNEE = 25;
const R_KNEE = 26;
const L_ANKLE = 27;
const R_ANKLE = 28;
const NOSE = 0;

const MIN_VIS = 0.22;
const HYSTERESIS = 0.07;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function visible(point: PoseLandmark | undefined, min = MIN_VIS): point is PoseLandmark {
  return !!point && (point.visibility ?? 1) >= min;
}

function mid(a: PoseLandmark, b: PoseLandmark): PoseLandmark {
  // Basit (%50/%50) ortalama, iki taraf çok farklı güvenle görünürken (ör.
  // gerçek namaz kaydında diz 0.88/0.44 gibi asimetrik durumlar sık görüldü)
  // daha az güvenilir/muhtemelen kaymış tarafı eşit ağırlıkla karışıma katıp
  // konumu bozabiliyordu. Güvene göre ağırlıklı ortalama, daha net görünen
  // tarafa daha çok itibar eder. (visibility eşit olduğunda — sentetik
  // testlerdeki gibi — davranış tam olarak eski basit ortalamayla aynıdır.)
  const va = a.visibility ?? 1;
  const vb = b.visibility ?? 1;
  const total = va + vb || 1;
  return {
    x: (a.x * va + b.x * vb) / total,
    y: (a.y * va + b.y * vb) / total,
    z: ((a.z ?? 0) * va + (b.z ?? 0) * vb) / total,
    visibility: Math.min(va, vb),
  };
}

/** 0 = dik, 90 = yatay. y aşağı. */
export function torsoAngleDeg(hip: PoseLandmark, shoulder: PoseLandmark): number {
  const vx = shoulder.x - hip.x;
  const vy = shoulder.y - hip.y;
  const mag = Math.hypot(vx, vy) || 1e-6;
  const cos = clamp(-vy / mag, -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

function empty(framing: Framing): PoseGuess {
  return { pose: 'unknown', confidence: 0, framing };
}

/**
 * Ön kamera: omuz genişliği ölçek.
 * iPhone selfie sıkça yalnızca yüz/omuz gösterir — kalça yoksa dik gövde kıyam sayılır.
 */
export function classifyPose(landmarks: readonly PoseLandmark[], previous?: BodyPose): PoseGuess {
  const nose = landmarks[NOSE];
  const shoulderL = landmarks[L_SHOULDER];
  const shoulderR = landmarks[R_SHOULDER];
  const hipL = landmarks[L_HIP];
  const hipR = landmarks[R_HIP];

  // ÖNEMLİ: burnu ZORUNLU tutmuyoruz. Secdede yüz aşağı/kameradan uzağa döner ve
  // MediaPipe burnu çoğu zaman düşük güvenle (veya hiç) görür — tam olarak
  // saymamız gereken duruşta burun yokluğunu "vücut yok" sayıp sessizce hiçbir
  // şey algılamamak, kamera tabanlı ilerlemeyi rekat sayımının en kritik anında
  // (2. secde) devre dışı bırakırdı. Burun sadece "close" kadraj tespiti ve
  // secde'nin "compact" (baştan dize kısa mesafe) sinyali için ek bilgi olarak
  // kullanılır; omuz/kalça/diz varsa sınıflandırma burunsuz da devam eder.
  const hasNose = visible(nose, 0.18);

  const hasShoulders = visible(shoulderL, 0.18) && visible(shoulderR, 0.18);
  if (!hasShoulders) {
    // GERÇEK KULLANICI TESTİNDE BULUNAN KRİTİK DURUM: rükûda gövde kameraya
    // doğru/ondan uzağa öne eğilir (derinlik eksenine yakın döner) — bu açıdan
    // MediaPipe omuzları güvenle konumlandıramaz ve görünürlük skoru eşiğin
    // altında kalabilir. Video kayıtlı testte tam olarak bu oldu: kullanıcı net
    // biçimde rükûdayken "Algı: yok" görüldü, çünkü omuz yokluğu tüm diğer
    // (kalça/diz/ayak bileği) veriyi de atıp fonksiyonu erken sonlandırıyordu —
    // tıpkı daha önce düzeltilen "burun zorunlu" hatasının omuzdaki ikizi.
    //
    // Rükûda bacaklar dik kalır (yalnızca kalçadan öne bükülme olur): kalça hâlâ
    // "ayaktaki" yüksekliğinde, dize/ayak bileğine olan dikey mesafe uzun kalır.
    // Omuz görünmüyorsa bu bacak imzasından rükûyu tahmin ediyoruz. Kalça da
    // görünmüyorsa (ör. gerçekten kadraj dışı) ya da bacaklar kısaysa (secde/
    // oturuş — ikisi omuzsuz güvenle ayrılamaz, aradaki farkı gövde açısı verir)
    // yine boş dönüyoruz.
    const hasHipsOnly = visible(hipL, 0.16) && visible(hipR, 0.16);
    if (hasHipsOnly) {
      const hipOnly = mid(hipL, hipR);
      const kneeL2 = landmarks[L_KNEE];
      const kneeR2 = landmarks[R_KNEE];
      const ankleL2 = landmarks[L_ANKLE];
      const ankleR2 = landmarks[R_ANKLE];
      const knee2 =
        visible(kneeL2, 0.14) && visible(kneeR2, 0.14) ? mid(kneeL2, kneeR2) : undefined;
      const ankle2 =
        visible(ankleL2, 0.12) && visible(ankleR2, 0.12) ? mid(ankleL2, ankleR2) : undefined;
      const lowerRef2 = ankle2 ?? knee2;
      if (lowerRef2) {
        const hipScale = Math.max(Math.abs(hipR.x - hipL.x), 0.08);
        const legNorm2 = (lowerRef2.y - hipOnly.y) / hipScale;
        const legsStanding = clamp((legNorm2 - 0.9) / 0.6, 0, 1);
        if (legsStanding > 0.25) {
          return pick(
            { kiyam: 0, ruku: legsStanding, secde: 0, oturus: 0 },
            previous,
            0.22,
            'ok',
          );
        }
      }
    }
    return empty(hasNose && nose.y < 0.55 ? 'close' : 'none');
  }

  const shoulder = mid(shoulderL, shoulderR);
  const shoulderWidth = Math.abs(shoulderR.x - shoulderL.x);
  const tooClose = shoulderWidth > 0.48 || (shoulder.y < 0.42 && !visible(hipL, 0.18));

  const hasHips = visible(hipL, 0.16) && visible(hipR, 0.16);
  if (!hasHips) {
    // Burun yoksa "ayakta mı" sorusuna cevap veremeyiz — kalça da yoksa elimizde
    // yalnızca omuz var, bu da secde/rükû/kıyamı ayırt etmeye yetmez.
    const uprightFace = hasNose && nose.y < shoulder.y;
    if (tooClose) {
      return {
        pose: uprightFace ? 'kiyam' : 'unknown',
        confidence: uprightFace ? 0.4 : 0,
        framing: 'close',
      };
    }
    return {
      pose: uprightFace ? 'kiyam' : 'unknown',
      confidence: uprightFace ? 0.45 : 0,
      framing: 'partial',
    };
  }

  const hip = mid(hipL, hipR);
  const kneeL = landmarks[L_KNEE];
  const kneeR = landmarks[R_KNEE];
  const ankleL = landmarks[L_ANKLE];
  const ankleR = landmarks[R_ANKLE];
  // GERÇEK NAMAZ OTURUMU KAYDINDA BULUNAN KRİTİK DURUM: rükûda omuz/kalça hep
  // ~1.00 güvenle kalırken, ayak bileği güveni sık sık 0.2-0.5 bandına düşüyordu
  // (diz ise aynı anlarda 0.5-0.9 bandında, belirgin şekilde daha güvenilirdi).
  // Eski eşik (0.12) bu düşük güvendeki ayak bileğini yine de "görünür" sayıp
  // konumunu kullanıyordu — ama bu düşük güvendeki KONUM tahmini kaymış/gürültülü
  // olabiliyor ve bacaklar sanki kısalmış (oturuyormuş) gibi ölçülüp gerçek rükû
  // "oturuş" ya da "yok" olarak algılanıyordu (asıl rapor edilen hata). Ayak
  // bileğini yalnızca GERÇEKTEN güvenilir olduğunda kullanıyoruz; değilse zaten
  // var olan `ankle ?? knee` yedeği devreye girip dize düşüyor.
  const knee =
    visible(kneeL, 0.25) && visible(kneeR, 0.25) ? mid(kneeL, kneeR) : undefined;
  const ankle =
    visible(ankleL, 0.55) && visible(ankleR, 0.55) ? mid(ankleL, ankleR) : undefined;

  const scale = Math.max(shoulderWidth, 0.1);
  const torsoNorm = (hip.y - shoulder.y) / scale;
  const angle = torsoAngleDeg(hip, shoulder);
  const bentByAngle = clamp((angle - 32) / 45, 0, 1);
  // GERÇEK NAMAZ KAYDINDA BULUNAN KALICI HATA: bazı kamera açılarında rükûda
  // torsoNorm'un 2D izdışımı hâlâ "dik" (kıyamdaki gibi) ölçülüyor — çünkü
  // kameraya DOĞRU/ONDAN UZAĞA öne eğilme, y ekseninde net bir kısalma
  // yaratmayabilir (foreshortening). Sonuç: rükû, ~50 saniye boyunca
  // KESİNTİSİZ "oturuş" olarak algılandı (gürültü değil, sistematik hata).
  // MediaPipe'ın verdiği ama şimdiye kadar kullanmadığımız z (derinlik)
  // koordinatı bunun için çok daha güvenilir: köken kalça orta noktası,
  // kameraya yaklaşan eklem daha KÜÇÜK/NEGATİF z alır. Rükûda omuz, kalçaya
  // göre kameraya belirgin şekilde yaklaşır — bu, y izdüşümünden bağımsız
  // doğrudan bir "öne eğilme" ölçüsü. z verisi yoksa/sıfırsa (sentetik
  // testler, veya bazı tarayıcı/GPU yollarında) bu sinyal sessizce 0 kalır
  // ve eski davranış (yalnızca y/açı) değişmeden korunur.
  const shoulderZ = ((shoulderL.z ?? 0) + (shoulderR.z ?? 0)) / 2;
  const hipZ = ((hipL.z ?? 0) + (hipR.z ?? 0)) / 2;
  const zLean = (hipZ - shoulderZ) / scale;
  const bentByZ = clamp(zLean / 1.4, 0, 1);
  const bentSignal = Math.max(bentByAngle, bentByZ);
  const framing: Framing = tooClose ? 'close' : ankle || knee ? 'ok' : 'partial';

  const lowerRef = ankle ?? knee;
  // Diz, kalçaya ayak bileğinden çok daha yakındır (~ayak bileği-kalça
  // mesafesinin yarısı) — ayak bileği güvenilmeyip dize düşüldüğünde, aşağıdaki
  // legNorm eşiklerinin (0.95/1.05) hâlâ anlamlı kalması için tipik vücut
  // oranına göre ölçeği telafi ediyoruz. Aksi halde dize düşülen her kare
  // (ayak bileği güvensizken) bacaklar gerçekte dik olsa bile "kısa/bükülü"
  // (oturuş/secde) gibi ölçülür.
  const usingKneeOnly = !ankle && !!knee;
  const legScaleCompensation = usingKneeOnly ? 1.9 : 1;
  if (!lowerRef) {
    // ÖNEMLİ SINIRLAMA: diz/ayak bileği görünmüyorsa secde ve oturuş, torso/omuz
    // oranıyla kıyamdan güvenle ayırt edilemez — ayakta dururken de otururken de
    // gövde-omuz oranı neredeyse aynıdır (yalnızca bacak açısı ayırt eder). Burada
    // secde/oturuşu 0 bırakıp yalnızca kıyam/rükûyu tahmin ediyoruz; çağıran taraf
    // (usePoseAssist → cameraStatusText: legsMissing) bunu sessizce yanlış
    // sınıflandırmak yerine kullanıcıya "telefonu geriye çekin" diye söylemeli.
    const highTorso = clamp((torsoNorm - 0.35) / 0.55, 0, 1);
    const lowTorso = clamp((0.5 - torsoNorm) / 0.4, 0, 1);
    return pick(
      {
        kiyam: highTorso * (1 - bentSignal),
        ruku: Math.max(lowTorso, bentSignal),
        secde: 0,
        oturus: 0,
      },
      previous,
      0.38,
      framing,
    );
  }

  const legNorm = ((lowerRef.y - hip.y) / scale) * legScaleCompensation;
  const highTorso = clamp((torsoNorm - 0.38) / 0.5, 0, 1);
  const lowTorso = clamp((0.52 - torsoNorm) / 0.4, 0, 1);
  
  const uprightTorso = highTorso * (1 - bentSignal);
  const highLeg = clamp((legNorm - 0.95) / 0.55, 0, 1);
  const lowLeg = clamp((1.05 - legNorm) / 0.55, 0, 1);

  // GERÇEK NAMAZ KAYDINDA BULUNAN KALICI HATA 2: Oturuş (celse/tahiyyat) sırasında
  // telefon yere yakınsa veya kameraya açılıysa, 2D izdüşümde kalça ve ayak bileği 
  // arasındaki Y mesafesi uzun görünebilir ve legNorm > 1.0 çıkıp oturuşu "kıyam"
  // sanmasına neden olabilir (asıl rapor edilen 1. rekât celsesinde 150sn takılma).
  // Rükûdaki bentByZ çözümüne benzer şekilde, dizlerin kalçaya göre Z ekseninde
  // kameraya çok daha yakın olmasını (negatif z) kullanarak bükülü bacağı kesin
  // olarak tespit ediyoruz.
  const kneeZ = knee ? (((kneeL?.z ?? 0) + (kneeR?.z ?? 0)) / 2) : 0;
  const kneeFoldZ = knee ? (hipZ - kneeZ) / scale : 0;
  const foldedLegSignal = clamp(kneeFoldZ / 0.8, 0, 1);
  
  const effectiveHighLeg = highLeg * (1 - foldedLegSignal);
  const effectiveLowLeg = Math.max(lowLeg, foldedLegSignal);

  // "compact" (baştan dize kısa mesafe) burun gerektirir; burun yoksa (secdede sık
  // görülen durum) bu ek sinyalden vazgeçip ana sinyale (lowTorso*lowLeg) güveniriz —
  // burnu zorunlu kılıp secde'yi hiç algılamamaktan çok daha iyi.
  const spanNorm = hasNose ? (lowerRef.y - nose.y) / scale : null;
  const compact = spanNorm !== null ? clamp((1.45 - spanNorm) / 0.7, 0, 1) : 0;

  return pick(
    {
      kiyam: uprightTorso * effectiveHighLeg,
      ruku: Math.max(lowTorso, bentSignal) * effectiveHighLeg,
      oturus: uprightTorso * effectiveLowLeg,
      secde: Math.max(lowTorso * effectiveLowLeg, compact * Math.max(lowTorso, 0.35)),
    },
    previous,
    0.3,
    framing,
  );
}

function pick(
  scores: Record<Exclude<BodyPose, 'unknown'>, number>,
  previous: BodyPose | undefined,
  min: number,
  framing: Framing,
): PoseGuess {
  const entries = Object.entries(scores) as Array<[Exclude<BodyPose, 'unknown'>, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const [bestPose, bestScore] = entries[0];
  const second = entries[1]?.[1] ?? 0;

  if (previous && previous !== 'unknown' && previous !== bestPose) {
    const prevScore = scores[previous];
    if (prevScore + HYSTERESIS >= bestScore) {
      return { pose: previous, confidence: prevScore, framing };
    }
  }

  if (bestScore < min || bestScore - second < 0.03) {
    return {
      pose: previous && previous !== 'unknown' && bestScore > min * 0.65 ? previous : 'unknown',
      confidence: bestScore,
      framing,
    };
  }

  return { pose: bestPose, confidence: bestScore, framing };
}
