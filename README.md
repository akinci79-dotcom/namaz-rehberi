# Namaz Rehberi (Hanefi · Farz ve Vitir)

Telefonu veya tableti namazın önüne koyup, hangi rekâtta olduğunu ve sıradaki hareketi büyük yazıyla takip etmek için kişisel bir Expo uygulaması.

**Hanefi** mezhebine göre:

- Farz: Sabah (2), Öğle (4), İkindi (4), Akşam (3), Yatsı (4)
- Vacip: Vitir (3 rekât, tek selam; 3. rekâtta rükûdan önce kunut)

Bu bir kişisel yardımcıdır; yaygın öğretilen Hanefi uygulamaya dayanır. Güvenilir bir âlime danışarak teyit ediniz. **Fetva değildir.**

## iPad / iPhone’da hemen açmak (Safari)

Bilgisayar veya Expo Go gerekmez. Safari’de şu adresi açın:

**https://akinci79-dotcom.github.io/namaz-rehberi/**

İsteğe bağlı: Safari’de **Paylaş → Ana Ekrana Ekle**. Uygulama gibi tam ekran açılır (adres çubuğu gizlenir).

Kaynak: `npx expo export -p web` çıktısı GitHub Pages’te yayınlanır. Güncellemek için:

```bash
npm run export:web
```

Ardından `dist/` içeriğini Pages sitesine kopyalayın.

### Kamera yardımcısı (iPad / iPhone Safari)

Namaz ekranında **Kamera yardımcısı**nı açın. Ön kamera duruşu tanır (kıyam, rükû, secde, oturuş).

- **Kamera açıkken süre yok.** Adım yalnızca (1) sonraki duruş ~0,85 sn tutulunca veya (2) Sonraki / Önceki ile geçer. Aynı duruştaki metinler (niyet → tekbir → kıyam) için **Sonraki** gerekir.
- **Kamerasız:** “Süre ile prova (kamerasız)” — eski süreyle ilerleme.
- Canlı önizleme ekranın yaklaşık yarısı (ayna ön kamera); baş-omuz-bel kadrajı görünsün. Durum: “Bekleniyor: rükû”, “Algı: kıyam”, “2. secde görüldü — rekat sayılacak”. Saat sayacı yok.
- **Ses:** yalnızca adım **`secde2` → `kalkış` veya `tahiyyat`** (ilk/son oturuş) geçişinde, biten rekâtın sayısı bir kez (1 **bir**, 2 **iki**, 3 **üç**, 4 **dört**). Rükûdan kalkış (kavme), 1. secdeden celse, secdeye giriş veya duruş titremesi konuşturmaz. **Ses kapalı** düğmesi vardır.
- İlk yüklemeden sonra kabuk + duruş modeli servis çalışanıyla önbelleğe alınır; namaz ortasında Wi‑Fi kopsa ekran boşalmamalıdır. Bitiş ekranı **Namaz bitti** yereldedir.
- % sayacı yoktur; durum metni ne beklendiğini söyler (ör. “Şimdi rükûya eğilin”).
- Görüntü **yalnızca cihazda** işlenir; kareler yüklenmez ve kaydedilmez.
- Kamera için **HTTPS** gerekir; bu Pages adresi zaten HTTPS.
- Safari’de ilk seferde kameraya izin verin. Reddedilirse Ayarlar → Safari → Kamera.
- Telefonu/tableti **uzaklaştırın** — yalnızca yüz kadrajı duruşu bozar; baş-omuz-bel (mümkünse ayak) görünsün.
- Sonraki / Önceki her zaman yedektir.

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
