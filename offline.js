/* GitHub Pages alt yolunda çalışır; kayıt prepare-web-dist ile enjekte edilir. */
(function registerNamazWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () {
      /* çevrimdışı kayıt olmasa da namaz ekranı açık kalır */
    });
  });
})();
