# Namaz Rehberi (Hanefi · Farz ve Vitir)

Telefonu veya tableti namazın önüne koyup, hangi rekâtta olduğunu ve sıradaki hareketi büyük yazıyla takip etmek için kişisel bir Expo uygulaması.

**Hanefi** mezhebine göre:

- Farz: Sabah (2), Öğle (4), İkindi (4), Akşam (3), Yatsı (4)
- Vacip: Vitir (3 rekât, tek selam; 3. rekâtta rükûdan önce kunut)

Bu bir kişisel yardımcıdır; yaygın öğretilen Hanefi uygulamaya dayanır. Güvenilir bir âlime danışarak teyit ediniz. **Fetva değildir.**

## GitHub: kaynak kod ve canlı site

Aynı depo, iki dal:

| Dal | İçerik |
|-----|--------|
| **`source`** | Tam Expo / TypeScript kaynak (`package.json`, `src/`, `App.tsx`, …) |
| **`main`** | Yalnızca web derlemesi (GitHub Pages: `index.html`, `_expo/`, `sw.js`) |

Kaynağı klonlamak:

```bash
git clone -b source https://github.com/akinci79-dotcom/namaz-rehberi.git
cd namaz-rehberi
npm ci
```

Canlı site (Safari, kaynak gerekmez):

**https://akinci79-dotcom.github.io/namaz-rehberi/**

## Geliştirme

```bash
npx expo start          # QR (Expo Go) veya tarayıcı
npx expo start --web    # web önizleme
npm run typecheck
npm run check:prayers
npm run check:pose
npm run check:camera
npm run check:offline
```

## Web derlemesi ve Pages yayını

GitHub Actions yok. Yayın elle: derleme `dist/` üretir, içeriği deponun **`main`** dalına (Pages) kopyalanır.

```bash
npm run typecheck && npm test && npm run export:web
# dist/ = index.html + _expo + mediapipe wasm + sw.js
# MediaPipe wasm npm paketinden kopyalanır (git'te tutulmaz).
```

`dist/` içeriğini `akinci79-dotcom/namaz-rehberi` **`main`** dalına (mevcut geçmişi koruyan yeni bir commit ile, yalnızca derleme) gönderin. `source` dalına `node_modules/` veya `dist/` koymayın.

İsteğe bağlı: Safari’de **Paylaş → Ana Ekrana Ekle**.

### Kamerayla rekât takibi (tracker-2)

Öğrenme/prova ekranından “Kamerayla rekât takibi” açılır. Telefon sabit ve hafif yanda
olmalı; ayakta ve secdede tüm gövde için görüntüde yer bırakılmalıdır. Kamera hazır
bildiriminden sonra iki elin aşağı → kulak hizası → aşağı hareketi başlangıcı açar.
Bu bildirim yalnızca ayakta başlangıç koşullarını doğrular; secde kadrajını garanti etmez.

- Takip motoru (`src/pose/prayerTracker.ts`) ekran adımlarından bağımsızdır.
- Gözlenen sıra: kıyam → rükû → kavme → secde1 → celse → secde2 → oturuş/kıyam.
- Sayı, ikinci secdeye girişte değil **çıkış doğrulanınca** bir kez üretilir.
- Uzun bekleme sayı üretmez. Kısa algı kayıpları tolere edilir; 2,5 saniyelik
  doğrulanamayan görüntü veya kalıcı sıra uyuşmazlığı sayımı durdurur. Kaçan rekât
  tahmin edilmez. Kamera kapatılıp açıldığında yeni deneme sıfırdan başlar.
- Ekran gizlenirse sayım durur. Kamera açıkken elle adım ilerletme kapalıdır.
- Son rekâtın hareketleri doğrulandığında sayaç durur. Selam kamerayla algılanmaz;
  kullanıcı selamdan sonra Bitir düğmesini kullanır.
- Ses, hazırlık bildirimi ve doğrulanan rekât sayıları içindir. Namaz sırasında
  kısa kadraj kayıplarında konuşulmaz; sayım kesintisi ekranda ve günlükte belirtilir.
- Geometri, kameranın gerçek genişlik/yüksekliğiyle ortak ölçeğe çevrilir.
  Günlükteki “duruş puanı” olasılık veya doğruluk yüzdesi değildir.
- Görüntü/video kaydedilmez veya gönderilmez. Saniyelik sayısal eklem ölçümleri,
  puanlar ve takip geçişleri sınırlı yerel günlükte tutulur; günlük silinebilir.
- İlk başarılı önbelleklemeden sonra uygulama/model çevrimdışı çalışır. Güncelleme
  için eski sekmeler ve ana ekran uygulaması tamamen kapatılmalıdır.

**Doğrulama sınırı:** otomatik testler gerçek kamera doğruluğunu kanıtlamaz. İlk deneme
namaz dışında iki rekâtlık hareket provası olmalı: her ikinci secdeden çıkışta tam bir
sayı duyulmalı; hazırlıkta, ilk secdede ve hareketsiz beklemede sayı duyulmamalıdır.
Sağ çapraz yerleşim, doğal tempo ve kısa örtülmeler gerçek cihazda ayrıca sınanmalıdır.

