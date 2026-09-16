# Namaz Rehberi — Proje Özeti ve Sorun Geçmişi (Gemini için)

> Bu belge, projenin tamamını, mimarisini, kullanıcı ihtiyacını ve bugüne kadarki tüm sorun/düzeltme sürecini anlatmak için hazırlanmıştır. Son güncelleme: Eylül 2026, deploy v21.

---

## 1. Proje Özeti

**Ad:** Namaz Rehberi (Hanefi · Farz ve Vitir)

**Kullanıcı:** Hüseyin (Product Manager). Namaz kılarken kaçıncı rekatta olduğunu unutuyor; namaz sırasında telefona bakamıyor.

**Asıl istek:** Kamera ile duruş algılayıp, **yalnızca 2. secdeden sonra** biten rekâtın sayısını sesli söylemek ("bir", "iki", "üç", "dört"). Başka hiçbir sesli yönlendirme istenmiyor.

**Gelecek plan (henüz yapılmadı):** iOS/Android market, mezhep seçimi, sünnet/nafile, sesli namaz öğretimi — ama önce kamera güvenilir çalışmalı.

**Canlı site:** https://akinci79-dotcom.github.io/namaz-rehberi/

**Kaynak kod:** https://github.com/akinci79-dotcom/namaz-rehberi ( **`source`** dalı)

---

## 2. Teknik Stack

| Katman | Teknoloji |
|--------|-----------|
| Framework | Expo / React Native Web |
| Dil | TypeScript |
| Poz algılama | MediaPipe Pose Landmarker (WASM, GPU/CPU fallback) |
| Ses | Web Speech API (`speechSynthesis`) |
| Hosting | GitHub Pages (`main` dalı = derlenmiş site) |
| PWA | Service Worker (`sw.js`, `offline.js`) |
| Ekran kilidi | Wake Lock API |
| Teşhis | localStorage oturum kaydı (`sessionLog.ts`) |

**Derleme:**
```bash
git clone -b source https://github.com/akinci79-dotcom/namaz-rehberi.git
npm install
npm run export:web   # dist/ üretir → main dalına deploy
npm run check:pose   # poz sınıflandırıcı testleri
npm run typecheck
```

---

## 3. Repo Yapısı (source dalı)

```
namaz-rehberi/
├── App.tsx
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx       # Namaz seçimi, teşhis linki
│   │   ├── PrayerScreen.tsx     # Ana namaz ekranı (kamera + adımlar)
│   │   └── DoneScreen.tsx       # Namaz bitti
│   ├── pose/
│   │   ├── classifyPose.ts      # ★ Kıyam/rükû/secde/oturuş sınıflandırması
│   │   ├── cameraAdvance.ts     # ★ Adım ilerleme mantığı (hold timer)
│   │   ├── usePoseAssist.ts     # ★ Kamera hook (rAF döngüsü, oturum kaydı)
│   │   ├── mediapipe.ts         # Model yükleme
│   │   ├── sessionLog.ts        # Teşhis kaydı (localStorage)
│   │   ├── stepPose.ts          # Adım → duruş eşlemesi
│   │   ├── usePoseVoiceCues.ts  # Ses (artık neredeyse kapalı)
│   │   └── types.ts
│   ├── voice/
│   │   ├── usePrayerVoice.ts    # ★ Rekât seslendirme hook
│   │   ├── rakahComplete.ts     # ★ Hangi adımda "bir/iki/üç/dört"
│   │   └── speech.ts            # speakCue(), rakahNumberWord()
│   ├── data/
│   │   ├── prayers.ts           # Namaz listesi (Sabah 2, Öğle 4, …)
│   │   └── buildSteps.ts        # Adım sırası üretimi
│   └── components/
│       ├── CameraAssistBar.tsx  # Kamera önizleme + durum metni
│       └── DiagnosticsModal.tsx # Oturum kaydı göster/kopyala
├── public/offline.js            # Service worker kaydı + güncelleme
├── scripts/
│   ├── prepare-web-dist.mjs     # SW üretimi, cache hash
│   └── check-pose.ts            # Otomatik poz testleri
└── README.md
```

---

## 4. Nasıl Çalışıyor?

### 4.1 Namaz adım akışı (ör. Sabah 2 rekat)

Her namaz bir `PrayerStep[]` dizisi. Örnek ilk rekât:

