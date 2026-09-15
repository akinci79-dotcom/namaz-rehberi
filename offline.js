/* GitHub Pages alt yolunda çalışır; kayıt prepare-web-dist ile enjekte edilir. */
(function registerNamazWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // ÖNEMLİ: eski register() çağrısı yalnızca ilk kez kayıt yapıyordu ve bir daha
  // asla güncelleme kontrolü tetiklemiyordu. Tarayıcılar SW dosyasını en fazla
  // 24 saatte bir (bazen daha da seyrek) kendiliğinden kontrol eder — aynı gün
  // içinde art arda yapılan testlerde (tam olarak bu projede olduğu gibi) yeni
  // dağıtım HİÇBİR ZAMAN fark edilmeyebilir ve kullanıcı günlerce eski sürümde
  // takılı kalabilir. Bu, "düzeltme gönderildi ama hiçbir şey değişmedi" gibi
  // görünen raporların asıl nedeni olabilir. Çözüm: her sayfa açılışında
  // updateViaCache:'none' ile kaydol (SW dosyası hiç HTTP önbelleğe girmesin) ve
  // hemen ardından update() ile ağdan zorla kontrol et; yeni bir SW devreye
  // girip bu sekmenin kontrolünü aldığında (controllerchange) sayfayı BİR KEZ
  // otomatik yenile — kullanıcı elle "sekmeyi kapat/aç" yapmak zorunda kalmasın.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) {
      return;
    }
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then(function (reg) {
        reg.update().catch(function () {
          /* ağ yoksa mevcut sürümle devam */
        });
        // Sekme namaz öncesi uzun süre açık kalmış olabilir (ör. ekran kilidi
        // sonrası tekrar bakıldığında) — görünür olduğunda da tazele.
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            reg.update().catch(function () {
              /* yoksay */
            });
          }
        });
      })
      .catch(function () {
        /* çevrimdışı kayıt olmasa da namaz ekranı açık kalır */
      });
  });
})();
