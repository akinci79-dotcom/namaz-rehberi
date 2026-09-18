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