```
niyet → iftitah → kiyam → ruku → kavme → secde1 → celse → secde2 → kalkis → ...
```

Her adımın bir `kind` (tür) ve beklenen `BodyPose` (kıyam/ruku/secde/oturus) var.

### 4.2 Kamera ile ilerleme

1. Ön kamera açılır, MediaPipe her ~110ms'de bir kare işler.
2. `classifyPose()` 33 landmark'tan duruş tahmin eder.
3. `expectedPoseForTransition()` o adımda hangi duruşun beklediğini hesaplar.
4. Algılanan duruş beklenenle eşleşirse `holdExpectedMs` birikir (550ms yeterli).
5. Süre dolunca `onAdvance()` → Sonraki butonuyla aynı etki.
6. **Rükû özel:** önce rükû teyit (`commitCurrent`), sonra kıyam beklenir.

### 4.3 Ses (rekat sayımı)

**Yalnızca** şu geçişte konuşur:
- Mevcut adım: `secde2` (2. secde)
- Sonraki adım: `kalkis` veya `tahiyyat`
- Söylenen: biten rekâtın sayısı (`bir`, `iki`, `üç`, `dört`)

Kod: `src/voice/rakahComplete.ts` → `completedRakahAnnouncements()`

**Konuşmaz:** rükû, kavme, 1. secde, celse, poz ipuçları, çerçeveleme uyarıları.

### 4.4 Poz sınıflandırma sinyalleri (`classifyPose.ts`)

| Sinyal | Ne ölçer |
|--------|----------|
| `torsoNorm` | Omuz-kalça dikey mesafe (y ekseni) |
| `bentByAngle` | Gövde açısı (derece) |
| `bentByZ` | **YENİ:** Omuz-kalça z derinliği farkı (öne eğilme) |
| `bentSignal` | max(bentByAngle, bentByZ) |
| `legNorm` | Kalça-diz/ayak dikey mesafe |
| `highLeg` / `lowLeg` | Bacak uzun/kısa (ayakta vs oturma) |
| `compact` | Burun-diz mesafe (secde) |

Landmark indeksleri (MediaPipe): 0=burun, 11/12=omuz, 23/24=kalça, 25/26=diz, 27/28=ayak bileği.

---

## 5. Kullanıcı Şikayetleri ve Düzeltme Geçmişi

### Faz 1 — İlk analiz (deploy edilmiş web export)

- Repo'da sadece derlenmiş dosyalar vardı (`main` dalı).
- Kullanıcı `source` dalına kaynak kodu push etti.

### Faz 2 — Kamera önizleme "tavanı gösteriyor"

**Şikayet:** Telefon karşıda olmasına rağmen kamera tavanı gösteriyordu.

**Sebep:** CSS `objectFit: 'cover'` + `objectPosition: 'center top'`. iOS Safari dikey video (720x1280) akışında üst kısmı (tavan) kırpıyordu.

**Düzeltme:** `objectFit: 'contain'`, `objectPosition: 'center'`.

**Dosya:** `src/pose/usePoseAssist.ts`

### Faz 3 — Deploy görünmüyor (PWA cache)

**Şikayet:** Düzeltmeler canlı sitede görünmüyordu.

**Sebep:** Service worker sabit cache adı, `skipWaiting()`/`clients.claim()` yok.

**Düzeltme:** Dinamik cache hash, `skipWaiting`, `clients.claim`. Sonra ek: `offline.js`'de `reg.update()` + `controllerchange` ile otomatik sayfa yenileme; `index.html` için network-first stratejisi.

**Dosyalar:** `scripts/prepare-web-dist.mjs`, `public/offline.js`

### Faz 4 — Hiç ilerleme yok, bazen yanlış "bir"

**Şikayet:** Namaz boyunca hiç sayma/ilerleme olmadı; son rekatta bir kez "bir" dedi.

**Sebep 1:** `classifyPose` burun görünmezse hemen `unknown` dönüyordu (secde/rükûda yüz kameradan uzak).

**Düzeltme 1:** Burun zorunluluğu kaldırıldı; omuz+kalça+diz yeterli.

**Sebep 2:** `holdExpectedMs` tek yanlış karede sıfırlanıyordu.

**Düzeltme 2:** `accumulateHold()` — yumuşak azalma, `unknown` ceza vermez.

