import assert from 'node:assert/strict';
import { createPrayerTracker } from '../src/pose/prayerTracker';
import { classifyPose } from '../src/pose/classifyPose';
import type { BodyPose, PoseLandmark } from '../src/pose/types';

function harness(total = 2) {
  const tracker = createPrayerTracker(total);
  let now = 0;
  const events: number[] = [];
  const feed = (pose: BodyPose, duration = 880) => {
    for (let t = 0; t < duration; t += 110) {
      now += 110;
      const result = tracker.update(pose, now);
      if (result.completedEvent !== null) events.push(result.completedEvent);
    }
    return tracker.snapshot();
  };
  return { tracker, feed, events, start: () => tracker.start(now), gap: () => { now += 4000; } };
}
for (const total of [2, 3, 4]) {
  const h = harness(total);
  h.feed('ruku'); h.feed('secde');
  assert.equal(h.tracker.snapshot().phase, 'waiting');
  h.start();
  for (let n = 1; n <= total; n++) {
    h.feed('kiyam', 11000); h.feed('ruku'); h.feed('kiyam');
    h.feed('secde', 6000);
    assert.equal(h.events.length, n - 1, 'long first prostration cannot count twice');
    h.feed('oturus'); h.feed('secde', 6000);
    assert.equal(h.events.length, n - 1, 'count waits for exit, not entry');
    h.feed('oturus');
    assert.deepEqual(h.events, Array.from({ length: n }, (_, i) => i + 1));
  }
  h.feed('kiyam'); h.feed('secde'); h.feed('oturus');
  assert.equal(h.tracker.snapshot().phase, 'complete');
  assert.equal(h.events.length, total);
}
{
  const h = harness(); h.start(); h.feed('ruku'); h.feed('kiyam');
  h.feed('secde'); h.feed('oturus'); h.feed('secde'); h.feed('kiyam');
  assert.deepEqual(h.events, [1]);
  assert.equal(h.tracker.snapshot().phase, 'kiyam');
}
for (const fault of ['missing', 'frozen', 'hidden', 'order'] as const) {
  const h = harness(); h.start(); h.feed('ruku'); h.feed('kiyam'); h.feed('secde');
  if (fault === 'missing') h.feed('unknown', 3000);
  if (fault === 'frozen') h.gap();
  if (fault === 'hidden') h.tracker.suspend('hidden');
  if (fault === 'order') h.feed('kiyam', 1800);
  h.feed('oturus'); h.feed('secde'); h.feed('oturus');
  assert.equal(h.tracker.snapshot().uncertain, true, fault);
  assert.deepEqual(h.events, [], fault + ' must never manufacture a count');
}
{
  const h = harness(); h.start(); h.feed('ruku', 330); h.feed('unknown', 220);
  h.feed('ruku', 880);
  assert.equal(h.tracker.snapshot().phase, 'ruku', 'brief missing frames are tolerated');
  h.feed('secde', 220); h.feed('ruku');
  assert.equal(h.tracker.snapshot().uncertain, false, 'brief contradictory noise is tolerated');
}
// The same physical coordinates embedded in differently shaped images must agree.
const body: PoseLandmark[] = Array.from({length: 33}, () => ({x: .5, y: .5, visibility: 0}));
for (const [i,x,y] of [[0,.5,.12],[11,.38,.22],[12,.62,.22],[23,.44,.48],[24,.56,.48],
  [25,.44,.7],[26,.56,.7],[27,.44,.92],[28,.56,.92]]) body[i] = {x, y, visibility: .95};
for (const bent of [false, true]) {
  const sample = body.map(p => ({...p}));
  if (bent) { sample[11].y = .46; sample[12].y = .46; sample[0].y = .4; }
  const results = [1, 16/9, 9/16].map(ratio => {
    const points = sample.map(p => ({...p, x: .25 + p.x * .5, y: p.y * .5 / ratio}));
    return classifyPose(points, undefined, {width: 1000, height: ratio * 1000});
  });
  assert.equal(results[0].pose, bent ? 'ruku' : 'kiyam');
  for (const result of results) {
    assert.equal(result.pose, results[0].pose);
    assert.ok(Math.abs(result.confidence - results[0].confidence) < 1e-8);
  }
}
body[11].x = NaN;
assert.equal(classifyPose(body).pose, 'unknown', 'invalid geometry cannot count');
console.log('OK independent tracker: full cycles, exit timing, gaps, noise, sequence loss, aspect ratios');

import { trackerStepIndex } from '../src/pose/trackerPresentation';
import { getPrayerSteps, PRAYERS } from '../src/data';
for (const prayer of PRAYERS) {
  const steps = getPrayerSteps(prayer.id);
  const h = harness(prayer.rakahCount); h.start();
  for (let n = 1; n <= prayer.rakahCount; n++) {
    for (const pose of ['kiyam','ruku','kiyam','secde','oturus','secde','oturus'] as const) {
      const state = h.feed(pose);
      const index = trackerStepIndex(steps, state);
      assert.ok(index >= 0, `${prayer.id}: display projection for ${state.phase}`);
      assert.equal(steps[index].rakah, state.phase === 'between' || state.phase === 'complete' ? n : state.rakah);
    }
  }
  assert.deepEqual(h.events, Array.from({length: prayer.rakahCount}, (_, i) => i + 1));
}
console.log('OK tracker → teaching display for all six prayers');