## iPhone’da denemek (Expo Go, geliştirme)

App Store veya TestFlight gerekmez.

1. iPhone’a [Expo Go](https://apps.apple.com/app/expo-go/id982107779) uygulamasını yükleyin.
2. Bilgisayarda proje klasöründe:

```bash
npm install
npx expo start
```

3. Terminalde (veya tarayıcıdaki Expo geliştirici sayfasında) QR kod görünür.
4. iPhone **Kamera** uygulamasıyla QR kodu okutun; Expo Go açılır.
5. Telefon ve bilgisayar **aynı Wi‑Fi** ağında olmalıdır.

Aynı kod tabanı daha sonra Android’de de Expo Go ile açılır (`npx expo start` → Android cihazdan QR).

QR görünmezse veya ağ sorun çıkarırsa:

```bash
npx expo start --tunnel
```

`--tunnel` biraz daha yavaştır; farklı ağlardayken işe yarar.

## Komutlar

```bash
npm install
npx expo start          # QR + geliştirici menüsü
npx expo start --ios    # simülatör (yalnızca macOS)
npx expo start --android
npx expo start --web    # tarayıcı önizleme
npm run typecheck       # tsc --noEmit
```

## Proje yapısı

```
App.tsx                 # Ekranlar arası basit yönlendirme
src/types/prayer.ts     # Namaz / adım tipleri
src/data/prayers.ts     # Farz + vitir tanımları (Hanefi)
src/data/phrases.ts     # Kısa Arapça ibareler
src/data/buildSteps.ts  # Rekât ve oturuş sırasını üretir
src/data/sanity.ts      # Rekât / oturuş bütünlük kontrolü
src/pose/               # Kamera duruş algılama (cihaz içi)
src/voice/              # Biten rekât sayısı (bir / iki / üç / dört)
src/screens/            # Ana sayfa, aktif namaz, özet
src/components/         # Kart, uyarı, ilerleme, kamera çubuğu
src/theme/colors.ts     # Koyu / açık tema
```

Namaz içeriği arayüz bileşenlerine gömülü değildir. Adımlar `buildSteps.ts` içinde, mezhep notlarıyla birlikte üretilir.

## Bu sürümde var

- Hanefi farz akışı: niyet → iftitah tekbiri → kıyam → rükû → kavme → secde → celse → secde → (kalk / ilk oturuş / son oturuş) → selam
- 3 ve 4 rekâtlı namazlarda 2. rekâttan sonra **ilk oturuş** (yalnızca tahiyyat)
- Son rekâtta **son oturuş** (tahiyyat, salavat, dua) ve selam
- 1. rekâtta Sübhaneke + Eûzü; sonraki rekâtlarda yok
- Farzın 3. ve 4. rekâtında yalnızca Fâtiha (zamm-ı sure yok)
- **Vitir** (Hanefi, vacip): 3 rekât tek namaz, ortada selam yok; 2. rekâttan sonra ilk oturuş; 3. rekâtta Fâtiha + zamm-ı sure, sonra ayakta **kunut**, sonra rükû
- Büyük **Sonraki** / **Önceki**, yazıya dokunarak ilerleme
- Namaz sırasında ekranın uyanık kalması
- Destekleyen cihazda hafif titreşim (haptic)
- İsteğe bağlı **kamera yardımcısı** (ön kamera, cihazda MediaPipe; otomatik adım)

## Bu sürümde yok

- Sunucuya görüntü yükleme / kayıt
- Sünnet, nafile, kaza
- Ezan / namaz vakti / kıble
- Sesli kıraat kaydı
- Kadınlara özel duruş şemaları (kısa not var; ayrıntı yok)
- Secde-i sehiv
- App Store / TestFlight / mağaza yayını
- Diğer mezhepler

Küçük ayrıntıda tereddüt varsa `src/data/buildSteps.ts` içindeki yorumlara bakın; uydurma dipnot veya “kaynak” eklenmedi.

## Geliştirme notu

`npx tsc --noEmit` (veya `npm run typecheck`) hatasız geçmelidir. Geliştirme modunda uygulama açılırken rekât ve oturuş noktaları `assertPrayerIntegrity` ile kontrol edilir.

## Regresyon kontrolleri

`npm test`: namaz verileri, sentetik duruşlar, altı namazın tam kamera akışı, iki saniyelik rükû, rekât seslerinin tekilleştirilmesi, omuz/görüntü kaybı ve çevrimdışı güncelleme hata senaryoları. Gerçek cihazda ışık/kadraj farklılıkları ayrıca denenmelidir.

Yeni takip motoru kontrolleri: `npm run check:tracker`. Tam diziler, ikinci secdeden
çıkış, eksik hareket, donma, kısa gürültü ve en–boy oranı değişimleri sınanır.
Eski `check:camera` öğretim adımı yardımcılarının geriye dönük kontrollerini de içerir;
aktif kamera sayımının kaynağı yeni takip motorudur.
