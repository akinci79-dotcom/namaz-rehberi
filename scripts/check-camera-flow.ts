/// <reference types="node" />
import assert from 'node:assert/strict';
import { getPrayerSteps, PRAYERS } from '../src/data';
import { createCameraProgress } from '../src/pose/cameraProgress';
import { cameraStepTitle } from '../src/pose/cameraAdvance';
import { classifyPose } from '../src/pose/classifyPose';
import { completedRakahAnnouncements } from '../src/voice/rakahComplete';
import type { BodyPose } from '../src/pose/types';

// Modelin çıktısından başlayan tam namazlar, kancanın kullandığı gerçek durum makinesini sınar.
for (const prayer of PRAYERS) {
  const steps = getPrayerSteps(prayer.id);
  const progress = createCameraProgress(steps);
  let index = 0;
  let now = 0;
  const announced = new Set<number>();
  const words: string[] = [];
  const pose = (detected: BodyPose, duration = 1100) => {
    for (let elapsed = 0; elapsed < duration; elapsed += 110) {
      now += 110;
      const result = progress.update(index, detected, now, true);
      if (result.advance) {
        assert.notEqual(result.targetIndex, null);
        const target = result.targetIndex!;
        for (const cue of completedRakahAnnouncements(steps, index, target, announced)) {
          assert.equal(detected, 'secde', 'rekât sesi ancak doğrulanan ikinci secdede');
          announced.add(cue.rakah);
          words.push(cue.word);
        }
        index = target;
      }
    }
  };
  pose('kiyam', 5000);
  assert.equal(index, 0, 'ayakta beklemek niyeti süreyle geçirmemeli');
  for (let rakah = 1; rakah <= prayer.rakahCount; rakah++) {
    if (rakah > 1) pose('kiyam', 1500);
    if (prayer.id === 'vitir' && rakah === 3) {
      assert.equal(cameraStepTitle(steps, index), 'Kıyam ve kunut');
      assert.equal(steps[index].kind, 'kiyam', 'kunut rükûdan önce görünmeli');
    }
    pose('ruku', 2000);
    assert.equal(steps[index].kind, 'ruku');
    pose('kiyam');
    assert.equal(steps[index].kind, 'kavme', 'iki saniyelik rükûda takılmamalı');
    pose('secde');
    assert.equal(steps[index].kind, 'celse');
    assert.equal(words.length, rakah - 1, 'birinci secde sayılmaz');
    pose('secde', 2500);
    assert.equal(words.length, rakah - 1, 'aynı secdede durmak ikinci secde değildir');
    pose('oturus');
    assert.equal(steps[index].kind, 'secde2');
    assert.equal(words.length, rakah - 1, 'oturuşta rekât sayılmaz');
    pose('secde');
    assert.equal(words.length, rakah);
    pose('secde', 2500);
    assert.equal(words.length, rakah, 'aynı rekât tekrar seslenmez');
    if (steps[index].kind === 'tahiyyat') pose('oturus', 2000);
  }
  assert.equal(steps[index].kind, 'tahiyyat');
  assert.deepEqual([...announced], Array.from({ length: prayer.rakahCount }, (_, i) => i + 1));
  console.log(`OK ${prayer.id}: tam kamera akışı, ${words.join(', ')}`);
}

// Ayakta duruşun omuzları örtülünce sahte rükû üretilemez.
const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0 }));
for (const [id, x, y] of [[0,.5,.12],[11,.38,.22],[12,.62,.22],[23,.44,.48],
  [24,.56,.48],[25,.44,.7],[26,.56,.7],[27,.44,.92],[28,.56,.92]]) {
  points[id] = { x, y, visibility: .9 };
}
assert.equal(classifyPose(points).pose, 'kiyam');
points[11].visibility = 0;
points[12].visibility = 0;
assert.equal(classifyPose(points, 'kiyam').pose, 'unknown');
assert.equal(classifyPose(points, 'ruku').pose, 'unknown');

