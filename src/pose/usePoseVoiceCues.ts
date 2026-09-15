import { useEffect, useRef } from 'react';

import { speakCue } from '../voice/speech';
import type { PoseAssistState } from './usePoseAssist';

/**
 * ÖNEMLİ TASARIM KURALI: namaz sırasında ses SADECE 2. secdeden sonra biten
 * rekâtın sayısını söylemeli (bkz. usePrayerVoice) — kullanıcının asıl isteği
 * budur, başka hiçbir sesli yönlendirme istenmemiştir.
 *
 * Daha önce burada iki ek sesli katman denendi ve İKİSİ DE gerçek namaz
 * testinde rahatsız edici/gereksiz bulundu:
 *  1) Her poz geçişini okuyan cue'lar ("Şimdi rükûya eğilin" vb.) — kaldırıldı.
 *  2) Çerçeveleme uyarıları ("Dizler görünmüyor, telefonu geriye çekin") —
 *     kamera artık düzgün çalıştığı için, adımlar arası bir anlık vücut
 *     kadraj dışına çıkması (ör. rükûdan hızlı kalkarken) gibi tamamen normal
 *     kısa titremelerde bile tetiklenip namaz ortasında gülünç/rahatsız edici
 *     şekilde konuşuyordu — da kaldırıldı.
 *
 * Yalnızca kamera/model TAMAMEN çalışmıyorsa (izin reddi, model yüklenemedi,
 * desteklenmiyor) — yani namaz boyunca hiç sayım yapılamayacaksa — bunu bir
 * kez sesli söylüyoruz; aksi halde kullanıcı "çalışıyor" sanıp hiç sayım
 * alamadan namazı bitirebilir.
 */
export function usePoseVoiceCues(enabled: boolean, assist: PoseAssistState): void {
  const spokenBrokenStatus = useRef(false);

  useEffect(() => {
    if (!enabled) {
      spokenBrokenStatus.current = false;
      return;
    }
    const broken =
      assist.status === 'degraded' ||
      assist.status === 'error' ||
      assist.status === 'denied' ||
      assist.status === 'unsupported';
    if (broken && !spokenBrokenStatus.current) {
      spokenBrokenStatus.current = true;
      speakCue(assist.statusText);
    }
    if (assist.status === 'running') {
      spokenBrokenStatus.current = false;
    }
  }, [enabled, assist.status, assist.statusText]);
}