**Dosyalar:** `src/pose/classifyPose.ts`, `src/pose/cameraAdvance.ts`

### Faz 5 — Ekran kilidi şüphesi

**Şikayet:** Hiç ilerlemedi (ekran kararmadı dedi kullanıcı).

**Düzeltme:** Wake Lock yeniden alma, visibility change'de state sıfırlama. Sonuç: ekran kilidi asıl sebep değilmiş.

**Dosya:** `src/pose/usePoseAssist.ts`

### Faz 6 — Hiç ses yok

**Şikayet:** Namaz boyunca tek kelime etmedi.

**Sebep:** Tüm geri bildirim sadece ekrandaydı; sesli cue yoktu.

**Düzeltme (sonra geri alındı):** `usePoseVoiceCues.ts` eklendi — poz ipuçları sesli okundu.

**Sonuç:** Kullanıcı "sürekli konuşuyor, yanlış komut veriyor" dedi → poz cue'ları ve çerçeveleme uyarıları sesli okunmaktan çıkarıldı. Ses = sadece rekat sayımı.

### Faz 7 — Rükû algılanmıyor (ekran görüntüleri)

**Şikayet:** Kıyam/secde/oturuş doğru, rükû "Algı: yok".

**Sebep:** Rükûda omuz görünürlüğü düşüyor (kameraya doğru eğilme); omuz yoksa tüm veri atılıyordu.

**Düzeltme:** Omuz yoksa kalça+diz bacak sinyaliyle rükû tahmini.

**Dosya:** `src/pose/classifyPose.ts`

### Faz 8 — Teşhis kaydı

**Eklendi:** `sessionLog.ts`, `DiagnosticsModal.tsx` — namaz sonrası "Kamera oturumu kaydını göster" linki.

**Kullanım:** Kullanıcı log metnini kopyalayıp geliştiriciye gönderiyor. Örnek satır:
```
110.8s KAMERA İLERLETTİ #0 → #1 (iftitah), algı=ruku
110.3s algı: oturus → ruku (adım #0, güven 1.00)
```

### Faz 9 — Ayak bileği gürültüsü (kök neden #1)

**Log bulgusu:** Rükû anlarında omuz/kalça ~1.00, ayak bileği 0.2-0.5, diz 0.5-0.9. Düşük güvenli ayak bileği konumu bacakları "kısa" ölçüp rükû → oturuş/yok.

**Düzeltme:** Ayak bileği eşiği 0.12→0.55; diz eşiği 0.14→0.25; dize düşüldüğünde `legScaleCompensation=1.9`.

**Dosya:** `src/pose/classifyPose.ts`

### Faz 10 — Çok yavaş hareket gerekiyor

**Şikayet:** "Kaplumbağa gibi yavaş hareket etmek gerekiyor."

**Düzeltme:**
- `FRAME_MS`: 140→110
- Algı yayın eşiği: 3 kare→2 kare
- `CAMERA_HOLD_MS`: 850→550
- `accumulateHold` ceza: dt×2 → dt×1.3

### Faz 11 — Kalıcı rükû→oturuş (kök neden #2)

**Log bulgusu:** Adım #10'da 50 saniye kesintisiz `algı=oturus` (2. rekât rükûsunda takıldı). 1. rekât akıcı çalışmış, "bir" doğru söylenmiş.

**Sebep:** 2D y-izdüşümünde rükû "dik" görünüyor (foreshortening — kameraya doğru eğilme). Oturuş skoru rükûyü sürekli yener.

**Düzeltme:** MediaPipe z (derinlik) sinyali — `bentByZ`, `bentSignal`; `uprightTorso = highTorso * (1 - bentSignal)`; güvene göre ağırlıklı `mid()`.

**Dosya:** `src/pose/classifyPose.ts`

---

## 6. Mevcut Parametreler (v21)

| Parametre | Değer | Dosya |
|-----------|-------|-------|
| FRAME_MS | 110 | usePoseAssist.ts |
| Stable kare eşiği | 2 | usePoseAssist.ts |
| CAMERA_HOLD_MS | 550 | cameraAdvance.ts |
| accumulateHold ceza | dt × 1.3 | cameraAdvance.ts |
| Ayak bileği min visibility | 0.55 | classifyPose.ts |
| Diz min visibility | 0.25 | classifyPose.ts |
| Diz-only leg compensation | 1.9 | classifyPose.ts |

