import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { etClock } from '../lib/ga-live-status';
import { GODSEYE_INTEL_LAYERS, SAMPLE_ENTITY_NOTICE } from '../lib/godseye-layers';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the 1,000-anomaly panel is left as it is', () => {
  const src = read('components/StatewideAnomalyDashboard.tsx');
  assert.ok(src.includes('LIVE NSA VERBATIM NARRATIVE VIEW'));
  assert.ok(src.includes("'LIVE STREAMING'"));
});

test('layer cards keep their original text and add a measured map-feed line', () => {
  const page = read('app/godseye-telemetry/page.tsx');
  for (const kept of ['60K+ LIVE ENTITIES', '20 PRODUCTION FEEDS LIVE', '● 24/7 STREAM', '+ Live']) assert.ok(page.includes(kept), `missing original: ${kept}`);
  assert.ok(page.includes('MEASURED ON MAP'));
  assert.ok(page.includes('MAP FEEDS LIVE'));
});

test('catalogue layers point at feed ids the map really reports', () => {
  const wired = GODSEYE_INTEL_LAYERS.flatMap((l) => l.mapFeedIds ?? []);
  assert.deepEqual(wired, ['aircraft', 'vessels', 'satellites', 'gdotcams', 'webcams', 'fires', 'quakes']);
  const markers = read('lib/ga-live-markers-layer.ts');
  const orbital = read('lib/ga-orbital-layer.ts');
  for (const id of wired) assert.ok(new RegExp(`^  ${id}: \\{`, 'm').test(markers) || orbital.includes(`id: '${id}'`), `no feed reports ${id}`);
});

test('sample entities keep their original text and add a sample notice', () => {
  const map = read('components/GodsEyeMap.tsx');
  assert.ok(map.includes('ALL SENSORS (10)'));
  assert.ok(map.includes('ACTIVE SENSOR TELEMETRY LOCK'));
  assert.equal(map.split('SAMPLE_ENTITY_NOTICE').length - 1, 3);
  assert.match(SAMPLE_ENTITY_NOTICE, /not live/);
});

test('the advisory stream keeps its labels and adds the snapshot date', () => {
  const src = read('components/PublicAdvisoryStream.tsx');
  assert.ok(src.includes('"LIVE STREAMING"'));
  assert.ok(src.includes('Advisory Stream — Continuous'));
  assert.ok(src.includes('· NOT LIVE'));
});

test('no line of the God\'s Eye files was deleted relative to the last commit', () => {
  const files = ['app/godseye-telemetry/page.tsx', 'components/GodsEyeMap.tsx', 'components/PublicAdvisoryStream.tsx', 'components/StatewideAnomalyDashboard.tsx', 'lib/godseye-layers.ts'];
  const diff = execFileSync('git', ['diff', '--numstat', 'HEAD', '--', ...files], { encoding: 'utf8' });
  for (const line of diff.trim().split('\n').filter(Boolean)) {
    const [, del, file] = line.split('\t');
    assert.ok(Number(del) <= 2, `${file} deletes ${del} lines`);
  }
});

test('feed timestamps render as Eastern clock time', () => {
  assert.equal(etClock('2026-11-24T03:42:00Z'), 'Nov 23, 10:42 PM ET');
  assert.equal(etClock('nope'), 'no timestamp');
});
