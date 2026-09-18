/* Yeni sürüm mevcut namazı kesmez; tüm eski sekmeler kapandığında etkinleşir. */
(function registerNamazWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then(function (reg) {
        reg.update().catch(function () {});
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') reg.update().catch(function () {});
        });
      })
      .catch(function () { /* Ağ yokken mevcut uygulama çalışmaya devam eder. */ });
  });
})();