---

## 7. Bilinen Sınırlamalar

1. **MediaPipe 2D+Z:** Tek ön kamera, yan profilden çok daha iyi. Kullanıcıya ~30-45° açı öneriliyor.
2. **Secde vs oturuş:** Diz/ayak görünmezse (`framing=partial`) ayırt edilemez — ekranda uyarı, ses yok.
3. **Hızlı geçişler:** Adımlar arası ~1 saniyede 2-3 adım atlayabilir (log: #8→#9→#10). İlerleme çalışıyor ama bazen secde2'de oturuş algısıyla erken geçiş olabiliyor.
4. **PWA ilk güncelleme:** Eski SW takılı kaldıysa bir kez Safari Web Site Data silmek gerekebilir.
5. **Lite model:** `pose_landmarker_lite.task` — hızlı ama tam model kadar hassas değil.

---

## 8. Teşhis Nasıl Yapılır?

1. Namaz bitince Ana sayfa veya "Namaz bitti" ekranında **"Kamera oturumu kaydını göster (teşhis)"**
2. Metni kopyala
3. Önemli satırlar:
   - `KAMERA İLERLETTİ #X → #Y` — adım geçişi
   - `algı: X → Y` — poz değişimi
   - `hold=XXXms` — tutma süresi birikimi
   - `[omuz ... kalça ... diz ... ayak ...]` — unknown anında görünürlük skorları
   - `nabız:` — 4 saniyede bir durum özeti

---

## 9. Test Komutları

```bash
npm run check:pose    # Sentetik poz testleri (standing, ruku, secde, oturus, omuzsuz rükû, düşük ayak bileği, z-foreshortening)
npm run check:prayers # Namaz adım bütünlüğü
npm run typecheck
```

---

## 10. Ses Tasarım Kuralı (KRİTİK)

```
✅ Konuşur: secde2 → kalkis/tahiyyat geçişinde bir/iki/üç/dört (bir kez)
✅ Konuşur (nadir): kamera/model tamamen çalışmıyorsa (denied, error)
❌ Konuşmaz: "Şimdi rükûya eğilin", "Şimdi oturun", "Dizler görünmüyor", rükû, kavme, secde1, celse
```

Kod: `usePrayerVoice.ts` + `rakahComplete.ts` (ses), `usePoseVoiceCues.ts` (neredeyse boş).

---

## 11. Deploy Süreci

```bash
# source dalında geliştir
git checkout source
# ... değişiklikler ...
npm run export:web

# dist/ içeriğini main dalına kopyala (GitHub Pages)
# Commit mesajı: "Deploy: ... (vNN)"
git push origin main
```

Service worker otomatik güncelleme: sayfa açılışında `reg.update()`, yeni SW devreye girince bir kez `location.reload()`.

---

## 12. Kullanıcı Geri Bildirim Özeti

| Durum | Sonuç |
|-------|-------|
| İlk testler | Hiç ilerleme, hiç ses |
| Kamera önizleme fix | Görüntü düzeldi |
| PWA fix | Güncellemeler gelmeye başladı |
| Burun/hold fix | Kısmen ilerleme |
| Ayak bileği fix | 1. rekât akıcı çalıştı, "bir" doğru |
| Ses cue kaldırma | Gereksiz konuşma durdu |
| Hız fix | Daha az "kaplumbağa" hissi |
| z-derinlik fix | 2. rekât rükû takılması hedeflenen düzeltme (v21, test bekliyor) |

---

## 13. Gemini'ye Sorulabilecek Sorular

- `classifyPose.ts` içinde rükû/secde/oturuş ayrımını daha robust yapmak için alternatif yaklaşımlar?
- MediaPipe lite yerine full/heavy model web'de performans?
- Tek ön kamera ile rükû güvenilirliğini artırmak için temporal smoothing (son N kare oylaması)?
- secde2'de oturuş yerine secde algılanmadan geçiş — false positive azaltma?
- iOS Safari PWA + Wake Lock + kamera best practices?

---

## 14. İletişim / Repo

- GitHub: https://github.com/akinci79-dotcom/namaz-rehberi
- Kaynak: `source` dalı
- Canlı: https://akinci79-dotcom.github.io/namaz-rehberi/
- Son deploy: v21 (z-derinlik sinyali)