// Uzun örnek aralığı veya algı kaybı eski 440ms birikimi tamamlayamaz.
for (const missing of [false, true]) {
  const steps = getPrayerSteps('sabah');
  const index = steps.findIndex(s => s.kind === 'secde2');
  const progress = createCameraProgress(steps);
  for (let t = 0; t <= 440; t += 110) assert.equal(progress.update(index, 'secde', t, true).advance, false);
  if (missing) for (let t = 550; t <= 1870; t += 110) progress.update(index, 'unknown', t, true);
  assert.equal(progress.update(index, 'secde', 2000, true).advance, false);
  assert.equal(progress.update(index, 'secde', 2110, true).advance, false);
}
console.log('OK omuz kaybı, görüntü donması ve uzun algı kesintisi');

// Kullanıcının hazırlık hareketleri, tek el kaldırma ve kadraj kaybı başlangıç değildir.
import { createTakbirStart, acceptedCameraPose } from '../src/pose/takbirStart';
const full = points.map(p => ({ ...p, visibility: .95 }));
full[11] = { x: .38, y: .22, visibility: .95 };
full[12] = { x: .62, y: .22, visibility: .95 };
full[7] = { x: .44, y: .13, visibility: .95 };
full[8] = { x: .56, y: .13, visibility: .95 };
full[15] = { x: .39, y: .6, visibility: .95 };
full[16] = { x: .61, y: .6, visibility: .95 };
const raised = full.map(p => ({ ...p }));
raised[15].y = .13;
raised[16].y = .13;
const oneHand = raised.map(p => ({ ...p }));
oneHand[16].y = .6;
const hiddenHand = raised.map(p => ({ ...p }));
hiddenHand[16].visibility = .1;
const standingGuess = { pose: 'kiyam' as const, confidence: .9, framing: 'ok' as const };
for (const invalid of [oneHand, hiddenHand]) {
  const start = createTakbirStart();
  for (let t = 0; t < 550; t += 110) start.update(full, standingGuess, t);
  for (let t = 550; t < 1100; t += 110) assert.notEqual(start.update(invalid, standingGuess, t), 'started');
  for (let t = 1100; t < 2200; t += 110) assert.notEqual(start.update(full, standingGuess, t), 'started');
}
const start = createTakbirStart();
for (let t = 0; t < 1100; t += 110) assert.equal(start.update(raised, standingGuess, t), 'waiting', 'öncesinde ayakta eller aşağı görülmeli');
for (let t = 1100; t < 1650; t += 110) start.update(full, standingGuess, t);
for (let t = 1650; t < 2200; t += 110) assert.notEqual(start.update(raised, standingGuess, t), 'started');
let phase = '';
for (let t = 2200; t < 2750; t += 110) phase = start.update(full, standingGuess, t);
assert.equal(phase, 'started');
start.resetPending();
assert.equal(start.update(undefined, { pose: 'unknown', confidence: 0, framing: 'none' }, 9999), 'started', 'namaz içinde kayıp/sekme dönüşü tekbiri yeniden başlatmaz');
for (const framing of ['none', 'partial', 'close'] as const) {
  assert.equal(acceptedCameraPose({ pose: 'ruku', confidence: 1, framing }), 'unknown');
}
assert.equal(acceptedCameraPose({ pose: 'ruku', confidence: 0, framing: 'ok' }), 'unknown');
assert.equal(acceptedCameraPose({ pose: 'ruku', confidence: NaN, framing: 'ok' }), 'unknown');
// Tam görünür ama üst üste çökmüş eklemlerden sıfır güvenli eski poz üretilemez.
const collapsed = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
for (const previous of ['kiyam', 'ruku', 'secde', 'oturus'] as const) {
  const guess = classifyPose(collapsed, previous);
  assert.ok(guess.pose === 'unknown' || guess.confidence >= .3);
}
// Eğilmiş üst gövde, bacaklar kayıpsa rükûya dönüştürülemez.
const cropped = full.map(p => ({ ...p }));
cropped[11].y = cropped[12].y = .46;
for (const id of [25,26,27,28]) cropped[id].visibility = 0;
assert.equal(classifyPose(cropped, 'ruku').pose, 'unknown');
console.log('OK tekbir sırası, tek el/örtülme, başlangıç kilidi, eksik kadraj ve güven tabanı');
