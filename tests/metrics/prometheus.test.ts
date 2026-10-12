import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeTfrCount, formatPrometheus, liveFeedGauges, newestAgeSeconds } from '../../lib/metrics/prometheus';
import type { LiveMarker } from '../../lib/ga-live-markers/parse';

const m = (observedAt: string | null, props: LiveMarker['props'] = {}): LiveMarker => ({ lon: -84, lat: 33, observedAt, label: 'x', props });
const NOW = Date.parse('2026-10-12T12:00:00Z');

test('formatPrometheus writes HELP/TYPE, escapes labels and drops null samples', () => {
  const text = formatPrometheus([{ name: 'g', help: 'h', values: [{ labels: { layer: 'a"b' }, value: 3 }, { value: null }] }]);
  assert.equal(text, '# HELP g h\n# TYPE g gauge\ng{layer="a\\"b"} 3\n');
});

test('newestAgeSeconds uses the most recent observation and ignores missing times', () => {
  assert.equal(newestAgeSeconds([m('2026-10-12T11:59:00Z'), m(null), m('2026-10-12T11:00:00Z')], NOW), 60);
  assert.equal(newestAgeSeconds([m(null)], NOW), null);
});

test('activeTfrCount counts only restrictions whose window contains now', () => {
  const tfrs = [
    m(null, { effective: '2026-10-12T11:00:00Z', expires: '2026-10-12T13:00:00Z' }),
    m(null, { effective: '2026-10-14T13:45:00Z', expires: '2026-10-14T19:00:00Z' }),
    m(null, { effective: '2026-10-01T00:00:00Z' }),
  ];
  assert.equal(activeTfrCount(tfrs, NOW), 2);
});

test('liveFeedGauges reports failed layers as down without inventing values', () => {
  const text = formatPrometheus(liveFeedGauges([
    { layer: 'aircraft', durationMs: 120.4, body: { markers: [m('2026-10-12T11:59:50Z')], feeds: [{ error: null }] } },
    { layer: 'tfr', durationMs: 900, body: null },
  ], NOW));
  assert.match(text, /^ga_feed_up\{layer="aircraft"\} 1$/m);
  assert.match(text, /^ga_feed_up\{layer="tfr"\} 0$/m);
  assert.match(text, /^aircraft_ingest_latency_ms 120$/m);
  assert.match(text, /^ga_feed_data_age_seconds\{layer="aircraft"\} 10$/m);
  assert.doesNotMatch(text, /^faa_restriction_active_count /m);
  assert.doesNotMatch(text, /^ga_feed_markers\{layer="tfr"\}/m);
});
